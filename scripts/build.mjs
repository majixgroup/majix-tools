/* ---------------------------------------------------------------------- *
 * CONSTRUIR EL PAQUETE — `npm run build`
 *
 *   1. Compila el CSS del panel con Tailwind (solo las clases que usa) y lo
 *      prepara para vivir dentro de un Shadow DOM.
 *   2. Empaqueta con esbuild las tres piezas:
 *        dist/cliente.js  el panel, con React dentro (navegador)
 *        dist/vite.js     el plugin de Vite (Node)
 *        dist/cli.js      `npx majix-tools` (Node)
 *   3. Escribe los tipos públicos (dist/*.d.ts).
 * ---------------------------------------------------------------------- */

import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(RAIZ, "dist");
const TEMPORAL = join(RAIZ, ".construir");
const { version } = JSON.parse(readFileSync(join(RAIZ, "package.json"), "utf8"));

rmSync(DIST, { recursive: true, force: true });
rmSync(TEMPORAL, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
mkdirSync(TEMPORAL, { recursive: true });

/* ── 1. EL CSS ── */
const cssCompilado = join(TEMPORAL, "panel.css");
execFileSync(
  join(RAIZ, "node_modules", ".bin", "tailwindcss"),
  ["-i", join(RAIZ, "src/cliente/estilos.css"), "-o", cssCompilado, "--minify"],
  { cwd: RAIZ, stdio: ["ignore", "ignore", "inherit"] },
);
let css = readFileSync(cssCompilado, "utf8");

/* Tailwind 4 da valores iniciales a sus variables internas (--tw-shadow,
   --tw-translate-x…) con `@property`. Dentro de un Shadow DOM, `@property`
   NO se registra: esas variables quedarían sin valor y las sombras, los
   degradados y los desplazamientos no se pintarían. Se copian como
   declaraciones normales sobre todos los elementos del panel. */
const iniciales = [];
css = css.replace(/@property\s+(--[\w-]+)\s*\{([^}]*)\}/g, (_todo, nombre, cuerpo) => {
  const inicial = cuerpo.match(/initial-value\s*:\s*([^;]+)/);
  if (inicial) iniciales.push(`${nombre}:${inicial[1].trim()}`);
  return "";
});
if (iniciales.length) {
  css += `:host,*,::before,::after,::backdrop{${iniciales.join(";")}}`;
}
writeFileSync(cssCompilado, css);

/* `import estilos from "./estilos.css?texto"` → el CSS ya compilado, como texto. */
const cssComoTexto = {
  name: "css-como-texto",
  setup(b) {
    b.onResolve({ filter: /\.css\?texto$/ }, () => ({ path: cssCompilado, namespace: "css-texto" }));
    b.onLoad({ filter: /.*/, namespace: "css-texto" }, () => ({
      contents: readFileSync(cssCompilado, "utf8"),
      loader: "text",
    }));
  },
};

const comun = {
  bundle: true,
  format: "esm",
  target: "es2022",
  legalComments: "none",
  logLevel: "warning",
  define: { __MAJIX_TOOLS_VERSION__: JSON.stringify(version) },
};

/* ── 2. LOS TRES PAQUETES ── */
/* El cliente en dos trozos: `cliente.js` (el arranque, pequeño) y
   `cliente-panel-*.js` (el panel, que `cliente.js` pide más tarde). */
await build({
  ...comun,
  entryPoints: { cliente: join(RAIZ, "src/cliente/index.ts") },
  outdir: DIST,
  splitting: true,
  chunkNames: "cliente-panel-[hash]",
  platform: "browser",
  jsx: "automatic",
  minify: true,
  plugins: [cssComoTexto],
  define: { ...comun.define, "process.env.NODE_ENV": '"production"' },
  banner: {
    js: `/*! MAJIX Tools v${version} · MIT · https://majixlab.com/open-source/majix-tools — solo desarrollo */`,
  },
});

await build({
  ...comun,
  entryPoints: [join(RAIZ, "src/vite/index.ts")],
  outfile: join(DIST, "vite.js"),
  platform: "node",
  packages: "external",
});
/* La misma pieza en CommonJS, para quien tenga un `vite.config.cjs` y un
   Node que no pueda hacer `require()` de un módulo ESM. */
await build({
  ...comun,
  entryPoints: [join(RAIZ, "src/vite/index.ts")],
  outfile: join(DIST, "vite.cjs"),
  platform: "node",
  format: "cjs",
  packages: "external",
});

await build({
  ...comun,
  entryPoints: [join(RAIZ, "src/cli/index.ts")],
  outfile: join(DIST, "cli.js"),
  platform: "node",
  packages: "external",
  banner: { js: "#!/usr/bin/env node" },
});
chmodSync(join(DIST, "cli.js"), 0o755);

/* ── 3. LOS TIPOS PÚBLICOS ──
   La superficie pública es pequeña a propósito; se escriben a mano para
   que digan exactamente lo que se promete, ni una función más. */
writeFileSync(
  join(DIST, "vite.d.ts"),
  `import type { Plugin } from "vite";

export type OpcionesMajixTools = {
  /** Inyecta el panel en index.html automáticamente. Por defecto, true. */
  inyectar?: boolean;
  /** Permite usar los endpoints desde otros equipos de tu red. Por defecto, false. */
  red?: boolean;
  /** Alias en inglés de \`inyectar\`: injects the panel into index.html. Default: true. */
  inject?: boolean;
  /** Alias en inglés de \`red\`: lets other machines on your network use the endpoints. Default: false. */
  network?: boolean;
};

/** El plugin de MAJIX Tools. Solo se ejecuta con el servidor de desarrollo. */
export declare function majixTools(opciones?: OpcionesMajixTools): Plugin;
export default majixTools;
`,
);
writeFileSync(join(DIST, "vite.d.cts"), readFileSync(join(DIST, "vite.d.ts"), "utf8"));
writeFileSync(
  join(DIST, "cliente.d.ts"),
  `/** Monta el panel ya, sin esperar a que el navegador esté libre. Devuelve la función que lo desmonta. */
export declare function montar(): Promise<() => void>;
/** Quita el panel de la página (el medidor y el grabador siguen activos). */
export declare function desmontar(): Promise<void>;
/** Mounts the panel now (English alias of \`montar\`). */
export declare const mount: typeof montar;
/** Removes the panel (English alias of \`desmontar\`). */
export declare const unmount: typeof desmontar;
`,
);

rmSync(TEMPORAL, { recursive: true, force: true });

const kb = (f) => (readFileSync(join(DIST, f)).length / 1024).toFixed(1);
console.log(
  `MAJIX Tools v${version} → dist/cliente.js ${kb("cliente.js")} KB · dist/vite.js ${kb("vite.js")} KB · dist/cli.js ${kb("cli.js")} KB · CSS ${(css.length / 1024).toFixed(1)} KB`,
);
