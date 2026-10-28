# 03 · Concurrencia, control de cupos y lista de espera

**Producto:** Mis Eventos  
**Estado:** diseño propuesto y criterios de validación del MVP  
**Fecha:** 2026-10-27

## 1. Problema a resolver

Un evento tiene capacidad máxima de **5.000** asistentes y **4.999** inscripciones confirmadas. **1.000 usuarios distintos** intentan inscribirse casi al mismo tiempo. Una validación ingenua (`contar inscritos → comprobar cupo → insertar`) permite que varias solicitudes lean simultáneamente el mismo cupo restante y terminen confirmadas.

**Resultado obligatorio cuando las 1.000 solicitudes se procesan exitosamente:** **1** confirmada nueva; **999** en lista de espera; **5.000** confirmadas totales y **ningún sobrecupo**. Si alguna petición falla por saturación, no se supone inscrita: el cliente puede reintentar de manera idempotente y consultar su estado.

### Invariantes

1. `confirmed_count(event) <= event.capacity` después de **cada commit**.
2. Cada `(event_id, user_id)` tiene **una sola inscripción lógica**.
3. Cuando se libera o aumenta un cupo, la lista de espera activa tiene prioridad sobre cualquier inscripción nueva.
4. Las promociones se realizan en orden determinista `waitlist_order`, un secuenciador por evento asignado bajo el lock (FIFO **según orden de entrada registrado**, no necesariamente según el instante en que el cliente pulsó el botón; ver docs/04 §3.3).
5. Las operaciones concurrentes de inscripción, cancelación, promoción y modificación de aforo usan **la misma disciplina transaccional**.
6. Ninguna respuesta `CONFIRMED` se devuelve antes del `COMMIT` exitoso.

## 2. Riesgo de condición de carrera

**Implementación incorrecta:**

```text
Solicitud A: SELECT COUNT(confirmados) → 4999
Solicitud B: SELECT COUNT(confirmados) → 4999
Solicitud A: 4999 < 5000 → INSERT CONFIRMED
Solicitud B: 4999 < 5000 → INSERT CONFIRMED
Resultado → 5001 confirmados (incorrecto)
```

La validación Pydantic, un `if` de Python o una caché de cupos no pueden resolver por sí solos este problema: ninguna de esas alternativas sincroniza múltiples procesos, instancias ni contenedores de la API.

## 3. Solución MVP: PostgreSQL como árbitro transaccional

Emplear transacciones PostgreSQL con aislamiento **READ COMMITTED** y un **bloqueo de la fila del evento** mediante `SELECT ... FOR UPDATE` como punto único de serialización por evento.

**Orden obligatorio para toda operación que altere aforo o inscripciones:**

1. Abrir transacción de BD.
2. Bloquear `events.id = :event_id` con `FOR UPDATE` **antes de leer cupos**.
3. Validar estado del evento, permisos y situación previa del usuario.
4. Calcular ocupación desde inscripciones `CONFIRMED` y verificar si existe cola pendiente.
5. Dar prioridad a los usuarios `WAITLISTED` (si aparecen plazas libres), o registrar al solicitante como `CONFIRMED`/`WAITLISTED` según aforo y precedencia.
6. Insertar/actualizar inscripciones e historial de cambios, dentro de la misma transacción.
7. Hacer `COMMIT`; solo entonces comunicar el resultado.

La siguiente transacción concurrente sobre el **mismo evento** espera hasta que se libera el bloqueo; al continuar, ejecuta su consulta de ocupación en una **nueva sentencia** y ve los commits previos bajo READ COMMITTED. Otros eventos no se bloquean entre sí por este mecanismo.

> Importante: no es suficiente bloquear al leer si otra ruta puede crear inscripciones sin el mismo bloqueo. Todas las entradas al dominio (`register`, `cancel`, `increase_capacity`, `decrease_capacity`, `promote_waitlist` y tareas administrativas) deben respetar el contrato. No mantener el bloqueo durante llamadas HTTP externas, envío de correo ni trabajo intensivo.

### SQL conceptual

```sql
BEGIN;

SELECT id, capacity, status
FROM events
WHERE id = :event_id
FOR UPDATE;

-- Ejecutar DESPUÉS de adquirir el lock, en otra sentencia:
SELECT COUNT(*)
FROM event_registrations
WHERE event_id = :event_id
  AND status = 'CONFIRMED';

-- Consultar inscripción previa y cola, aplicar las reglas;
-- insertar o modificar a CONFIRMED/WAITLISTED.

COMMIT;
```

> Un `SELECT COUNT(*)` no puede bloquear futuras inserciones por sí solo. El candado es la **fila del evento**, que actúa como recurso compartido por todos los escritores.

## 4. Modelo de datos y garantías adicionales

- `events`: `capacity > 0`, `status`, `owner_id`. La capacidad no se reduce por debajo de las confirmaciones existentes.
- `event_registrations`: `event_id`, `user_id`, `status`, `waitlist_order`, `requested_at`, `waitlisted_at`, `confirmed_at`, `cancelled_at`, identificador único.
- Restricción `UNIQUE (event_id, user_id)` para prevenir dobles inscripciones, incluidos reintentos concurrentes y reactivaciones después de una cancelación.
- Índice para consultas de ocupación: `(event_id, status)`.
- Índice para cola FIFO: `UNIQUE (event_id, waitlist_order) WHERE status = 'WAITLISTED'`.
- Fechas UTC en la BD. La antigüedad de cola se **asigna o renueva dentro de la transacción**, al inscribir/reactivar en espera.
- Historial de estados recomendado para auditoría.

El diseño funcional actual **calcula el número de confirmados a partir de inscripciones** en lugar de almacenar un contador duplicado. Esto simplifica las invariantes. Si la prueba de carga demuestra que los conteos sobre un evento muy solicitado son un cuello de botella, podremos considerar un contador de ocupación mantenido de manera **atómica y transaccional**, con reconciliación y pruebas; esto añade complejidad y no debe introducirse sin medición. La API y la lógica de negocio deben depender de una abstracción de persistencia que permita optimizar sin cambiar los contratos HTTP.

## 5. Lista de espera y liberación de cupos

**Inscripción sin capacidad:** registrar `WAITLISTED` en vez de devolver un rechazo permanente, siempre que el evento admita solicitudes. La respuesta indica explícitamente que **no existe un cupo garantizado**.

**Cancelación / aumento de capacidad:** dentro de una sola transacción, bloquear el evento, cambiar estado o aforo, calcular los lugares libres y promover en orden `waitlist_order`. No entregar plazas a nuevos solicitantes si existen candidatos anteriores.

**Reintentos del mismo usuario:** devolver el estado de su inscripción existente sin insertar una segunda. Si estaba `CANCELLED` y vuelve a inscribirse, se considera **una solicitud nueva** a efectos de prioridad en la cola.

**Limitación de FIFO:** el orden que controla el backend es el orden en que las solicitudes **consiguen el bloqueo y quedan registradas**, que puede diferir del orden en que distintos usuarios presionaron “Inscribirme”. Si el producto exige un orden estrictamente definido por llegada a un gateway bajo picos muy grandes, habría que emitir tickets/secuenciar las solicitudes antes de la transacción; no es una garantía del MVP.

## 6. Capacidad operativa: 1.000 solicitudes no implican 1.000 conexiones

El bloqueo garantiza **corrección**, no garantiza que el servidor pueda responder instantáneamente a 1.000 solicitudes. Evitar intentar abrir una conexión de PostgreSQL por cada petición concurrente.

- Mantener pool de conexiones limitado y timeouts definidos; no mantener sesiones abiertas durante trabajo que no requiere BD.
- Usar límites de concurrencia/admisión, rate limiting por identidad y protección antiabuso. Responder de forma explícita ante saturación (`429` o `503` con indicación de reintento, según la causa).
- Los clientes pueden reintentar; la inscripción debe ser idempotente a nivel de dominio.
- Medir espera por locks, espera por conexión, tasa de errores, latencias p95/p99, throughput, ocupación y longitud de cola.
- Evitar consultas costosas y cálculos de posición de 999 usuarios en el camino transaccional caliente. Calcular posición cuando se consulte.
- No introducir Redis como sistema alternativo de verdad ni locks distribuidos para el MVP: los mecanismos correctos ya están en PostgreSQL.

Si observamos **picos sostenidos** que saturan un mismo evento, evaluar una cola de trabajo duradera con partición por `event_id` y workers que procesen las solicitudes en serie. En tal arquitectura la API podría devolver `202 PENDING` y resolver el estado de manera asíncrona. Esta es una posible evolución operativa, **no un requisito del MVP**.

## 7. Pruebas obligatorias de concurrencia

Las pruebas que afirman propiedades de bloqueo **deben ejecutarse contra PostgreSQL real**, no SQLite in-memory. Cada solicitud paralela abre su **propia Session/transaction**. No compartir objetos Session entre hilos. Para pruebas de integración se recomienda `pytest` con una instancia PostgreSQL aislada en Docker Compose o Testcontainers.

| ID | Escenario | Resultado obligatorio |
|---|---|---|
| C-01 | Capacidad 5.000, confirmados 4.999, 1.000 usuarios distintos llegan a la vez | Tras procesar las 1.000 con éxito: 1 nuevo `CONFIRMED`, 999 `WAITLISTED`, total confirmados 5.000 |
| C-02 | Un usuario envía 20 solicitudes simultáneas | Existe una sola inscripción lógica `(event_id, user_id)` |
| C-03 | Cancelación y dos nuevos registros simultáneos, con lista en espera | El primer `WAITLISTED` elegible obtiene el cupo; ninguno de los nuevos se adelanta |
| C-04 | Aumento de aforo de 5.000 a 5.010 con 100 en espera | Se promueven exactamente 10, en orden FIFO |
| C-05 | Dos administradores intentan reducir aforo mientras hay nuevos inscritos | Nunca se acepta capacidad menor que confirmaciones |
| C-06 | Fallo antes de COMMIT | No queda inscripción parcialmente confirmada y se libera el bloqueo al hacer ROLLBACK |
| C-07 | 100 inscripciones a dos eventos distintos | Sin bloqueo global entre eventos; se respetan capacidades independientes |
| C-08 | Reintentos tras timeout o reconexión | Se retorna el estado persistido sin duplicar ni perder la reserva |
| C-09 | Intercalaciones repetidas con varias instancias de la API | Se mantienen todas las invariantes; no depende de un `threading.Lock` local |

Para las pruebas de corrección es suficiente una oleada simultánea moderada (por ejemplo, 20–100 hilos/solicitudes) repetida varias veces. Para el caso de **1.000 usuarios virtuales**, utilizar además pruebas HTTP de carga (k6 o Locust), observar límites de infraestructura y verificar después los resultados reales en PostgreSQL; si hubo `429/503`, contar únicamente las operaciones completadas y reintentar idempotentemente antes de exigir un total de 1.000 estados persistidos.

### Ejemplo de prueba de integración (esquema)

```python
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier


def test_last_seat_is_never_oversold(event_with_4999_confirmed, users):
    # Fixture: evento con capacity=5000, 4999 CONFIRMED.
    # Cada llamada usa una transacción/Session independiente de PostgreSQL.
    event_id = event_with_4999_confirmed.id
    group = users[:50]
    barrier = Barrier(len(group))

    def attempt(user):
        barrier.wait()
        return register_for_event(event_id=event_id, user_id=user.id)

    with ThreadPoolExecutor(max_workers=len(group)) as executor:
        statuses = list(executor.map(attempt, group))

    assert statuses.count("CONFIRMED") == 1
    assert statuses.count("WAITLISTED") == 49
    assert count_confirmed(event_id) == 5000
    assert count_waitlisted(event_id) == 49
```

Los nombres `register_for_event`, `count_confirmed`, `count_waitlisted` y las fixtures representan las implementaciones futuras del proyecto; **este fragmento es un contrato de prueba, no código ejecutable aislado**.

### Observabilidad / criterios de aceptación

- Invariante de negocio: **0 sobrecupos**, **0 duplicados**, **0 saltos de lista atribuibles a las reglas** en todas las pruebas.
- Registrar fallos `40001` (serialización), `40P01` (deadlock), timeouts y saturación de pools; reintentar transacciones completas solamente para fallos transitorios seguros, con límite y backoff.
- Definir objetivos de rendimiento (p95, throughput, error rate) **después** de medir el Dev Container/CI y un entorno de staging con recursos comparables a producción. No prometer que 1.000 solicitudes terminen todas en el mismo instante.

## 8. Decisión recomendada

Para el MVP, adoptar **bloqueo transaccional de fila de evento en PostgreSQL + índice de inscripciones + unicidad usuario/evento + lista de espera FIFO + pruebas de concurrencia y carga**. El candado está en PostgreSQL, por lo que sigue funcionando aunque haya múltiples workers o contenedores FastAPI. Evaluar contador atómico o cola duradera **solo a partir de evidencia de carga**.

## Referencias

- [PostgreSQL: Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html).
- [PostgreSQL: Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html).
- [PostgreSQL: Unique Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html).
