import { execFile } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

/* ---------------------------------------------------------------------- *
 * EL ÁRBOL DE TU PROYECTO, CON EL PESO REAL DE CADA FICHERO
 *
 * El navegador no puede leer el disco; esto se ejecuta en el servidor de
 * desarrollo de Vite y lee la carpeta raíz de tu proyecto.
 *
 * ── QUÉ SE ENSEÑA ──
 * Si el proyecto está en git, EXACTAMENTE lo que git no ignora
 * (`git ls-files --cached --others --exclude-standard`): tu `.gitignore` ya
 * dice qué es tu código y qué no, y MAJIX Tools no tiene por qué adivinarlo.
 * Si no hay git, se recorre el disco saltando dependencias, builds y cachés.
 *
 * En los dos casos, los secretos NUNCA salen: ni el nombre ni el tamaño de
 * `.env*` (salvo `.env.example`), claves `*.pem`/`*.key`/`*.p12`, ni
 * credenciales `service-account*.json`, aunque estén en git.
 * ---------------------------------------------------------------------- */

const ejecutar = promisify(execFile);

/** Por encima de esto se corta: un árbol de 200 000 ficheros no se lee en
 *  un panel, y leerlo cada 8 s cargaría el disco sin motivo. */
export const MAX_FICHEROS = 20_000;

const CARPETAS_EXCLUIDAS = new Set([
  "node_modules",
  ".git",
  ".hg",
  ".svn",
  "dist",
  "dist-ssr",
  "build",
  "out",
  ".output",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".astro",
  ".vercel",
  ".netlify",
  ".wrangler",
  ".turbo",
  ".cache",
  ".parcel-cache",
  ".vite",
  ".vinxi",
  ".nitro",
  ".tanstack",
  "coverage",
  ".nyc_output",
  ".DS_Store",
]);

export function esSecreto(nombre: string): boolean {
  const n = nombre.toLowerCase();
  if (n === ".ds_store" || n === "thumbs.db") return true;
  if (n === ".env" || (n.startsWith(".env.") && n !== ".env.example")) return true;
  if (n.endsWith(".pem") || n.endsWith(".key") || n.endsWith(".p12") || n.endsWith(".pfx")) {
    return true;
  }
  if (n.startsWith("service-account") && n.endsWith(".json")) return true;
  if (n === ".npmrc" || n === ".netrc" || n === "id_rsa" || n === "id_ed25519") return true;
  return false;
}

export type Nodo = {
  nombre: string;
  ruta: string;
  tipo: "carpeta" | "archivo";
  bytes: number;
  hijos?: Nodo[];
};

async function listarConGit(raiz: string): Promise<string[] | null> {
  try {
    const { stdout } = await ejecutar(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { cwd: raiz, maxBuffer: 256 * 1024 * 1024, windowsHide: true },
    );
    return stdout.split("\0").filter(Boolean);
  } catch {
    /* No es un repositorio git, o git no está instalado. */
    return null;
  }
}

async function listarDisco(raiz: string, rel = "", salida: string[] = []): Promise<string[]> {
  if (salida.length > MAX_FICHEROS) return salida;
  let entradas;
  try {
    entradas = await readdir(join(raiz, rel), { withFileTypes: true });
  } catch {
    return salida;
  }
  for (const e of entradas) {
    if (e.isSymbolicLink()) continue;
    const ruta = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (!CARPETAS_EXCLUIDAS.has(e.name)) await listarDisco(raiz, ruta, salida);
    } else if (e.isFile()) {
      salida.push(ruta);
    }
  }
  return salida;
}

/** Ejecuta `tarea` sobre cada elemento con como mucho `n` a la vez. */
async function enLotes<T, R>(items: T[], n: number, tarea: (x: T) => Promise<R>): Promise<R[]> {
  const salida: R[] = new Array(items.length);
  let siguiente = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (siguiente < items.length) {
        const i = siguiente++;
        salida[i] = await tarea(items[i]);
      }
    }),
  );
  return salida;
}

export function construirArbol(ficheros: { ruta: string; bytes: number }[]): Nodo[] {
  type Carpeta = { hijos: Map<string, Carpeta | Nodo> };
  const raiz: Carpeta = { hijos: new Map() };
  for (const f of ficheros) {
    const partes = f.ruta.split("/");
    let actual = raiz;
    for (let i = 0; i < partes.length - 1; i++) {
      let sub = actual.hijos.get(partes[i]);
      /* Un `Nodo` lleva `tipo`; una carpeta en construcción, no. */
      if (!sub || "tipo" in sub) {
        sub = { hijos: new Map() };
        actual.hijos.set(partes[i], sub);
      }
      actual = sub;
    }
    actual.hijos.set(partes[partes.length - 1], {
      nombre: partes[partes.length - 1],
      ruta: f.ruta,
      tipo: "archivo",
      bytes: f.bytes,
    });
  }
  const aNodos = (c: Carpeta, prefijo: string): Nodo[] => {
    const nodos: Nodo[] = [];
    for (const [nombre, h] of c.hijos) {
      if ("tipo" in h) {
        nodos.push(h as Nodo);
      } else {
        const ruta = prefijo ? `${prefijo}/${nombre}` : nombre;
        const hijos = aNodos(h as Carpeta, ruta);
        if (!hijos.length) continue;
        nodos.push({
          nombre,
          ruta,
          tipo: "carpeta",
          bytes: hijos.reduce((s, x) => s + x.bytes, 0),
          hijos,
        });
      }
    }
    return nodos.sort((a, b) => b.bytes - a.bytes);
  };
  return aNodos(raiz, "");
}

function contar(nodos: Nodo[]): { archivos: number; carpetas: number } {
  let archivos = 0;
  let carpetas = 0;
  for (const n of nodos) {
    if (n.tipo === "archivo") archivos++;
    else {
      carpetas++;
      const sub = contar(n.hijos ?? []);
      archivos += sub.archivos;
      carpetas += sub.carpetas;
    }
  }
  return { archivos, carpetas };
}

export async function leerProyecto(raiz: string) {
  const deGit = await listarConGit(raiz);
  const todas = (deGit ?? (await listarDisco(raiz))).filter(
    (ruta) => !ruta.split("/").some(esSecreto),
  );
  const recortado = todas.length > MAX_FICHEROS;
  const rutas = todas.slice(0, MAX_FICHEROS);

  /* `git ls-files --cached` también lista ficheros borrados del disco que
     aún no se han quitado del índice: se descartan al no poder leerlos. */
  const medidos = await enLotes(rutas, 64, async (ruta) => {
    try {
      const info = await stat(join(raiz, ruta));
      return info.isFile() ? { ruta, bytes: info.size } : null;
    } catch {
      return null;
    }
  });
  const ficheros = medidos.filter((x): x is { ruta: string; bytes: number } => x !== null);
  const arbol = construirArbol(ficheros);
  const { archivos, carpetas } = contar(arbol);

  return {
    raiz,
    fuente: deGit ? ("git" as const) : ("disco" as const),
    recortado,
    generadoEn: new Date().toISOString(),
    totalBytes: arbol.reduce((s, n) => s + n.bytes, 0),
    totalArchivos: archivos,
    totalCarpetas: carpetas,
    arbol,
  };
}
