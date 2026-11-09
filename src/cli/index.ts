import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import {
  LINEA_CLIENTE,
  anadirBloqueEnv,
  anadirLineaCliente,
  anadirPlugin,
  ignoraEnv,
  quitarBloqueEnv,
  quitarLineaCliente,
  quitarPlugin,
  type Resultado,
} from "./parches";
import {
  leerProyectoLocal,
  mayorDeVite,
  ordenDesinstalar,
  ordenInstalar,
  type Proyecto,
} from "./proyecto";
import { textos, type TextosCli } from "./textos";

/* ---------------------------------------------------------------------- *
 * LA CLI — `npx majix-tools init | doctor | remove`
 *
 * Reglas que no se rompen:
 *   · Nunca toca tu `.env` (solo `.env.example`, y solo si existe).
 *   · Cada cambio es reversible: `remove` deja tus ficheros byte a byte
 *     como estaban.
 *   · Se puede repetir sin miedo: si algo ya está hecho, lo dice y sigue.
 *   · `--dry-run` enseña cada cambio antes de hacerlo.
 *   · Si no sabe hacer algo con seguridad, no lo intenta: te dice qué
 *     línea añadir y dónde.
 * ---------------------------------------------------------------------- */

declare const __MAJIX_TOOLS_VERSION__: string;
const VERSION = __MAJIX_TOOLS_VERSION__;

type Opciones = {
  orden: string | null;
  simulacro: boolean;
  sinInstalar: boolean;
  desde: string | null;
  puerto: number;
  idioma: "es" | "en";
  ayuda: boolean;
  version: boolean;
};

/** `--desde`: una dirección de paquete (`github:…`, `git+https://…`, `https://….tgz`) se pasa tal cual; una ruta, se resuelve. */
function fuenteDesde(valor: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(valor) && !/^[a-z]:[\\/]/i.test(valor)) return valor;
  return isAbsolute(valor) ? valor : resolve(process.cwd(), valor);
}

function leerArgumentos(argv: string[]): Opciones {
  const o: Opciones = {
    orden: null,
    simulacro: false,
    sinInstalar: false,
    desde: null,
    puerto: 5173,
    idioma: (process.env.LC_ALL ?? process.env.LANG ?? "").toLowerCase().startsWith("es") ? "es" : "en",
    ayuda: false,
    version: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const valor = () => argv[++i] ?? "";
    if (a === "--dry-run") o.simulacro = true;
    else if (a === "--sin-instalar" || a === "--no-install") o.sinInstalar = true;
    else if (a === "--desde" || a === "--from") o.desde = valor();
    else if (a === "--puerto" || a === "--port") o.puerto = Number(valor()) || 5173;
    else if (a === "--lang") o.idioma = valor() === "es" ? "es" : "en";
    else if (a === "-h" || a === "--help") o.ayuda = true;
    else if (a === "-v" || a === "--version") o.version = true;
    else if (!a.startsWith("-") && !o.orden) o.orden = a;
  }
  return o;
}

/* ── LA SALIDA ── colores solo si es una terminal y NO_COLOR no está puesto. */
const color = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (codigo: string) => (s: string) => (color ? `\x1b[${codigo}m${s}\x1b[0m` : s);
const verde = c("32");
const amarillo = c("33");
const rojo = c("31");
const gris = c("90");
const negrita = c("1");
const morado = c("35");

const bien = (s: string) => console.log(`  ${verde("✓")} ${s}`);
/** Un cambio hecho… o, en simulacro, uno que se haría. */
let enSimulacro = false;
const hecho = (s: string) =>
  enSimulacro ? console.log(`  ${amarillo("→")} ${s}`) : bien(s);
const aviso = (s: string) => console.log(`  ${amarillo("!")} ${s}`);
const fallo = (s: string) => console.log(`  ${rojo("✗")} ${s}`);
const info = (s: string) => console.log(`  ${gris("·")} ${gris(s)}`);
const codigoSuelto = (s: string) => console.log(`\n      ${morado(s)}\n`);

function cabecera(t: TextosCli, p: Proyecto) {
  console.log(`\n${negrita("MAJIX Tools")} ${gris(`v${VERSION}`)}\n`);
  info(t.proyecto(p.paquete.name ?? p.dir));
  info(t.framework(p.framework.nombre));
  info(t.gestor(p.gestor));
  console.log("");
}

/** Diferencias línea a línea (subsecuencia común más larga): marca solo lo
 *  que cambia de verdad. Los ficheros que toca la CLI son pequeños. */
export function diferencias(a: string[], b: string[]): { tipo: " " | "-" | "+"; linea: string }[] {
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const salida: { tipo: " " | "-" | "+"; linea: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      salida.push({ tipo: " ", linea: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) salida.push({ tipo: "-", linea: a[i++] });
    else salida.push({ tipo: "+", linea: b[j++] });
  }
  while (i < n) salida.push({ tipo: "-", linea: a[i++] });
  while (j < m) salida.push({ tipo: "+", linea: b[j++] });
  return salida;
}

/** Enseña el cambio de un fichero como un diff: lo que se va en rojo, lo
 *  que llega en verde y una línea de contexto alrededor. */
function ensenarCambio(t: TextosCli, fichero: string, antes: string, despues: string) {
  console.log(`\n  ${negrita(t.cambioPropuesto(fichero))}`);
  const d = diferencias(antes.split(/\r?\n/), despues.split(/\r?\n/));
  const cerca = (k: number) => d.slice(Math.max(0, k - 1), k + 2).some((x) => x.tipo !== " ");
  let hueco = false;
  d.forEach((x, k) => {
    if (x.tipo === " " && !cerca(k)) {
      if (!hueco) console.log(`    ${gris("…")}`);
      hueco = true;
      return;
    }
    hueco = false;
    if (x.tipo === "-") console.log(`    ${rojo(`- ${x.linea}`)}`);
    else if (x.tipo === "+") console.log(`    ${verde(`+ ${x.linea}`)}`);
    else console.log(`    ${gris(`  ${x.linea}`)}`);
  });
  console.log("");
}

function aplicar(
  t: TextosCli,
  o: Opciones,
  dir: string,
  fichero: string,
  cambio: (texto: string) => Resultado,
  crearSiFalta = false,
): Resultado | null {
  const ruta = join(dir, fichero);
  if (!existsSync(ruta) && !crearSiFalta) return null;
  const antes = existsSync(ruta) ? readFileSync(ruta, "utf8") : "";
  const r = cambio(antes);
  if (r.estado === "cambiado") {
    if (o.simulacro) ensenarCambio(t, fichero, antes, r.codigo);
    else {
      mkdirSync(dirname(ruta), { recursive: true });
      writeFileSync(ruta, r.codigo);
    }
  }
  return r;
}

function ejecutar(orden: [string, string[]], dir: string): boolean {
  const r = spawnSync(orden[0], orden[1], {
    cwd: dir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return r.status === 0;
}

const texto = (orden: [string, string[]]) => [orden[0], ...orden[1]].join(" ");

function leerGitignore(dir: string): string {
  const ruta = join(dir, ".gitignore");
  return existsSync(ruta) ? readFileSync(ruta, "utf8") : "";
}

function ordenDev(p: Proyecto): string {
  return p.gestor === "npm" ? "npm run dev" : `${p.gestor} dev`;
}

/* ── INIT ── */
function init(t: TextosCli, o: Opciones, p: Proyecto): number {
  cabecera(t, p);
  if (o.simulacro) aviso(t.simulacro);

  if (p.framework.id === "no-soportado") {
    fallo(p.framework.motivo === "next" ? t.noSoportadoNext : t.noSoportado(p.framework.nombre));
    return 1;
  }
  if (!p.viteDeclarado && !p.viteInstalado) {
    fallo(t.sinVite);
    return 1;
  }
  const mayor = mayorDeVite(p);
  if (mayor !== null && mayor < 5) {
    fallo(t.viteViejo(mayor));
    return 1;
  }
  if (!p.configVite) {
    fallo(t.sinConfig);
    return 1;
  }

  /* 1. El paquete. */
  const yaDeclarado = !!(p.paquete.devDependencies?.["majix-tools"] ?? p.paquete.dependencies?.["majix-tools"]);
  if (o.sinInstalar) {
    /* nada */
  } else if (yaDeclarado && p.instalado && !o.desde) {
    bien(t.yaInstalado(p.instalado));
  } else {
    /* Por defecto, desde GitHub y fijado a la etiqueta de esta versión (reproducible): no hay nada que instalar aparte,
       es una dependencia de desarrollo de TU proyecto. `--desde` permite otra fuente (un .tgz, una carpeta, otra etiqueta). */
    const fuente = o.desde ? fuenteDesde(o.desde) : `github:majixgroup/majix-tools#v${VERSION}`;
    const orden = ordenInstalar(p.gestor, fuente);
    if (o.simulacro) hecho(t.instalando(texto(orden)));
    else {
      info(t.instalando(texto(orden)));
      if (!ejecutar(orden, p.dir)) {
        fallo(t.instalacionFallo(texto(orden)));
        return 1;
      }
    }
  }

  /* 2. El plugin en vite.config. */
  const rConfig = aplicar(t, o, p.dir, p.configVite, anadirPlugin)!;
  if (rConfig.estado === "cambiado") hecho(t.configCambiado(p.configVite));
  else if (rConfig.estado === "ya-estaba") bien(t.configYaEstaba(p.configVite));
  else {
    aviso(t.configNoPuedo(p.configVite));
    codigoSuelto(`import { majixTools } from "majix-tools/vite";\n      …\n      plugins: [majixTools(), /* tus otros plugins */],`);
  }

  /* 3. La línea del panel, en las webs que se pintan en el servidor. */
  const f = p.framework;
  if (f.id !== "spa") {
    if (f.raiz) {
      const existia = existsSync(join(p.dir, f.raiz));
      const r = aplicar(t, o, p.dir, f.raiz, anadirLineaCliente, f.id === "sveltekit");
      if (r?.estado === "cambiado") hecho(existia ? t.raizCambiada(f.raiz) : t.raizCreada(f.raiz));
      else if (r?.estado === "ya-estaba") bien(t.raizYaEstaba(f.raiz));
    } else {
      aviso(t.raizNoEncontrada(f.nombre));
      codigoSuelto(LINEA_CLIENTE);
    }
  }

  /* 4. Las variables de ejemplo, solo si ya tienes un .env.example. */
  const rEnv = aplicar(t, o, p.dir, ".env.example", anadirBloqueEnv);
  if (rEnv?.estado === "cambiado") hecho(t.envCambiado(".env.example"));
  else if (rEnv?.estado === "ya-estaba") bien(t.envYaEstaba(".env.example"));

  /* 5. Que tu .env no pueda acabar en git. */
  if (!ignoraEnv(leerGitignore(p.dir))) aviso(t.gitignoreEnv);

  console.log("");
  if (o.simulacro) {
    info(t.simulacroFin);
  } else {
    console.log(`  ${verde(negrita(t.listo))}`);
    console.log(`  ${t.siguiente(ordenDev(p))}`);
  }
  console.log("");
  return 0;
}

/* ── DOCTOR ── */
async function doctor(t: TextosCli, o: Opciones, p: Proyecto): Promise<number> {
  cabecera(t, p);
  console.log(`  ${negrita(t.doctorTitulo)}\n`);
  let errores = 0;
  const mal = (s: string) => {
    errores++;
    fallo(s);
  };

  const [mayorNode, menorNode] = process.versions.node.split(".").map(Number);
  if (mayorNode > 18 || (mayorNode === 18 && menorNode >= 18)) bien(t.dNode(process.versions.node));
  else mal(t.dNodeViejo(process.versions.node));

  if (p.viteInstalado) {
    const mayor = mayorDeVite(p);
    if (mayor !== null && mayor < 5) mal(t.viteViejo(mayor));
    else bien(t.dVite(p.viteInstalado));
  } else mal(t.dViteFalta);

  if (p.instalado) bien(t.dPaquete(p.instalado));
  else mal(t.dPaqueteFalta);

  if (p.configVite) {
    const cfg = readFileSync(join(p.dir, p.configVite), "utf8");
    if (cfg.includes("majix-tools/vite") && /majixTools\s*\(/.test(cfg)) bien(t.dPlugin(p.configVite));
    else mal(t.dPluginFalta(p.configVite));
  } else mal(t.sinConfig);

  const f = p.framework;
  if (f.id !== "spa" && f.id !== "no-soportado") {
    if (f.raiz && existsSync(join(p.dir, f.raiz)) && readFileSync(join(p.dir, f.raiz), "utf8").includes("majix-tools/cliente")) {
      bien(t.dRaiz(f.raiz));
    } else mal(t.dRaizFalta(f.raiz ?? f.nombre));
  }

  if (ignoraEnv(leerGitignore(p.dir))) bien(t.dGitignore);
  else aviso(t.gitignoreEnv);

  /* El servidor, si está arrancado: lo único que prueba que el plugin se
     está ejecutando de verdad, no solo que está escrito en la config. */
  const url = `http://localhost:${o.puerto}/__majix-tools/api/estado`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    const estado = (await res.json()) as {
      ok?: boolean;
      searchConsole?: { falta: string[] };
      sesion?: { estado?: string; plan?: string | null };
    };
    if (res.ok && estado.ok) {
      bien(t.dServidor(`localhost:${o.puerto}`));
      /* La herramienta se usa con la cuenta de MAJIX: sin sesión el panel solo enseña la pantalla de inicio. */
      if (estado.sesion?.estado === "conectada") bien(t.dSesion(estado.sesion.plan ?? "libre"));
      else info(t.dSesionFalta);
      const falta = estado.searchConsole?.falta ?? [];
      if (falta.length) info(t.dGscFalta(falta.join(", ")));
      else bien(t.dGsc);
    } else info(t.dServidorNo(`localhost:${o.puerto}`));
  } catch {
    info(t.dServidorNo(`localhost:${o.puerto}`));
  }

  console.log("");
  if (errores) console.log(`  ${rojo(negrita(t.dResumenErrores(errores)))}\n`);
  else console.log(`  ${verde(negrita(t.dResumenOk))}\n`);
  return errores ? 1 : 0;
}

/* ── REMOVE ── */
function remove(t: TextosCli, o: Opciones, p: Proyecto): number {
  cabecera(t, p);
  if (o.simulacro) aviso(t.simulacro);
  console.log(`  ${t.quitando}\n`);
  let algo = false;

  if (p.configVite) {
    const r = aplicar(t, o, p.dir, p.configVite, quitarPlugin);
    if (r?.estado === "cambiado") {
      algo = true;
      hecho(t.quitadoConfig(p.configVite));
    }
  }
  const f = p.framework;
  if ((f.id === "tanstack-start" || f.id === "react-router" || f.id === "remix" || f.id === "sveltekit") && f.raiz) {
    const r = aplicar(t, o, p.dir, f.raiz, quitarLineaCliente);
    if (r?.estado === "cambiado") {
      algo = true;
      hecho(t.quitadaRaiz(f.raiz));
      /* Si el fichero lo creó `init` (SvelteKit, `hooks.client.ts`) y ya
         no le queda nada, se borra: no existía antes. */
      if (!o.simulacro && r.codigo.trim() === "") rmSync(join(p.dir, f.raiz));
    }
  }
  const rEnv = aplicar(t, o, p.dir, ".env.example", quitarBloqueEnv);
  if (rEnv?.estado === "cambiado") {
    algo = true;
    hecho(t.quitadoEnv(".env.example"));
  }

  const declarado = p.paquete.devDependencies?.["majix-tools"] ?? p.paquete.dependencies?.["majix-tools"];
  if (declarado && !o.sinInstalar) {
    algo = true;
    const orden = ordenDesinstalar(p.gestor);
    info(t.desinstalando(texto(orden)));
    if (!o.simulacro && !ejecutar(orden, p.dir)) {
      fallo(t.instalacionFallo(texto(orden)));
      return 1;
    }
  }

  console.log("");
  if (o.simulacro) info(t.simulacroFin);
  else console.log(`  ${verde(negrita(algo ? t.quitadoTodo : t.nadaQueQuitar))}`);
  console.log("");
  return 0;
}

async function principal(): Promise<number> {
  const o = leerArgumentos(process.argv.slice(2));
  const t = textos(o.idioma);
  enSimulacro = o.simulacro;
  if (o.version) {
    console.log(VERSION);
    return 0;
  }
  if (o.ayuda || !o.orden) {
    console.log(t.ayuda(VERSION));
    return o.ayuda ? 0 : 1;
  }
  if (!["init", "doctor", "remove"].includes(o.orden)) {
    console.error(t.ordenDesconocida(o.orden));
    return 1;
  }
  const p = leerProyectoLocal(process.cwd());
  if (!p) {
    console.error(t.sinPackageJson);
    return 1;
  }
  if (o.orden === "init") return init(t, o, p);
  if (o.orden === "doctor") return doctor(t, o, p);
  return remove(t, o, p);
}

principal().then(
  (codigo) => process.exit(codigo),
  (e) => {
    console.error(e instanceof Error ? e.stack : e);
    process.exit(1);
  },
);
