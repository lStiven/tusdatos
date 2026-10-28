# 01 · Problema, solución y alcance del MVP

**Producto:** Mis Eventos  
**Tipo:** Sistema de gestión de eventos, sesiones y asistentes (API REST)  
**Estado:** especificación funcional inicial  
**Fecha:** 2026-10-27

## 1. Resumen ejecutivo

La empresa **Mis Eventos** administra eventos de forma tradicional y manual. Los registros de personas, los horarios, los ponentes y la disponibilidad de recursos se encuentran dispersos, lo que ocasiona errores de aforo, trabajo repetitivo, dificultades para obtener indicadores y una experiencia de inscripción deficiente.

La solución consiste en una **plataforma centralizada** que gestione usuarios y permisos, eventos, sesiones/charlas, salas, inscripciones confirmadas, listas de espera y expresiones de interés por sesiones. La aplicación aplicará reglas verificables para proteger los cupos y evitar conflictos de programación, y ofrecerá datos consistentes mediante una API REST.

### Objetivos del producto

1. Garantizar que nunca se confirmen más asistentes que la capacidad de un evento.
2. Permitir una inscripción autónoma y transparente, con lista de espera ordenada.
3. Restringir la modificación de eventos y sus charlas a organizadores propietarios y administradores.
4. Coordinar sesiones simultáneas sin conflictos de sala ni de ponente.
5. Recopilar interés por las charlas para estimar demanda, **sin confundirlo con una reserva de asiento**.
6. Producir información útil de ocupación, demanda y estado de las inscripciones.

## 2. Problemas identificados y solución

| Problema actual | Impacto | Solución del MVP | Indicador posible |
|---|---|---|---|
| Información fragmentada | Versiones contradictorias de eventos, horarios e inscritos | Base de datos PostgreSQL y API centralizada | Eventos con información completa |
| Registro manual | Errores, duplicados y demora | Inscripción automática con controles transaccionales | Tiempo de inscripción y duplicados rechazados |
| Sobreventa de cupos | Asistentes confirmados por encima del aforo | Capacidad máxima y lista de espera FIFO | Eventos con sobrecupo confirmado: 0 |
| Programación de salas manual | Salas y ponentes asignados a la vez | Validación de solapamientos y capacidades | Conflictos aceptados: 0 |
| Permisos poco claros | Ediciones no autorizadas | Roles y verificación del propietario | Modificaciones no autorizadas: 0 |
| Falta de datos | Decisiones sin evidencia | Estadísticas básicas de eventos y charlas | Ocupación y demanda visibles |
| Experiencia confusa | Usuarios desconocen su estado | Consulta de eventos, mis inscripciones y posición en espera | Estado de inscripción consultable |

## 3. Actores y autorización

| Rol | Consultar eventos publicados | Inscribirse a eventos | Marcar interés en charlas | Crear eventos | Modificar eventos/charlas | Administrar roles y espacios |
|---|---|---|---|---|---|---|
| **Asistente** (`ATTENDEE`) | Sí | Sí | Sí, si tiene cupo confirmado | No | No | No |
| **Organizador** (`ORGANIZER`) | Sí | Sí | Sí | Sí | Solo en eventos de su propiedad | No; puede seleccionar salas disponibles |
| **Administrador** (`ADMIN`) | Sí | Sí | Sí | Sí | Cualquier evento y charla | Sí |

**Decisiones de seguridad:**

- Una nueva cuenta recibe el rol `ATTENDEE`; nunca puede asignarse a sí misma `ORGANIZER` o `ADMIN`.
- Solo un administrador puede elevar privilegios.
- Un administrador concede o retira `ORGANIZER` y `ADMIN` (`PUT`/`DELETE /users/{id}/roles/{rol}`, idempotentes, con `assigned_by`). `ATTENDEE` es de toda cuenta y no se retira. Siempre queda al menos un `ADMIN` activo; la retirada bloquea la fila del rol `ADMIN` para que dos retiradas simultáneas no dejen el sistema sin administradores.
- Modificar un evento exige ser administrador o ser su propietario **con** rol `ORGANIZER`: quien pierde el rol conserva la propiedad y la visibilidad de sus borradores, pero solo un administrador puede cambiarlos.
- El evento registra un `owner_id` (creador/propietario). La autorización comprueba rol **y** propiedad en todas las operaciones protegidas.
- La autorización también aplica a las sesiones: el organizador solo puede modificar charlas del evento que posee.
- Administrar salas compartidas y asignar roles es responsabilidad del administrador, para evitar que un organizador bloquee o altere recursos de otro.
- Un evento `DRAFT` solo es visible para su propietario y los administradores; los demás estados (`PUBLISHED`, `CANCELLED`, `COMPLETED`) los consulta cualquier usuario autenticado, para que un inscrito vea que su evento se canceló. Un borrador ajeno responde 404, no 403, para no revelar que existe.
- Los ponentes no tienen propietario y se comparten entre eventos: cualquier `ORGANIZER` o `ADMIN` puede darlos de alta, editarlos o borrarlos (solo si nunca se asignaron), porque el organizador los necesita para programar sus charlas.
- Un organizador puede asistir como participante en otros eventos; los permisos no impiden la inscripción propia.
- Se contemplará un modelo de roles extensible (por ejemplo, usuario y asignaciones de rol) para no depender de un booleano `is_admin`.

## 4. Alcance del MVP

### Incluido (funcionalidades prioritarias)

| ID | Funcionalidad | Criterio principal |
|---|---|---|
| RF-01 | Registro, login y autenticación | Correo único, credenciales verificadas, API protegida mediante token |
| RF-02 | Gestión de usuarios y roles | Nuevo usuario asistente; promoción de roles solo por administrador |
| RF-03 | CRUD de eventos | Organizador propio / administrador global; validaciones de fechas y aforo |
| RF-04 | Búsqueda y consulta de eventos | Búsqueda parcial por nombre, filtros de estado y paginación |
| RF-05 | Estados del evento | `DRAFT`, `PUBLISHED`, `CANCELLED`, `COMPLETED`; transiciones válidas |
| RF-06 | Inscripción al evento | Inscripción confirmada si hay cupo y evento admite registros |
| RF-07 | Lista de espera | Si no hay cupo, solicitud `WAITLISTED`, con orden verificable |
| RF-08 | Promoción desde lista de espera | Liberar/aumentar cupos promociona a los primeros elegibles en una transacción |
| RF-09 | Cancelación de inscripción | Un participante puede cancelar y liberar un cupo confirmado |
| RF-10 | Mis eventos e inscripciones | Consulta de confirmadas, en espera y canceladas por su propietario |
| RF-11 | Gestión de sedes y salas | Capacidad positiva, pertenencia a sede, disponibilidad consultable |
| RF-12 | Gestión de charlas/sesiones | Alta, edición y cancelación; horarios dentro del evento |
| RF-13 | Asignación de ponentes | Ponentes independientes de las cuentas; admite múltiples ponentes por charla |
| RF-14 | Conflictos de programación | No aceptar solapamiento de una misma sala o un mismo ponente |
| RF-15 | Interés por charlas | Participante confirmado puede indicar o retirar interés en cualquier charla del evento |
| RF-16 | Estimaciones y métricas | Aforo confirmado del evento, tamaño de espera e interés de cada charla |
| RF-17 | Calidad de API | Swagger/OpenAPI, migraciones Alembic y tests pytest |

### Fuera del MVP (no bloquearán la estructura futura)

Venta de entradas y pagos, check-in físico con QR, correo de notificación garantizado, selección de asiento, reserva firme de cupos en charlas, facturación, marketing, aplicación web y métricas avanzadas. Se modelarán las entidades de forma que esos componentes puedan incorporarse después.

## 5. Conceptos del dominio

### Evento (`Event`)

- Tiene propietario, nombre, descripción, intervalo temporal, estado y capacidad máxima.
- Puede organizarse en una sede (`Venue`) y contener varias charlas (`Session`).
- La **capacidad del evento** es el número máximo de inscripciones confirmadas, independientemente de cuántas charlas existan.
- La cantidad confirmada se obtiene de las inscripciones vigentes; evitar contadores redundantes reduce inconsistencias.

### Inscripción a evento (`EventRegistration`)

- Relaciona un usuario y un evento.
- Estados: `CONFIRMED` (cupo garantizado), `WAITLISTED` (sin cupo) y `CANCELLED` (registro sin cupo activo).
- Existe **una sola inscripción lógica por pareja usuario/evento**, con restricción única en BD. Reinscribirse después de cancelar reutiliza o reactiva esa relación conforme a un flujo controlado y genera una nueva antigüedad en espera.
- Se conservan marcas temporales como `requested_at`, `confirmed_at` y `cancelled_at`; un historial/auditoría permitirá reconstruir transiciones.

### Lista de espera

- No es otro tipo de evento ni concede acceso.
- Es el conjunto de registros `WAITLISTED`, ordenados de manera determinista por `waitlist_order`, un secuenciador por evento asignado bajo bloqueo: **FIFO**.
- Si se libera o incrementa el aforo, el sistema promueve primero a quienes ya esperan; una solicitud nueva no puede saltarse la cola.
- La propuesta del MVP es **promoción automática**; se marca como decisión confirmable la política de aviso/aceptación del usuario.

### Sala (`Room`) y sede (`Venue`)

- Una sede agrupa una o más salas físicas. Cada sala tiene un aforo propio.
- Una charla usa una sala en un intervalo definido; la misma sala no puede tener charlas solapadas, incluso si pertenecen a eventos distintos.
- La capacidad configurada de una charla **no puede superar** la capacidad física de su sala.
- El aforo general del evento y el aforo de cada sala son restricciones diferentes.

### Charla (`Session`) y ponente (`Speaker`)

- La charla pertenece a un evento, tiene hora de inicio/fin, sala y capacidad de referencia.
- Debe quedar dentro del intervalo del evento.
- Un ponente no puede estar asignado a charlas solapadas, incluso entre eventos.
- Se admite más de un ponente por charla mediante una relación intermedia `SessionSpeaker`.
- Es posible programar charlas simultáneas **si ocupan salas distintas y no comparten ponentes**.

### Interés por charla (`SessionInterest`)

- Es un **RSVP informativo**, no una reserva garantizada ni un requisito para acceder a la charla.
- Solo un usuario con inscripción `CONFIRMED` al evento puede registrarlo.
- Puede marcar interés en todas las charlas, incluso si sus horarios coinciden. El sistema puede advertir del conflicto, pero no impide la acción.
- Una persona solo puede tener una marca de interés activa por charla; puede retirarla.
- El número de interesados puede superar el aforo de la sala: se registra como **demanda estimada**, no como autorización de sobreocupación física. Si supera el aforo, el sistema muestra una alerta. La admisión real a la sala deberá controlarse operativamente hasta que exista un módulo de check-in.

## 6. Reglas de negocio e invariantes

| ID | Regla | Comportamiento esperado |
|---|---|---|
| RN-01 | Solo eventos `PUBLISHED` admiten nuevas inscripciones | Rechazo funcional si es borrador/cancelado/finalizado |
| RN-02 | No confirmar por encima de `Event.capacity` | Confirmados <= capacidad siempre |
| RN-03 | Cola con prioridad | Cuando existe espera, los cupos libres se asignan primero a la cola |
| RN-04 | La cancelación de un confirmado libera cupo | Promoción inmediata del primero en espera, si corresponde |
| RN-05 | Aumentar capacidad libera nuevos cupos | Promoción FIFO de tantos solicitantes como cupos queden |
| RN-06 | Reducir aforo | No se permite reducirlo por debajo de los confirmados actuales |
| RN-07 | Evitar duplicados | No crear registros repetidos de evento ni de interés por charla |
| RN-08 | Roles y propiedad | Organizador edita lo propio; administrador edita todo |
| RN-09 | Fechas válidas | Inicio < fin; sesión dentro del evento |
| RN-10 | Sala no superpuesta | Una sala no puede asignarse a dos charlas en tiempos coincidentes |
| RN-11 | Ponente no superpuesto | Un ponente no puede participar en charlas coincidentes |
| RN-12 | Sala con capacidad suficiente | `session.capacity <= room.capacity` |
| RN-13 | Interés sin reserva | Marcar una charla no consume cupo adicional del evento ni garantiza asiento en la sala |
| RN-14 | Evento cancelado | No recibe nuevas inscripciones ni promociones; sus inscripciones activas y charlas pasan a `CANCELLED` y el historial registra el motivo `EVENT_CANCELLED` |
| RN-15 | Horarios y zonas | Guardar instantes en UTC y exponer zona horaria IANA del evento para mostrar horarios locales |

**Concurrencia y consistencia:** todas las operaciones que cambian las inscripciones confirmadas, promueven solicitudes o modifican la capacidad del evento deben ejecutarse dentro de transacciones de PostgreSQL. El flujo de escritura bloqueará la fila del evento (`SELECT ... FOR UPDATE`) antes de leer/recalcular ocupación y alterar inscripciones, con la misma disciplina para todos los caminos de escritura. Las restricciones únicas respaldan la idempotencia y previenen duplicados. Se probarán condiciones de carrera con solicitudes simultáneas.

**Programación de recursos:** validar solapamientos dentro de una transacción consistente; para evitar carreras entre dos creaciones concurrentes, se utilizará bloqueo de las filas de sala y ponentes afectados, en un orden estable. Se evaluarán restricciones de exclusión de PostgreSQL para reforzar los conflictos de sala a nivel de BD.

## 7. Flujos principales

### F-01: inscripción con cupo disponible

1. Usuario autenticado consulta el evento publicado.
2. Solicita inscripción.
3. El sistema valida elegibilidad y que no haya inscripción activa duplicada.
4. La transacción bloquea el evento, atiende antes la cola pendiente si existe, consulta confirmados y capacidad.
5. Si queda cupo y no hay solicitantes previos, crea/reactiva `CONFIRMED`.
6. Responde con estado confirmado y datos de la inscripción.

### F-02: inscripción sin cupo

1. Usuario solicita inscripción en un evento publicado y lleno.
2. El sistema crea/reactiva `WAITLISTED` con su fecha de entrada a la cola.
3. Devuelve estado en espera y posición orientativa calculada en el momento de consulta.
4. La posición puede variar por cancelaciones o promociones; no equivale a un cupo.

### F-03: cancelación o aumento de capacidad

1. Asistente cancela su inscripción o un actor autorizado aumenta el aforo.
2. El sistema bloquea el evento y actualiza el estado o capacidad.
3. Calcula cupos disponibles y promueve en orden FIFO a elegibles de la cola.
4. Persiste todos los cambios en una sola transacción.
5. La consulta de inscripciones devuelve el nuevo estado; notificaciones externas se incorporarán después mediante eventos transaccionales si son necesarias.

### F-04: creación de charla

1. Propietario del evento o administrador crea una charla.
2. El sistema valida fechas, estado editable, sala disponible, aforo de la sala y disponibilidad de ponentes.
3. Persiste la charla y relaciones con ponentes.
4. Rechaza con un error de conflicto cuando hay superposición o insuficiencia de capacidad.

### F-05: interés en múltiples charlas

1. Asistente confirmado consulta la agenda.
2. Marca interés en una o varias charlas, incluso simultáneas.
3. El sistema registra cada elección sin descontar cupos.
4. El organizador consulta estimaciones y posibles alertas de exceso respecto al aforo de sala.

## 8. Historias de usuario y criterios de aceptación

### HU-01 · Organizador administra únicamente lo suyo

**Como** organizador, **quiero** crear eventos y gestionar sus charlas **para** planificar actividades sin alterar eventos ajenos.

- **Dado** un organizador autenticado, **cuando** crea un evento válido, **entonces** es su propietario.
- **Dado** un evento de otro organizador, **cuando** intenta editarlo o editar sus charlas, **entonces** recibe `403 Forbidden`.
- **Dado** un administrador, **cuando** edita ese mismo evento, **entonces** la operación está permitida si cumple las reglas de negocio.

### HU-02 · Asistente obtiene cupo o entra en espera

**Como** asistente, **quiero** saber si estoy confirmado o en lista de espera **para** planificar mi participación.

- Una solicitud elegible con aforo libre confirma un cupo.
- Una solicitud elegible sin aforo retorna `WAITLISTED`, sin prometer acceso.
- Dos solicitudes concurrentes al último cupo nunca producen dos confirmaciones.
- Inscribirse dos veces no genera dos registros activos.

### HU-03 · Lista de espera equitativa

**Como** asistente en espera, **quiero** recibir prioridad si se libera una plaza **para** no depender de operaciones manuales.

- Cancelar una confirmación promueve al primer candidato elegible.
- Aumentar capacidad de 50 a 53 promueve como máximo tres candidatos si existen tres plazas nuevas.
- El orden lo da `waitlist_order`; no se adelantan nuevos solicitantes.

### HU-04 · Programador evita choques de salas

**Como** organizador, **quiero** programar charlas paralelas **para** aprovechar diferentes espacios sin duplicar la ocupación de una sala.

- Dos charlas simultáneas en salas diferentes son válidas si no comparten ponente.
- Dos charlas superpuestas en la misma sala son inválidas, aunque pertenezcan a eventos distintos.
- Una charla con capacidad superior a la de su sala es inválida.

### HU-05 · Interés informativo por charlas

**Como** participante confirmado, **quiero** indicar mis charlas de interés **para** que los organizadores estimen demanda.

- Puede indicar interés por todas las charlas, incluso con solapamientos.
- No puede crear intereses duplicados.
- El interés no garantiza asiento ni resta capacidad de una charla.
- Si el interés supera el aforo de sala, se muestra un indicador de sobredemanda.
- Una persona en lista de espera del evento no puede marcar interés como participante confirmado.

## 9. Métricas mínimas

Por evento: capacidad, confirmados, cupos libres, usuarios en espera, porcentaje de ocupación y estado.  
Por charla: sala, capacidad de referencia, personas interesadas, porcentaje de interés respecto al aforo y alerta de sobredemanda.  
Por organizador: cantidad de eventos propios y ocupación de cada uno.

Estas métricas se calculan con datos de la base de datos; no requieren integrar todavía una plataforma analítica.

## 10. Entidades previstas (modelo lógico preliminar)

- `User`: identidad y autenticación.
- `Role` / `UserRole`: autorización extensible (o rol único si se decide formalmente, sin usar un booleano aislado).
- `Event`: propietario, intervalo, estado y capacidad.
- `Venue`: sede o recinto.
- `Room`: sala, sede y aforo.
- `Session`: charla, evento, sala, intervalo y capacidad de referencia.
- `Speaker`: ficha de ponente independiente de cuenta de usuario.
- `SessionSpeaker`: relación muchos-a-muchos entre charlas y ponentes.
- `EventRegistration`: vínculo usuario-evento con estado y antigüedad.
- `SessionInterest`: vínculo usuario-charla como señal de interés.
- `RegistrationStatusHistory` (recomendado): trazabilidad de cambios entre confirmación, espera y cancelación.

**Relaciones clave:** `Event.owner_id -> User.id`; `Session.event_id -> Event.id`; `Session.room_id -> Room.id`; `EventRegistration (user_id, event_id)` único; `SessionInterest (user_id, session_id)` único.

El ERD físico, claves foráneas, índices y restricciones detalladas se definirán en el siguiente documento de diseño de datos.

## 11. Requisitos no funcionales

- **Integridad:** operaciones de cupos y recursos transaccionales.
- **Seguridad:** autenticación, autorización por recurso, secretos externos, principio de mínimo privilegio.
- **Mantenibilidad:** módulos de dominio; routers HTTP separados de servicios/reglas y persistencia.
- **Pruebas:** pytest para flujos felices, validaciones, permisos y concurrencia real con PostgreSQL.
- **Documentación:** OpenAPI/Swagger y guías para nuevos desarrolladores.
- **Observabilidad:** logs estructurados, request ID, endpoints de salud y errores trazables.
- **Reproducibilidad:** Python, dependencias y contenedores con versiones fijadas; migraciones versionadas.

### Seguridad de contraseñas

El enunciado original solicita `hashlib.sha256()` para almacenar contraseñas. **SHA-256 simple no es adecuado para contraseñas reales**. La recomendación técnica es Argon2id. **Decisión (2026-10-28): Argon2id**, con `pwdlib` y los parámetros recomendados por RFC 9106 (64 MiB, 3 iteraciones, paralelismo 4); SHA-256 no se implementa. El hash se guarda en formato PHC (`$argon2id$v=19$m=…`), que incluye sal y parámetros; al iniciar sesión se re-hashea si los parámetros cambiaron. El cálculo queda detrás de `app/core/security.py`, y el login verifica contra un hash ficticio cuando el correo no existe para no revelar por tiempo de respuesta qué cuentas están registradas.

Referencia: [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

## 12. Decisiones pendientes (no suponer en código sin documentarlas)

| Tema | Valor provisional / pregunta | Motivo |
|---|---|---|
| Promoción de espera | Automática e inmediata (propuesta) o con ventana de aceptación | Puede haber usuarios que ya no puedan asistir |
| Aviso de promoción | Consulta en API en MVP; email posterior | La entrega fiable de correo necesita infraestructura adicional |
| Cierre de inscripciones | Al inicio del evento por defecto; posibilidad de `registration_closes_at` | Evita registros tardíos inesperados |
| Edición durante un evento | **Acordada:** editable en `DRAFT`/`PUBLISHED` con guardas de aforo, fechas y sede (docs/04 §12) | Modificar horarios/cupos puede afectar inscritos |
| Sedes | MVP con eventos presenciales de una sola sede | Eventos virtuales/híbridos requerirán extensión |
| Eliminación | Preferir baja lógica o cancelación cuando hay inscripciones | Conserva trazabilidad |
| Disponibilidad de salas fuera de charlas | Reservas y bloqueos por mantenimiento: futura extensión | Afecta calendario de instalaciones |
| Protección de contraseñas | **Acordada:** Argon2id (ver «Seguridad de contraseñas») | Implicación crítica de seguridad |
| Historial de movimientos | Tabla auditable recomendada desde MVP | Facilita diagnosticar promociones y disputas |

## 13. Definición de terminado para el MVP

Una funcionalidad se considera terminada si posee reglas documentadas, migración correspondiente, endpoint OpenAPI, controles de autenticación/autorización, pruebas automatizadas y manejo consistente de errores. La entrega global exige una prueba de concurrencia del último cupo y otra de programación simultánea sobre la misma sala.
