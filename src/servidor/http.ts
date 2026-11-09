import type { IncomingMessage, ServerResponse } from "node:http";

/* ---------------------------------------------------------------------- *
 * UTILIDADES HTTP DEL PLUGIN — respuestas JSON y quién puede preguntar
 * ---------------------------------------------------------------------- */

export function enviarJson(res: ServerResponse, estado: number, datos: unknown): void {
  const cuerpo = JSON.stringify(datos);
  res.statusCode = estado;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(cuerpo);
}

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function esLoopback(ip: string | undefined): boolean {
  if (!ip) return false;
  return LOOPBACK.has(ip) || ip.startsWith("127.") || ip.startsWith("::ffff:127.");
}

function nombreDeHost(cabecera: string | undefined): string {
  if (!cabecera) return "";
  /* "[::1]:5173" → "::1"; "localhost:5173" → "localhost" */
  if (cabecera.startsWith("[")) return cabecera.slice(1, cabecera.indexOf("]"));
  return cabecera.split(":")[0].toLowerCase();
}

/** Lee el cuerpo de una petición con tope de tamaño. Devuelve `null` si se pasa o si no es JSON. */
export async function leerCuerpoJson(req: IncomingMessage, max = 64 * 1024): Promise<unknown | null> {
  const trozos: Buffer[] = [];
  let total = 0;
  for await (const t of req) {
    const b = typeof t === "string" ? Buffer.from(t) : (t as Buffer);
    total += b.length;
    if (total > max) return null;
    trozos.push(b);
  }
  if (total === 0) return {};
  try {
    return JSON.parse(Buffer.concat(trozos).toString("utf8")) as unknown;
  } catch {
    return null;
  }
}

export type Acceso = {
  /** `true` para permitir peticiones desde otros equipos de tu red. */
  red: boolean;
  /** `server.allowedHosts` de tu configuración de Vite. */
  hostsPermitidos: string[] | true;
};

/* ── QUIÉN PUEDE USAR LOS ENDPOINTS ──
   Tres comprobaciones, de la más a la menos evidente:

   1. DESDE DÓNDE. Solo desde este mismo ordenador. Si arrancas Vite con
      `--host` para probar en el móvil, tu servidor se ve desde toda tu red
      WiFi: sin esto, cualquiera en ella podría leer el árbol de tu proyecto
      o tus datos de Search Console. Se abre con `majixTools({ red: true })`.

   2. A QUÉ NOMBRE. La cabecera `Host` tiene que ser localhost, una IP o un
      host que TÚ hayas permitido en Vite. Es la defensa contra el "DNS
      rebinding": una web cualquiera abierta en tu navegador podría hacer que
      su dominio apunte a 127.0.0.1 y leer estos endpoints como si fuera tu
      propia web.

   3. DESDE QUÉ WEB. Solo desde TU web. Si el navegador dice que la petición
      viene de otra (`Sec-Fetch-Site: cross-site` o `same-site`), se rechaza:
      `same-site` incluye otra web tuya en otro puerto de localhost, y una web
      cualquiera que tengas abierta no debe poder leer tu sesión ni tu disco.

   Y para lo que CAMBIA algo (iniciar o cerrar sesión, enviar datos) hay una
   cuarta: la petición tiene que llevar la cabecera `X-Majix-Tools`. Un
   formulario o una imagen de otra web no pueden poner cabeceras propias, y
   un `fetch` con una cabecera propia obliga al navegador a preguntar antes
   (CORS), pregunta que este servidor nunca contesta que sí. */
export function permitido(req: IncomingMessage, acceso: Acceso, escritura = false): boolean {
  if (!acceso.red && !esLoopback(req.socket.remoteAddress)) return false;

  const host = nombreDeHost(req.headers.host);
  const hostValido =
    acceso.hostsPermitidos === true ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    /^[\d.]+$/.test(host) ||
    host.includes(":") ||
    acceso.hostsPermitidos.some((h) =>
      h.startsWith(".") ? host === h.slice(1) || host.endsWith(h) : host === h.toLowerCase(),
    );
  if (!hostValido) return false;

  const sitio = req.headers["sec-fetch-site"];
  if (sitio !== undefined && sitio !== "same-origin" && sitio !== "none") return false;

  /* `Origin`, si viene, tiene que ser el de esta misma dirección. */
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
