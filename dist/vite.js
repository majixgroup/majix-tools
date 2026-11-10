// src/vite/index.ts
import { loadEnv } from "vite";
import { readFile as readFile2 } from "node:fs/promises";
import { join as join3 } from "node:path";

// src/servidor/http.ts
function enviarJson(res, estado, datos) {
  const cuerpo = JSON.stringify(datos);
  res.statusCode = estado;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(cuerpo);
}
var LOOPBACK = /* @__PURE__ */ new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
function esLoopback(ip) {
  if (!ip) return false;
  return LOOPBACK.has(ip) || ip.startsWith("127.") || ip.startsWith("::ffff:127.");
}
function nombreDeHost(cabecera) {
  if (!cabecera) return "";
  if (cabecera.startsWith("[")) return cabecera.slice(1, cabecera.indexOf("]"));
  return cabecera.split(":")[0].toLowerCase();
}
async function leerCuerpoJson(req, max = 64 * 1024) {
  const trozos = [];
  let total = 0;
  for await (const t of req) {
    const b = typeof t === "string" ? Buffer.from(t) : t;
    total += b.length;
    if (total > max) return null;
    trozos.push(b);
  }
  if (total === 0) return {};
  try {
    return JSON.parse(Buffer.concat(trozos).toString("utf8"));
  } catch {
    return null;
  }
}
function permitido(req, acceso, escritura = false) {
  if (!acceso.red && !esLoopback(req.socket.remoteAddress)) return false;
  const host = nombreDeHost(req.headers.host);
  const hostValido = acceso.hostsPermitidos === true || host === "localhost" || host.endsWith(".localhost") || /^[\d.]+$/.test(host) || host.includes(":") || acceso.hostsPermitidos.some(
    (h) => h.startsWith(".") ? host === h.slice(1) || host.endsWith(h) : host === h.toLowerCase()
  );
  if (!hostValido) return false;
  const sitio = req.headers["sec-fetch-site"];
  if (sitio !== void 0 && sitio !== "same-origin" && sitio !== "none") return false;
  const origen = req.headers.origin;
  if (typeof origen === "string" && req.headers.host) {
    try {
      if (new URL(origen).host !== req.headers.host) return false;
    } catch {
      return false;
    }
  }
  if (escritura && req.headers["x-majix-tools"] !== "1") return false;
  return true;
}

// src/servidor/archivos.ts
import { execFile } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
var ejecutar = promisify(execFile);
var MAX_FICHEROS = 2e4;
var CARPETAS_EXCLUIDAS = /* @__PURE__ */ new Set([
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
  ".DS_Store"
]);
function esSecreto(nombre) {
  const n = nombre.toLowerCase();
  if (n === ".ds_store" || n === "thumbs.db") return true;
  if (n === ".env" || n.startsWith(".env.") && n !== ".env.example") return true;
  if (n.endsWith(".pem") || n.endsWith(".key") || n.endsWith(".p12") || n.endsWith(".pfx")) {
    return true;
  }
  if (n.startsWith("service-account") && n.endsWith(".json")) return true;
  if (n === ".npmrc" || n === ".netrc" || n === "id_rsa" || n === "id_ed25519") return true;
  return false;
}
async function listarConGit(raiz) {
  try {
    const { stdout } = await ejecutar(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { cwd: raiz, maxBuffer: 256 * 1024 * 1024, windowsHide: true }
    );
    return stdout.split("\0").filter(Boolean);
  } catch {
    return null;
  }
}
async function listarDisco(raiz, rel = "", salida = []) {
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
async function enLotes(items, n, tarea) {
  const salida = new Array(items.length);
  let siguiente = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (siguiente < items.length) {
        const i = siguiente++;
        salida[i] = await tarea(items[i]);
      }
    })
  );
  return salida;
}
function construirArbol(ficheros) {
  const raiz = { hijos: /* @__PURE__ */ new Map() };
  for (const f of ficheros) {
    const partes = f.ruta.split("/");
    let actual = raiz;
    for (let i = 0; i < partes.length - 1; i++) {
      let sub = actual.hijos.get(partes[i]);
      if (!sub || "tipo" in sub) {
        sub = { hijos: /* @__PURE__ */ new Map() };
        actual.hijos.set(partes[i], sub);
      }
      actual = sub;
    }
    actual.hijos.set(partes[partes.length - 1], {
      nombre: partes[partes.length - 1],
      ruta: f.ruta,
      tipo: "archivo",
      bytes: f.bytes
    });
  }
  const aNodos = (c, prefijo) => {
    const nodos = [];
    for (const [nombre, h] of c.hijos) {
      if ("tipo" in h) {
        nodos.push(h);
      } else {
        const ruta = prefijo ? `${prefijo}/${nombre}` : nombre;
        const hijos = aNodos(h, ruta);
        if (!hijos.length) continue;
        nodos.push({
          nombre,
          ruta,
          tipo: "carpeta",
          bytes: hijos.reduce((s, x) => s + x.bytes, 0),
          hijos
        });
      }
    }
    return nodos.sort((a, b) => b.bytes - a.bytes);
  };
  return aNodos(raiz, "");
}
function contar(nodos) {
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
async function leerProyecto(raiz) {
  const deGit = await listarConGit(raiz);
  const todas = (deGit ?? await listarDisco(raiz)).filter(
    (ruta) => !ruta.split("/").some(esSecreto)
  );
  const recortado = todas.length > MAX_FICHEROS;
  const rutas = todas.slice(0, MAX_FICHEROS);
  const medidos = await enLotes(rutas, 64, async (ruta) => {
    try {
      const info = await stat(join(raiz, ruta));
      return info.isFile() ? { ruta, bytes: info.size } : null;
    } catch {
      return null;
    }
  });
  const ficheros = medidos.filter((x) => x !== null);
  const arbol = construirArbol(ficheros);
  const { archivos, carpetas } = contar(arbol);
  return {
    raiz,
    fuente: deGit ? "git" : "disco",
    recortado,
    generadoEn: (/* @__PURE__ */ new Date()).toISOString(),
    totalBytes: arbol.reduce((s, n) => s + n.bytes, 0),
    totalArchivos: archivos,
    totalCarpetas: carpetas,
    arbol
  };
}

// src/servidor/comprobar-web.ts
import { lookup as resolverDns } from "node:dns";
import { request as peticionHttp } from "node:http";
import { request as peticionHttps } from "node:https";
import { BlockList, isIP } from "node:net";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
var ErrorComprobacion = class extends Error {
  constructor(codigo) {
    super(codigo);
    this.codigo = codigo;
  }
  codigo;
};
var TIEMPO_MAX_MS = 1e4;
var MAX_REDIRECCIONES = 5;
var MAX_BYTES_CUERPO = 5 * 1024 * 1024;
var PROHIBIDAS = new BlockList();
for (const [red, prefijo] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4]
]) {
  PROHIBIDAS.addSubnet(red, prefijo, "ipv4");
}
for (const [red, prefijo] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32]
]) {
  PROHIBIDAS.addSubnet(red, prefijo, "ipv6");
}
function ipv4Dentro(ip) {
  const mapeada = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapeada) return mapeada[1];
  const hex = ip.match(/^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (hex) {
    const alto = parseInt(hex[1], 16);
    const bajo = parseInt(hex[2], 16);
    return `${alto >> 8}.${alto & 255}.${bajo >> 8}.${bajo & 255}`;
  }
  return null;
}
function ipProhibida(ip) {
  const version = isIP(ip);
  if (version === 4) return PROHIBIDAS.check(ip, "ipv4");
  if (version === 6) {
    const v4 = ipv4Dentro(ip);
    if (v4) return PROHIBIDAS.check(v4, "ipv4");
    return PROHIBIDAS.check(ip, "ipv6");
  }
  return true;
}
var lookupSeguro = (host, opciones, alTerminar) => {
  resolverDns(host, { ...opciones, all: true }, (err, direcciones) => {
    if (err) return alTerminar(err, "", 0);
    const lista = direcciones;
    if (!lista.length || lista.some((d) => ipProhibida(d.address))) {
      const e = new Error("red-privada");
      e.code = "EMAJIXPRIVADA";
      return alTerminar(e, "", 0);
    }
    if (opciones.all) {
      return alTerminar(null, lista);
    }
    alTerminar(null, lista[0].address, lista[0].family);
  });
};
function normalizar(texto) {
  let url;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(texto) ? texto : `https://${texto}`);
  } catch {
    throw new ErrorComprobacion("url-invalida");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ErrorComprobacion("protocolo");
  }
  if (url.username || url.password) throw new ErrorComprobacion("url-invalida");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new ErrorComprobacion("red-privada");
  }
  if (isIP(host) && ipProhibida(host)) throw new ErrorComprobacion("red-privada");
  return url;
}
function pedir(url, restanteMs) {
  return new Promise((resolver, rechazar) => {
    const inicio = performance.now();
    const hacer = url.protocol === "https:" ? peticionHttps : peticionHttp;
    const req = hacer(
      url,
      {
        method: "GET",
        lookup: lookupSeguro,
        timeout: restanteMs,
        headers: {
          /* Algunos sitios devuelven otra página (o un bloqueo) sin un
             user-agent que parezca un navegador. */
          "User-Agent": "Mozilla/5.0 (compatible; MajixTools/1.0; +https://majixlab.com)",
          Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
          "Accept-Encoding": "br, gzip, deflate"
        }
      },
      (res) => resolver({ res, url, ms: Math.round(performance.now() - inicio) })
    );
    req.on("timeout", () => req.destroy(new ErrorComprobacion("tiempo")));
    req.on("error", (e) => {
      if (e instanceof ErrorComprobacion) return rechazar(e);
      if (e.code === "EMAJIXPRIVADA") return rechazar(new ErrorComprobacion("red-privada"));
      if (e.code === "ENOTFOUND" || e.code === "EAI_AGAIN") {
        return rechazar(new ErrorComprobacion("dns"));
      }
      rechazar(new ErrorComprobacion("sin-conexion"));
    });
    req.end();
  });
}
function leerCuerpo(res, restanteMs) {
  return new Promise((resolver) => {
    let transferidos = 0;
    let hecho = false;
    res.on("data", (trozo) => {
      transferidos += trozo.length;
    });
    const codificacion = (res.headers["content-encoding"] ?? "").toLowerCase();
    let flujo = res;
    if (codificacion === "gzip") flujo = res.pipe(createGunzip());
    else if (codificacion === "br") flujo = res.pipe(createBrotliDecompress());
    else if (codificacion === "deflate") flujo = res.pipe(createInflate());
    const trozos = [];
    let leidos = 0;
    const terminar = () => {
      if (hecho) return;
      hecho = true;
      clearTimeout(reloj);
      resolver({ transferidos, texto: Buffer.concat(trozos).toString("utf8") });
    };
    const reloj = setTimeout(() => {
      res.destroy();
      terminar();
    }, Math.max(500, restanteMs));
    flujo.on("data", (trozo) => {
      if (leidos >= MAX_BYTES_CUERPO) return;
      trozos.push(trozo);
      leidos += trozo.length;
      if (leidos >= MAX_BYTES_CUERPO) {
        res.destroy();
        terminar();
      }
    });
    flujo.on("end", terminar);
    flujo.on("error", terminar);
    res.on("error", terminar);
  });
}
function seguridadDe(h) {
  const csp = String(h["content-security-policy"] ?? "");
  return {
    hsts: "strict-transport-security" in h,
    csp: "content-security-policy" in h,
    xContentTypeOptions: "x-content-type-options" in h,
    xFrameOptions: "x-frame-options" in h || /frame-ancestors/i.test(csp),
    referrerPolicy: "referrer-policy" in h,
    permissionsPolicy: "permissions-policy" in h
  };
}
function analizarHtml(html) {
  const contar2 = (re) => (html.match(re) ?? []).length;
  const titulo = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? null;
  return {
    titulo,
    scripts: contar2(/<script\b/gi),
    imagenes: contar2(/<img\b/gi),
    imagenesConLazy: contar2(/<img\b[^>]*\bloading=["']?lazy/gi),
    hojasEstilo: contar2(/<link\b[^>]*rel=["']?stylesheet/gi),
    tieneViewport: /<meta\b[^>]*name=["']?viewport/i.test(html),
    tieneCharset: /<meta\b[^>]*charset=/i.test(html)
  };
}
async function comprobarWeb(solicitada) {
  try {
    if (!solicitada?.trim()) throw new ErrorComprobacion("falta-url");
    let url = normalizar(solicitada.trim());
    const inicio = performance.now();
    let respuesta = null;
    for (let salto = 0; salto <= MAX_REDIRECCIONES; salto++) {
      const restante = TIEMPO_MAX_MS - (performance.now() - inicio);
      if (restante <= 0) throw new ErrorComprobacion("tiempo");
      respuesta = await pedir(url, restante);
      const { res: res2 } = respuesta;
      const destino = res2.headers.location;
      if (res2.statusCode && res2.statusCode >= 300 && res2.statusCode < 400 && destino) {
        res2.resume();
        if (salto === MAX_REDIRECCIONES) throw new ErrorComprobacion("redirecciones");
        url = normalizar(new URL(destino, url).toString());
        continue;
      }
      break;
    }
    if (!respuesta) throw new ErrorComprobacion("sin-conexion");
    const { res, ms } = respuesta;
    const tipo = String(res.headers["content-type"] ?? "") || null;
    const esHtml = !!tipo && /text\/html/i.test(tipo);
    const { transferidos, texto } = await leerCuerpo(
      res,
      TIEMPO_MAX_MS - (performance.now() - inicio)
    );
    const cabeceras = {};
    for (const [k, v] of Object.entries(res.headers)) {
      if (v !== void 0) cabeceras[k] = Array.isArray(v) ? v.join(", ") : String(v);
    }
    const normalizadaInicial = normalizar(solicitada.trim()).toString();
    return {
      estado: 200,
      cuerpo: {
        solicitada,
        urlFinal: respuesta.url.toString(),
        redirigida: respuesta.url.toString() !== normalizadaInicial,
        estado: res.statusCode ?? 0,
        ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
        tiempoMs: ms,
        servidor: cabeceras.server ?? null,
        tipoContenido: tipo,
        comprimido: !!cabeceras["content-encoding"],
        codificacion: cabeceras["content-encoding"] ?? null,
        tamanoTransferidoBytes: transferidos,
        tamanoDescomprimidoBytes: esHtml ? Buffer.byteLength(texto) : null,
        cabeceras,
        seguridad: seguridadDe(res.headers),
        html: esHtml ? analizarHtml(texto) : null
      }
    };
  } catch (e) {
    const codigo = e instanceof ErrorComprobacion ? e.codigo : "sin-conexion";
    const estado = codigo === "falta-url" || codigo === "url-invalida" || codigo === "protocolo" || codigo === "red-privada" ? 400 : 502;
    return { estado, cuerpo: { codigo } };
  }
}

// src/servidor/search-console.ts
import { createSign } from "node:crypto";
var ErrorSearchConsole = class extends Error {
  constructor(info) {
    super(info.codigo);
    this.info = info;
  }
  info;
};
var VARIABLES_GSC = [
  "MAJIX_TOOLS_GSC_CLIENT_EMAIL",
  "MAJIX_TOOLS_GSC_PRIVATE_KEY",
  "MAJIX_TOOLS_GSC_SITE"
];
function credenciales(env) {
  const email = env.MAJIX_TOOLS_GSC_CLIENT_EMAIL?.trim();
  const clave = env.MAJIX_TOOLS_GSC_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  const sitio = env.MAJIX_TOOLS_GSC_SITE?.trim();
  const falta = VARIABLES_GSC.filter(
    (v) => !(v === "MAJIX_TOOLS_GSC_CLIENT_EMAIL" ? email : v === "MAJIX_TOOLS_GSC_PRIVATE_KEY" ? clave : sitio)
  );
  return { email, clave, sitio, falta: [...falta] };
}
var base64url = (b) => Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
function firmarJwt(email, clavePrivada, ahora = Math.floor(Date.now() / 1e3)) {
  const cabecera = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const cuerpo = base64url(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/webmasters.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: ahora,
      exp: ahora + 3600
    })
  );
  let firma;
  try {
    firma = createSign("RSA-SHA256").update(`${cabecera}.${cuerpo}`).sign(clavePrivada);
  } catch {
    throw new ErrorSearchConsole({ codigo: "clave" });
  }
  return `${cabecera}.${cuerpo}.${base64url(firma)}`;
}
var tokenEnMemoria = null;
async function pedirJson(url, init) {
  let res;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(15e3) });
  } catch {
    throw new ErrorSearchConsole({ codigo: "red" });
  }
  return { res, datos: await res.json().catch(() => ({})) };
}
async function token(email, clave) {
  if (tokenEnMemoria && tokenEnMemoria.email === email && tokenEnMemoria.caduca > Date.now() + 6e4) {
    return tokenEnMemoria.valor;
  }
  const { res, datos } = await pedirJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: firmarJwt(email, clave)
    })
  });
  const d = datos;
  if (!res.ok || !d.access_token) {
    throw new ErrorSearchConsole({
      codigo: "credenciales",
      detalle: d.error_description ?? d.error ?? `HTTP ${res.status}`
    });
  }
  tokenEnMemoria = { valor: d.access_token, caduca: Date.now() + (d.expires_in ?? 3600) * 1e3, email };
  return d.access_token;
}
function fecha(diasAtras) {
  return new Date(Date.now() - diasAtras * 864e5).toISOString().slice(0, 10);
}
function fechasEntre(inicio, fin) {
  const salida = [];
  for (let t = Date.parse(`${inicio}T00:00:00Z`); t <= Date.parse(`${fin}T00:00:00Z`); t += 864e5) {
    salida.push(new Date(t).toISOString().slice(0, 10));
  }
  return salida;
}
async function consultar(tk, sitio, inicio, fin, dimensiones, filas) {
  const { res, datos } = await pedirJson(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(sitio)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: inicio,
        endDate: fin,
        dimensions: dimensiones,
        rowLimit: filas,
        /* "all" incluye los datos recientes que Google aún no ha consolidado,
           lo mismo que enseña Search Console. Con "final" (el valor por
           defecto) los dos o tres últimos días llegarían vacíos y la
           gráfica caería a cero al final sin motivo. */
        dataState: "all"
      })
    }
  );
  const d = datos;
  if (!res.ok) {
    if (res.status === 403) throw new ErrorSearchConsole({ codigo: "acceso" });
    throw new ErrorSearchConsole({
      codigo: "google",
      estado: res.status,
      detalle: d.error?.message ?? "\u2014"
    });
  }
  return {
    filas: d.rows ?? [],
    primerDiaProvisional: d.metadata?.first_incomplete_date ?? d.metadata?.firstIncompleteDate ?? null
  };
}
var aplanar = (c) => c.filas.map((f) => ({
  clave: f.keys?.[0] ?? "",
  clics: f.clicks,
  impresiones: f.impressions,
  ctr: f.ctr,
  posicion: f.position
}));
async function searchConsole(env, diasPedidos) {
  const { email, clave, sitio, falta } = credenciales(env);
  if (falta.length || !email || !clave || !sitio) return { configurado: false, falta };
  const dias = [7, 28, 90].includes(Number(diasPedidos)) ? Number(diasPedidos) : 28;
  const fin = fecha(1);
  const inicio = fecha(dias);
  try {
    const tk = await token(email, clave);
    const [totales, porDia, consultas, paginas, paises, dispositivos] = await Promise.all([
      consultar(tk, sitio, inicio, fin, [], 1),
      consultar(tk, sitio, inicio, fin, ["date"], 500),
      consultar(tk, sitio, inicio, fin, ["query"], 25),
      consultar(tk, sitio, inicio, fin, ["page"], 25),
      consultar(tk, sitio, inicio, fin, ["country"], 10),
      consultar(tk, sitio, inicio, fin, ["device"], 5)
    ]);
    const delDia = new Map(aplanar(porDia).map((f) => [f.clave, f]));
    const ultimoConDatos = [...delDia.keys()].sort().at(-1) ?? "";
    const porDiaCompleto = fechasEntre(inicio, fin).map(
      (d) => delDia.get(d) ?? (d <= ultimoConDatos ? { clave: d, clics: 0, impresiones: 0, ctr: null, posicion: null } : { clave: d, clics: null, impresiones: null, ctr: null, posicion: null })
    );
    return {
      configurado: true,
      sitio,
      inicio,
      fin,
      dias,
      primerDiaProvisional: porDia.primerDiaProvisional,
      totales: aplanar(totales)[0] ?? { clave: "", clics: 0, impresiones: 0, ctr: 0, posicion: 0 },
      porDia: porDiaCompleto,
      consultas: aplanar(consultas),
      paginas: aplanar(paginas),
      paises: aplanar(paises),
      dispositivos: aplanar(dispositivos)
    };
  } catch (e) {
    return {
      configurado: true,
      sitio,
      error: e instanceof ErrorSearchConsole ? e.info : { codigo: "red" }
    };
  }
}

// src/servidor/cuenta.ts
import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join as join2 } from "node:path";

// src/servidor/muestras.ts
function textoLimpio(v, max) {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}
function numero(v, min, max) {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v < min || v > max ? null : v;
}
function rutaLimpia(v) {
  let r = textoLimpio(v, 300);
  const corte = r.search(/[?#]/);
  if (corte !== -1) r = r.slice(0, corte);
  if (!r.startsWith("/")) r = `/${r}`;
  return r.slice(0, 160);
}
function limpiarMuestras(valor) {
  if (!Array.isArray(valor)) return [];
  const salida = [];
  for (const x of valor.slice(0, 50)) {
    if (typeof x !== "object" || x === null) continue;
    const o = x;
    const id = textoLimpio(o.id, 40);
    const momento = numero(o.momento, 0, 864e13);
    if (id.length < 8 || momento === null) continue;
    salida.push({
      id,
      momento,
      ruta: rutaLimpia(o.ruta),
      lcp: numero(o.lcp, 0, 6e5),
      cls: numero(o.cls, 0, 100),
      inp: numero(o.inp, 0, 6e5),
      ttfb: numero(o.ttfb, 0, 6e5),
      peticiones: numero(o.peticiones, 0, 1e5) ?? 0,
      kb: numero(o.kb, 0, 1e8) ?? 0,
      errores: numero(o.errores, 0, 1e5) ?? 0,
      fps: numero(o.fps, 0, 1e3),
      largos: numero(o.largos, 0, 1e5),
      bloqueo: numero(o.bloqueo, 0, 1e8)
    });
  }
  return salida;
}
function diasDeSearchConsole(respuesta) {
  const r = respuesta;
  if (!r || r.configurado !== true || r.error || !Array.isArray(r.porDia)) return [];
  const salida = [];
  for (const f of r.porDia.slice(0, 400)) {
    if (typeof f !== "object" || f === null) continue;
    const o = f;
    if (typeof o.clave !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(o.clave)) continue;
    if (typeof o.clics !== "number" || typeof o.impresiones !== "number") continue;
    salida.push({
      dia: o.clave,
      clics: numero(o.clics, 0, 1e9) ?? 0,
      impresiones: numero(o.impresiones, 0, 1e9) ?? 0,
      ctr: numero(o.ctr, 0, 1),
      posicion: numero(o.posicion, 0, 1e4)
    });
  }
  return salida;
}

// src/servidor/cuenta.ts
var API_POR_DEFECTO = "https://majixlab.com";
var PROYECTO_ID = "majix-tools";
var GRACIA_MS = 24 * 60 * 60 * 1e3;
var REVALIDAR_MS = 10 * 60 * 1e3;
var PLAZO_MS = 8e3;
var MAX_BITACORA = 60;
function apiPermitida(valor) {
  if (!valor) return null;
  let u;
  try {
    u = new URL(valor);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const local = host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
  if (u.protocol === "http:" && local) return u.origin;
  if (u.protocol === "https:" && (host === "majixlab.com" || host.endsWith(".majixlab.com"))) {
    return u.origin;
  }
  return null;
}
function carpetaDeConfiguracion() {
  const manual = process.env.MAJIX_TOOLS_CONFIG_DIR;
  if (manual) return manual;
  const base = process.platform === "win32" ? process.env.APPDATA ?? join2(homedir(), "AppData", "Roaming") : process.platform === "darwin" ? join2(homedir(), "Library", "Application Support") : process.env.XDG_CONFIG_HOME ?? join2(homedir(), ".config");
  return join2(base, "majix-tools");
}
var RE_TOKEN = /^mjxt_[A-Za-z0-9_-]{43}$/;
var Cuenta = class {
  constructor(op) {
    this.op = op;
    this.api = apiPermitida(op.api) ?? API_POR_DEFECTO;
    this.f = op.fetch ?? fetch;
    this.ahora = op.ahora ?? Date.now;
    this.temporizadores = op.temporizadores ?? true;
    this.dir = op.dirConfig ?? carpetaDeConfiguracion();
    this.fichero = join2(this.dir, "sesiones.json");
    this.clave = createHash("sha256").update(`${this.api}
${op.raiz}`).digest("hex").slice(0, 32);
    this.etiqueta = textoLimpio(op.etiqueta ?? basename(op.raiz), 80) || "proyecto";
  }
  op;
  api;
  clave;
  fichero;
  dir;
  f;
  ahora;
  temporizadores;
  etiqueta;
  token = null;
  datos = null;
  estado = "sin-sesion";
  motivo = null;
  sinRed = false;
  vinculo = null;
  espera = null;
  revalidador = null;
  envio = { ultimo: null, enviadas: 0, fallos: 0, fueraDePlan: false };
  registro = [];
  ultimas = /* @__PURE__ */ new Map();
  /** Una escritura del fichero a la vez. */
  cola = Promise.resolve();
  // ── Arranque y cierre ───────────────────────────────────────────────────────────────────
  /** Lee la sesión guardada y la comprueba con MAJIX. No bloquea: la herramienta ya está arrancando. */
  async arrancar() {
    await this.cargar();
    if (this.token) await this.validar();
    if (this.temporizadores && !this.revalidador) {
      this.revalidador = setInterval(() => void this.validar(), REVALIDAR_MS);
      this.revalidador.unref?.();
    }
  }
  parar() {
    if (this.espera) clearTimeout(this.espera);
    if (this.revalidador) clearInterval(this.revalidador);
    this.espera = null;
    this.revalidador = null;
  }
  // ── Lo que ve el panel ──────────────────────────────────────────────────────────────────
  instantanea() {
    const d = this.datos;
    return {
      estado: this.estado,
      motivo: this.motivo,
      correo: d?.correo ?? null,
      etiqueta: d?.etiqueta ?? this.etiqueta,
      plan: d?.plan ?? null,
      webs: d?.webs ?? null,
      diasHistorial: d?.diasHistorial ?? null,
      searchConsole: d?.searchConsole ?? false,
      enVivo: d?.enVivo ?? false,
      dominio: d?.dominio ?? null,
      sinRed: this.sinRed,
      codigo: this.vinculo ? {
        usuario: this.vinculo.usuario,
        url: this.vinculo.url,
        urlCompleta: this.vinculo.urlCompleta,
        caducaEn: this.vinculo.caducaEn
      } : null,
      envio: { ...this.envio },
      api: this.api
    };
  }
  /** ¿Se puede usar la herramienta? Solo con una sesión comprobada (o dentro de las 24 h de gracia). */
  get conectada() {
    return this.estado === "conectada";
  }
  get plan() {
    return this.datos?.plan ?? null;
  }
  /** Plus y Pro: las mediciones llegan en vivo al panel de MAJIX. Con Libre no sale nada de tu ordenador. */
  get permiteEnVivo() {
    return this.conectada && this.datos?.enVivo === true;
  }
  get permiteSearchConsole() {
    return this.conectada && this.datos?.searchConsole === true;
  }
  bitacora() {
    return { entradas: [...this.registro].reverse(), ultimas: Object.fromEntries(this.ultimas) };
  }
  // ── Iniciar sesión (código de dispositivo) ──────────────────────────────────────────────
  async iniciar() {
    if (this.espera) clearTimeout(this.espera);
    this.espera = null;
    this.vinculo = null;
    this.motivo = null;
    const r = await this.llamar("iniciar", null, {
      proyecto: PROYECTO_ID,
      etiqueta: this.etiqueta,
      version: this.op.version
    });
    const c = r.cuerpo;
    if (!r.ok || typeof c.codigo_dispositivo !== "string" || typeof c.codigo_usuario !== "string" || typeof c.url !== "string" || typeof c.url_completa !== "string") {
      this.estado = this.token ? this.estado : "sin-sesion";
      this.motivo = "error";
      return this.instantanea();
    }
    const segundos = typeof c.intervalo_s === "number" ? Math.min(Math.max(c.intervalo_s, 2), 30) : 5;
    const caduca = typeof c.caduca_en_s === "number" ? c.caduca_en_s : 600;
    this.vinculo = {
      secreto: c.codigo_dispositivo,
      usuario: c.codigo_usuario,
      url: c.url,
      urlCompleta: c.url_completa,
      caducaEn: this.ahora() + Math.min(caduca, 900) * 1e3,
      intervalo: segundos * 1e3
    };
    this.estado = "esperando";
    this.programarSondeo();
    return this.instantanea();
  }
  cancelar() {
    if (this.espera) clearTimeout(this.espera);
    this.espera = null;
    this.vinculo = null;
    if (this.estado === "esperando") this.estado = this.token ? "conectada" : "sin-sesion";
    return this.instantanea();
  }
  programarSondeo() {
    if (!this.temporizadores || !this.vinculo) return;
    if (this.espera) clearTimeout(this.espera);
    this.espera = setTimeout(() => void this.sondearUnaVez(), this.vinculo.intervalo);
    this.espera.unref?.();
  }
  /** Una pregunta a MAJIX: ¿ya lo has aprobado? Pública para poder probarla sin esperar. */
  async sondearUnaVez() {
    const v = this.vinculo;
    if (!v || this.estado !== "esperando") return;
    if (this.ahora() > v.caducaEn) {
      this.vinculo = null;
      this.estado = this.token ? "conectada" : "sin-sesion";
      this.motivo = "expirada";
      return;
    }
    const r = await this.llamar("sondear", null, { codigo: v.secreto });
    if (this.vinculo !== v) return;
    if (r.http === 429) {
      v.intervalo = Math.min(v.intervalo * 2, 3e4);
    } else if (r.ok) {
      switch (r.cuerpo.estado) {
        case "aprobado": {
          const token2 = r.cuerpo.token;
          if (typeof token2 !== "string" || !RE_TOKEN.test(token2)) {
            this.vinculo = null;
            this.estado = this.token ? "conectada" : "sin-sesion";
            this.motivo = "error";
            return;
          }
          this.vinculo = null;
          this.token = token2;
          this.motivo = null;
          this.estado = "conectada";
          await this.validar(true);
          return;
        }
        case "denegado":
          this.vinculo = null;
          this.estado = this.token ? "conectada" : "sin-sesion";
          this.motivo = "denegada";
          return;
        case "caducado":
        case "desconocido":
        case "canjeado":
          this.vinculo = null;
          this.estado = this.token ? "conectada" : "sin-sesion";
          this.motivo = "expirada";
          return;
      }
    }
    this.programarSondeo();
  }
  // ── Comprobar la sesión ─────────────────────────────────────────────────────────────────
  /** Pregunta a MAJIX si el token sigue valiendo y trae el plan. Sin red, se mantiene la última comprobación. */
  async validar(guardarSiempre = false) {
    if (!this.token) return this.instantanea();
    const r = await this.llamar("sesion", this.token, { version: this.op.version });
    if (r.ok && r.cuerpo.ok === true) {
      const plan = ["libre", "plus", "pro"].find((p) => p === r.cuerpo.plan) ?? "libre";
      this.datos = {
        validadaEn: this.ahora(),
        correo: typeof r.cuerpo.correo === "string" ? r.cuerpo.correo : null,
        etiqueta: textoLimpio(r.cuerpo.etiqueta, 80) || this.etiqueta,
        plan,
        webs: typeof r.cuerpo.webs === "number" ? r.cuerpo.webs : 1,
        diasHistorial: typeof r.cuerpo.dias_historial === "number" ? r.cuerpo.dias_historial : 7,
        searchConsole: r.cuerpo.search_console === true,
        enVivo: r.cuerpo.en_vivo === true,
        dominio: typeof r.cuerpo.dominio === "string" ? r.cuerpo.dominio : null
      };
      this.estado = this.vinculo ? "esperando" : "conectada";
      this.sinRed = false;
      this.motivo = null;
      this.envio.fueraDePlan = false;
      await this.guardar();
      return this.instantanea();
    }
    if (r.http === 401) {
      const caducada = r.cuerpo.error === "caducada";
      await this.olvidar();
      this.motivo = caducada ? "caducada" : "revocada";
      return this.instantanea();
    }
    const ultima = this.datos?.validadaEn ?? null;
    if (ultima !== null && this.ahora() - ultima < GRACIA_MS) {
      this.estado = this.vinculo ? "esperando" : "conectada";
      this.sinRed = true;
    } else {
      this.estado = "sin-red";
      this.sinRed = true;
    }
    if (guardarSiempre) await this.guardar();
    return this.instantanea();
  }
  // ── Cerrar sesión ───────────────────────────────────────────────────────────────────────
  async cerrar() {
    if (this.token) await this.llamar("cerrar", this.token, {});
    await this.olvidar();
    this.motivo = null;
    return this.instantanea();
  }
  async olvidar() {
    this.token = null;
    this.datos = null;
    this.estado = "sin-sesion";
    this.sinRed = false;
    this.vinculo = null;
    if (this.espera) clearTimeout(this.espera);
    this.espera = null;
    await this.borrarGuardada();
  }
  // ── Enviar lo que se mide ───────────────────────────────────────────────────────────────
  async enviarMuestras(entrada) {
    if (!this.token || !this.conectada) return { http: 401, aceptadas: 0 };
    if (!this.permiteEnVivo) return { http: 403, aceptadas: 0 };
    const muestras = limpiarMuestras(entrada);
    if (muestras.length === 0) return { http: 400, aceptadas: 0 };
    const r = await this.llamar("muestras", this.token, { muestras }, resumenMuestras(muestras));
    return this.tratarEnvio(r, "aceptadas");
  }
  async enviarSearchConsole(dias) {
    if (!this.token || !this.permiteSearchConsole || dias.length === 0) return { http: 403, aceptadas: 0 };
    const r = await this.llamar("search-console", this.token, { dias }, `${dias.length} d\xEDas`);
    return this.tratarEnvio(r, "aceptados");
  }
  async tratarEnvio(r, campo) {
    if (r.ok) {
      this.envio.ultimo = this.ahora();
      this.envio.enviadas += typeof r.cuerpo[campo] === "number" ? r.cuerpo[campo] : 0;
      this.envio.fueraDePlan = false;
      return { http: 200, aceptadas: typeof r.cuerpo[campo] === "number" ? r.cuerpo[campo] : 0 };
    }
    this.envio.fallos++;
    if (r.http === 401) await this.validar();
    if (r.http === 403 && r.cuerpo.error === "plan") this.envio.fueraDePlan = true;
    return { http: r.http, aceptadas: 0 };
  }
  // ── La llamada a MAJIX ──────────────────────────────────────────────────────────────────
  async llamar(accion, token2, cuerpo, resumenPropio) {
    const texto = JSON.stringify(cuerpo);
    const control = new AbortController();
    const plazo = setTimeout(() => control.abort(), PLAZO_MS);
    let http = 0;
    let datos = {};
    try {
      const res = await this.f(`${this.api}/api/herramientas/${accion}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...token2 ? { Authorization: `Bearer ${token2}` } : {},
          "User-Agent": `majix-tools/${this.op.version}`
        },
        body: texto,
        signal: control.signal,
        redirect: "error"
        // un redirect podría llevar el token a otro servidor
      });
      http = res.status;
      const crudo = await res.text();
      if (crudo.length <= 256 * 1024) {
        try {
          const j = JSON.parse(crudo);
          if (typeof j === "object" && j !== null && !Array.isArray(j)) datos = j;
        } catch {
        }
      }
    } catch {
      http = 0;
    } finally {
      clearTimeout(plazo);
    }
    const ok = http >= 200 && http < 300;
    this.anotar({
      t: this.ahora(),
      accion,
      ok,
      http,
      resumen: resumenPropio ?? resumenDe(accion, cuerpo),
      bytes: Buffer.byteLength(texto)
    });
    if (accion === "muestras" || accion === "search-console" || accion === "sesion" || accion === "iniciar") {
      this.ultimas.set(accion, texto.length > 4e3 ? `${texto.slice(0, 4e3)}\u2026` : texto);
    }
    return { ok, http, cuerpo: datos };
  }
  anotar(e) {
    this.registro.push(e);
    if (this.registro.length > MAX_BITACORA) this.registro.shift();
  }
  // ── El fichero de la sesión ─────────────────────────────────────────────────────────────
  async leerFichero() {
    try {
      const j = JSON.parse(await readFile(this.fichero, "utf8"));
      if (j?.version === 1 && typeof j.sesiones === "object" && j.sesiones !== null) return j;
    } catch {
    }
    return { version: 1, sesiones: {} };
  }
  async cargar() {
    const g = (await this.leerFichero()).sesiones[this.clave];
    if (!g || typeof g.token !== "string" || !RE_TOKEN.test(g.token)) return;
    this.token = g.token;
    this.datos = {
      validadaEn: typeof g.validadaEn === "number" ? g.validadaEn : null,
      correo: typeof g.correo === "string" ? g.correo : null,
      etiqueta: textoLimpio(g.etiqueta, 80) || this.etiqueta,
      plan: ["libre", "plus", "pro"].find((p) => p === g.plan) ?? "libre",
      webs: typeof g.webs === "number" ? g.webs : 1,
      diasHistorial: typeof g.diasHistorial === "number" ? g.diasHistorial : 7,
      searchConsole: g.searchConsole === true,
      enVivo: g.enVivo === true,
      dominio: typeof g.dominio === "string" ? g.dominio : null
    };
    this.estado = "conectada";
  }
  async escribirFichero(cambiar) {
    const trabajo = async () => {
      const f = await this.leerFichero();
      cambiar(f);
      await mkdir(this.dir, { recursive: true, mode: 448 });
      await chmod(this.dir, 448).catch(() => {
      });
      const temporal = `${this.fichero}.${process.pid}.tmp`;
      await writeFile(temporal, JSON.stringify(f), { mode: 384 });
      await chmod(temporal, 384).catch(() => {
      });
      await rename(temporal, this.fichero);
    };
    this.cola = this.cola.then(trabajo, trabajo).catch(() => {
    });
    await this.cola;
  }
  async guardar() {
    const t = this.token;
    const d = this.datos;
    if (!t || !d) return;
    await this.escribirFichero((f) => {
      f.sesiones[this.clave] = {
        token: t,
        creadaEn: f.sesiones[this.clave]?.creadaEn ?? this.ahora(),
        ...d
      };
    });
  }
  async borrarGuardada() {
    await this.escribirFichero((f) => {
      delete f.sesiones[this.clave];
    });
  }
};
function resumenMuestras(m) {
  const rutas = [...new Set(m.map((x) => x.ruta))].slice(0, 3).join(", ");
  return `${m.length} ${m.length === 1 ? "muestra" : "muestras"} \xB7 ${rutas}`;
}
function resumenDe(accion, cuerpo) {
  switch (accion) {
    case "iniciar":
      return `proyecto ${String(cuerpo.proyecto)} \xB7 ${String(cuerpo.etiqueta)} \xB7 v${String(cuerpo.version)}`;
    case "sesion":
      return `comprobar sesi\xF3n \xB7 v${String(cuerpo.version)}`;
    case "sondear":
      return "esperando tu aprobaci\xF3n";
    case "cerrar":
      return "cerrar sesi\xF3n";
    default:
      return accion;
  }
}

// src/vite/index.ts
var PREFIJO = "/__majix-tools/";
async function nombreDelProyecto(raiz) {
  try {
    const j = JSON.parse(await readFile2(join3(raiz, "package.json"), "utf8"));
    return typeof j.name === "string" && j.name.trim() ? j.name.trim() : null;
  } catch {
    return null;
  }
}
function majixTools(opcionesDadas = {}) {
  const opciones = {
    inyectar: opcionesDadas.inyectar ?? opcionesDadas.inject ?? true,
    red: opcionesDadas.red ?? opcionesDadas.network ?? false
  };
  let config;
  let env = {};
  let cuenta = null;
  let nombreProyecto = null;
  let ultimaSc = 0;
  return {
    name: "majix-tools",
    apply: "serve",
    enforce: "pre",
    /* El panel ya viene empaquetado y sin dependencias (lleva React dentro):
       Vite no tiene nada que pre-empaquetar. Excluirlo evita, además, que
       Vite lo descubra al pedirlo el navegador y recargue la página una vez
       ("new dependencies optimized"), y conserva la ruta
       /majix-tools/dist/ que el grabador de red usa para no contar las
       peticiones del propio panel. */
    config: () => ({ optimizeDeps: { exclude: ["majix-tools"] } }),
    async configResolved(c) {
      config = c;
      nombreProyecto = await nombreDelProyecto(c.root);
      env = c.envDir === false ? {} : loadEnv(c.mode, c.envDir || c.root, "MAJIX_TOOLS_");
      for (const [k, v] of Object.entries(process.env)) {
        if (k.startsWith("MAJIX_TOOLS_") && v !== void 0 && !(k in env)) env[k] = v;
      }
    },
    configureServer(server) {
      cuenta = new Cuenta({
        api: apiPermitida(process.env.MAJIX_TOOLS_API) ?? API_POR_DEFECTO,
        raiz: config.root,
        version: "0.2.2",
        etiqueta: nombreProyecto ?? void 0
      });
      void cuenta.arrancar().catch(() => {
      });
      const programa = setInterval(() => void sincronizarSearchConsole(), 10 * 60 * 1e3);
      programa.unref?.();
      server.httpServer?.once("close", () => {
        clearInterval(programa);
        cuenta?.parar();
      });
      const sincronizarSearchConsole = async () => {
        if (!cuenta?.permiteSearchConsole) return;
        if (Date.now() - ultimaSc < 6 * 60 * 60 * 1e3) return;
        if (credenciales(env).falta.length) return;
        ultimaSc = Date.now();
        const dias = diasDeSearchConsole(await searchConsole(env, "90"));
        if (dias.length) await cuenta.enviarSearchConsole(dias);
      };
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "";
        if (!url.startsWith(PREFIJO)) return next();
        const { pathname, searchParams } = new URL(url, "http://majix-tools.localhost");
        const metodo = req.method ?? "GET";
        const escritura = metodo === "POST";
        const acceso = {
          red: opciones.red,
          hostsPermitidos: server.config.server.allowedHosts ?? []
        };
        if (!permitido(req, acceso, escritura)) return enviarJson(res, 403, { codigo: "prohibido" });
        if (metodo !== "GET" && metodo !== "POST") return enviarJson(res, 405, { codigo: "metodo" });
        const c = cuenta;
        if (!c) return enviarJson(res, 503, { codigo: "arrancando" });
        const exigeSesion = () => {
          if (c.conectada) return true;
          enviarJson(res, 401, { codigo: "sesion", sesion: c.instantanea() });
          return false;
        };
        const soloGet = () => {
          if (metodo === "GET") return true;
          enviarJson(res, 405, { codigo: "metodo" });
          return false;
        };
        const soloPost = () => {
          if (metodo === "POST") return true;
          enviarJson(res, 405, { codigo: "metodo" });
          return false;
        };
        try {
          switch (pathname) {
            case `${PREFIJO}api/sesion`:
              if (!soloGet()) return;
              return enviarJson(res, 200, c.instantanea());
            case `${PREFIJO}api/sesion/iniciar`:
              if (!soloPost()) return;
              return enviarJson(res, 200, await c.iniciar());
            case `${PREFIJO}api/sesion/cancelar`:
              if (!soloPost()) return;
              return enviarJson(res, 200, c.cancelar());
            case `${PREFIJO}api/sesion/refrescar`:
              if (!soloPost()) return;
              return enviarJson(res, 200, await c.validar());
            case `${PREFIJO}api/sesion/cerrar`:
              if (!soloPost()) return;
              return enviarJson(res, 200, await c.cerrar());
            case `${PREFIJO}api/bitacora`:
              if (!soloGet()) return;
              return enviarJson(res, 200, c.bitacora());
            case `${PREFIJO}api/muestras`: {
              if (!soloPost()) return;
              if (!c.conectada) return enviarJson(res, 401, { codigo: "sesion" });
              const cuerpo = await leerCuerpoJson(req);
              if (cuerpo === null || typeof cuerpo !== "object") return enviarJson(res, 400, { codigo: "formato" });
              if (!c.permiteEnVivo) return enviarJson(res, 403, { codigo: "plan", requiere: "plus" });
              const r = await c.enviarMuestras(cuerpo.muestras);
              return enviarJson(res, r.http === 200 ? 200 : r.http === 0 ? 502 : r.http, {
                ok: r.http === 200,
                aceptadas: r.aceptadas
              });
            }
            case `${PREFIJO}api/archivos`:
              if (!soloGet() || !exigeSesion()) return;
              return enviarJson(res, 200, await leerProyecto(config.root));
            case `${PREFIJO}api/comprobar-web`: {
              if (!soloGet() || !exigeSesion()) return;
              const r = await comprobarWeb(searchParams.get("url"));
              return enviarJson(res, r.estado, r.cuerpo);
            }
            case `${PREFIJO}api/search-console`: {
              if (!soloGet() || !exigeSesion()) return;
              if (!c.permiteSearchConsole) {
                return enviarJson(res, 403, { codigo: "plan", requiere: "plus", sesion: c.instantanea() });
              }
              const datos = await searchConsole(env, searchParams.get("dias"));
              const dias = diasDeSearchConsole(datos);
              if (dias.length) {
                ultimaSc = Date.now();
                void c.enviarSearchConsole(dias);
              }
              return enviarJson(res, 200, datos);
            }
            /* Lo usa `npx majix-tools doctor` para comprobar que el plugin
               está vivo. No devuelve ningún secreto: solo si faltan. */
            case `${PREFIJO}api/estado`:
              if (!soloGet()) return;
              return enviarJson(res, 200, {
                ok: true,
                version: "0.2.2",
                raiz: config.root,
                inyecta: opciones.inyectar,
                red: opciones.red,
                searchConsole: { falta: credenciales(env).falta },
                sesion: { estado: c.instantanea().estado, plan: c.plan }
              });
            default:
              return enviarJson(res, 404, { codigo: "no-existe" });
          }
        } catch (e) {
          config.logger.error(`[majix-tools] ${e instanceof Error ? e.stack : String(e)}`);
          return enviarJson(res, 500, { codigo: "interno" });
        }
      });
      server.httpServer?.once("listening", () => {
        setTimeout(() => {
          const es = (process.env.LC_ALL ?? process.env.LANG ?? "").toLowerCase().startsWith("es");
          const texto = es ? "el panel est\xE1 abajo en el centro de tu web" : "the panel is at the bottom centre of your site";
          config.logger.info(
            `  \x1B[35m\u279C\x1B[0m  \x1B[1mMAJIX Tools\x1B[0m v${"0.2.2"}: ${texto}`
          );
        }, 0);
      });
    },
    transformIndexHtml() {
      if (!opciones.inyectar) return;
      return [
        /* El navegador guarda como mucho 250 peticiones hasta que alguien
           las observa, y Vite pide más que eso antes de que llegue el panel.
           Esta línea, la primera del <head>, amplía ese margen. */
        {
          tag: "script",
          children: "performance.setResourceTimingBufferSize&&performance.setResourceTimingBufferSize(5000)",
          injectTo: "head-prepend"
        },
        {
          tag: "script",
          attrs: { type: "module", src: "/@id/majix-tools/cliente" },
          injectTo: "head-prepend"
        }
      ];
    }
  };
}
var index_default = majixTools;
export {
  index_default as default,
  majixTools
};
