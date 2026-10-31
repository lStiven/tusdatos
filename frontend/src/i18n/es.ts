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
