/* ---------------------------------------------------------------------- *
 * PRUEBAS DE LOS CAMBIOS QUE HACE LA CLI — `npm test`
 *
 * La promesa que se comprueba aquí: para cualquier fichero de los casos,
 *   1. `init` añade exactamente lo que dice,
 *   2. repetir `init` no cambia nada más,
 *   3. `remove` deja el fichero BYTE A BYTE como estaba.
 * ---------------------------------------------------------------------- */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const temporal = mkdtempSync(join(tmpdir(), "majix-tools-pruebas-"));
const salida = join(temporal, "parches.mjs");
await build({
  entryPoints: [fileURLToPath(new URL("../src/cli/parches.ts", import.meta.url))],
  outfile: salida,
  bundle: true,
  format: "esm",
  platform: "node",
  logLevel: "silent",
});
const P = await import(pathToFileURL(salida).href);
process.on("exit", () => rmSync(temporal, { recursive: true, force: true }));

function idaYVuelta(nombre, original, anadir, quitar, comprobar) {
  test(nombre, () => {
    const a = anadir(original);
    assert.equal(a.estado, "cambiado", "init debería cambiar el fichero");
    if (comprobar) comprobar(a.codigo);
    assert.equal(anadir(a.codigo).estado, "ya-estaba", "repetir init no debería cambiar nada");
    const q = quitar(a.codigo);
    assert.equal(q.estado, "cambiado", "remove debería cambiar el fichero");
    assert.equal(q.codigo, original, "remove debería dejarlo exactamente como estaba");
  });
}

const tienePlugin = (codigo) => {
  assert.match(codigo, /import \{ majixTools \} from "majix-tools\/vite";|require\("majix-tools\/vite"\)/);
  assert.match(codigo, /majixTools\(\)/);
};

/* ── vite.config ── */
const CONFIGS = {
  "plugins en una línea": `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({ plugins: [react()] });
`,
  "plugins en varias líneas": `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

export default defineConfig({
  server: { port: 3000 },
  plugins: [
    tailwind(),
    react(),
  ],
});
`,
  "sin plugins, objeto en varias líneas": `import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 3000 },
});
`,
  "export default de un objeto": `export default { server: { port: 3000 } };
`,
  "configuración como función": `import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  base: mode === "production" ? "/app/" : "/",
}));
`,
  "plugins vacío": `import { defineConfig } from "vite";
export default defineConfig({ plugins: [] });
`,
  "CommonJS con require": `const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");

module.exports = defineConfig({
  plugins: [react()],
});
`,
  "saltos de línea de Windows": `import { defineConfig } from "vite";\r\nimport react from "@vitejs/plugin-react";\r\n\r\nexport default defineConfig({\r\n  plugins: [\r\n    react(),\r\n  ],\r\n});\r\n`,
  "postcss con plugins antes que los de Vite": `import { defineConfig } from "vite";
import autoprefixer from "autoprefixer";
import react from "@vitejs/plugin-react";

export default defineConfig({
  css: { postcss: { plugins: [autoprefixer()] } },
  plugins: [react()],
});
`,
  "función con cuerpo y return (como TanStack Start)": `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Un comentario que menciona plugins: [ cosas ] no debe confundir a nadie.
export default defineConfig(({ command }) => {
  const extra = "plugins: [ esto es un texto ]";
  return {
    build: { rollupOptions: { plugins: [] } },
    plugins: [
      react(),
      ...(command === "build" ? [otro({ plugins: ["./x.ts"] })] : []),
    ],
  };
});
`,
  "import de varias líneas": `import {
  defineConfig,
  loadEnv,
} from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({ plugins: [react()] });
`,
};

for (const [nombre, original] of Object.entries(CONFIGS)) {
  idaYVuelta(`vite.config · ${nombre}`, original, P.anadirPlugin, P.quitarPlugin, tienePlugin);
}

test("vite.config · elige el plugins de Vite, no uno anidado ni uno en un comentario", () => {
  const r1 = P.anadirPlugin(CONFIGS["postcss con plugins antes que los de Vite"]);
  assert.match(r1.codigo, /postcss: \{ plugins: \[autoprefixer\(\)\] \}/);
  assert.match(r1.codigo, /plugins: \[majixTools\(\), react\(\)\]/);
  const r2 = P.anadirPlugin(CONFIGS["función con cuerpo y return (como TanStack Start)"]);
  assert.match(r2.codigo, /rollupOptions: \{ plugins: \[\] \}/);
  assert.match(r2.codigo, /plugins: \[\n      majixTools\(\),\n      react\(\),/);
  assert.match(r2.codigo, /comentario que menciona plugins: \[ cosas \]/);
});

test("vite.config · CommonJS usa require, no import", () => {
  const r = P.anadirPlugin(CONFIGS["CommonJS con require"]);
  assert.match(r.codigo, /const \{ majixTools \} = require\("majix-tools\/vite"\);/);
  assert.doesNotMatch(r.codigo, /^import /m);
});

test("vite.config · con saltos de Windows no mezcla \\n sueltos", () => {
  const r = P.anadirPlugin(CONFIGS["saltos de línea de Windows"]);
  assert.equal(r.codigo.replace(/\r\n/g, "").includes("\n"), false);
});

test("vite.config · sin objeto de configuración reconocible no inventa nada", () => {
  const r = P.anadirPlugin(`import config from "./base";\nexport default config;\n`);
  assert.equal(r.estado, "no-se-puede");
});

test("vite.config · quita el plugin aunque lo movieras al final", () => {
  const movido = `import { defineConfig } from "vite";
import { majixTools } from "majix-tools/vite";
import react from "@vitejs/plugin-react";
export default defineConfig({ plugins: [react(), majixTools({ red: true })] });
`;
  const r = P.quitarPlugin(movido);
  assert.equal(
    r.codigo,
    `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({ plugins: [react()] });
`,
  );
});

/* ── La línea del panel (webs con SSR) ── */
const RAICES = {
  "con imports": `import { Outlet } from "@tanstack/react-router";
import { StrictMode } from "react";

export const Route = createRootRoute({ component: Outlet });
`,
  "sin imports": `export function handleError() {}
`,
  vacío: "",
  "saltos de Windows": `import { Outlet } from "react-router";\r\n\r\nexport default function App() {}\r\n`,
};
for (const [nombre, original] of Object.entries(RAICES)) {
  idaYVuelta(`raíz · ${nombre}`, original, P.anadirLineaCliente, P.quitarLineaCliente, (c) =>
    assert.ok(c.includes(P.LINEA_CLIENTE)),
  );
}

test("raíz · la línea va detrás del último import", () => {
  const r = P.anadirLineaCliente(RAICES["con imports"]);
  const lineas = r.codigo.split("\n");
  assert.equal(lineas[1], 'import { StrictMode } from "react";');
  assert.equal(lineas[3], P.LINEA_CLIENTE);
});

/* ── .env.example ── */
const ENVS = {
  vacío: "",
  "acaba en salto de línea": "VITE_API=https://api.ejemplo.com\n",
  "sin salto final": "VITE_API=https://api.ejemplo.com",
  "saltos de Windows": "VITE_API=1\r\nVITE_OTRA=2\r\n",
};
for (const [nombre, original] of Object.entries(ENVS)) {
  idaYVuelta(`.env.example · ${nombre}`, original, P.anadirBloqueEnv, P.quitarBloqueEnv, (c) =>
    assert.match(c, /MAJIX_TOOLS_GSC_SITE=/),
  );
}

/* ── .gitignore ── */
test(".gitignore · reconoce las formas de ignorar .env", () => {
  for (const si of [".env", "/.env", ".env*", ".env.*", "*.env", "node_modules\n.env\ndist"]) {
    assert.equal(P.ignoraEnv(si), true, si);
  }
  for (const no of ["", "node_modules", ".env.example", "# .env", "!.env", "env"]) {
    assert.equal(P.ignoraEnv(no), false, no);
  }
});
