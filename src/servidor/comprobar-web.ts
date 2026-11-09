import { lookup as resolverDns, type LookupAddress } from "node:dns";
import { request as peticionHttp, type IncomingMessage } from "node:http";
import { request as peticionHttps } from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import type { Readable } from "node:stream";

/* ---------------------------------------------------------------------- *
 * COMPROBAR OTRA WEB, DE VERDAD
 *
 * La pestaña "Otras webs" pide un informe de cualquier dirección. El
 * navegador no puede (CORS no le deja leer las cabeceras de otro dominio),
 * así que lo pide el servidor de desarrollo.
 *
 * ── QUÉ ES Y QUÉ NO ES ──
 * No es un Lighthouse: eso necesita un Chrome renderizando la página. Esto
 * es lo que da una petición HTTP, medido: tiempo de respuesta, cabeceras de
 * seguridad, compresión, bytes transferidos y un vistazo al HTML.
 *
 * ── POR QUÉ SE VALIDA EL DESTINO EN CADA CONEXIÓN ──
 * Es una petición desde TU ordenador a una dirección que escribe alguien.
 * Sin filtro, serviría para sondear tu red local (el router, otros equipos,
 * los metadatos de la nube en 169.254.169.254…). No basta con mirar el
 * nombre: `localtest.me` resuelve a 127.0.0.1, y una web puede redirigir a
 * una IP privada. Por eso:
 *   · la IP se comprueba en el momento de CONECTAR (la función `lookup` de
 *     Node), así que ni un DNS que cambie entre medias se cuela;
 *   · las redirecciones se siguen a mano, validando cada salto (máx. 5);
 *   · se bloquean IPv4 e IPv6 privadas, locales, reservadas y las IPv4
 *     escondidas dentro de una IPv6.
 * ---------------------------------------------------------------------- */

export type CodigoError =
  | "falta-url"
  | "url-invalida"
  | "protocolo"
  | "red-privada"
  | "tiempo"
  | "sin-conexion"
  | "redirecciones"
  | "dns";

class ErrorComprobacion extends Error {
  constructor(public codigo: CodigoError) {
    super(codigo);
  }
}

const TIEMPO_MAX_MS = 10_000;
const MAX_REDIRECCIONES = 5;
/** Del cuerpo solo se lee lo necesario para analizar el HTML. */
const MAX_BYTES_CUERPO = 5 * 1024 * 1024;

const PROHIBIDAS = new BlockList();
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
  ["240.0.0.0", 4],
] as const) {
  PROHIBIDAS.addSubnet(red, prefijo, "ipv4");
}
for (const [red, prefijo] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
] as const) {
  PROHIBIDAS.addSubnet(red, prefijo, "ipv6");
}

/** IPv4 escondida en una IPv6: `::ffff:127.0.0.1` o `64:ff9b::7f00:1`. */
function ipv4Dentro(ip: string): string | null {
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

export function ipProhibida(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return PROHIBIDAS.check(ip, "ipv4");
  if (version === 6) {
    const v4 = ipv4Dentro(ip);
    if (v4) return PROHIBIDAS.check(v4, "ipv4");
    return PROHIBIDAS.check(ip, "ipv6");
  }
  return true;
}

/** El `lookup` que usa cada conexión: resuelve como siempre y se niega a
 *  devolver una IP prohibida. Es lo que cierra la puerta al DNS rebinding. */
const lookupSeguro: LookupFunction = (host, opciones, alTerminar) => {
  resolverDns(host, { ...opciones, all: true }, (err, direcciones) => {
    if (err) return alTerminar(err, "", 0);
    const lista = direcciones as LookupAddress[];
    if (!lista.length || lista.some((d) => ipProhibida(d.address))) {
      const e = new Error("red-privada") as NodeJS.ErrnoException;
      e.code = "EMAJIXPRIVADA";
      return alTerminar(e, "", 0);
    }
    if ((opciones as { all?: boolean }).all) {
      return (alTerminar as unknown as (e: null, d: LookupAddress[]) => void)(null, lista);
    }
    alTerminar(null, lista[0].address, lista[0].family);
  });
};

function normalizar(texto: string): URL {
  let url: URL;
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

type Respuesta = { res: IncomingMessage; url: URL; ms: number };

function pedir(url: URL, restanteMs: number): Promise<Respuesta> {
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
          "Accept-Encoding": "br, gzip, deflate",
        },
      },
      (res) => resolver({ res, url, ms: Math.round(performance.now() - inicio) }),
    );
    req.on("timeout", () => req.destroy(new ErrorComprobacion("tiempo")));
    req.on("error", (e: NodeJS.ErrnoException) => {
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

/** Lee el cuerpo (hasta 5 MB) contando los bytes que llegan por la red y,
 *  aparte, los que ocupa ya descomprimido. Con tiempo límite: un servidor
 *  que manda el cuerpo byte a byte no puede dejar la comprobación colgada. */
function leerCuerpo(
  res: IncomingMessage,
  restanteMs: number,
): Promise<{ transferidos: number; texto: string }> {
  return new Promise((resolver) => {
    let transferidos = 0;
    let hecho = false;
    res.on("data", (trozo: Buffer) => {
      transferidos += trozo.length;
    });
    const codificacion = (res.headers["content-encoding"] ?? "").toLowerCase();
    let flujo: Readable = res;
    if (codificacion === "gzip") flujo = res.pipe(createGunzip());
    else if (codificacion === "br") flujo = res.pipe(createBrotliDecompress());
    else if (codificacion === "deflate") flujo = res.pipe(createInflate());

    const trozos: Buffer[] = [];
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
    flujo.on("data", (trozo: Buffer) => {
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

/** Cabeceras de seguridad habituales: si están o no, sin puntuar nada más. */
function seguridadDe(h: IncomingMessage["headers"]) {
  const csp = String(h["content-security-policy"] ?? "");
  return {
    hsts: "strict-transport-security" in h,
    csp: "content-security-policy" in h,
    xContentTypeOptions: "x-content-type-options" in h,
    xFrameOptions: "x-frame-options" in h || /frame-ancestors/i.test(csp),
    referrerPolicy: "referrer-policy" in h,
    permissionsPolicy: "permissions-policy" in h,
  };
}

/** Un vistazo al HTML con expresiones regulares: de sobra para contar
 *  etiquetas, no para nada más. */
function analizarHtml(html: string) {
  const contar = (re: RegExp) => (html.match(re) ?? []).length;
  const titulo = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? null;
  return {
    titulo,
    scripts: contar(/<script\b/gi),
    imagenes: contar(/<img\b/gi),
    imagenesConLazy: contar(/<img\b[^>]*\bloading=["']?lazy/gi),
    hojasEstilo: contar(/<link\b[^>]*rel=["']?stylesheet/gi),
    tieneViewport: /<meta\b[^>]*name=["']?viewport/i.test(html),
    tieneCharset: /<meta\b[^>]*charset=/i.test(html),
  };
}

export async function comprobarWeb(
  solicitada: string | null,
): Promise<{ estado: number; cuerpo: unknown }> {
  try {
    if (!solicitada?.trim()) throw new ErrorComprobacion("falta-url");
    let url = normalizar(solicitada.trim());
    const inicio = performance.now();
    let respuesta: Respuesta | null = null;

    for (let salto = 0; salto <= MAX_REDIRECCIONES; salto++) {
      const restante = TIEMPO_MAX_MS - (performance.now() - inicio);
      if (restante <= 0) throw new ErrorComprobacion("tiempo");
      respuesta = await pedir(url, restante);
      const { res } = respuesta;
      const destino = res.headers.location;
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && destino) {
        res.resume();
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
      TIEMPO_MAX_MS - (performance.now() - inicio),
    );

    const cabeceras: Record<string, string> = {};
    for (const [k, v] of Object.entries(res.headers)) {
      if (v !== undefined) cabeceras[k] = Array.isArray(v) ? v.join(", ") : String(v);
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
        html: esHtml ? analizarHtml(texto) : null,
      },
    };
  } catch (e) {
    const codigo = e instanceof ErrorComprobacion ? e.codigo : "sin-conexion";
    const estado =
      codigo === "falta-url" ||
      codigo === "url-invalida" ||
      codigo === "protocolo" ||
      codigo === "red-privada"
        ? 400
        : 502;
    return { estado, cuerpo: { codigo } };
  }
}
