/* ---------------------------------------------------------------------- *
 * LOS CAMBIOS QUE HACE LA CLI EN TUS FICHEROS — funciones puras
 *
 * Reciben el texto de un fichero y devuelven el texto nuevo, sin tocar el
 * disco: así se pueden probar una a una (test/parches.test.mjs) y
 * `--dry-run` puede enseñarte el cambio exacto antes de hacerlo.
 *
 * Cada cambio deja una marca reconocible, para que `remove` lo deshaga
 * EXACTAMENTE y tu fichero quede byte a byte como estaba.
 * ---------------------------------------------------------------------- */

export const IMPORT_ESM = `import { majixTools } from "majix-tools/vite";`;
export const IMPORT_CJS = `const { majixTools } = require("majix-tools/vite");`;
export const LLAMADA = "majixTools()";
/** Cuando tu configuración no tenía `plugins`, la CLI lo crea con esta
 *  marca, para que `remove` sepa que puede quitar la línea entera. */
export const PLUGINS_NUEVO = "plugins: [majixTools()] /* majix-tools */,";

/** La línea que monta el panel en webs que se pintan en el servidor. */
export const LINEA_CLIENTE =
  'if (import.meta.env.DEV && typeof window !== "undefined") void import("majix-tools/cliente"); // MAJIX Tools · dev only';

export const MARCA_ENV = "# ── MAJIX Tools · Search Console (dev only) ──";
export const BLOQUE_ENV = `${MARCA_ENV}
# Google service account with read access to your property.
# Cuenta de servicio de Google con acceso de lectura a tu propiedad.
# https://majixlab.com/open-source/majix-tools/docs
MAJIX_TOOLS_GSC_CLIENT_EMAIL=
MAJIX_TOOLS_GSC_PRIVATE_KEY=
MAJIX_TOOLS_GSC_SITE=
`;

export type Resultado =
  | { estado: "cambiado"; codigo: string }
  | { estado: "ya-estaba" }
  | { estado: "no-se-puede"; motivo: "sin-plugins" | "sin-imports" };

const EOL = (texto: string) => (texto.includes("\r\n") ? "\r\n" : "\n");

/** Índice justo DESPUÉS de la última línea de imports del principio del
 *  fichero (o 0 si no hay ninguno). Salta comentarios y directivas. */
function finDeImports(texto: string): number {
  const re = /^(?:import\s[^;]*?(?:from\s*)?["'][^"']+["'];?|import\s*["'][^"']+["'];?|const\s+\{?[^=]*\}?\s*=\s*require\(["'][^"']+["']\);?)[^\n]*\n/gm;
  let fin = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) fin = m.index + m[0].length;
  return fin;
}

/* ── ¿CUÁL ES EL `plugins` DE VERDAD? ──
   En muchas configuraciones hay más de un `plugins: [`: el de Vite y otros
   anidados (`css.postcss.plugins`, `build.rollupOptions.plugins`, las
   opciones de otro plugin…), y el anidado puede ir ANTES. El bueno es el
   que está menos anidado en llaves. Se cuentan las llaves saltando
   cadenas, plantillas y comentarios, para que un "{" dentro de un texto no
   descuadre la cuenta. */
export function pluginsDeNivelSuperior(texto: string): { index: number; largo: number } | null {
  /* Profundidad de llaves de cada carácter de CÓDIGO; -1 en comentarios,
     cadenas y plantillas (ahí un `plugins: [` no cuenta). */
  const profundidadEn = new Array<number>(texto.length).fill(-1);
  let profundidad = 0;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    const sig = texto[i + 1];
    if (ch === "/" && sig === "/") {
      const fin = texto.indexOf("\n", i);
      i = fin === -1 ? texto.length : fin - 1;
      continue;
    }
    if (ch === "/" && sig === "*") {
      const fin = texto.indexOf("*/", i + 2);
      i = fin === -1 ? texto.length : fin + 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < texto.length && texto[j] !== ch) j += texto[j] === "\\" ? 2 : 1;
      i = j;
      continue;
    }
    if (ch === "{") profundidad++;
    else if (ch === "}") profundidad--;
    profundidadEn[i] = profundidad;
  }
  let mejor: { index: number; largo: number; profundidad: number } | null = null;
  for (const m of texto.matchAll(/(?<![\w$.])plugins\s*:\s*\[/g)) {
    const i = m.index ?? 0;
    const p = profundidadEn[i];
    if (p < 0) continue;
    if (!mejor || p < mejor.profundidad) mejor = { index: i, largo: m[0].length, profundidad: p };
  }
  return mejor ? { index: mejor.index, largo: mejor.largo } : null;
}

/* ── EL PLUGIN EN vite.config ── */
export function anadirPlugin(texto: string): Resultado {
  if (texto.includes("majix-tools/vite")) return { estado: "ya-estaba" };
  const eol = EOL(texto);
  const esCjs = /\brequire\s*\(/.test(texto) && !/^\s*import\s/m.test(texto);
  const lineaImport = (esCjs ? IMPORT_CJS : IMPORT_ESM) + eol;

  let codigo = texto;
  const plugins = pluginsDeNivelSuperior(codigo);
  if (plugins) {
    const tras = plugins.index + plugins.largo;
    const resto = codigo.slice(tras);
    const saltoYSangria = /^[ \t]*\r?\n([ \t]*)\S/.exec(resto);
    const insercion = saltoYSangria
      ? `${eol}${saltoYSangria[1]}${LLAMADA},`
      : resto.trimStart().startsWith("]")
        ? LLAMADA
        : `${LLAMADA}, `;
    codigo = codigo.slice(0, tras) + insercion + codigo.slice(tras);
  } else {
    /* Sin `plugins`: se añade dentro del objeto de configuración. */
    const objeto = /defineConfig\(\s*(?:\([^)]*\)\s*=>\s*\(?\s*)?\{|export\s+default\s*\{|module\.exports\s*=\s*\{/.exec(
      codigo,
    );
    if (!objeto) return { estado: "no-se-puede", motivo: "sin-plugins" };
    const tras = objeto.index + objeto[0].length;
    const saltoYSangria = /^[ \t]*\r?\n([ \t]*)\S/.exec(codigo.slice(tras));
    const insercion = saltoYSangria
      ? `${eol}${saltoYSangria[1]}${PLUGINS_NUEVO}`
      : ` ${PLUGINS_NUEVO}`;
    codigo = codigo.slice(0, tras) + insercion + codigo.slice(tras);
  }

  const fin = finDeImports(codigo);
  codigo = codigo.slice(0, fin) + lineaImport + codigo.slice(fin);
  return { estado: "cambiado", codigo };
}

export function quitarPlugin(texto: string): Resultado {
  if (!texto.includes("majix-tools/vite")) return { estado: "ya-estaba" };
  const llamada = String.raw`majixTools\((?:[^()]|\([^()]*\))*\)`;
  let codigo = texto.replace(/^[^\n]*["']majix-tools\/vite["'][^\n]*\r?\n?/m, "");
  /* Se deshace exactamente la forma en que se añadió, de la más a la menos
     específica: el `plugins` que creó la CLI, la llamada en su propia línea,
     delante de otros plugins, y, por último, en cualquier otra posición
     (por si la moviste tú). */
  const formas = [
    /\r?\n[ \t]*plugins: \[majixTools\(\)\] \/\* majix-tools \*\/,(?=\r?\n)/,
    / plugins: \[majixTools\(\)\] \/\* majix-tools \*\/,/,
    new RegExp(String.raw`\r?\n[ \t]*${llamada},(?=\r?\n)`),
    new RegExp(String.raw`${llamada}, `),
    new RegExp(String.raw`,?[ \t]*${llamada}`),
  ];
  for (const forma of formas) {
    if (forma.test(codigo)) {
      codigo = codigo.replace(forma, "");
      break;
    }
  }
  return { estado: "cambiado", codigo };
}

/* ── LA LÍNEA DEL PANEL EN EL FICHERO RAÍZ (webs con SSR) ── */
export function anadirLineaCliente(texto: string): Resultado {
  if (texto.includes("majix-tools/cliente")) return { estado: "ya-estaba" };
  const eol = EOL(texto);
  const fin = finDeImports(texto);
  /* Tras los imports, con una línea en blanco delante; si no hay imports,
     al principio, con una línea en blanco detrás. Siempre la misma forma,
     para que `remove` la quite sin dejar rastro. */
  const bloque = fin > 0 ? `${eol}${LINEA_CLIENTE}${eol}` : `${LINEA_CLIENTE}${eol}${eol}`;
  return { estado: "cambiado", codigo: texto.slice(0, fin) + bloque + texto.slice(fin) };
}

export function quitarLineaCliente(texto: string): Resultado {
  if (!texto.includes("majix-tools/cliente")) return { estado: "ya-estaba" };
  const eol = EOL(texto);
  const alPrincipio = `${LINEA_CLIENTE}${eol}${eol}`;
  const trasImports = `${eol}${LINEA_CLIENTE}${eol}`;
  let codigo: string;
  if (texto.startsWith(alPrincipio)) codigo = texto.slice(alPrincipio.length);
  else if (texto.includes(trasImports)) codigo = texto.replace(trasImports, "");
  /* La línea se editó a mano: se quita esa línea y nada más. */ else
    codigo = texto.replace(/^[^\n]*majix-tools\/cliente[^\n]*\r?\n/m, "");
  return { estado: "cambiado", codigo };
}

/* ── LAS VARIABLES DE EJEMPLO EN .env.example ── */
export function anadirBloqueEnv(texto: string): Resultado {
  if (texto.includes("MAJIX_TOOLS_GSC_")) return { estado: "ya-estaba" };
  const eol = EOL(texto);
  /* Un salto de línea delante si el fichero no está vacío (con eso, si ya
     terminaba en salto, queda una línea en blanco de separación). */
  const separador = texto.length === 0 ? "" : eol;
  return { estado: "cambiado", codigo: texto + separador + BLOQUE_ENV.replace(/\n/g, eol) };
}

export function quitarBloqueEnv(texto: string): Resultado {
  if (!texto.includes(MARCA_ENV)) return { estado: "ya-estaba" };
  const eol = EOL(texto);
  const bloque = BLOQUE_ENV.replace(/\n/g, eol);
  if (!texto.endsWith(bloque)) {
    /* Se escribió algo detrás del bloque: se quita solo el bloque. */
    return { estado: "cambiado", codigo: texto.replace(bloque, "") };
  }
  let codigo = texto.slice(0, -bloque.length);
  if (codigo.endsWith(eol)) codigo = codigo.slice(0, -eol.length);
  return { estado: "cambiado", codigo };
}

/** ¿Tu .gitignore deja fuera el .env? Acepta las formas habituales:
 *  `.env`, `/.env`, `.env*`, `.env.*`, `*.env`. */
export function ignoraEnv(gitignore: string): boolean {
  return gitignore
    .split(/\r?\n/)
    .map((l) => l.trim())
    .some((l) => /^\/?(\*\.env|\.env(\*|\.\*)?)$/.test(l));
}
