/* ---------------------------------------------------------------------- *
 * LOS TEXTOS DE LA CLI — español e inglés
 *
 * Se elige con `--lang es|en`; si no, por la variable LANG de tu terminal
 * (es_* → español; cualquier otra → inglés).
 * ---------------------------------------------------------------------- */

const es = {
  ayuda: (v: string) => `MAJIX Tools v${v} — panel de desarrollo para webs hechas con Vite

Uso:
  npx majix-tools <orden> [opciones]

Órdenes:
  init      Instala MAJIX Tools en este proyecto
  doctor    Comprueba que la instalación está bien, paso a paso
  remove    Quita MAJIX Tools y deja tus ficheros como estaban

Opciones:
  --dry-run          Enseña lo que haría, sin tocar nada
  --sin-instalar     No instala el paquete (ya lo instalaste tú)
  --desde <ruta>     Instala desde un .tgz o una carpeta local
  --puerto <n>       Puerto de tu servidor de desarrollo (para doctor; por defecto 5173)
  --lang es|en       Idioma de los mensajes
  -h, --help         Esta ayuda
  -v, --version      La versión

Documentación: https://majixlab.com/open-source/majix-tools/docs`,
  ordenDesconocida: (o: string) => `No conozco la orden «${o}». Usa init, doctor o remove (--help para ver todo).`,
  sinPackageJson:
    "No hay package.json en esta carpeta. Ejecuta la orden desde la raíz de tu proyecto (donde está package.json).",
  proyecto: (n: string) => `Proyecto: ${n}`,
  framework: (n: string) => `Tipo: ${n}`,
  gestor: (g: string) => `Gestor de paquetes: ${g}`,
  simulacro: "Simulacro (--dry-run): no se va a tocar ningún fichero.",
  sinVite:
    "Este proyecto no usa Vite. MAJIX Tools es un plugin de Vite: necesita Vite 5 o superior.",
  viteViejo: (m: number) => `Tienes Vite ${m}. MAJIX Tools necesita Vite 5 o superior: actualízalo primero.`,
  noSoportado: (n: string) =>
    `${n} todavía no se instala automáticamente. Mira la guía manual: https://majixlab.com/open-source/majix-tools/docs`,
  noSoportadoNext:
    "Next.js no usa Vite (usa webpack/Turbopack), y MAJIX Tools es un plugin de Vite. Hoy no funciona con Next.js.",
  instalando: (orden: string) => `Instalar el paquete: ${orden}`,
  yaInstalado: (v: string) => `El paquete ya está instalado (v${v}).`,
  instalacionFallo: (orden: string) =>
    `No se pudo instalar el paquete. Prueba a ejecutar tú: ${orden}`,
  sinConfig:
    "No encuentro vite.config (.ts/.js/.mjs…). Crea uno o añade el plugin a mano (mira la guía manual).",
  configCambiado: (f: string) => `${f}: añadido el plugin majixTools()`,
  configYaEstaba: (f: string) => `${f}: el plugin ya estaba`,
  configNoPuedo: (f: string) =>
    `${f}: no sé dónde añadir el plugin automáticamente. Añádelo tú dentro de plugins: [ … ] así:`,
  raizCambiada: (f: string) => `${f}: añadida la línea que carga el panel (solo en desarrollo)`,
  raizYaEstaba: (f: string) => `${f}: la línea del panel ya estaba`,
  raizCreada: (f: string) => `${f}: creado, con la línea que carga el panel`,
  raizNoEncontrada: (n: string) =>
    `No encuentro el fichero raíz de ${n}. Añade tú esta línea al principio de tu fichero raíz, tras los imports:`,
  envCambiado: (f: string) => `${f}: añadidas las variables de Search Console (vacías)`,
  envYaEstaba: (f: string) => `${f}: las variables de Search Console ya estaban`,
  gitignoreEnv:
    "Tu .gitignore no ignora .env. Añádelo antes de poner credenciales: si no, podrías subirlas a git.",
  listo: "Listo. MAJIX Tools está instalado.",
  siguiente: (orden: string) =>
    `Siguiente paso: arranca tu servidor de desarrollo (${orden}) y abre tu web. El panel está abajo en el centro.`,
  simulacroFin: "Fin del simulacro. Quita --dry-run para hacerlo de verdad.",
  cambioPropuesto: (f: string) => `Cambio en ${f}:`,

  doctorTitulo: "Revisión de MAJIX Tools",
  dSesion: (plan: string) => `Sesión de MAJIX iniciada (plan ${plan})`,
  dSesionFalta:
    "Falta iniciar sesión: abre tu web, pulsa el botón de MAJIX Tools de abajo y sigue los pasos (gratis, con tu cuenta de MAJIX)",
  ok: "bien",
  aviso: "aviso",
  error: "error",
  dNode: (v: string) => `Node ${v}`,
  dNodeViejo: (v: string) => `Node ${v}: MAJIX Tools necesita Node 18.18 o superior.`,
  dVite: (v: string) => `Vite ${v}`,
  dViteFalta: "Vite no está instalado. Ejecuta la instalación de dependencias de tu proyecto.",
  dPaquete: (v: string) => `majix-tools ${v} instalado`,
  dPaqueteFalta: "majix-tools no está instalado. Ejecuta: npx github:majixgroup/majix-tools init",
  dPlugin: (f: string) => `Plugin en ${f}`,
  dPluginFalta: (f: string) => `${f} no carga el plugin. Ejecuta: npx github:majixgroup/majix-tools init`,
  dRaiz: (f: string) => `Panel cargado desde ${f}`,
  dRaizFalta: (f: string) => `${f} no carga el panel. Ejecuta: npx github:majixgroup/majix-tools init`,
  dGitignore: ".env está en .gitignore",
  dServidor: (url: string) => `Servidor de desarrollo respondiendo en ${url}`,
  dServidorNo: (url: string) =>
    `No hay un servidor de desarrollo en ${url} (o no tiene el plugin). Si usas otro puerto: --puerto <n>. Si no está arrancado, esto no es un fallo.`,
  dGsc: "Search Console: credenciales completas",
  dGscFalta: (v: string) => `Search Console: faltan ${v} (opcional; la pestaña te guía)`,
  dResumenOk: "Todo en orden.",
  dResumenErrores: (n: number) => `${n} ${n === 1 ? "cosa que arreglar" : "cosas que arreglar"}.`,

  quitando: "Quitando MAJIX Tools…",
  quitadoConfig: (f: string) => `${f}: quitado el plugin`,
  quitadaRaiz: (f: string) => `${f}: quitada la línea del panel`,
  quitadoEnv: (f: string) => `${f}: quitadas las variables de Search Console`,
  desinstalando: (orden: string) => `Desinstalando el paquete: ${orden}`,
  quitadoTodo: "Listo. MAJIX Tools ya no está en este proyecto.",
  nadaQueQuitar: "No había nada de MAJIX Tools que quitar.",
};

type Textos = { [K in keyof typeof es]: (typeof es)[K] };

const en: Textos = {
  ayuda: (v) => `MAJIX Tools v${v} — a dev panel for sites built with Vite

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
  ordenDesconocida: (o) => `Unknown command “${o}”. Use init, doctor or remove (--help to see everything).`,
  sinPackageJson:
    "There's no package.json in this folder. Run the command from your project root (where package.json is).",
  proyecto: (n) => `Project: ${n}`,
  framework: (n) => `Type: ${n}`,
  gestor: (g) => `Package manager: ${g}`,
  simulacro: "Dry run (--dry-run): no file will be touched.",
  sinVite: "This project doesn't use Vite. MAJIX Tools is a Vite plugin: it needs Vite 5 or newer.",
  viteViejo: (m) => `You have Vite ${m}. MAJIX Tools needs Vite 5 or newer: upgrade it first.`,
  noSoportado: (n) =>
    `${n} isn't installed automatically yet. See the manual guide: https://majixlab.com/open-source/majix-tools/docs`,
  noSoportadoNext:
    "Next.js doesn't use Vite (it uses webpack/Turbopack), and MAJIX Tools is a Vite plugin. It doesn't work with Next.js today.",
  instalando: (orden) => `Install the package: ${orden}`,
  yaInstalado: (v) => `The package is already installed (v${v}).`,
  instalacionFallo: (orden) => `The package couldn't be installed. Try running it yourself: ${orden}`,
  sinConfig:
    "I can't find vite.config (.ts/.js/.mjs…). Create one or add the plugin by hand (see the manual guide).",
  configCambiado: (f) => `${f}: added the majixTools() plugin`,
  configYaEstaba: (f) => `${f}: the plugin was already there`,
  configNoPuedo: (f) =>
    `${f}: I don't know where to add the plugin automatically. Add it yourself inside plugins: [ … ] like this:`,
  raizCambiada: (f) => `${f}: added the line that loads the panel (development only)`,
  raizYaEstaba: (f) => `${f}: the panel line was already there`,
  raizCreada: (f) => `${f}: created, with the line that loads the panel`,
  raizNoEncontrada: (n) =>
    `I can't find the ${n} root file. Add this line at the top of your root file, after the imports:`,
  envCambiado: (f) => `${f}: added the Search Console variables (empty)`,
  envYaEstaba: (f) => `${f}: the Search Console variables were already there`,
  gitignoreEnv:
    "Your .gitignore doesn't ignore .env. Add it before adding credentials, or you could commit them to git.",
  listo: "Done. MAJIX Tools is installed.",
  siguiente: (orden) =>
    `Next step: start your dev server (${orden}) and open your site. The panel is at the bottom centre.`,
  simulacroFin: "End of the dry run. Remove --dry-run to do it for real.",
  cambioPropuesto: (f) => `Change in ${f}:`,

  doctorTitulo: "MAJIX Tools check-up",
  dSesion: (plan) => `MAJIX session signed in (${plan} plan)`,
  dSesionFalta:
    "You still need to sign in: open your site, press the MAJIX Tools button at the bottom and follow the steps (free, with your MAJIX account)",
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
  dServidorNo: (url) =>
    `No dev server at ${url} (or it doesn't have the plugin). If you use another port: --port <n>. If it isn't running, this isn't a problem.`,
  dGsc: "Search Console: credentials complete",
  dGscFalta: (v) => `Search Console: missing ${v} (optional; the tab guides you)`,
  dResumenOk: "Everything in order.",
  dResumenErrores: (n) => `${n} ${n === 1 ? "thing to fix" : "things to fix"}.`,

  quitando: "Removing MAJIX Tools…",
  quitadoConfig: (f) => `${f}: removed the plugin`,
  quitadaRaiz: (f) => `${f}: removed the panel line`,
  quitadoEnv: (f) => `${f}: removed the Search Console variables`,
  desinstalando: (orden) => `Uninstalling the package: ${orden}`,
  quitadoTodo: "Done. MAJIX Tools is no longer in this project.",
  nadaQueQuitar: "There was nothing from MAJIX Tools to remove.",
};

export type TextosCli = Textos;
export function textos(idioma: "es" | "en"): TextosCli {
  return idioma === "es" ? es : en;
}
