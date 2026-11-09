/* ---------------------------------------------------------------------- *
 * PRUEBAS DE LA CUENTA DE MAJIX — `npm test`
 *
 * Con un servidor de MAJIX simulado (sin red): el flujo de código de
 * dispositivo entero, dónde se guarda el token y, sobre todo, dónde NO
 * aparece. También las reglas de acceso a los endpoints del plugin.
 * ---------------------------------------------------------------------- */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Readable } from "node:stream";
import { build } from "esbuild";

const temporal = mkdtempSync(join(tmpdir(), "mt-cuenta-"));
process.on("exit", () => rmSync(temporal, { recursive: true, force: true }));

async function cargar(ruta, nombre) {
  const salida = join(temporal, `${nombre}.mjs`);
  await build({
    entryPoints: [fileURLToPath(new URL(ruta, import.meta.url))],
    outfile: salida,
    bundle: true,
    format: "esm",
    platform: "node",
    logLevel: "silent",
  });
  return import(pathToFileURL(salida).href);
}
const { Cuenta, apiPermitida } = await cargar("../src/servidor/cuenta.ts", "cuenta");
const M = await cargar("../src/servidor/muestras.ts", "muestras");
const H = await cargar("../src/servidor/http.ts", "http");

const TOKEN = `mjxt_${"T".repeat(43)}`;
const SECRETO = `mjxd_${"S".repeat(43)}`;

/** Un MAJIX de mentira. `modo` se cambia desde cada prueba. */
function majix() {
  const estado = {
    llamadas: [],
    sondeo: "pendiente",
    sesion: { ok: true, etiqueta: "mi-tienda", plan: "libre", webs: 1, dias_historial: 7, search_console: false, en_vivo: false, dominio: null, correo: "a***@gmail.com" },
    sesionHttp: 200,
    envio: { http: 200, cuerpo: { ok: true, aceptadas: 1 } },
    sinRed: false,
  };
  const f = async (url, init) => {
    const accion = new URL(url).pathname.split("/").pop();
    estado.llamadas.push({ accion, url, init, cuerpo: init.body ? JSON.parse(init.body) : null });
    if (estado.sinRed) throw new TypeError("fetch failed");
    const r = (status, cuerpo) => new Response(JSON.stringify(cuerpo), { status });
    switch (accion) {
      case "iniciar":
        return r(200, { codigo_dispositivo: SECRETO, codigo_usuario: "BCDF-GHJK", url: "https://majixlab.com/conectar", url_completa: "https://majixlab.com/conectar?codigo=BCDF-GHJK", caduca_en_s: 600, intervalo_s: 5 });
      case "sondear":
        return estado.sondeo === "aprobado" ? r(200, { estado: "aprobado", token: TOKEN }) : r(200, { estado: estado.sondeo });
      case "sesion":
        return r(estado.sesionHttp, estado.sesionHttp === 200 ? estado.sesion : { error: estado.sesionHttp === 401 ? "sesion" : "servidor" });
      case "muestras":
      case "search-console":
        return r(estado.envio.http, estado.envio.cuerpo);
      case "cerrar":
        return r(200, { ok: true, cerrada: true });
    }
    return r(404, {});
  };
  return { f, estado };
}

function nueva(extra = {}) {
  const m = extra.majix ?? majix();
  let t = 1_700_000_000_000;
  const dir = mkdtempSync(join(temporal, "cfg-"));
  const c = new Cuenta({
    api: "https://majixlab.com",
    raiz: extra.raiz ?? "/proyectos/tienda",
    version: "0.2.0",
    dirConfig: dir,
    fetch: m.f,
    ahora: () => t,
    temporizadores: false,
    etiqueta: "mi-tienda",
  });
  return { c, m, dir, avanzar: (ms) => (t += ms), ahora: () => t };
}

/** Plan de pago: las mediciones llegan en vivo al panel de MAJIX. */
async function conVivo(x) {
  x.m.estado.sesion = { ...x.m.estado.sesion, plan: "plus", webs: 3, dias_historial: 90, search_console: true, en_vivo: true, dominio: "mi-tienda.es" };
  await x.c.validar();
}

async function conectar(x) {
  await x.c.iniciar();
  x.m.estado.sondeo = "aprobado";
  await x.c.sondearUnaVez();
}

test("apiPermitida: solo majixlab.com por https y localhost; lo demás se ignora", () => {
  for (const ok of ["https://majixlab.com", "https://majixlab.com/x", "https://panel.majixlab.com", "http://localhost:3000", "http://127.0.0.1:8787"])
    assert.ok(apiPermitida(ok), ok);
  for (const mal of ["http://majixlab.com", "https://majixlab.com.evil.com", "https://evilmajixlab.com", "https://evil.com", "http://evil.localhost.com", "ftp://majixlab.com", "no-es-url", "", undefined])
    assert.equal(apiPermitida(mal), null, String(mal));
});

test("el flujo entero: código → aprobación → sesión", async () => {
  const x = nueva();
  assert.equal(x.c.instantanea().estado, "sin-sesion");
  const a = await x.c.iniciar();
  assert.equal(a.estado, "esperando");
  assert.equal(a.codigo.usuario, "BCDF-GHJK");
  assert.equal(a.codigo.urlCompleta, "https://majixlab.com/conectar?codigo=BCDF-GHJK");
  assert.equal(x.c.conectada, false);

  await x.c.sondearUnaVez(); // pendiente
  assert.equal(x.c.instantanea().estado, "esperando");

  x.m.estado.sondeo = "aprobado";
  await x.c.sondearUnaVez();
  const s = x.c.instantanea();
  assert.equal(s.estado, "conectada");
  assert.equal(s.plan, "libre");
  assert.equal(s.correo, "a***@gmail.com");
  assert.equal(s.codigo, null);
  assert.equal(x.c.conectada, true);
  assert.equal(x.c.permiteSearchConsole, false);

  // La llamada de iniciar lleva el nombre de la web y la versión; la de sesión lleva el token en la cabecera, no en el cuerpo.
  const ini = x.m.estado.llamadas.find((l) => l.accion === "iniciar");
  assert.deepEqual(ini.cuerpo, { proyecto: "majix-tools", etiqueta: "mi-tienda", version: "0.2.0" });
  assert.equal(ini.init.redirect, "error", "un redirect no puede llevar el token a otro servidor");
  const ses = x.m.estado.llamadas.find((l) => l.accion === "sesion");
  assert.equal(ses.init.headers.Authorization, `Bearer ${TOKEN}`);
  assert.ok(!JSON.stringify(ses.cuerpo).includes(TOKEN));
});

test("el token NO aparece en nada de lo que ve el panel, ni el código secreto", async () => {
  const x = nueva();
  await conectar(x);
  await conVivo(x);
  await x.c.enviarMuestras([{ id: "carga-0001", momento: 1, ruta: "/a?x=1", lcp: 1000 }]);
  const visible = JSON.stringify([x.c.instantanea(), x.c.bitacora()]);
  assert.ok(!visible.includes(TOKEN), "el token no sale");
  assert.ok(!visible.includes("T".repeat(20)));
  assert.ok(!visible.includes(SECRETO), "el código secreto de dispositivo no sale");
  assert.ok(!visible.includes("S".repeat(20)));
});

test("el token se guarda en un fichero que solo lee tu usuario, y dentro de la carpeta de configuración", async () => {
  const x = nueva();
  await conectar(x);
  const f = join(x.dir, "sesiones.json");
  assert.ok(existsSync(f));
  if (process.platform !== "win32") {
    assert.equal(statSync(f).mode & 0o777, 0o600, "permisos 600");
    assert.equal(statSync(x.dir).mode & 0o777, 0o700, "carpeta 700");
  }
  assert.ok(readFileSync(f, "utf8").includes(TOKEN));
  assert.ok(!f.includes("proyectos"), "no va dentro del proyecto");
});

test("al arrancar otra vez, recupera la sesión; otro proyecto no la comparte", async () => {
  const x = nueva();
  await conectar(x);
  const mismo = new Cuenta({ api: "https://majixlab.com", raiz: "/proyectos/tienda", version: "0.2.0", dirConfig: x.dir, fetch: x.m.f, temporizadores: false });
  await mismo.arrancar();
  assert.equal(mismo.conectada, true);
  assert.equal(mismo.plan, "libre");
  const otro = new Cuenta({ api: "https://majixlab.com", raiz: "/proyectos/OTRA", version: "0.2.0", dirConfig: x.dir, fetch: x.m.f, temporizadores: false });
  await otro.arrancar();
  assert.equal(otro.conectada, false);
  const local = new Cuenta({ api: "http://localhost:3000", raiz: "/proyectos/tienda", version: "0.2.0", dirConfig: x.dir, fetch: x.m.f, temporizadores: false });
  await local.arrancar();
  assert.equal(local.conectada, false, "la sesión de producción no sirve contra otro servidor");
});

test("revocada o caducada desde MAJIX: se borra y se vuelve a pedir sesión", async () => {
  for (const [error, motivo] of [["sesion", "revocada"], ["caducada", "caducada"]]) {
    const x = nueva();
    await conectar(x);
    x.m.estado.sesionHttp = 401;
    const original = x.m.f;
    x.m.f = null;
    const c2 = new Cuenta({
      api: "https://majixlab.com", raiz: "/proyectos/tienda", version: "0.2.0", dirConfig: x.dir, temporizadores: false,
      fetch: async (u, i) => (new URL(u).pathname.endsWith("sesion") ? new Response(JSON.stringify({ error }), { status: 401 }) : original(u, i)),
    });
    await c2.arrancar();
    assert.equal(c2.instantanea().estado, "sin-sesion");
    assert.equal(c2.instantanea().motivo, motivo);
    assert.ok(!readFileSync(join(x.dir, "sesiones.json"), "utf8").includes(TOKEN), "el token se borra del disco");
  }
});

test("sin red: una sesión ya comprobada sigue 24 h; pasado ese plazo, se bloquea", async () => {
  const x = nueva();
  await conectar(x);
  x.m.estado.sinRed = true;
  x.avanzar(2 * 3600_000);
  let s = await x.c.validar();
  assert.equal(s.estado, "conectada");
  assert.equal(s.sinRed, true);
  assert.equal(x.c.conectada, true);
  x.avanzar(23 * 3600_000); // en total, 25 h desde la última comprobación buena
  s = await x.c.validar();
  assert.equal(s.estado, "sin-red");
  assert.equal(x.c.conectada, false, "pasadas 24 h sin poder comprobarla, no se usa");
  x.m.estado.sinRed = false;
  s = await x.c.validar();
  assert.equal(s.estado, "conectada");
  assert.equal(s.sinRed, false);
});

test("un error del servidor de MAJIX (5xx) no cierra la sesión", async () => {
  const x = nueva();
  await conectar(x);
  x.m.estado.sesionHttp = 503;
  const s = await x.c.validar();
  assert.equal(s.estado, "conectada");
  assert.equal(s.sinRed, true);
  assert.ok(readFileSync(join(x.dir, "sesiones.json"), "utf8").includes(TOKEN));
});

test("denegado, caducado y código expirado vuelven a «sin sesión» con su motivo", async () => {
  for (const [sondeo, motivo] of [["denegado", "denegada"], ["caducado", "expirada"], ["desconocido", "expirada"]]) {
    const x = nueva();
    await x.c.iniciar();
    x.m.estado.sondeo = sondeo;
    await x.c.sondearUnaVez();
    const s = x.c.instantanea();
    assert.equal(s.estado, "sin-sesion");
    assert.equal(s.motivo, motivo);
    assert.equal(s.codigo, null);
  }
  const x = nueva();
  await x.c.iniciar();
  x.avanzar(11 * 60_000);
  await x.c.sondearUnaVez();
  assert.equal(x.c.instantanea().motivo, "expirada");
});

test("cancelar el inicio de sesión y no recibir un token con forma rara", async () => {
  const x = nueva();
  await x.c.iniciar();
  assert.equal(x.c.cancelar().estado, "sin-sesion");

  const y = nueva();
  await y.c.iniciar();
  const f = y.m.f;
  const c = new Cuenta({
    api: "https://majixlab.com", raiz: "/otro", version: "1", dirConfig: y.dir, temporizadores: false,
    fetch: async (u, i) => (new URL(u).pathname.endsWith("sondear") ? new Response(JSON.stringify({ estado: "aprobado", token: "no-es-un-token" })) : f(u, i)),
  });
  await c.iniciar();
  await c.sondearUnaVez();
  assert.equal(c.instantanea().estado, "sin-sesion");
  assert.equal(c.instantanea().motivo, "error");
});

test("enviar muestras: filtra, no envía sin sesión y anota cada envío", async () => {
  const x = nueva();
  assert.deepEqual(await x.c.enviarMuestras([{ id: "carga-0001", momento: 1 }]), { http: 401, aceptadas: 0 });
  assert.equal(x.m.estado.llamadas.length, 0, "sin sesión no sale nada");

  await conectar(x);
  await conVivo(x);
  const antes = x.m.estado.llamadas.length;
  const r = await x.c.enviarMuestras([{ id: "carga-0001", momento: 1700000000000, ruta: "/precios?token=SECRETO#x", lcp: 1500, cls: 0.02, inp: 90, ttfb: 150, peticiones: 20, kb: 700, errores: 0, fps: 58, largos: 2, bloqueo: 120, cookie: "no", url: "https://x/privado" }]);
  assert.deepEqual(r, { http: 200, aceptadas: 1 });
  const env = x.m.estado.llamadas.slice(antes).find((l) => l.accion === "muestras");
  assert.equal(env.cuerpo.muestras[0].ruta, "/precios");
  assert.ok(!JSON.stringify(env.cuerpo).includes("SECRETO"));
  assert.ok(!JSON.stringify(env.cuerpo).includes("cookie"));
  assert.deepEqual(Object.keys(env.cuerpo.muestras[0]).sort(), ["bloqueo", "cls", "errores", "fps", "id", "inp", "kb", "largos", "lcp", "momento", "peticiones", "ruta", "ttfb"]);
  assert.equal(env.cuerpo.muestras[0].fps, 58);
  const b = x.c.bitacora();
  assert.equal(b.entradas[0].accion, "muestras");
  assert.equal(b.entradas[0].ok, true);
  assert.match(b.entradas[0].resumen, /1 muestra · \/precios/);
  assert.ok(JSON.parse(b.ultimas.muestras).muestras, "lo último enviado se puede enseñar tal cual");
  assert.equal(x.c.instantanea().envio.enviadas, 1);
  assert.deepEqual(await x.c.enviarMuestras([{ roto: true }]), { http: 400, aceptadas: 0 });
  assert.deepEqual(Object.keys(JSON.parse(x.c.bitacora().ultimas.muestras).muestras[0]).sort(), ["bloqueo", "cls", "errores", "fps", "id", "inp", "kb", "largos", "lcp", "momento", "peticiones", "ruta", "ttfb"]);
});

test("plan Libre: la medición se queda en local, sin llamadas de red ni envíos anotados", async () => {
  const x = nueva();
  await conectar(x);
  assert.equal(x.c.permiteEnVivo, false);
  assert.equal(x.c.instantanea().enVivo, false);
  const n = x.m.estado.llamadas.length;
  assert.deepEqual(await x.c.enviarMuestras([{ id: "carga-0001", momento: 1, ruta: "/" }]), { http: 403, aceptadas: 0 });
  assert.equal(x.m.estado.llamadas.length, n, "con el plan Libre no sale nada");
  assert.ok(!x.c.bitacora().entradas.some((e) => e.accion === "muestras"));
  assert.equal(x.c.instantanea().envio.enviadas, 0);
});

test("el plan manda: al pasar a Plus empieza el envío y se conoce el dominio; Search Console solo con plan de pago", async () => {
  const x = nueva();
  await conectar(x);
  assert.equal(x.c.permiteSearchConsole, false);
  const n = x.m.estado.llamadas.length;
  assert.equal((await x.c.enviarSearchConsole([{ dia: "2026-11-01", clics: 1, impresiones: 2, ctr: 0.5, posicion: 3 }])).http, 403);
  assert.equal(x.m.estado.llamadas.length, n, "sin plan no hay llamada de red");

  await conVivo(x);
  assert.equal(x.c.permiteEnVivo, true);
  assert.equal(x.c.instantanea().dominio, "mi-tienda.es");
  assert.equal(x.c.permiteSearchConsole, true);
  assert.deepEqual(await x.c.enviarMuestras([{ id: "carga-0002", momento: 1 }]), { http: 200, aceptadas: 1 });

  x.m.estado.envio = { http: 403, cuerpo: { error: "plan" } };
  await x.c.enviarMuestras([{ id: "carga-0003", momento: 1 }]);
  assert.equal(x.c.instantanea().envio.fueraDePlan, true);
  x.m.estado.envio = { http: 200, cuerpo: { ok: true, aceptados: 1 } };
  assert.deepEqual(await x.c.enviarSearchConsole([{ dia: "2026-11-01", clics: 1, impresiones: 2, ctr: 0.5, posicion: 3 }]), { http: 200, aceptadas: 1 });
});

test("la sesión guardada recuerda el plan y el dominio al arrancar sin red", async () => {
  const x = nueva();
  await conectar(x);
  await conVivo(x);
  const otra = new Cuenta({ api: "https://majixlab.com", raiz: "/proyectos/tienda", version: "0.2.0", dirConfig: x.dir, fetch: async () => { throw new TypeError("sin red"); }, temporizadores: false, ahora: () => x.ahora() });
  await otra.arrancar();
  assert.equal(otra.conectada, true);
  assert.equal(otra.permiteEnVivo, true);
  assert.equal(otra.instantanea().dominio, "mi-tienda.es");
});

test("un 401 al enviar comprueba la sesión (puede haberse revocado)", async () => {
  const x = nueva();
  await conectar(x);
  await conVivo(x);
  x.m.estado.envio = { http: 401, cuerpo: { error: "sesion" } };
  x.m.estado.sesionHttp = 401;
  await x.c.enviarMuestras([{ id: "carga-0009", momento: 1 }]);
  assert.equal(x.c.instantanea().estado, "sin-sesion");
  assert.equal(x.c.conectada, false);
});

test("cerrar sesión: avisa a MAJIX y borra el token del disco", async () => {
  const x = nueva();
  await conectar(x);
  const s = await x.c.cerrar();
  assert.equal(s.estado, "sin-sesion");
  assert.equal(s.motivo, null);
  assert.ok(x.m.estado.llamadas.some((l) => l.accion === "cerrar" && l.init.headers.Authorization === `Bearer ${TOKEN}`));
  assert.ok(!readFileSync(join(x.dir, "sesiones.json"), "utf8").includes(TOKEN));
  assert.equal(x.c.conectada, false);
});

test("diasDeSearchConsole: solo los cuatro números del día, y los días que Google no tiene aún no viajan", () => {
  const r = M.diasDeSearchConsole({
    configurado: true,
    consultas: [{ clave: "mi marca secreta", clics: 9 }],
    paginas: [{ clave: "https://x/privada" }],
    porDia: [
      { clave: "2026-11-01", clics: 3, impresiones: 80, ctr: 0.0375, posicion: 14.2 },
      { clave: "2026-11-02", clics: 0, impresiones: 0, ctr: null, posicion: null },
      { clave: "2026-11-03", clics: null, impresiones: null, ctr: null, posicion: null },
      { clave: "mal", clics: 1, impresiones: 1 },
    ],
  });
  assert.deepEqual(r, [
    { dia: "2026-11-01", clics: 3, impresiones: 80, ctr: 0.0375, posicion: 14.2 },
    { dia: "2026-11-02", clics: 0, impresiones: 0, ctr: null, posicion: null },
  ]);
  assert.ok(!JSON.stringify(r).includes("secreta"));
  assert.deepEqual(M.diasDeSearchConsole({ configurado: false }), []);
  assert.deepEqual(M.diasDeSearchConsole({ configurado: true, error: { codigo: "acceso" } }), []);
});

// ── Las reglas de acceso del plugin ─────────────────────────────────────────────────────────
const peticion = (cabeceras, ip = "127.0.0.1") => ({ headers: { host: "localhost:5173", ...cabeceras }, socket: { remoteAddress: ip } });
const acceso = { red: false, hostsPermitidos: [] };

test("permitido: solo tu web, desde tu ordenador", () => {
  assert.equal(H.permitido(peticion({}), acceso), true, "sin cabeceras (doctor, curl)");
  assert.equal(H.permitido(peticion({ "sec-fetch-site": "same-origin" }), acceso), true);
  assert.equal(H.permitido(peticion({ "sec-fetch-site": "none" }), acceso), true);
  assert.equal(H.permitido(peticion({ "sec-fetch-site": "cross-site" }), acceso), false);
  assert.equal(H.permitido(peticion({ "sec-fetch-site": "same-site" }), acceso), false, "otra web tuya en otro puerto de localhost no entra");
  assert.equal(H.permitido(peticion({ origin: "http://localhost:5173" }), acceso), true);
  assert.equal(H.permitido(peticion({ origin: "http://localhost:3000" }), acceso), false);
  assert.equal(H.permitido(peticion({ origin: "https://malo.example" }), acceso), false);
  assert.equal(H.permitido(peticion({ origin: "no-url" }), acceso), false);
  assert.equal(H.permitido(peticion({}, "192.168.1.50"), acceso), false, "otro equipo de la red");
  assert.equal(H.permitido(peticion({}, "192.168.1.50"), { ...acceso, red: true }), true);
  assert.equal(H.permitido(peticion({ host: "evil.example" }), acceso), false, "DNS rebinding");
});

test("permitido: lo que cambia algo exige la cabecera X-Majix-Tools", () => {
  assert.equal(H.permitido(peticion({}), acceso, true), false);
  assert.equal(H.permitido(peticion({ "x-majix-tools": "0" }), acceso, true), false);
  assert.equal(H.permitido(peticion({ "x-majix-tools": "1" }), acceso, true), true);
  assert.equal(H.permitido(peticion({ "x-majix-tools": "1", "sec-fetch-site": "cross-site" }), acceso, true), false);
});

test("leerCuerpoJson: respeta el tope y rechaza lo que no es JSON", async () => {
  const flujo = (texto) => Readable.from([Buffer.from(texto)]);
  assert.deepEqual(await H.leerCuerpoJson(flujo('{"a":1}')), { a: 1 });
  assert.deepEqual(await H.leerCuerpoJson(flujo("")), {});
  assert.equal(await H.leerCuerpoJson(flujo("no json")), null);
  assert.equal(await H.leerCuerpoJson(flujo(JSON.stringify({ x: "y".repeat(70_000) }))), null);
  assert.deepEqual(await H.leerCuerpoJson(flujo(JSON.stringify({ x: "y".repeat(70_000) })), 100_000), { x: "y".repeat(70_000) });
});
