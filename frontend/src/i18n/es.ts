// UI copy lives here (Spanish); code, identifiers and comments stay in English.
export const es = {
  app: {
    name: 'Mis Eventos',
    tagline: 'Gestión de eventos, charlas e inscripciones',
  },
  a11y: {
    skipToContent: 'Saltar al contenido',
    openMenu: 'Abrir menú',
    mainNav: 'Navegación principal',
    showPassword: 'Mostrar contraseña',
    hidePassword: 'Ocultar contraseña',
  },
  roles: {
    ATTENDEE: 'Asistente',
    ORGANIZER: 'Organizador',
    ADMIN: 'Administrador',
  },
  nav: {
    explore: 'Explorar',
    organize: 'Organizar',
    administer: 'Administrar',
    tools: 'Herramientas',
    home: 'Inicio',
    events: 'Eventos',
    myRegistrations: 'Mis inscripciones',
    myEvents: 'Mis eventos',
    speakers: 'Ponentes',
    venues: 'Sedes y salas',
    users: 'Usuarios y roles',
    lab: 'Laboratorio',
  },
  theme: {
    label: 'Tema',
    light: 'Claro',
    dark: 'Oscuro',
    system: 'Sistema',
  },
  userMenu: {
    label: 'Menú de usuario',
    logout: 'Cerrar sesión',
  },
  auth: {
    loginTitle: 'Inicia sesión',
    loginSubtitle: 'Entra con tu cuenta para ver y gestionar eventos.',
    registerTitle: 'Crea tu cuenta',
    registerSubtitle:
      'Las cuentas nuevas son de asistente; un administrador puede darte más roles.',
    email: 'Correo electrónico',
    password: 'Contraseña',
    passwordHint: 'Entre 8 y 128 caracteres.',
    fullName: 'Nombre completo',
    login: 'Entrar',
    loggingIn: 'Entrando…',
    register: 'Crear cuenta',
    registering: 'Creando cuenta…',
    noAccount: '¿No tienes cuenta?',
    goRegister: 'Regístrate',
    haveAccount: '¿Ya tienes cuenta?',
    goLogin: 'Inicia sesión',
    sessionExpired: 'Tu sesión expiró. Vuelve a iniciar sesión para continuar.',
    loggedOut: 'Cerraste sesión.',
    demoTitle: 'Cuentas de demo',
    demoHint:
      'Contraseña demo1234. Usa una pestaña por cuenta para probar varios roles a la vez.',
    demoAccounts: {
      admin: 'Administrador',
      ana: 'Organizadora: PyData, Summit, Meetup, Lightning',
      bruno: 'Organizador: DevOps Day, Hackathon',
      irene: 'Perdió el rol de organizadora; conserva su borrador',
      carla: 'Asistente confirmada en PyData',
      gabriela: 'Primera en la lista de espera de PyData',
      hugo: 'Asistente sin inscripción en PyData',
    },
    features: [
      'Cupos garantizados y lista de espera en orden de llegada',
      'Charlas sin choques de sala ni de ponente',
      'Permisos por rol y por propiedad del evento',
    ],
    validation: {
      email: 'Escribe un correo válido.',
      passwordRequired: 'Escribe tu contraseña.',
      passwordLength: 'La contraseña debe tener entre 8 y 128 caracteres.',
      fullName: 'Escribe tu nombre.',
    },
  },
  home: {
    greeting: (name: string) => `Hola, ${name}`,
    subtitle: 'Esto es lo que tu cuenta puede hacer en Mis Eventos.',
    rolesTitle: 'Tus roles',
    capabilitiesTitle: 'Tus permisos',
    capabilitiesHint:
      'La interfaz se adapta a tus roles, pero quien decide es la API: pruébalo en el inspector.',
    capabilities: {
      'event:create': 'Crear eventos',
      'event:manage': 'Editar eventos y charlas',
      'speaker:manage': 'Gestionar ponentes',
      'venue:manage': 'Gestionar sedes y salas',
      'user:manage': 'Conceder y retirar roles',
    },
    ownOnly: 'solo los tuyos',
    all: 'todos',
    allowed: 'Permitido',
    denied: 'No permitido',
    apiTitle: 'Estado de la API',
  },
  status: {
    event: {
      DRAFT: 'Borrador',
      PUBLISHED: 'Publicado',
      CANCELLED: 'Cancelado',
      COMPLETED: 'Finalizado',
    },
    registration: {
      CONFIRMED: 'Confirmada',
      WAITLISTED: 'En lista de espera',
      CANCELLED: 'Cancelada',
    },
    session: {
      DRAFT: 'Borrador',
      SCHEDULED: 'Programada',
      CANCELLED: 'Cancelada',
    },
  },
  pagination: {
    label: 'Paginación',
    range: (from: number, to: number, total: number) =>
      `${from}–${to} de ${total}`,
    previous: 'Anterior',
    next: 'Siguiente',
  },
  occupancy: {
    summary: (confirmed: number, capacity: number) =>
      `${confirmed} de ${capacity} plazas`,
    waitlisted: (count: number) => `${count} en espera`,
    full: 'Completo',
    snapshot:
      'Es una foto del momento: una plaza libre aquí no garantiza la tuya al inscribirte.',
  },
  events: {
    title: 'Eventos',
    subtitle: 'Explora los eventos publicados e inscríbete.',
    search: 'Buscar por título',
    searchPlaceholder: 'Buscar eventos…',
    statusFilter: 'Estado',
    allStatuses: 'Todos los estados',
    emptyTitle: 'No hay eventos con ese filtro',
    emptyDescription: 'Prueba con otro título o quita el filtro de estado.',
    clearFilters: 'Quitar filtros',
    loadError: 'No pudimos cargar los eventos',
    retry: 'Reintentar',
  },
  eventDetail: {
    back: 'Volver a eventos',
    notFoundTitle: 'Evento no encontrado',
    notFoundDescription:
      'No existe o es un borrador de otro organizador: los borradores solo los ven su dueño y los administradores.',
    loadError: 'No pudimos cargar el evento',
    retry: 'Reintentar',
    about: 'Sobre el evento',
    noDescription: 'Este evento no tiene descripción.',
    venue: 'Sede',
    noVenue: 'Sin sede asignada',
    when: 'Cuándo',
    timezone: (zone: string) => `Horario de ${zone}`,
    registrationCloses: (date: string) => `Inscripciones hasta el ${date}`,
  },
  registration: {
    title: 'Tu inscripción',
    none: 'Aún no estás inscrito.',
    confirmed: 'Tienes plaza confirmada.',
    waitlisted: (position: number | null) =>
      position
        ? `Estás en la lista de espera, posición ${position}.`
        : 'Estás en la lista de espera.',
    waitlistHint:
      'La lista de espera no garantiza plaza: si alguien cancela, asciende el primero de la cola.',
    cancelled: 'Cancelaste tu inscripción.',
    register: 'Inscribirme',
    registering: 'Inscribiendo…',
    registerAgain: 'Volver a inscribirme',
    registerAgainHint:
      'Es una solicitud nueva: si no hay plazas, irás al final de la lista de espera.',
    cancel: 'Cancelar inscripción',
    leaveWaitlist: 'Salir de la lista de espera',
    cancelling: 'Cancelando…',
    blocked: {
      DRAFT: 'El evento aún no está publicado.',
      CANCELLED: 'El evento se canceló.',
      COMPLETED: 'El evento ya terminó.',
      closed: (date: string) => `Las inscripciones cerraron el ${date}.`,
    },
    cancellationClosed:
      'El evento ya empezó: la inscripción ya no se puede cancelar.',
    result: {
      CONFIRMED: '¡Listo! Tienes plaza confirmada.',
      WAITLISTED: (position: number | null) =>
        position
          ? `El evento está lleno: entraste en la lista de espera (posición ${position}).`
          : 'El evento está lleno: entraste en la lista de espera.',
      unchanged: 'Ya estabas inscrito: tu inscripción no cambió.',
      cancelled: 'Inscripción cancelada.',
    },
    dialog: {
      confirmTitle: '¿Cancelar tu inscripción?',
      confirmDescription:
        'Liberarás tu plaza y pasará al momento al primero de la lista de espera. También se retirará tu interés en las charlas del evento.',
      waitlistTitle: '¿Salir de la lista de espera?',
      waitlistDescription:
        'Perderás tu posición. Si vuelves a inscribirte, irás al final de la cola.',
      keep: 'Mantener',
      confirm: 'Sí, cancelar',
    },
  },
  agenda: {
    title: 'Agenda',
    hint: 'Marcar interés ayuda al organizador a dimensionar las salas; no reserva asiento.',
    empty: 'El evento aún no tiene charlas en la agenda.',
    loadError: 'No pudimos cargar la agenda.',
    noRoom: 'Sin sala',
    speakers: (names: string) => `Con ${names}`,
    interest: (interested: number, capacity: number) =>
      `${interested} interesados · ${capacity} plazas`,
    overdemand: 'Sobredemanda',
    overdemandHint: 'Hay más interesados que plazas en la sala.',
    markInterest: 'Me interesa',
    interestLabel: (title: string) => `Me interesa: ${title}`,
    overlaps: (titles: string) =>
      `Se solapa con ${titles}, que también te interesa.`,
    blocked: {
      notConfirmed: 'Necesitas una inscripción confirmada para marcar interés.',
      notOpen: 'Solo en charlas programadas que aún no han empezado.',
    },
  },
  myRegistrations: {
    title: 'Mis inscripciones',
    subtitle:
      'Tus inscripciones y el estado de cada evento, de la más reciente a la más antigua.',
    filterLabel: 'Filtrar por estado',
    tabs: {
      ALL: 'Todas',
      CONFIRMED: 'Confirmadas',
      WAITLISTED: 'En espera',
      CANCELLED: 'Canceladas',
    },
    position: (position: number) => `Posición ${position} en la cola`,
    eventStatus: 'Evento',
    registrationStatus: 'Inscripción',
    emptyTitle: 'No hay inscripciones aquí',
    emptyDescription:
      'Cuando te inscribas en un evento aparecerá en esta lista.',
    explore: 'Explorar eventos',
    loadError: 'No pudimos cargar tus inscripciones',
    retry: 'Reintentar',
  },
  myEvents: {
    title: 'Mis eventos',
    subtitle:
      'Los eventos que organizas: publícalos, gestiona su agenda y su cola.',
    create: 'Nuevo evento',
    filterLabel: 'Filtrar por estado',
    all: 'Todos',
    emptyTitle: 'Aún no tienes eventos aquí',
    emptyDescription:
      'Crea un evento: nace como borrador y solo tú lo ves hasta publicarlo.',
    loadError: 'No pudimos cargar tus eventos',
    retry: 'Reintentar',
  },
  eventForm: {
    createTitle: 'Nuevo evento',
    createSubtitle:
      'Nace como borrador: nadie más lo verá hasta que lo publiques.',
    editTitle: (title: string) => `Editar «${title}»`,
    back: 'Volver al evento',
    backToList: 'Volver a mis eventos',
    title: 'Título',
    description: 'Descripción',
    capacity: 'Aforo',
    capacityHint: (confirmed: number) =>
      `Hay ${confirmed} confirmados: el aforo no puede bajar de ahí.`,
    capacityRaiseHint:
      'Si lo subes, la lista de espera se confirma al momento, en orden de cola.',
    timezone: 'Zona horaria',
    timezoneHint:
      'Las fechas de abajo se escriben en esta zona (nombre IANA, p. ej. America/Bogota).',
    startsAt: 'Empieza',
    endsAt: 'Termina',
    closesAt: 'Cierre de inscripciones',
    closesAtHint: 'Opcional. Sin fecha, se cierran al empezar el evento.',
    venue: 'Sede',
    noVenue: 'Sin sede por ahora',
    venueHint: 'Puedes dejarla para después, pero hará falta para publicar.',
    venueLocked:
      'No se puede cambiar: el evento tiene charlas programadas en su sede.',
    save: 'Guardar cambios',
    create: 'Crear borrador',
    saving: 'Guardando…',
    created: 'Borrador creado.',
    saved: 'Cambios guardados.',
    notEditable: 'Un evento cancelado o finalizado ya no se puede editar.',
    validation: {
      title: 'Escribe un título.',
      capacity: 'El aforo debe ser un número entero mayor que 0.',
      date: 'Indica fecha y hora.',
      timezone: 'Zona horaria desconocida.',
      endsBeforeStart: 'Debe terminar después de empezar.',
      closesAfterEnd: 'El cierre no puede ser posterior al final del evento.',
      outsideEvent: 'La charla debe quedar dentro de las fechas del evento.',
    },
  },
  manage: {
    back: 'Volver a mis eventos',
    viewAsAttendee: 'Ver como asistente',
    manage: 'Gestionar',
    edit: 'Editar',
    forbiddenTitle: 'No puedes gestionar este evento',
    forbiddenDescription:
      'Solo su organizador (con el rol vigente) o un administrador pueden cambiarlo.',
    stats: {
      confirmed: 'Confirmados',
      available: 'Plazas libres',
      waitlisted: 'En espera',
      occupancy: 'Ocupación',
    },
    publish: 'Publicar',
    publishing: 'Publicando…',
    published: 'Evento publicado: ya es visible y admite inscripciones.',
    complete: 'Marcar como finalizado',
    completed: 'Evento finalizado.',
    cancel: 'Cancelar evento',
    cancelled: 'Evento cancelado.',
    blocked: {
      noVenue: 'Asigna una sede para poder publicar.',
      started: 'El evento ya empezó: no se puede publicar.',
      notEnded: 'Se podrá finalizar cuando termine.',
    },
    publishDialog: {
      title: '¿Publicar el evento?',
      description:
        'Será visible para todos y admitirá inscripciones. No podrá volver a borrador.',
      confirm: 'Publicar',
    },
    completeDialog: {
      title: '¿Marcar el evento como finalizado?',
      description: 'Es definitivo: después no se podrá editar ni cancelar.',
      confirm: 'Finalizar',
    },
    cancelDialog: {
      title: '¿Cancelar el evento?',
      description:
        'Es definitivo y ocurre todo a la vez: se cancelan todas las inscripciones (nadie asciende de la cola), todas las charlas liberan su sala y se retiran los intereses.',
      typeToConfirm: (title: string) => `Escribe «${title}» para confirmar`,
      confirm: 'Cancelar evento',
    },
    keep: 'Volver',
  },
  sessionsAdmin: {
    title: 'Charlas',
    hint: 'Los borradores no reservan sala ni comprueban ponentes: eso ocurre al programar.',
    create: 'Nueva charla',
    empty: 'Aún no hay charlas. Crea la primera.',
    actions: (title: string) => `Acciones de ${title}`,
    edit: 'Editar',
    schedule: 'Programar',
    unschedule: 'Volver a borrador',
    cancel: 'Cancelar charla',
    scheduled: 'Charla programada: la sala queda reservada.',
    unscheduled: 'La charla volvió a borrador y liberó su sala.',
    cancelledToast: 'Charla cancelada.',
    created: 'Charla creada como borrador.',
    saved: 'Charla guardada.',
    needsRoom: 'Asigna una sala para poder programarla.',
    roomTooSmall: (capacity: number) =>
      `La sala tiene ${capacity} plazas: no alcanza para programarla.`,
    cancelDialog: {
      title: '¿Cancelar la charla?',
      description:
        'Es definitivo: libera la sala y retira el interés de los asistentes. Seguirá en la agenda como cancelada.',
      confirm: 'Cancelar charla',
    },
    form: {
      createTitle: 'Nueva charla',
      editTitle: 'Editar charla',
      description: 'Las horas se escriben en la zona del evento.',
      title: 'Título',
      summary: 'Descripción',
      capacity: 'Plazas',
      room: 'Sala',
      noRoom: 'Sin sala por ahora',
      roomOption: (name: string, capacity: number) =>
        `${name} · ${capacity} plazas`,
      roomHint: 'Salas activas de la sede del evento.',
      noVenue: 'El evento no tiene sede: asígnale una para elegir sala.',
      capacityOverRoom: (capacity: number) =>
        `Supera las ${capacity} plazas de la sala: no se podrá programar así.`,
      speakers: 'Ponentes',
      speakersFilter: 'Filtrar ponentes',
      noSpeakers: 'No hay ponentes con ese nombre.',
      selectedSpeakers: (count: number) =>
        count === 1 ? '1 seleccionado' : `${count} seleccionados`,
      save: 'Guardar',
      saving: 'Guardando…',
      close: 'Cancelar',
    },
  },
  attendees: {
    title: 'Inscritos y lista de espera',
    hint: 'Primero confirmadas y canceladas por fecha de solicitud; después la cola, en orden.',
    filterLabel: 'Filtrar inscritos por estado',
    all: 'Todos',
    empty: 'No hay inscripciones con ese estado.',
    none: 'Aún no hay inscritos.',
    requestedAt: (date: string) => `Solicitada el ${date}`,
    position: (position: number) => `#${position} en la cola`,
    loadError: 'No pudimos cargar los inscritos.',
  },
  speakers: {
    title: 'Ponentes',
    subtitle: 'Ponentes disponibles para las charlas de cualquier evento.',
    create: 'Nuevo ponente',
    search: 'Buscar por nombre',
    searchPlaceholder: 'Buscar ponentes…',
    emptyTitle: 'No hay ponentes',
    emptyDescription: 'Crea uno o cambia la búsqueda.',
    loadError: 'No pudimos cargar los ponentes',
    retry: 'Reintentar',
    noEmail: 'Sin correo',
    edit: (name: string) => `Editar a ${name}`,
    delete: (name: string) => `Eliminar a ${name}`,
    created: 'Ponente creado.',
    saved: 'Ponente guardado.',
    deleted: 'Ponente eliminado.',
    form: {
      createTitle: 'Nuevo ponente',
      editTitle: 'Editar ponente',
      description: 'Los cambios se ven en todas las charlas donde participa.',
      fullName: 'Nombre completo',
      email: 'Correo (opcional)',
      bio: 'Biografía (opcional)',
      save: 'Guardar',
      saving: 'Guardando…',
      close: 'Cancelar',
      validation: {
        fullName: 'Escribe el nombre.',
        email: 'Escribe un correo válido o déjalo vacío.',
      },
    },
    deleteDialog: {
      title: (name: string) => `¿Eliminar a ${name}?`,
      description:
        'Solo se puede si nunca se asignó a una charla; si ya participó, se conserva para el historial.',
      confirm: 'Eliminar',
      keep: 'Volver',
    },
  },
  users: {
    title: 'Usuarios y roles',
    subtitle:
      'Concede o retira los roles de organizador y administrador. Todas las cuentas son asistentes.',
    search: 'Buscar por correo',
    searchPlaceholder: 'Buscar por correo…',
    filterLabel: 'Filtrar por rol',
    all: 'Todos',
    you: 'Tú',
    inactive: 'Cuenta desactivada',
    attendeeFixed: 'Asistente (siempre)',
    roleSwitch: (role: string, name: string) => `${role} de ${name}`,
    granted: (role: string, name: string) => `${name} ahora es ${role}.`,
    revoked: (role: string, name: string) => `${name} ya no es ${role}.`,
    lastAdminHint: 'Debe quedar al menos un administrador activo.',
    emptyTitle: 'No hay usuarios con ese filtro',
    emptyDescription:
      'Prueba con otra parte del correo o quita el filtro de rol.',
    loadError: 'No pudimos cargar los usuarios',
    retry: 'Reintentar',
    revokeDialog: {
      title: (role: string, name: string) =>
        `¿Quitar el rol ${role} a ${name}?`,
      ORGANIZER:
        'Conservará sus eventos, pero ya no podrá crearlos ni cambiarlos (un administrador sí podrá). Se aplica en su próxima petición, sin cerrar sesión.',
      ADMIN:
        'Perderá la administración de usuarios, sedes y salas. Se aplica en su próxima petición, sin cerrar sesión.',
      self: 'Te lo quitas a ti: dejarás de ver esta sección.',
      confirm: 'Quitar rol',
      keep: 'Volver',
    },
  },
  venues: {
    title: 'Sedes y salas',
    subtitle:
      'Las sedes y salas no se borran: se desactivan para que no se programen charlas nuevas en ellas.',
    create: 'Nueva sede',
    filterLabel: 'Filtrar por estado',
    filters: { ALL: 'Todas', ACTIVE: 'Activas', INACTIVE: 'Desactivadas' },
    active: 'Activa',
    inactive: 'Desactivada',
    noCity: 'Sin ciudad',
    noAddress: 'Sin dirección',
    rooms: 'Salas',
    emptyTitle: 'No hay sedes con ese filtro',
    emptyDescription: 'Crea una sede para poder asignarla a los eventos.',
    loadError: 'No pudimos cargar las sedes',
    retry: 'Reintentar',
    back: 'Volver a sedes',
    notFound: 'La sede no existe.',
    edit: 'Editar sede',
    activate: 'Activar',
    deactivate: 'Desactivar',
    activeSwitch: (name: string) => `Sede activa: ${name}`,
    activated: 'Sede activada.',
    deactivated: 'Sede desactivada.',
    created: 'Sede creada.',
    saved: 'Sede guardada.',
    deactivateDialog: {
      title: (name: string) => `¿Desactivar ${name}?`,
      description:
        'No se podrán programar charlas nuevas en sus salas. Si tiene charlas programadas que aún no han terminado, la API lo impedirá. Sus salas conservan su propio estado.',
      confirm: 'Desactivar',
      keep: 'Volver',
    },
    form: {
      createTitle: 'Nueva sede',
      editTitle: 'Editar sede',
      description: 'Dirección y ciudad son opcionales; vacías se borran.',
      name: 'Nombre',
      address: 'Dirección',
      city: 'Ciudad',
      save: 'Guardar',
      saving: 'Guardando…',
      close: 'Cancelar',
      validation: { name: 'Escribe un nombre.' },
    },
  },
  rooms: {
    title: 'Salas',
    hint: 'La capacidad son los asientos físicos: ninguna charla puede superarla.',
    create: 'Nueva sala',
    empty: 'Esta sede aún no tiene salas.',
    capacity: (seats: number) => `${seats} plazas`,
    edit: (name: string) => `Editar ${name}`,
    activeSwitch: (name: string) => `Sala activa: ${name}`,
    activated: 'Sala activada.',
    deactivated: 'Sala desactivada.',
    created: 'Sala creada.',
    saved: 'Sala guardada.',
    deactivateDialog: {
      title: (name: string) => `¿Desactivar ${name}?`,
      description:
        'No se podrán programar charlas nuevas en ella. Si tiene charlas programadas que aún no han terminado, la API lo impedirá.',
      confirm: 'Desactivar',
      keep: 'Volver',
    },
    form: {
      createTitle: 'Nueva sala',
      editTitle: 'Editar sala',
      description: 'El nombre no puede repetirse dentro de la sede.',
      name: 'Nombre',
      capacity: 'Capacidad',
      capacityHint:
        'Con charlas programadas, no puede bajar de la que más plazas necesita.',
      save: 'Guardar',
      saving: 'Guardando…',
      close: 'Cancelar',
      validation: {
        name: 'Escribe un nombre.',
        capacity: 'La capacidad debe ser un número entero mayor que 0.',
      },
    },
  },
  comingSoon: {
    title: 'Próximamente',
    description: (phase: number) =>
      `Esta vista llega en la fase ${phase} del frontend. Mientras tanto, puedes usar el inspector o /docs.`,
  },
  forbidden: {
    title: 'No tienes permiso para ver esto',
    description: (roles: string) => `Esta sección requiere el rol ${roles}.`,
    back: 'Volver al inicio',
  },
  crash: {
    title: 'Algo salió mal en esta pantalla',
    description:
      'Fue un error de la aplicación, no de tus datos. Recarga la página; si se repite, avísanos.',
    reload: 'Recargar',
  },
  notFound: {
    title: 'Página no encontrada',
    description: 'La dirección no existe o ya no está disponible.',
    back: 'Volver al inicio',
  },
  loadError: {
    title: 'No pudimos cargar tu cuenta',
    retry: 'Reintentar',
  },
  health: {
    checking: 'Comprobando la API…',
    ok: 'API disponible',
    down: 'La API no responde. Comprueba que el backend está en marcha.',
  },
  inspector: {
    title: 'Inspector de peticiones',
    description:
      'Las últimas 50 peticiones a la API. Las contraseñas y tokens se ocultan.',
    open: 'Abrir inspector de peticiones',
    clear: 'Limpiar',
    empty: 'Aún no hay peticiones. Navega por la app y aparecerán aquí.',
    pending: 'En curso',
    networkError: 'Sin respuesta',
    request: 'Petición',
    response: 'Respuesta',
    apiDocs: 'Abrir /docs de la API',
  },
  errors: {
    unexpected: 'Algo salió mal. Inténtalo de nuevo.',
    retryIn: (seconds: number) =>
      `El servicio está ocupado. Vuelve a intentarlo en ${seconds} s.`,
    byCode: {
      network_error:
        'No hay conexión con la API. Comprueba que el backend está en marcha.',
      validation_error: 'Revisa los campos marcados.',
      service_unavailable:
        'El servicio está ocupado. Vuelve a intentarlo en unos segundos.',
      internal_server_error: 'Error interno del servidor. Inténtalo más tarde.',
      // auth
      unauthorized: 'Inicia sesión para continuar.',
      invalid_credentials: 'Correo o contraseña incorrectos.',
      token_expired: 'Tu sesión expiró. Vuelve a iniciar sesión.',
      invalid_token: 'Tu sesión no es válida. Vuelve a iniciar sesión.',
      email_taken: 'Ese correo ya está registrado.',
      forbidden: 'No tienes permiso para hacer esto.',
      // users
      user_not_found: 'El usuario no existe.',
      last_admin:
        'No se puede retirar: debe quedar al menos un administrador activo.',
      // events
      not_found: 'No encontramos lo que buscas.',
      event_not_found: 'El evento no existe o no tienes acceso a él.',
      not_event_owner:
        'Solo el organizador dueño del evento o un administrador pueden cambiarlo.',
      event_not_editable:
        'Un evento cancelado o finalizado ya no se puede cambiar.',
      invalid_event_schedule: 'Las fechas del evento no son coherentes.',
      invalid_status_transition: 'El evento no puede pasar a ese estado.',
      event_requires_venue: 'Asigna una sede antes de publicar el evento.',
      event_already_started: 'El evento ya empezó.',
      event_not_ended: 'El evento aún no ha terminado.',
      capacity_below_confirmed:
        'El aforo no puede quedar por debajo de los inscritos confirmados.',
      sessions_outside_event:
        'Algunas charlas quedarían fuera de las fechas del evento.',
      event_has_scheduled_sessions:
        'El evento tiene charlas programadas en su sede.',
      // registrations
      event_not_open: 'El evento no admite inscripciones.',
      registration_closed: 'Las inscripciones de este evento están cerradas.',
      cancellation_closed:
        'El evento ya empezó: no se puede cancelar la inscripción.',
      registration_not_found: 'No estás inscrito en este evento.',
      // sessions
      session_not_found: 'La charla no existe o no tienes acceso a ella.',
      session_cancelled: 'Una charla cancelada no se puede cambiar.',
      invalid_session_schedule: 'La charla debe empezar antes de terminar.',
      session_outside_event:
        'La charla debe estar dentro de las fechas del evento.',
      session_requires_room: 'Asigna una sala antes de programar la charla.',
      session_not_open:
        'Solo puedes marcar interés en charlas programadas que no han empezado.',
      registration_not_confirmed:
        'Necesitas una inscripción confirmada para marcar interés.',
      room_not_available: 'La sala ya tiene otra charla programada a esa hora.',
      speaker_not_available:
        'Un ponente ya tiene otra charla programada a esa hora.',
      capacity_exceeds_room:
        'La charla necesita más plazas de las que tiene la sala.',
      room_not_in_event_venue: 'La sala no pertenece a la sede del evento.',
      // venues
      venue_not_found: 'La sede no existe.',
      room_not_found: 'La sala no existe.',
      venue_inactive: 'La sede está desactivada.',
      room_inactive: 'La sala o su sede están desactivadas.',
      room_name_taken: 'La sede ya tiene una sala con ese nombre.',
      room_has_scheduled_sessions:
        'La sala tiene charlas programadas próximamente.',
      venue_has_scheduled_sessions:
        'La sede tiene charlas programadas próximamente.',
      room_capacity_below_sessions:
        'Una charla próxima en esta sala necesita más plazas.',
      // speakers
      speaker_not_found: 'El ponente no existe.',
      speaker_has_sessions:
        'El ponente ya se asignó a charlas y no se puede borrar.',
      conflict:
        'La operación choca con el estado actual. Recarga e inténtalo de nuevo.',
    },
  },
} as const
