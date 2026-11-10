#!/usr/bin/env node

// src/cli/index.ts
import { spawnSync } from "node:child_process";
import { existsSync as existsSync2, mkdirSync, readFileSync as readFileSync2, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join as join2, resolve } from "node:path";

// src/cli/parches.ts
var IMPORT_ESM = `import { majixTools } from "majix-tools/vite";`;
var IMPORT_CJS = `const { majixTools } = require("majix-tools/vite");`;
var LLAMADA = "majixTools()";
var PLUGINS_NUEVO = "plugins: [majixTools()] /* majix-tools */,";
var LINEA_CLIENTE = 'if (import.meta.env.DEV && typeof window !== "undefined") void import("majix-tools/cliente"); // MAJIX Tools \xB7 dev only';
var MARCA_ENV = "# \u2500\u2500 MAJIX Tools \xB7 Search Console (dev only) \u2500\u2500";
var BLOQUE_ENV = `${MARCA_ENV}
# Google service account with read access to your property.
# Cuenta de servicio de Google con acceso de lectura a tu propiedad.
# https://majixlab.com/open-source/majix-tools/docs
MAJIX_TOOLS_GSC_CLIENT_EMAIL=
MAJIX_TOOLS_GSC_PRIVATE_KEY=
MAJIX_TOOLS_GSC_SITE=
`;
var EOL = (texto2) => texto2.includes("\r\n") ? "\r\n" : "\n";
function finDeImports(texto2) {
  const re = /^(?:import\s[^;]*?(?:from\s*)?["'][^"']+["'];?|import\s*["'][^"']+["'];?|const\s+\{?[^=]*\}?\s*=\s*require\(["'][^"']+["']\);?)[^\n]*\n/gm;
  let fin = 0;
  let m;
  while (m = re.exec(texto2)) fin = m.index + m[0].length;
  return fin;
}
function pluginsDeNivelSuperior(texto2) {
  const profundidadEn = new Array(texto2.length).fill(-1);
  let profundidad = 0;
  for (let i = 0; i < texto2.length; i++) {
    const ch = texto2[i];
    const sig = texto2[i + 1];
    if (ch === "/" && sig === "/") {
      const fin = texto2.indexOf("\n", i);
      i = fin === -1 ? texto2.length : fin - 1;
      continue;
    }
    if (ch === "/" && sig === "*") {
      const fin = texto2.indexOf("*/", i + 2);
      i = fin === -1 ? texto2.length : fin + 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < texto2.length && texto2[j] !== ch) j += texto2[j] === "\\" ? 2 : 1;
      i = j;
      continue;
    }
    if (ch === "{") profundidad++;
    else if (ch === "}") profundidad--;
    profundidadEn[i] = profundidad;
  }
  let mejor = null;
  for (const m of texto2.matchAll(/(?<![\w$.])plugins\s*:\s*\[/g)) {
    const i = m.index ?? 0;
    const p = profundidadEn[i];
    if (p < 0) continue;
    if (!mejor || p < mejor.profundidad) mejor = { index: i, largo: m[0].length, profundidad: p };
  }
  return mejor ? { index: mejor.index, largo: mejor.largo } : null;
}
function anadirPlugin(texto2) {
  if (texto2.includes("majix-tools/vite")) return { estado: "ya-estaba" };
  const eol = EOL(texto2);
  const esCjs = /\brequire\s*\(/.test(texto2) && !/^\s*import\s/m.test(texto2);
  const lineaImport = (esCjs ? IMPORT_CJS : IMPORT_ESM) + eol;
  let codigo = texto2;
  const plugins = pluginsDeNivelSuperior(codigo);
  if (plugins) {
    const tras = plugins.index + plugins.largo;
    const resto = codigo.slice(tras);
    const saltoYSangria = /^[ \t]*\r?\n([ \t]*)\S/.exec(resto);
    const insercion = saltoYSangria ? `${eol}${saltoYSangria[1]}${LLAMADA},` : resto.trimStart().startsWith("]") ? LLAMADA : `${LLAMADA}, `;
    codigo = codigo.slice(0, tras) + insercion + codigo.slice(tras);
  } else {
    const objeto = /defineConfig\(\s*(?:\([^)]*\)\s*=>\s*\(?\s*)?\{|export\s+default\s*\{|module\.exports\s*=\s*\{/.exec(
      codigo
    );
    if (!objeto) return { estado: "no-se-puede", motivo: "sin-plugins" };
    const tras = objeto.index + objeto[0].length;
    const saltoYSangria = /^[ \t]*\r?\n([ \t]*)\S/.exec(codigo.slice(tras));
    const insercion = saltoYSangria ? `${eol}${saltoYSangria[1]}${PLUGINS_NUEVO}` : ` ${PLUGINS_NUEVO}`;
    codigo = codigo.slice(0, tras) + insercion + codigo.slice(tras);
  }
  const fin = finDeImports(codigo);
  codigo = codigo.slice(0, fin) + lineaImport + codigo.slice(fin);
  return { estado: "cambiado", codigo };
}
function quitarPlugin(texto2) {
  if (!texto2.includes("majix-tools/vite")) return { estado: "ya-estaba" };
  const llamada = String.raw`majixTools\((?:[^()]|\([^()]*\))*\)`;
  let codigo = texto2.replace(/^[^\n]*["']majix-tools\/vite["'][^\n]*\r?\n?/m, "");
  const formas = [
    /\r?\n[ \t]*plugins: \[majixTools\(\)\] \/\* majix-tools \*\/,(?=\r?\n)/,
    / plugins: \[majixTools\(\)\] \/\* majix-tools \*\/,/,
    new RegExp(String.raw`\r?\n[ \t]*${llamada},(?=\r?\n)`),
    new RegExp(String.raw`${llamada}, `),
    new RegExp(String.raw`,?[ \t]*${llamada}`)
  ];
  for (const forma of formas) {
    if (forma.test(codigo)) {
      codigo = codigo.replace(forma, "");
      break;
    }
  }
  return { estado: "cambiado", codigo };
}
function anadirLineaCliente(texto2) {
  if (texto2.includes("majix-tools/cliente")) return { estado: "ya-estaba" };
  const eol = EOL(texto2);
  const fin = finDeImports(texto2);
  const bloque = fin > 0 ? `${eol}${LINEA_CLIENTE}${eol}` : `${LINEA_CLIENTE}${eol}${eol}`;
  return { estado: "cambiado", codigo: texto2.slice(0, fin) + bloque + texto2.slice(fin) };
}
function quitarLineaCliente(texto2) {
  if (!texto2.includes("majix-tools/cliente")) return { estado: "ya-estaba" };
  const eol = EOL(texto2);
  const alPrincipio = `${LINEA_CLIENTE}${eol}${eol}`;
  const trasImports = `${eol}${LINEA_CLIENTE}${eol}`;
  let codigo;
  if (texto2.startsWith(alPrincipio)) codigo = texto2.slice(alPrincipio.length);
  else if (texto2.includes(trasImports)) codigo = texto2.replace(trasImports, "");
  else
    codigo = texto2.replace(/^[^\n]*majix-tools\/cliente[^\n]*\r?\n/m, "");
  return { estado: "cambiado", codigo };
}
function anadirBloqueEnv(texto2) {
  if (texto2.includes("MAJIX_TOOLS_GSC_")) return { estado: "ya-estaba" };
  const eol = EOL(texto2);
  const separador = texto2.length === 0 ? "" : eol;
  return { estado: "cambiado", codigo: texto2 + separador + BLOQUE_ENV.replace(/\n/g, eol) };
}
function quitarBloqueEnv(texto2) {
  if (!texto2.includes(MARCA_ENV)) return { estado: "ya-estaba" };
  const eol = EOL(texto2);
  const bloque = BLOQUE_ENV.replace(/\n/g, eol);
  if (!texto2.endsWith(bloque)) {
    return { estado: "cambiado", codigo: texto2.replace(bloque, "") };
  }
  let codigo = texto2.slice(0, -bloque.length);
  if (codigo.endsWith(eol)) codigo = codigo.slice(0, -eol.length);
  return { estado: "cambiado", codigo };
}
function ignoraEnv(gitignore) {
  return gitignore.split(/\r?\n/).map((l) => l.trim()).some((l) => /^\/?(\*\.env|\.env(\*|\.\*)?)$/.test(l));
}

// src/cli/proyecto.ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
var CONFIGS = ["vite.config.ts", "vite.config.mts", "vite.config.js", "vite.config.mjs", "vite.config.cts", "vite.config.cjs"];
function leerJson(ruta) {
  try {
    return JSON.parse(readFileSync(ruta, "utf8"));
  } catch {
    return null;
  }
}
function primeroQueExista(dir, rutas) {
  for (const r of rutas) if (existsSync(join(dir, r))) return r;
  return null;
}
function detectarGestor(dir) {
  const agente = process.env.npm_config_user_agent ?? "";
  if (agente.startsWith("pnpm")) return "pnpm";
  if (agente.startsWith("yarn")) return "yarn";
  if (agente.startsWith("bun")) return "bun";
  if (existsSync(join(dir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(dir, "yarn.lock"))) return "yarn";
  if (existsSync(join(dir, "bun.lockb")) || existsSync(join(dir, "bun.lock"))) return "bun";
  return "npm";
}
function ordenInstalar(gestor, que) {
  switch (gestor) {
    case "pnpm":
      return ["pnpm", ["add", "-D", que]];
    case "yarn":
      return ["yarn", ["add", "-D", que]];
    case "bun":
      return ["bun", ["add", "-d", que]];
    default:
      return ["npm", ["install", "-D", que]];
  }
}
function ordenDesinstalar(gestor) {
  switch (gestor) {
    case "pnpm":
      return ["pnpm", ["remove", "majix-tools"]];
    case "yarn":
      return ["yarn", ["remove", "majix-tools"]];
    case "bun":
      return ["bun", ["remove", "majix-tools"]];
    default:
      return ["npm", ["uninstall", "majix-tools"]];
  }
}
function detectarFramework(dir, deps) {
  if (deps.next) {
    return { id: "no-soportado", nombre: "Next.js", motivo: "next" };
  }
  if (deps.nuxt) return { id: "no-soportado", nombre: "Nuxt", motivo: "nuxt" };
  if (deps.astro) return { id: "no-soportado", nombre: "Astro", motivo: "astro" };
  if (deps["@angular/core"] && !deps.vite) {
    return { id: "no-soportado", nombre: "Angular", motivo: "sin-vite" };
  }
  if (deps["@tanstack/react-start"] || deps["@tanstack/solid-start"]) {
    return {
      id: "tanstack-start",
      nombre: "TanStack Start",
      raiz: primeroQueExista(dir, [
        "src/routes/__root.tsx",
        "app/routes/__root.tsx",
        "src/routes/__root.jsx",
        "app/routes/__root.jsx"
      ])
    };
  }
  if (deps["@react-router/dev"]) {
    return {
      id: "react-router",
      nombre: "React Router",
      raiz: primeroQueExista(dir, ["app/root.tsx", "app/root.jsx", "src/root.tsx"])
    };
  }
  if (deps["@remix-run/dev"]) {
    return {
      id: "remix",
      nombre: "Remix",
      raiz: primeroQueExista(dir, ["app/root.tsx", "app/root.jsx"])
    };
  }
  if (deps["@sveltejs/kit"]) {
    return {
      id: "sveltekit",
      nombre: "SvelteKit",
      raiz: primeroQueExista(dir, ["src/hooks.client.ts", "src/hooks.client.js"]) ?? "src/hooks.client.ts"
    };
  }
  const nombre = deps.react ? "React + Vite" : deps.vue ? "Vue + Vite" : deps.svelte ? "Svelte + Vite" : deps["solid-js"] ? "Solid + Vite" : deps.preact ? "Preact + Vite" : deps.lit ? "Lit + Vite" : "Vite";
  return { id: "spa", nombre };
}
function leerProyectoLocal(dir) {
  const paquete = leerJson(join(dir, "package.json"));
  if (!paquete) return null;
  const deps = { ...paquete.dependencies, ...paquete.devDependencies };
  const viteInstalado = leerJson(join(dir, "node_modules", "vite", "package.json"))?.version ?? null;
  const instalado = leerJson(join(dir, "node_modules", "majix-tools", "package.json"))?.version ?? null;
  return {
    dir,
    paquete,
    gestor: detectarGestor(dir),
    viteDeclarado: deps.vite ?? null,
    viteInstalado,
    configVite: primeroQueExista(dir, CONFIGS),
    framework: detectarFramework(dir, deps),
    instalado
  };
}
function mayorDeVite(p) {
  const fuente = p.viteInstalado ?? p.viteDeclarado;
  const m = fuente?.match(/(\d+)\./) ?? fuente?.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

// src/cli/textos.ts
var es = {
  ayuda: (v) => `MAJIX Tools v${v} \u2014 panel de desarrollo para webs hechas con Vite

Uso:
  npx majix-tools <orden> [opciones]

\xD3rdenes:
  init      Instala MAJIX Tools en este proyecto
  doctor    Comprueba que la instalaci\xF3n est\xE1 bien, paso a paso
  remove    Quita MAJIX Tools y deja tus ficheros como estaban

Opciones:
  --dry-run          Ense\xF1a lo que har\xEDa, sin tocar nada
  --sin-instalar     No instala el paquete (ya lo instalaste t\xFA)
  --desde <ruta>     Instala desde un .tgz o una carpeta local
  --puerto <n>       Puerto de tu servidor de desarrollo (para doctor; por defecto 5173)
  --lang es|en       Idioma de los mensajes
  -h, --help         Esta ayuda
  -v, --version      La versi\xF3n

Documentaci\xF3n: https://majixlab.com/open-source/majix-tools/docs`,
  ordenDesconocida: (o) => `No conozco la orden \xAB${o}\xBB. Usa init, doctor o remove (--help para ver todo).`,
  sinPackageJson: "No hay package.json en esta carpeta. Ejecuta la orden desde la ra\xEDz de tu proyecto (donde est\xE1 package.json).",
  proyecto: (n) => `Proyecto: ${n}`,
  framework: (n) => `Tipo: ${n}`,
  gestor: (g) => `Gestor de paquetes: ${g}`,
  simulacro: "Simulacro (--dry-run): no se va a tocar ning\xFAn fichero.",
  sinVite: "Este proyecto no usa Vite. MAJIX Tools es un plugin de Vite: necesita Vite 5 o superior.",
  viteViejo: (m) => `Tienes Vite ${m}. MAJIX Tools necesita Vite 5 o superior: actual\xEDzalo primero.`,
  noSoportado: (n) => `${n} todav\xEDa no se instala autom\xE1ticamente. Mira la gu\xEDa manual: https://majixlab.com/open-source/majix-tools/docs`,
  noSoportadoNext: "Next.js no usa Vite (usa webpack/Turbopack), y MAJIX Tools es un plugin de Vite. Hoy no funciona con Next.js.",
  instalando: (orden) => `Instalar el paquete: ${orden}`,
  yaInstalado: (v) => `El paquete ya est\xE1 instalado (v${v}).`,
  instalacionFallo: (orden) => `No se pudo instalar el paquete. Prueba a ejecutar t\xFA: ${orden}`,
  sinConfig: "No encuentro vite.config (.ts/.js/.mjs\u2026). Crea uno o a\xF1ade el plugin a mano (mira la gu\xEDa manual).",
  configCambiado: (f) => `${f}: a\xF1adido el plugin majixTools()`,
  configYaEstaba: (f) => `${f}: el plugin ya estaba`,
  configNoPuedo: (f) => `${f}: no s\xE9 d\xF3nde a\xF1adir el plugin autom\xE1ticamente. A\xF1\xE1delo t\xFA dentro de plugins: [ \u2026 ] as\xED:`,
  raizCambiada: (f) => `${f}: a\xF1adida la l\xEDnea que carga el panel (solo en desarrollo)`,
  raizYaEstaba: (f) => `${f}: la l\xEDnea del panel ya estaba`,
  raizCreada: (f) => `${f}: creado, con la l\xEDnea que carga el panel`,
  raizNoEncontrada: (n) => `No encuentro el fichero ra\xEDz de ${n}. A\xF1ade t\xFA esta l\xEDnea al principio de tu fichero ra\xEDz, tras los imports:`,
  envCambiado: (f) => `${f}: a\xF1adidas las variables de Search Console (vac\xEDas)`,
  envYaEstaba: (f) => `${f}: las variables de Search Console ya estaban`,
  gitignoreEnv: "Tu .gitignore no ignora .env. A\xF1\xE1delo antes de poner credenciales: si no, podr\xEDas subirlas a git.",
  listo: "Listo. MAJIX Tools est\xE1 instalado.",
  siguiente: (orden) => `Siguiente paso: arranca tu servidor de desarrollo (${orden}) y abre tu web. El panel est\xE1 abajo en el centro.`,
  simulacroFin: "Fin del simulacro. Quita --dry-run para hacerlo de verdad.",
  cambioPropuesto: (f) => `Cambio en ${f}:`,
  doctorTitulo: "Revisi\xF3n de MAJIX Tools",
  dSesion: (plan) => `Sesi\xF3n de MAJIX iniciada (plan ${plan})`,
  dSesionFalta: "Falta iniciar sesi\xF3n: abre tu web, pulsa el bot\xF3n de MAJIX Tools de abajo y sigue los pasos (gratis, con tu cuenta de MAJIX)",
  ok: "bien",
  aviso: "aviso",
  error: "error",
  dNode: (v) => `Node ${v}`,
  dNodeViejo: (v) => `Node ${v}: MAJIX Tools necesita Node 18.18 o superior.`,
  dVite: (v) => `Vite ${v}`,
  dViteFalta: "Vite no est\xE1 instalado. Ejecuta la instalaci\xF3n de dependencias de tu proyecto.",
  dPaquete: (v) => `majix-tools ${v} instalado`,
  dPaqueteFalta: "majix-tools no est\xE1 instalado. Ejecuta: npx github:majixgroup/majix-tools init",
  dPlugin: (f) => `Plugin en ${f}`,
  dPluginFalta: (f) => `${f} no carga el plugin. Ejecuta: npx github:majixgroup/majix-tools init`,
  dRaiz: (f) => `Panel cargado desde ${f}`,
  dRaizFalta: (f) => `${f} no carga el panel. Ejecuta: npx github:majixgroup/majix-tools init`,
  dGitignore: ".env est\xE1 en .gitignore",
  dServidor: (url) => `Servidor de desarrollo respondiendo en ${url}`,
  dServidorNo: (url) => `No hay un servidor de desarrollo en ${url} (o no tiene el plugin). Si usas otro puerto: --puerto <n>. Si no est\xE1 arrancado, esto no es un fallo.`,
  dGsc: "Search Console: credenciales completas",
  dGscFalta: (v) => `Search Console: faltan ${v} (opcional; la pesta\xF1a te gu\xEDa)`,
  dResumenOk: "Todo en orden.",
  dResumenErrores: (n) => `${n} ${n === 1 ? "cosa que arreglar" : "cosas que arreglar"}.`,
  quitando: "Quitando MAJIX Tools\u2026",
  quitadoConfig: (f) => `${f}: quitado el plugin`,
  quitadaRaiz: (f) => `${f}: quitada la l\xEDnea del panel`,
  quitadoEnv: (f) => `${f}: quitadas las variables de Search Console`,
  desinstalando: (orden) => `Desinstalando el paquete: ${orden}`,
  quitadoTodo: "Listo. MAJIX Tools ya no est\xE1 en este proyecto.",
  nadaQueQuitar: "No hab\xEDa nada de MAJIX Tools que quitar."
};
var en = {
  ayuda: (v) => `MAJIX Tools v${v} \u2014 a dev panel for sites built with Vite

Usage:
  npx majix-tools <command> [options]

Commands:
  init      Install MAJIX Tools in this project
  doctor    Check the installation, step by step
  remove    Remove MAJIX Tools and leave your files as they were

Options:
  --dry-run          Show what it would do, without touching anything
  --no-install       Don't install the package (you already did)
  --from <path>      Install from a .tgz file or a local folder
  --port <n>         Your dev server port (for doctor; 5173 by default)
  --lang es|en       Language of the messages
  -h, --help         This help
  -v, --version      The version

Documentation: https://majixlab.com/open-source/majix-tools/docs`,
  ordenDesconocida: (o) => `Unknown command \u201C${o}\u201D. Use init, doctor or remove (--help to see everything).`,
  sinPackageJson: "There's no package.json in this folder. Run the command from your project root (where package.json is).",
  proyecto: (n) => `Project: ${n}`,
  framework: (n) => `Type: ${n}`,
  gestor: (g) => `Package manager: ${g}`,
  simulacro: "Dry run (--dry-run): no file will be touched.",
  sinVite: "This project doesn't use Vite. MAJIX Tools is a Vite plugin: it needs Vite 5 or newer.",
  viteViejo: (m) => `You have Vite ${m}. MAJIX Tools needs Vite 5 or newer: upgrade it first.`,
  noSoportado: (n) => `${n} isn't installed automatically yet. See the manual guide: https://majixlab.com/open-source/majix-tools/docs`,
  noSoportadoNext: "Next.js doesn't use Vite (it uses webpack/Turbopack), and MAJIX Tools is a Vite plugin. It doesn't work with Next.js today.",
  instalando: (orden) => `Install the package: ${orden}`,
  yaInstalado: (v) => `The package is already installed (v${v}).`,
  instalacionFallo: (orden) => `The package couldn't be installed. Try running it yourself: ${orden}`,
  sinConfig: "I can't find vite.config (.ts/.js/.mjs\u2026). Create one or add the plugin by hand (see the manual guide).",
  configCambiado: (f) => `${f}: added the majixTools() plugin`,
  configYaEstaba: (f) => `${f}: the plugin was already there`,
  configNoPuedo: (f) => `${f}: I don't know where to add the plugin automatically. Add it yourself inside plugins: [ \u2026 ] like this:`,
  raizCambiada: (f) => `${f}: added the line that loads the panel (development only)`,
  raizYaEstaba: (f) => `${f}: the panel line was already there`,
  raizCreada: (f) => `${f}: created, with the line that loads the panel`,
  raizNoEncontrada: (n) => `I can't find the ${n} root file. Add this line at the top of your root file, after the imports:`,
  envCambiado: (f) => `${f}: added the Search Console variables (empty)`,
  envYaEstaba: (f) => `${f}: the Search Console variables were already there`,
  gitignoreEnv: "Your .gitignore doesn't ignore .env. Add it before adding credentials, or you could commit them to git.",
  listo: "Done. MAJIX Tools is installed.",
  siguiente: (orden) => `Next step: start your dev server (${orden}) and open your site. The panel is at the bottom centre.`,
  simulacroFin: "End of the dry run. Remove --dry-run to do it for real.",
  cambioPropuesto: (f) => `Change in ${f}:`,
  doctorTitulo: "MAJIX Tools check-up",
  dSesion: (plan) => `MAJIX session signed in (${plan} plan)`,
  dSesionFalta: "You still need to sign in: open your site, press the MAJIX Tools button at the bottom and follow the steps (free, with your MAJIX account)",
  ok: "ok",
  aviso: "warning",
  error: "error",
  dNode: (v) => `Node ${v}`,
  dNodeViejo: (v) => `Node ${v}: MAJIX Tools needs Node 18.18 or newer.`,
  dVite: (v) => `Vite ${v}`,
  dViteFalta: "Vite isn't installed. Install your project's dependencies.",
  dPaquete: (v) => `majix-tools ${v} installed`,
  dPaqueteFalta: "majix-tools isn't installed. Run: npx github:majixgroup/majix-tools init",
  dPlugin: (f) => `Plugin in ${f}`,
  dPluginFalta: (f) => `${f} doesn't load the plugin. Run: npx github:majixgroup/majix-tools init`,
  dRaiz: (f) => `Panel loaded from ${f}`,
  dRaizFalta: (f) => `${f} doesn't load the panel. Run: npx github:majixgroup/majix-tools init`,
  dGitignore: ".env is in .gitignore",
  dServidor: (url) => `Dev server answering at ${url}`,
  dServidorNo: (url) => `No dev server at ${url} (or it doesn't have the plugin). If you use another port: --port <n>. If it isn't running, this isn't a problem.`,
  dGsc: "Search Console: credentials complete",
  dGscFalta: (v) => `Search Console: missing ${v} (optional; the tab guides you)`,
  dResumenOk: "Everything in order.",
  dResumenErrores: (n) => `${n} ${n === 1 ? "thing to fix" : "things to fix"}.`,
  quitando: "Removing MAJIX Tools\u2026",
  quitadoConfig: (f) => `${f}: removed the plugin`,
  quitadaRaiz: (f) => `${f}: removed the panel line`,
  quitadoEnv: (f) => `${f}: removed the Search Console variables`,
  desinstalando: (orden) => `Uninstalling the package: ${orden}`,
  quitadoTodo: "Done. MAJIX Tools is no longer in this project.",
  nadaQueQuitar: "There was nothing from MAJIX Tools to remove."
};
function textos(idioma) {
  return idioma === "es" ? es : en;
}

// src/cli/index.ts
var VERSION = "0.2.1";
function fuenteDesde(valor) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(valor) && !/^[a-z]:[\\/]/i.test(valor)) return valor;
  return isAbsolute(valor) ? valor : resolve(process.cwd(), valor);
}
function leerArgumentos(argv) {
  const o = {
    orden: null,
    simulacro: false,
    sinInstalar: false,
    desde: null,
    puerto: 5173,
    idioma: (process.env.LC_ALL ?? process.env.LANG ?? "").toLowerCase().startsWith("es") ? "es" : "en",
    ayuda: false,
    version: false
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
var color = process.stdout.isTTY && !process.env.NO_COLOR;
var c = (codigo) => (s) => color ? `\x1B[${codigo}m${s}\x1B[0m` : s;
var verde = c("32");
var amarillo = c("33");
var rojo = c("31");
var gris = c("90");
var negrita = c("1");
var morado = c("35");
var bien = (s) => console.log(`  ${verde("\u2713")} ${s}`);
var enSimulacro = false;
var hecho = (s) => enSimulacro ? console.log(`  ${amarillo("\u2192")} ${s}`) : bien(s);
var aviso = (s) => console.log(`  ${amarillo("!")} ${s}`);
var fallo = (s) => console.log(`  ${rojo("\u2717")} ${s}`);
var info = (s) => console.log(`  ${gris("\xB7")} ${gris(s)}`);
var codigoSuelto = (s) => console.log(`
      ${morado(s)}
`);
function cabecera(t, p) {
  console.log(`
${negrita("MAJIX Tools")} ${gris(`v${VERSION}`)}
`);
  info(t.proyecto(p.paquete.name ?? p.dir));
  info(t.framework(p.framework.nombre));
  info(t.gestor(p.gestor));
  console.log("");
}
function diferencias(a, b) {
  const n = a.length;
  const m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i2 = n - 1; i2 >= 0; i2--) {
    for (let j2 = m - 1; j2 >= 0; j2--) {
      lcs[i2][j2] = a[i2] === b[j2] ? lcs[i2 + 1][j2 + 1] + 1 : Math.max(lcs[i2 + 1][j2], lcs[i2][j2 + 1]);
    }
  }
  const salida = [];
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
function ensenarCambio(t, fichero, antes, despues) {
  console.log(`
  ${negrita(t.cambioPropuesto(fichero))}`);
  const d = diferencias(antes.split(/\r?\n/), despues.split(/\r?\n/));
  const cerca = (k) => d.slice(Math.max(0, k - 1), k + 2).some((x) => x.tipo !== " ");
  let hueco = false;
  d.forEach((x, k) => {
    if (x.tipo === " " && !cerca(k)) {
      if (!hueco) console.log(`    ${gris("\u2026")}`);
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
function aplicar(t, o, dir, fichero, cambio, crearSiFalta = false) {
  const ruta = join2(dir, fichero);
  if (!existsSync2(ruta) && !crearSiFalta) return null;
  const antes = existsSync2(ruta) ? readFileSync2(ruta, "utf8") : "";
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
function ejecutar(orden, dir) {
  const r = spawnSync(orden[0], orden[1], {
    cwd: dir,
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  return r.status === 0;
}
var texto = (orden) => [orden[0], ...orden[1]].join(" ");
function leerGitignore(dir) {
  const ruta = join2(dir, ".gitignore");
  return existsSync2(ruta) ? readFileSync2(ruta, "utf8") : "";
}
function ordenDev(p) {
  return p.gestor === "npm" ? "npm run dev" : `${p.gestor} dev`;
}
function init(t, o, p) {
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
  const yaDeclarado = !!(p.paquete.devDependencies?.["majix-tools"] ?? p.paquete.dependencies?.["majix-tools"]);
  if (o.sinInstalar) {
  } else if (yaDeclarado && p.instalado && !o.desde) {
    bien(t.yaInstalado(p.instalado));
  } else {
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
  const rConfig = aplicar(t, o, p.dir, p.configVite, anadirPlugin);
  if (rConfig.estado === "cambiado") hecho(t.configCambiado(p.configVite));
  else if (rConfig.estado === "ya-estaba") bien(t.configYaEstaba(p.configVite));
  else {
    aviso(t.configNoPuedo(p.configVite));
    codigoSuelto(`import { majixTools } from "majix-tools/vite";
      \u2026
      plugins: [majixTools(), /* tus otros plugins */],`);
  }
  const f = p.framework;
  if (f.id !== "spa") {
    if (f.raiz) {
      const existia = existsSync2(join2(p.dir, f.raiz));
      const r = aplicar(t, o, p.dir, f.raiz, anadirLineaCliente, f.id === "sveltekit");
      if (r?.estado === "cambiado") hecho(existia ? t.raizCambiada(f.raiz) : t.raizCreada(f.raiz));
      else if (r?.estado === "ya-estaba") bien(t.raizYaEstaba(f.raiz));
    } else {
      aviso(t.raizNoEncontrada(f.nombre));
      codigoSuelto(LINEA_CLIENTE);
    }
  }
  const rEnv = aplicar(t, o, p.dir, ".env.example", anadirBloqueEnv);
  if (rEnv?.estado === "cambiado") hecho(t.envCambiado(".env.example"));
  else if (rEnv?.estado === "ya-estaba") bien(t.envYaEstaba(".env.example"));
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
async function doctor(t, o, p) {
  cabecera(t, p);
  console.log(`  ${negrita(t.doctorTitulo)}
`);
  let errores = 0;
  const mal = (s) => {
    errores++;
    fallo(s);
  };
  const [mayorNode, menorNode] = process.versions.node.split(".").map(Number);
  if (mayorNode > 18 || mayorNode === 18 && menorNode >= 18) bien(t.dNode(process.versions.node));
  else mal(t.dNodeViejo(process.versions.node));
  if (p.viteInstalado) {
    const mayor = mayorDeVite(p);
    if (mayor !== null && mayor < 5) mal(t.viteViejo(mayor));
    else bien(t.dVite(p.viteInstalado));
  } else mal(t.dViteFalta);
  if (p.instalado) bien(t.dPaquete(p.instalado));
  else mal(t.dPaqueteFalta);
  if (p.configVite) {
    const cfg = readFileSync2(join2(p.dir, p.configVite), "utf8");
    if (cfg.includes("majix-tools/vite") && /majixTools\s*\(/.test(cfg)) bien(t.dPlugin(p.configVite));
    else mal(t.dPluginFalta(p.configVite));
  } else mal(t.sinConfig);
  const f = p.framework;
  if (f.id !== "spa" && f.id !== "no-soportado") {
    if (f.raiz && existsSync2(join2(p.dir, f.raiz)) && readFileSync2(join2(p.dir, f.raiz), "utf8").includes("majix-tools/cliente")) {
      bien(t.dRaiz(f.raiz));
    } else mal(t.dRaizFalta(f.raiz ?? f.nombre));
  }
  if (ignoraEnv(leerGitignore(p.dir))) bien(t.dGitignore);
  else aviso(t.gitignoreEnv);
  const url = `http://localhost:${o.puerto}/__majix-tools/api/estado`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2e3) });
    const estado = await res.json();
    if (res.ok && estado.ok) {
      bien(t.dServidor(`localhost:${o.puerto}`));
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
  if (errores) console.log(`  ${rojo(negrita(t.dResumenErrores(errores)))}
`);
  else console.log(`  ${verde(negrita(t.dResumenOk))}
`);
  return errores ? 1 : 0;
}
function remove(t, o, p) {
  cabecera(t, p);
  if (o.simulacro) aviso(t.simulacro);
  console.log(`  ${t.quitando}
`);
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
      if (!o.simulacro && r.codigo.trim() === "") rmSync(join2(p.dir, f.raiz));
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
async function principal() {
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
  }
);
export {
  diferencias
};
