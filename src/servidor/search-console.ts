import { createSign } from "node:crypto";

/* ---------------------------------------------------------------------- *
 * SEARCH CONSOLE, CON TU PROPIA CUENTA DE SERVICIO
 *
 * Datos de rendimiento en Google de tu web —clics, impresiones, CTR y
 * posición— por día, consulta, página, país y dispositivo, de la API
 * oficial (`searchAnalytics.query`).
 *
 * ── CÓMO SE AUTENTICA ──
 * Con una cuenta de servicio de Google Cloud que añades como usuario de tu
 * propiedad. Sus credenciales viven en tu `.env`:
 *
 *   MAJIX_TOOLS_GSC_CLIENT_EMAIL   el correo de la cuenta de servicio
 *   MAJIX_TOOLS_GSC_PRIVATE_KEY    su clave privada (con los \n literales)
 *   MAJIX_TOOLS_GSC_SITE           "sc-domain:ejemplo.com" o "https://ejemplo.com/"
 *
 * Se firma un JWT (RS256) con la clave, Google lo cambia por un token de una
 * hora con permiso SOLO de lectura (`webmasters.readonly`), y el token se
 * guarda en memoria hasta un minuto antes de caducar. La clave privada no
 * sale de este proceso: el navegador solo recibe los números.
 * ---------------------------------------------------------------------- */

type Fila = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number };
type Consulta = { filas: Fila[]; primerDiaProvisional: string | null };

export type ErrorGsc =
  | { codigo: "clave" }
  | { codigo: "credenciales"; detalle: string }
  | { codigo: "acceso" }
  | { codigo: "google"; estado: number; detalle: string }
  | { codigo: "red" };

class ErrorSearchConsole extends Error {
  constructor(public info: ErrorGsc) {
    super(info.codigo);
  }
}

export const VARIABLES_GSC = [
  "MAJIX_TOOLS_GSC_CLIENT_EMAIL",
  "MAJIX_TOOLS_GSC_PRIVATE_KEY",
  "MAJIX_TOOLS_GSC_SITE",
] as const;

export function credenciales(env: Record<string, string | undefined>) {
  const email = env.MAJIX_TOOLS_GSC_CLIENT_EMAIL?.trim();
  /* En un .env la clave va en una sola línea con "\n" escritos a mano;
     aquí se convierten en saltos de línea de verdad. */
  const clave = env.MAJIX_TOOLS_GSC_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  const sitio = env.MAJIX_TOOLS_GSC_SITE?.trim();
  const falta = VARIABLES_GSC.filter(
    (v) =>
      !(v === "MAJIX_TOOLS_GSC_CLIENT_EMAIL" ? email : v === "MAJIX_TOOLS_GSC_PRIVATE_KEY" ? clave : sitio),
  );
  return { email, clave, sitio, falta: [...falta] };
}

const base64url = (b: Buffer | string) =>
  Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

/** El JWT que Google espera de una cuenta de servicio (RFC 7523). */
export function firmarJwt(email: string, clavePrivada: string, ahora = Math.floor(Date.now() / 1000)) {
  const cabecera = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const cuerpo = base64url(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/webmasters.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: ahora,
      exp: ahora + 3600,
    }),
  );
  let firma: Buffer;
  try {
    firma = createSign("RSA-SHA256").update(`${cabecera}.${cuerpo}`).sign(clavePrivada);
  } catch {
    /* OpenSSL diría "DECODER routines::unsupported", que no ayuda a nadie.
       El fallo casi siempre es el mismo: la clave pegada sin sus \n o sin
       las líneas BEGIN/END. */
    throw new ErrorSearchConsole({ codigo: "clave" });
  }
  return `${cabecera}.${cuerpo}.${base64url(firma)}`;
}

let tokenEnMemoria: { valor: string; caduca: number; email: string } | null = null;

async function pedirJson(url: string, init: RequestInit): Promise<{ res: Response; datos: unknown }> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new ErrorSearchConsole({ codigo: "red" });
  }
  return { res, datos: await res.json().catch(() => ({})) };
}

async function token(email: string, clave: string): Promise<string> {
  if (tokenEnMemoria && tokenEnMemoria.email === email && tokenEnMemoria.caduca > Date.now() + 60_000) {
    return tokenEnMemoria.valor;
  }
  const { res, datos } = await pedirJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: firmarJwt(email, clave),
    }),
  });
  const d = datos as { access_token?: string; expires_in?: number; error_description?: string; error?: string };
  if (!res.ok || !d.access_token) {
    throw new ErrorSearchConsole({
      codigo: "credenciales",
      detalle: d.error_description ?? d.error ?? `HTTP ${res.status}`,
    });
  }
  tokenEnMemoria = { valor: d.access_token, caduca: Date.now() + (d.expires_in ?? 3600) * 1000, email };
  return d.access_token;
}

/** Fecha AAAA-MM-DD, `diasAtras` días antes de hoy (UTC). */
function fecha(diasAtras: number) {
  return new Date(Date.now() - diasAtras * 86_400_000).toISOString().slice(0, 10);
}

/** Todas las fechas de `inicio` a `fin`, ambas incluidas. */
export function fechasEntre(inicio: string, fin: string): string[] {
  const salida: string[] = [];
  for (let t = Date.parse(`${inicio}T00:00:00Z`); t <= Date.parse(`${fin}T00:00:00Z`); t += 86_400_000) {
    salida.push(new Date(t).toISOString().slice(0, 10));
  }
  return salida;
}

async function consultar(
  tk: string,
  sitio: string,
  inicio: string,
  fin: string,
  dimensiones: string[],
  filas: number,
): Promise<Consulta> {
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
        dataState: "all",
      }),
    },
  );
  const d = datos as {
    rows?: Fila[];
    metadata?: { first_incomplete_date?: string; firstIncompleteDate?: string };
    error?: { message?: string };
  };
  if (!res.ok) {
    if (res.status === 403) throw new ErrorSearchConsole({ codigo: "acceso" });
    throw new ErrorSearchConsole({
      codigo: "google",
      estado: res.status,
      detalle: d.error?.message ?? "—",
    });
  }
  return {
    filas: d.rows ?? [],
    primerDiaProvisional: d.metadata?.first_incomplete_date ?? d.metadata?.firstIncompleteDate ?? null,
  };
}

const aplanar = (c: Consulta) =>
  c.filas.map((f) => ({
    clave: f.keys?.[0] ?? "",
    clics: f.clicks,
    impresiones: f.impressions,
    ctr: f.ctr,
    posicion: f.position,
  }));

export async function searchConsole(
  env: Record<string, string | undefined>,
  diasPedidos: string | null,
): Promise<unknown> {
  const { email, clave, sitio, falta } = credenciales(env);
  if (falta.length || !email || !clave || !sitio) return { configurado: false, falta };

  const dias = [7, 28, 90].includes(Number(diasPedidos)) ? Number(diasPedidos) : 28;
  /* El periodo termina ayer: el día de hoy aún no tiene datos. */
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
      consultar(tk, sitio, inicio, fin, ["device"], 5),
    ]);

    /* ── UN PUNTO POR DÍA, AUNQUE GOOGLE NO LO DEVUELVA ──
       La API omite los días sin impresiones. Sin rellenarlos, el eje
       saltaría de fecha en fecha sin avisar. Un día que falta ANTES del
       último con datos es un día real con 0 clics y 0 impresiones (CTR y
       posición no existen: sin impresiones no hay posición media). Un día
       DESPUÉS del último con datos es que Google aún no lo tiene: vacío,
       no a cero. */
    const delDia = new Map(aplanar(porDia).map((f) => [f.clave, f]));
    const ultimoConDatos = [...delDia.keys()].sort().at(-1) ?? "";
    const porDiaCompleto = fechasEntre(inicio, fin).map(
      (d) =>
        delDia.get(d) ??
        (d <= ultimoConDatos
          ? { clave: d, clics: 0, impresiones: 0, ctr: null, posicion: null }
          : { clave: d, clics: null, impresiones: null, ctr: null, posicion: null }),
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
      dispositivos: aplanar(dispositivos),
    };
  } catch (e) {
    return {
      configurado: true,
      sitio,
      error: e instanceof ErrorSearchConsole ? e.info : ({ codigo: "red" } as ErrorGsc),
    };
  }
}
