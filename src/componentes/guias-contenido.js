// Contenido de las guías paso a paso y de los manuales de uso por pantalla y rol.
// `selector` apunta al elemento que se resalta; sin selector, el paso se muestra centrado.

const AYUDA = { selector: '[data-testid="guia-boton"]', titulo: 'Ayuda siempre a mano', texto: 'Con este botón vuelves a ver este paso a paso o abres el manual de uso completo cuando quieras.' };

const MANUAL_ARBITRO = [
  {
    titulo: 'Antes del partido',
    items: [
      'Entra con el enlace de árbitro del torneo y la clave que te dio la organización. La sesión dura 24 horas en tu celular.',
      'Elige tu partido en la lista: cada uno indica su ronda y su cancha. Los que tienen «● En juego» ya los está llevando alguien.',
      'Si el celular lo permite, la pantalla no se apaga mientras arbitras.',
    ],
  },
  {
    titulo: 'Durante el partido',
    items: [
      'Toca la mitad de la pantalla de la pareja que gana el punto: suma 1.',
      'Si te equivocas, usa «−» en esa pareja o «Deshacer» para volver atrás la última acción.',
      '«⇄ Lados» invierte las parejas en la pantalla para que coincidan con lo que ves en la cancha.',
      'El reloj del set arranca con «▶ Empezar set» o con el primer punto. «⏸ Pausa» lo detiene y bloquea los puntos; «▶ Reanudar» continúa. El tiempo de cada set queda guardado y el público lo ve.',
      'Cada toque se guarda solo y aparece al instante en la vista pública. Arriba a la derecha verás «✓ Guardado».',
      'Si aparece «⚠ Sin guardar» es un problema de señal: sigue arbitrando, se reintenta solo con el último marcador.',
    ],
  },
  {
    titulo: 'Sets y final del partido',
    items: [
      'Arriba ves la regla del set de esa fase, por ejemplo «Mejor de 3 sets a 15, se gana por 2 (tope 20)». La define el admin y puede ser distinta en la liga y en la final.',
      'La pantalla avisa «Punto de set», «Punto de partido» o «Iguales» y, cuando el set se gana según la regla, «Set ganado»: el botón «Cerrar set» se pone verde. Con el set ganado no deja sumar más puntos (si fue un error, resta con «−»).',
      'Cuando una pareja gana los sets necesarios (2 al mejor de 3) aparece «🏁 Finalizar partido».',
      'Al finalizar, el resultado cuenta para la tabla. Si hubo un error después de finalizar, avisa al admin: solo él puede corregirlo.',
      'Vuelve a la lista con «‹ Partidos» para elegir el siguiente partido.',
    ],
  },
];

const MANUAL_ADMIN = [
  {
    titulo: 'Preparar el torneo',
    items: [
      'En «Parejas» escribe el nombre de cada pareja inscrita y pulsa «Guardar». Puedes cambiarlos en cualquier momento sin perder resultados.',
      'Comparte con el público el enlace de «Vista pública» y con los árbitros el de «Árbitro» (y su clave).',
    ],
  },
  {
    titulo: 'Durante la liga (todos contra todos)',
    items: [
      'Son 3 rondas; en cada ronda se juegan 2 partidos a la vez, uno por cancha.',
      'Lo normal es que los árbitros carguen el marcador desde su pantalla. En «Partidos» verás «● EN JUEGO» en los que se están arbitrando.',
      'También puedes cargar un resultado a mano: escribe los puntos de cada set (S1, S2 y S3 si hizo falta) y pulsa «Guardar».',
      '«Corregir» cambia un resultado ya guardado; «Reset» lo borra para que se vuelva a jugar o arbitrar.',
    ],
  },
  {
    titulo: 'Reglas de puntuación',
    items: [
      'En «Reglas» defines, por fase, al mejor de cuántos sets se juega, a cuántos puntos es el set y cómo se cierra: seco (gana el primero que llega) o con ventaja de 2 puntos, con un tope opcional (el primero que llega al tope gana).',
      'Los cambios rigen al instante para el árbitro y el público, que ven la regla al empezar y los avisos de punto de set, punto de partido o set ganado. Los resultados ya guardados no cambian.',
    ],
  },
  {
    titulo: 'Tabla y desempates',
    items: [
      'Partido ganado: 2 puntos. Partido perdido: 0 puntos.',
      'Si hay empate en puntos, decide la diferencia de sets; si sigue el empate, la diferencia de puntos.',
      'Si dos parejas quedan iguales en todo, la tabla lo marca con ⚠ y la organización decide.',
    ],
  },
  {
    titulo: 'Final y campeón',
    items: [
      'Cuando terminan los 6 partidos, en «Final» pulsa «Armar Gran Final»: juegan el 1° y el 2° de la tabla, al mejor de 3 sets a 21.',
      'Si después corriges un resultado de la liga que cambia los finalistas, usa «Resetear Gran Final» y vuelve a armarla.',
      'Con la final jugada aparece el campeón: puedes subir la foto de los campeones y se verá en la vista pública.',
    ],
  },
];

const MANUAL_SUPER = [
  {
    titulo: 'Crear un torneo',
    items: [
      'Pulsa «+ Nuevo torneo», completa el nombre (el enlace se genera solo), la categoría, el organizador y las parejas si ya las tienes.',
      'Define la clave de admin y la de árbitro (mínimo 4 caracteres). Puedes dejarlas vacías y fijarlas después.',
      'Marca «Torneo de prueba» para ensayar sin que aparezca en la portada.',
    ],
  },
  {
    titulo: 'Enlaces y claves',
    items: [
      'Cada torneo tiene 3 enlaces: Pública (para todos), Árbitro y Admin. Usa «Copiar» para compartirlos.',
      'Las claves se guardan cifradas: no se pueden ver, solo reemplazar. Escribe una nueva y pulsa «Guardar».',
      '«✕» quita una clave: nadie podrá entrar con ese rol hasta que fijes otra.',
      'La clave de admin también abre la pantalla de árbitro.',
    ],
  },
  {
    titulo: 'Mantenimiento',
    items: [
      '«Editar» cambia nombre, categoría y organizador.',
      '«Borrar» elimina el torneo con sus parejas y resultados. Para confirmar hay que escribir el enlace exacto: no se puede deshacer.',
      'Como super admin puedes entrar al panel de cualquier torneo sin su clave y cambiar de torneo con el selector.',
    ],
  },
];

export const GUIAS = {
  'admin-relampago': {
    nombre: 'Admin',
    pasos: [
      { titulo: 'Bienvenido al panel', texto: 'Desde aquí administras el torneo. Te muestro lo esencial en unos pasos; puedes saltar la guía cuando quieras.' },
      { selector: '[data-guia="admin-enlaces"]', titulo: 'Enlaces del torneo', texto: '«Vista pública» es el enlace para compartir con todos. «Árbitro» abre la pantalla para llevar el marcador. «Salir» cierra tu sesión.' },
      { selector: '[data-testid="tab-parejas"]', titulo: 'Primero, las parejas', texto: 'Antes de empezar, escribe aquí el nombre de las 4 parejas inscritas.' },
      { selector: '[data-testid="ronda-1"]', titulo: 'Rondas', texto: 'La liga tiene 3 rondas de 2 partidos simultáneos. ✓ = ronda terminada, ● rojo = un árbitro está cargando el marcador en vivo.' },
      { selector: '[data-testid^="partido-"]', titulo: 'Cargar o corregir un partido', texto: 'Los árbitros cargan el marcador desde su pantalla, pero también puedes escribir los sets (S1, S2, S3) y pulsar «Guardar». «Reset» borra el resultado.' },
      { selector: '[data-testid="tab-tabla"]', titulo: 'Tabla', texto: 'Posiciones en tiempo real: 2 puntos por victoria; desempate por diferencia de sets y luego de puntos.' },
      { selector: '[data-testid="tab-final"]', titulo: 'Final', texto: 'Al terminar los 6 partidos, arma aquí la Gran Final entre el 1° y el 2°.' },
      { selector: '[data-testid="tab-reglas"]', titulo: 'Reglas de puntuación', texto: 'Define por fase los sets, los puntos y si el set se cierra seco o con ventaja de 2 (con tope). El árbitro y el público ven la regla y los avisos de punto de set.' },
      AYUDA,
    ],
    manual: MANUAL_ADMIN,
  },
  'arbitro-lista': {
    nombre: 'Árbitro',
    pasos: [
      { titulo: 'Pantalla del árbitro', texto: 'Aquí llevas el marcador punto a punto. Todo se guarda solo y el público lo ve al instante.' },
      { selector: '[data-testid^="arbitro-partido-"]', titulo: 'Elige tu partido', texto: 'Toca el partido que vas a arbitrar. Cada uno indica su ronda y su cancha.' },
      AYUDA,
    ],
    manual: MANUAL_ARBITRO,
  },
  'arbitro-marcador': {
    nombre: 'Árbitro',
    botonArriba: true,
    pasos: [
      { selector: '[data-testid="arbitro-sumar-1"]', titulo: 'Sumar un punto', texto: 'Toca la mitad de la pareja que gana el punto. Así de simple.' },
      { selector: '[data-testid="arbitro-restar-1"]', titulo: 'Corregir', texto: 'Si te equivocaste, «−» le quita un punto a esa pareja.' },
      { selector: '[data-testid="arbitro-reloj"]', titulo: 'Reloj del set', texto: 'Arranca con «▶ Empezar set» o con el primer punto. Con «⏸ Pausa» se detiene y los puntos quedan bloqueados hasta «▶ Reanudar». El público ve el tiempo y si el partido está en juego, pausado o por empezar.' },
      { selector: '[data-testid="arbitro-deshacer"]', titulo: 'Deshacer', texto: 'Vuelve atrás la última acción, incluso un set cerrado por error.' },
      { selector: '[data-guia="arbitro-lados"]', titulo: 'Lados', texto: 'Invierte las parejas en la pantalla para que coincidan con lo que ves en la cancha.' },
      { selector: '[data-testid="arbitro-reglas"]', titulo: 'Regla del set', texto: 'Aquí ves cómo se juega esta fase: cuántos sets, a cuántos puntos y si se gana seco o por 2 de ventaja (con tope). La pantalla te avisa «Punto de set», «Iguales» o «Set ganado».' },
      { selector: '[data-testid="arbitro-cerrar-set"]', titulo: 'Cerrar el set', texto: 'Cuando el set se gana según la regla aparece «Set ganado» y este botón se pone verde: tócalo para empezar el siguiente set. Con los sets necesarios ganados aparece «Finalizar partido».' },
      { selector: '[data-testid="arbitro-estado"]', titulo: 'Guardado automático', texto: '«✓ Guardado» confirma que el público ya lo ve. Si dice «⚠ Sin guardar», es la señal: sigue, se reintenta solo.' },
      AYUDA,
    ],
    manual: MANUAL_ARBITRO,
  },
  superadmin: {
    nombre: 'Super admin',
    pasos: [
      { titulo: 'Gestión de torneos', texto: 'Desde aquí creas torneos, defines quién entra a cada uno y compartes sus enlaces.' },
      { selector: '[data-testid="sa-nuevo"]', titulo: 'Nuevo torneo', texto: 'Crea un torneo con su nombre, categoría, organizador, parejas y claves.' },
      { selector: '[data-testid^="sa-torneo-"]', titulo: 'Enlaces para compartir', texto: 'Cada torneo tiene su enlace público, de árbitro y de admin. Usa «Copiar» para enviarlos.' },
      { selector: '[data-testid$="-clave_admin"]', titulo: 'Claves de acceso', texto: 'Fija o reemplaza la clave de admin y la de árbitro. Se guardan cifradas: no se pueden ver, solo cambiar.' },
      AYUDA,
    ],
    manual: MANUAL_SUPER,
  },
};
