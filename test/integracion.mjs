/* ---------------------------------------------------------------------- *
 * PRUEBA DE PRINCIPIO A FIN — `npm run test:integracion`
 *
 * Hace lo mismo que haría alguien que instala MAJIX Tools por primera vez,
 * en un proyecto de Vite + React recién creado, fuera de esta carpeta:
 *
 *   1. empaqueta el paquete con `npm pack` (lo que se publicaría en npm);
 *   2. crea un proyecto nuevo e instala sus dependencias;
 *   3. `majix-tools init` desde el .tgz, y otra vez (no debe cambiar nada);
 *   4. arranca Vite de verdad y comprueba el panel y los endpoints;
 *   5. `vite build` y busca cualquier rastro de MAJIX Tools (debe haber 0);
 *   6. `majix-tools doctor`;
 *   7. `majix-tools remove`: vite.config debe quedar byte a byte igual y el
 *      paquete, desinstalado.
 *
 * Y, aparte, `init` y `remove` en proyectos de TanStack Start, React Router
 * y SvelteKit (solo los ficheros: no hace falta instalar esos frameworks
 * para comprobar qué se escribe y que se deshace).
 *
 * Necesita red o una caché de npm con react, react-dom, vite y
 * @vitejs/plugin-react.
 * ---------------------------------------------------------------------- */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";

const PAQUETE = fileURLToPath(new URL("..", import.meta.url));
const CLI = join(PAQUETE, "dist", "cli.js");
/* Sin "majix" en el nombre: la prueba del paso 5 busca esa palabra en el
   build, y la ruta de la carpeta podría aparecer en él. */
const base = mkdtempSync(join(tmpdir(), "mt-integracion-"));
let fallos = 0;

const paso = (s) => console.log(`\n\x1b[1m${s}\x1b[0m`);
const ok = (s) => console.log(`  \x1b[32m✓\x1b[0m ${s}`);
const mal = (s) => {
  fallos++;
  console.log(`  \x1b[31m✗\x1b[0m ${s}`);
};
const comprobar = (cond, s) => (cond ? ok(s) : mal(s));

function cli(dir, args) {
  const r = spawnSync(process.execPath, [CLI, ...args, "--lang", "es"], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  return { codigo: r.status, salida: `${r.stdout}${r.stderr}` };
}

function escribir(dir, ficheros) {
  for (const [ruta, contenido] of Object.entries(ficheros)) {
    mkdirSync(join(dir, ruta, ".."), { recursive: true });
    writeFileSync(join(dir, ruta), contenido);
  }
}

/* ── UN MAJIX DE MENTIRA ──
   Lo justo del servidor real (`web/src/lib/herramientas.ts`) para poder iniciar sesión de punta a punta: código de
   dispositivo, token, plan y los envíos. Escucha en 127.0.0.1: el plugin solo habla con majixlab.com o con localhost. */
function iniciarMajix() {
  const TOKEN = `mjxt_${"Q".repeat(43)}`;
  const estado = { aprobado: false, revocado: false, plan: "libre", llamadas: [], muestras: [] };
  const servidor = createServer((req, res) => {
    let cuerpo = "";
    req.on("data", (c) => (cuerpo += c));
    req.on("end", () => {
      const accion = req.url.split("/").pop();
      const json = cuerpo ? JSON.parse(cuerpo) : {};
      estado.llamadas.push({ accion, auth: req.headers.authorization ?? null, json });
      const r = (status, o) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(o));
      };
      const conToken = req.headers.authorization === `Bearer ${TOKEN}` && !estado.revocado;
      if (accion === "iniciar") return r(200, { codigo_dispositivo: `mjxd_${"D".repeat(43)}`, codigo_usuario: "BCDF-GHJK", url: `http://127.0.0.1:${servidor.address().port}/conectar`, url_completa: `http://127.0.0.1:${servidor.address().port}/conectar?codigo=BCDF-GHJK`, caduca_en_s: 600, intervalo_s: 2 });
      if (accion === "sondear") return r(200, estado.aprobado ? { estado: "aprobado", token: TOKEN } : { estado: "pendiente" });
      if (!conToken) return r(401, { error: "sesion" });
      if (accion === "sesion") {
        const plus = estado.plan === "plus";
        return r(200, { ok: true, etiqueta: "mi-web", plan: estado.plan, webs: plus ? 3 : 1, dias_historial: plus ? 90 : 7, search_console: plus, en_vivo: plus, dominio: plus ? "mi-web.es" : null, correo: "m***@correo.es" });
      }
      if (accion === "muestras") { estado.muestras.push(...json.muestras); return r(200, { ok: true, aceptadas: json.muestras.length }); }
      if (accion === "search-console") return r(200, { ok: true, aceptados: json.dias.length });
      if (accion === "cerrar") { estado.revocado = true; return r(200, { ok: true, cerrada: true }); }
      return r(404, {});
    });
  });
  return new Promise((ok) => servidor.listen(0, "127.0.0.1", () => ok({ estado, TOKEN, url: `http://127.0.0.1:${servidor.address().port}`, cerrar: () => servidor.close() })));
}

function recorrer(dir) {
  return readdirSync(dir).flatMap((n) => {
    const r = join(dir, n);
    return statSync(r).isDirectory() ? recorrer(r) : [r];
  });
}

try {
  /* ── 1 ── */
  paso("1. npm pack");
  const tgzNombre = execFileSync("npm", ["pack", "--silent", "--pack-destination", base], {
    cwd: PAQUETE,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .pop();
  const tgz = join(base, tgzNombre);
  comprobar(existsSync(tgz), `paquete: ${tgzNombre}`);
  const contenido = execFileSync("tar", ["-tzf", tgz], { encoding: "utf8" });
  comprobar(!/src\/|test\/|node_modules\//.test(contenido), "el paquete solo lleva dist y la documentación");

  /* ── 2 ── */
  paso("2. Proyecto nuevo de Vite + React");
  const app = join(base, "mi-web");
  const VITE_CONFIG = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
`;
  escribir(app, {
    "package.json": JSON.stringify(
      { name: "mi-web", private: true, type: "module", scripts: { dev: "vite", build: "vite build" } },
      null,
      2,
    ),
    "index.html": `<!doctype html><html lang="es"><head><meta charset="UTF-8" /><title>Mi web</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>`,
    "src/main.jsx": `import { createRoot } from "react-dom/client";\ncreateRoot(document.getElementById("root")).render(<h1>Hola</h1>);\n`,
    "vite.config.js": VITE_CONFIG,
    ".gitignore": "node_modules\ndist\n.env\n",
    ".env.example": "VITE_API=https://api.ejemplo.com\n",
  });
  execFileSync("git", ["init", "-q"], { cwd: app });
  execFileSync(
    "npm",
    ["install", "--prefer-offline", "--no-audit", "--no-fund", "--loglevel=error", "react", "react-dom", "vite", "@vitejs/plugin-react"],
    { cwd: app, stdio: "inherit" },
  );
  comprobar(existsSync(join(app, "node_modules", "vite")), "dependencias instaladas");

  /* ── 3 ── */
  paso("3. majix-tools init");
  const i1 = cli(app, ["init", "--desde", tgz]);
  comprobar(i1.codigo === 0, `init termina bien (código ${i1.codigo})`);
  const config = readFileSync(join(app, "vite.config.js"), "utf8");
  comprobar(config.includes(`import { majixTools } from "majix-tools/vite";`), "vite.config importa el plugin");
  comprobar(config.includes("plugins: [majixTools(), react()]"), "majixTools() va delante de tus plugins");
  comprobar(readFileSync(join(app, ".env.example"), "utf8").includes("MAJIX_TOOLS_GSC_SITE="), ".env.example con las variables");
  comprobar(!existsSync(join(app, ".env")), "no crea ni toca .env");
  const i2 = cli(app, ["init", "--desde", tgz]);
  comprobar(i2.codigo === 0 && readFileSync(join(app, "vite.config.js"), "utf8") === config, "repetir init no cambia nada");

  /* ── 4 ── */
  paso("4. Servidor de desarrollo de verdad");
  const majix = await iniciarMajix();
  process.env.MAJIX_TOOLS_API = majix.url;
  process.env.MAJIX_TOOLS_CONFIG_DIR = join(base, "config");
  const vite = await import(pathToFileURL(join(app, "node_modules", "vite", "dist", "node", "index.js")).href);
  const servidor = await vite.createServer({ root: app, logLevel: "silent", server: { port: 0, host: "127.0.0.1" } });
  await servidor.listen();
  const { port } = servidor.httpServer.address();
  const url = (r) => `http://127.0.0.1:${port}${r}`;
  const API = "/__majix-tools/api";
  /* Todo lo que el navegador podría ver, para buscar en ello el token. */
  const vistas = [];
  const pedir = async (ruta, init = {}) => {
    const res = await fetch(url(ruta), init);
    const texto = await res.text();
    vistas.push(texto);
    let json = null;
    try { json = JSON.parse(texto); } catch { /* no es JSON */ }
    return { status: res.status, json, texto };
  };
  const post = (ruta, cuerpo = {}) =>
    pedir(ruta, { method: "POST", headers: { "X-Majix-Tools": "1", "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  try {
    const html = await (await fetch(url("/"))).text();
    comprobar(html.includes("/@id/majix-tools/cliente"), "index.html carga el panel");
    comprobar(html.includes("setResourceTimingBufferSize"), "index.html amplía el búfer de red");
    const cliente = await fetch(url("/@id/majix-tools/cliente"));
    comprobar(cliente.ok, `el panel se sirve (HTTP ${cliente.status})`);
    const estado = (await pedir(`${API}/estado`)).json;
    comprobar(estado.ok === true && estado.searchConsole.falta.length === 3, "/__majix-tools/api/estado responde");
    comprobar(estado.sesion.estado === "sin-sesion", "al principio no hay sesión");

    paso("4b. Sin sesión no hay herramienta");
    const sin = await pedir(`${API}/archivos`);
    comprobar(sin.status === 401 && sin.json.codigo === "sesion", "sin sesión, el árbol de archivos no responde (401)");
    comprobar((await pedir(`${API}/search-console`)).status === 401, "sin sesión, Search Console no responde (401)");
    comprobar((await pedir(`${API}/comprobar-web?url=example.com`)).status === 401, "sin sesión, comprobar-web no responde (401)");
    comprobar((await post(`${API}/muestras`, { muestras: [{ id: "carga-0001", momento: 1 }] })).status === 401, "sin sesión no se envía nada a MAJIX");
    comprobar(majix.estado.llamadas.filter((l) => l.accion === "muestras").length === 0, "…y MAJIX no ha recibido ninguna muestra");
    comprobar((await pedir(`${API}/estado`, { headers: { "Sec-Fetch-Site": "cross-site" } })).status === 403, "una web ajena no puede leer los endpoints");
    comprobar((await pedir(`${API}/sesion`, { headers: { "Sec-Fetch-Site": "same-site" } })).status === 403, "otra web tuya de localhost tampoco");
    comprobar((await pedir(`${API}/sesion/iniciar`, { method: "POST" })).status === 403, "iniciar sesión exige la cabecera X-Majix-Tools");
    comprobar((await pedir(`${API}/sesion/iniciar`)).status === 405, "iniciar sesión no se hace con GET");

    paso("4c. Iniciar sesión con el código");
    const e = await post(`${API}/sesion/iniciar`);
    comprobar(e.json.estado === "esperando" && e.json.codigo.usuario === "BCDF-GHJK", "pide el código y lo enseña");
    comprobar(!e.texto.includes("mjxd_"), "el código secreto de dispositivo no llega al navegador");
    majix.estado.aprobado = true; // «la persona lo aprueba en majixlab.com»
    let sesion = null;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 700));
      sesion = (await pedir(`${API}/sesion`)).json;
      if (sesion.estado === "conectada") break;
    }
    comprobar(sesion?.estado === "conectada", "tras aprobarlo, la herramienta se conecta sola");
    comprobar(sesion?.plan === "libre" && sesion?.correo === "m***@correo.es", "recibe el plan y el correo enmascarado");

    paso("4d. Con sesión, la herramienta funciona");
    const arbol = (await pedir(`${API}/archivos`)).json;
    const nombres = JSON.stringify(arbol.arbol);
    comprobar(arbol.fuente === "git", "el árbol sale de git");
    comprobar(!nombres.includes("node_modules"), "el árbol no incluye node_modules");
    comprobar(nombres.includes("vite.config.js"), "el árbol incluye vite.config.js");
    const privada = await pedir(`${API}/comprobar-web?url=127.0.0.1`);
    comprobar(privada.status === 400, "comprobar-web no deja mirar la red local");
    const libre = await pedir(`${API}/search-console`);
    comprobar(libre.status === 403 && libre.json.codigo === "plan", "con el plan Libre, Search Console pide mejorar el plan (403)");

    paso("4e. Con el plan Libre, la medición se queda en local");
    const muestraLibre = { muestras: [{ id: "carga-0001", momento: Date.now(), ruta: "/precios", lcp: 1500 }] };
    const libreEnvio = await post(`${API}/muestras`, muestraLibre);
    comprobar(libreEnvio.status === 403 && libreEnvio.json.codigo === "plan", "con el plan Libre el envío se rechaza (403)");
    comprobar(majix.estado.muestras.length === 0, "…y MAJIX no ha recibido ninguna medición");

    paso("4f. Cambiar de plan sin reiniciar, y entonces sí se envía");
    majix.estado.plan = "plus"; // «ha pagado en la web»
    const refrescada = (await post(`${API}/sesion/refrescar`)).json;
    comprobar(refrescada.plan === "plus" && refrescada.searchConsole === true && refrescada.enVivo === true, "tras pagar, el plan se activa sin reiniciar");
    comprobar(refrescada.dominio === "mi-web.es", "se conoce el dominio publicado");
    const enviada = await post(`${API}/muestras`, {
      muestras: [{ id: "carga-0001", momento: Date.now(), ruta: "/precios?token=SECRETO#x", lcp: 1500, cls: 0.02, inp: 90, ttfb: 150, peticiones: 20, kb: 700, errores: 0, fps: 58, largos: 2, bloqueo: 120, cookie: "no", url: "http://x/privado" }],
    });
    comprobar(enviada.status === 200 && enviada.json.aceptadas === 1, "con Plus, las mediciones llegan a MAJIX");
    const recibida = majix.estado.muestras[0];
    comprobar(recibida?.ruta === "/precios", "la ruta llega sin parámetros ni fragmento");
    comprobar(recibida?.fps === 58 && recibida?.largos === 2 && recibida?.bloqueo === 120, "llegan también los FPS, los fotogramas largos y el bloqueo");
    comprobar(!JSON.stringify(majix.estado.muestras).includes("SECRETO") && !("cookie" in recibida) && !("url" in recibida), "ningún campo fuera de la lista blanca sale del ordenador");
    const bit = (await pedir(`${API}/bitacora`)).json;
    comprobar(bit.entradas.some((x) => x.accion === "muestras" && x.ok), "la bitácora anota el envío");
    const plus = await pedir(`${API}/search-console`);
    comprobar(plus.status === 200 && plus.json.configurado === false, "con Plus, Search Console responde (y pide configurarse)");

    paso("4g. El token no se escapa");
    const fichero = join(base, "config", "sesiones.json");
    comprobar(existsSync(fichero) && readFileSync(fichero, "utf8").includes(majix.TOKEN), "el token vive en la carpeta de configuración");
    if (process.platform !== "win32") comprobar((statSync(fichero).mode & 0o777) === 0o600, "…con permisos 600 (solo tu usuario)");
    comprobar(!recorrer(app).filter((f) => !f.includes("node_modules")).some((f) => readFileSync(f, "utf8").includes(majix.TOKEN)), "el token no está en ningún fichero de tu proyecto");
    comprobar(!vistas.some((t) => t.includes(majix.TOKEN)), `el token no aparece en ninguna de las ${vistas.length} respuestas que ve el navegador`);
    comprobar(!html.includes(majix.TOKEN), "ni en tu index.html");

    paso("4h. Cerrar sesión");
    const cerrada = (await post(`${API}/sesion/cerrar`)).json;
    comprobar(cerrada.estado === "sin-sesion", "cerrar sesión vuelve a la puerta");
    comprobar(majix.estado.revocado, "MAJIX revoca el token");
    comprobar((await pedir(`${API}/archivos`)).status === 401, "y sin sesión la herramienta vuelve a bloquearse");
    comprobar(!readFileSync(fichero, "utf8").includes(majix.TOKEN), "el token se borra del disco");
  } finally {
    await servidor.close();
    majix.cerrar();
  }

  /* ── 5 ── */
  paso("5. Build de producción");
  /* En su propio proceso, como `npm run build`: el servidor de desarrollo
     de arriba deja NODE_ENV=development en este. */
  execFileSync(join(app, "node_modules", ".bin", "vite"), ["build", "--logLevel", "silent"], {
    cwd: app,
    env: { ...process.env, NODE_ENV: "production" },
  });
  const rastros = recorrer(join(app, "dist")).filter((f) =>
    /majix|__majix-tools|setResourceTimingBufferSize/i.test(readFileSync(f, "utf8")),
  );
  comprobar(rastros.length === 0, `0 rastros de MAJIX Tools en dist/ (${rastros.length} encontrados)`);
  for (const f of rastros) {
    const t = readFileSync(f, "utf8");
    const i = t.search(/majix|__majix-tools|setResourceTimingBufferSize/i);
    console.log(`      ${f.replace(app, "")}: …${t.slice(Math.max(0, i - 80), i + 80)}…`);
  }

  /* ── 6 ── */
  paso("6. majix-tools doctor");
  const d = cli(app, ["doctor"]);
  comprobar(d.codigo === 0, `doctor sin errores (código ${d.codigo})`);

  /* ── 7 ── */
  paso("7. majix-tools remove");
  const q = cli(app, ["remove"]);
  comprobar(q.codigo === 0, `remove termina bien (código ${q.codigo})`);
  comprobar(readFileSync(join(app, "vite.config.js"), "utf8") === VITE_CONFIG, "vite.config queda byte a byte como estaba");
  comprobar(readFileSync(join(app, ".env.example"), "utf8") === "VITE_API=https://api.ejemplo.com\n", ".env.example queda como estaba");
  const pkg = JSON.parse(readFileSync(join(app, "package.json"), "utf8"));
  comprobar(!pkg.devDependencies?.["majix-tools"], "el paquete ya no está en package.json");

  /* ── 8 ── */
  paso("8. Frameworks con SSR (solo ficheros)");
  const RAIZ_TSX = `import { Outlet, createRootRoute } from "@tanstack/react-router";\n\nexport const Route = createRootRoute({ component: Outlet });\n`;
  const casos = [
    { nombre: "TanStack Start", dep: "@tanstack/react-start", raiz: "src/routes/__root.tsx", original: RAIZ_TSX },
    { nombre: "React Router", dep: "@react-router/dev", raiz: "app/root.tsx", original: `import { Outlet } from "react-router";\n\nexport default function App() { return <Outlet />; }\n` },
    { nombre: "SvelteKit", dep: "@sveltejs/kit", raiz: "src/hooks.client.ts", original: null },
  ];
  for (const caso of casos) {
    const dir = join(base, caso.nombre.replace(/\s/g, "-"));
    escribir(dir, {
      "package.json": JSON.stringify({ name: "x", devDependencies: { vite: "^8.0.0", [caso.dep]: "*" } }),
      "vite.config.ts": VITE_CONFIG,
      ...(caso.original === null ? {} : { [caso.raiz]: caso.original }),
    });
    const a = cli(dir, ["init", "--sin-instalar"]);
    const raiz = existsSync(join(dir, caso.raiz)) ? readFileSync(join(dir, caso.raiz), "utf8") : "";
    comprobar(a.codigo === 0 && raiz.includes('import("majix-tools/cliente")'), `${caso.nombre}: init añade la línea del panel en ${caso.raiz}`);
    const b = cli(dir, ["remove", "--sin-instalar"]);
    const tras = existsSync(join(dir, caso.raiz)) ? readFileSync(join(dir, caso.raiz), "utf8") : null;
    comprobar(b.codigo === 0 && tras === caso.original, `${caso.nombre}: remove lo deja como estaba`);
  }

  paso("9. Proyectos que no se pueden instalar");
  for (const [nombre, deps] of [
    ["Next.js", { next: "15.0.0", react: "19.0.0" }],
    ["Sin Vite", { react: "19.0.0" }],
    ["Vite 4", { vite: "^4.5.0" }],
  ]) {
    const dir = join(base, nombre.replace(/\W/g, "-"));
    escribir(dir, { "package.json": JSON.stringify({ name: "x", dependencies: deps }), "vite.config.js": VITE_CONFIG });
    const r = cli(dir, ["init", "--sin-instalar"]);
    comprobar(r.codigo === 1 && readFileSync(join(dir, "vite.config.js"), "utf8") === VITE_CONFIG, `${nombre}: se niega y no toca nada`);
  }
} catch (e) {
  mal(`la prueba se interrumpió: ${e instanceof Error ? e.stack : e}`);
} finally {
  rmSync(base, { recursive: true, force: true });
}

console.log(fallos ? `\n\x1b[31m${fallos} fallo(s)\x1b[0m\n` : "\n\x1b[32mTodo en orden.\x1b[0m\n");
process.exit(fallos ? 1 : 0);
