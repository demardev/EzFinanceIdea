/* Traduce lo que responde la API a algo que se pueda leer en español.
   No hace red ni DOM: solo mapea. */

/* Abierto/cerrado por tabla: agregar un caso = agregar una entrada. */
const POR_ESTADO = {
  0:   'Sin conexión. Revisa tu internet.',
  400: 'Los datos enviados no son válidos.',
  401: 'Tu sesión expiró. Vuelve a entrar.',
  403: 'No tienes permiso para hacer eso.',
  404: 'No se encontró esa ruta. Revisa SUPABASE_URL en js/config.js.',
  409: 'Ese registro ya existe.',
  422: 'Faltan datos o están mal escritos.',
  429: 'Demasiados intentos. Espera un momento.',
  500: 'El servidor falló. Intenta de nuevo.',
  503: 'El servicio no está disponible ahora.',
};

/* Mensajes crudos de GoTrue/PostgREST que sí conviene traducir uno por uno. */
const POR_TEXTO = [
  ['invalid login credentials', 'Email o contraseña incorrectos.'],
  ['email not confirmed',       'Ese usuario no está confirmado. Actívalo en Supabase.'],
  ['invalid refresh token',     'Tu sesión expiró. Vuelve a entrar.'],
  ['violates row-level security', 'No tienes permiso sobre ese registro.'],
  ['violates check constraint', 'Esa combinación de datos no está permitida.'],
  ['violates foreign key',      'Hay otro registro que depende de este.'],
  ['duplicate key',             'Ese registro ya existe.'],
  ['could not find the table',  'Esa tabla no existe. ¿Corriste sql/01_schema.sql en Supabase?'],
  ['schema cache',              'Esa tabla no existe todavía. Corre sql/01_schema.sql y recarga.'],
  ['could not find the function','Falta el RPC. Vuelve a correr sql/01_schema.sql completo.'],
  ['invalid api key',           'La ANON_KEY de js/config.js no es válida.'],
  ['no api key',                'Falta la ANON_KEY en js/config.js.'],
];

function textoCrudo(cuerpo) {
  if (!cuerpo) return '';
  const bruto = cuerpo.message || cuerpo.error_description || cuerpo.msg ||
                cuerpo.error || cuerpo.hint || '';
  return String(bruto).toLowerCase();
}

export function traducirError(estado, cuerpo) {
  const crudo = textoCrudo(cuerpo);
  const conocido = POR_TEXTO.find(([clave]) => crudo.includes(clave));
  if (conocido) return conocido[1];
  return POR_ESTADO[estado] || 'Algo salió mal. Intenta de nuevo.';
}

/** Error con el código HTTP pegado, para que quien llame pueda decidir. */
export function errorApi(mensaje, estado) {
  const e = new Error(mensaje);
  e.estado = estado;
  return e;
}

/**
 * ¿Falló por falta de red, o porque el servidor dijo que no?
 * La diferencia importa: si no hay internet la sesión sigue siendo válida y
 * NO hay que cerrarla; si el servidor rechaza el token, sí.
 */
export function esFalloDeRed(error) {
  return error?.estado === 0;
}
