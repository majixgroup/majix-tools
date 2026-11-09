import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import {
  limpiarMuestras,
  textoLimpio,
  type DiaSearchConsole,
  type MuestraEnviada,
} from "./muestras";

/* ---------------------------------------------------------------------- *
 * LA CUENTA DE MAJIX — iniciar sesión desde una herramienta local
 *
 * MAJIX Tools se instala en TU ordenador, pero para usarla hay que iniciar
 * sesión con tu cuenta de MAJIX. No te pide la contraseña: usa el «código de
 * dispositivo» (como GitHub CLI o Stripe CLI).
 *
 *   1. Enseña un código corto («BCDF-GHJK») y una dirección de majixlab.com.
 *   2. Tú abres esa dirección con tu cuenta, ves QUÉ se está conectando y lo
 *      apruebas (o lo deniegas).
 *   3. La herramienta recibe un TOKEN propio, de corta vida y revocable.
 *
 * ── DÓNDE VIVE EL TOKEN, Y DÓNDE NO ──
 *   · Solo en este proceso (el servidor de desarrollo) y en un fichero de tu
 *     carpeta de configuración con permisos 600 (solo tu usuario lo lee).
 *   · NUNCA llega al navegador: el panel solo recibe «conectada», tu plan y tu
 *     correo con asteriscos. Ni las gráficas, ni la consola, ni nada de lo que
 *     ve el navegador contiene el token.
 *   · NUNCA va dentro de tu proyecto (no se puede subir a git por error) ni en
 *     tu `.env`.
 *   · En los servidores de MAJIX solo queda su hash: ni un volcado de su base
 *     de datos permite usarlo.
 *
 * ── LO QUE SE ENVÍA ──
 *   Ver `muestras.ts`. Cada envío queda anotado en la bitácora (sin el token)
 *   y la pestaña «Cuenta» del panel lo enseña tal cual salió.
 * ---------------------------------------------------------------------- */

export type Plan = "libre" | "plus" | "pro";
export type EstadoSesion = "sin-sesion" | "esperando" | "conectada" | "sin-red";
export type MotivoSinSesion = "caducada" | "revocada" | "denegada" | "expirada" | "error" | null;

export type Instantanea = {
  estado: EstadoSesion;
  motivo: MotivoSinSesion;
  /** El correo de tu cuenta con asteriscos («m***@gmail.com»). */
  correo: string | null;
  etiqueta: string;
  plan: Plan | null;
  webs: number | null;
  diasHistorial: number | null;
  searchConsole: boolean;
  /** ¿El plan incluye la monitorización en vivo en tu panel de MAJIX? (Plus y Pro; con Libre, todo queda en local.) */
  enVivo: boolean;
  /** El dominio publicado de esta web, el que confirmaste al conectar. */
  dominio: string | null;
  /** Conectada, pero ahora mismo no se puede comprobar con MAJIX (se sigue con la última comprobación). */
  sinRed: boolean;
  codigo: { usuario: string; url: string; urlCompleta: string; caducaEn: number } | null;
  envio: {
    ultimo: number | null;
    enviadas: number;
    fallos: number;
    /** Esta web sobra para tu plan (por ejemplo, tras bajar de plan): no se envían datos. */
    fueraDePlan: boolean;
  };
  /** El servidor de MAJIX al que habla (solo el origen). */
  api: string;
};

export type EntradaBitacora = {
  t: number;
  accion: "iniciar" | "sondear" | "sesion" | "muestras" | "search-console" | "cerrar";
  ok: boolean;
  http: number;
  resumen: string;
  bytes: number;
};

export type OpcionesCuenta = {
  api: string;
  /** La carpeta del proyecto: cada proyecto tiene su propia sesión. */
  raiz: string;
  version: string;
  /** Dónde se guarda la sesión. Por defecto, tu carpeta de configuración. */
  dirConfig?: string;
  fetch?: typeof fetch;
  ahora?: () => number;
  /** `false` en las pruebas: no arranca temporizadores. */
  temporizadores?: boolean;
  /** El nombre de tu web. Por defecto, el `name` de tu package.json. */
  etiqueta?: string;
};

export const API_POR_DEFECTO = "https://majixlab.com";
const PROYECTO_ID = "majix-tools";
/** Sin poder hablar con MAJIX, una sesión ya comprobada sigue valiendo 24 horas. */
const GRACIA_MS = 24 * 60 * 60 * 1000;
const REVALIDAR_MS = 10 * 60 * 1000;
const PLAZO_MS = 8000;
const MAX_BITACORA = 60;

/**
 * ¿A qué servidor se puede hablar? A majixlab.com (y sus subdominios, por las vistas previas) por https,
 * y a localhost para probar. Cualquier otra cosa se ignora: una variable de entorno cambiada no puede
 * mandar tu token a un servidor ajeno.
 */
export function apiPermitida(valor: string | undefined): string | null {
  if (!valor) return null;
  let u: URL;
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

/** La carpeta de configuración del sistema: la sesión vive ahí, nunca dentro de tu proyecto. */
export function carpetaDeConfiguracion(): string {
  const manual = process.env.MAJIX_TOOLS_CONFIG_DIR;
  if (manual) return manual;
  const base =
    process.platform === "win32"
      ? (process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"))
      : process.platform === "darwin"
        ? join(homedir(), "Library", "Application Support")
        : (process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"));
  return join(base, "majix-tools");
}

type Guardada = {
  token: string;
  creadaEn: number;
  validadaEn: number | null;
  correo: string | null;
  etiqueta: string;
  plan: Plan;
  webs: number;
  diasHistorial: number;
  searchConsole: boolean;
  enVivo: boolean;
  dominio: string | null;
};
type Fichero = { version: 1; sesiones: Record<string, Guardada> };

const RE_TOKEN = /^mjxt_[A-Za-z0-9_-]{43}$/;

export class Cuenta {
  private api: string;
  private clave: string;
  private fichero: string;
  private dir: string;
  private f: typeof fetch;
  private ahora: () => number;
  private temporizadores: boolean;
  private etiqueta: string;

  private token: string | null = null;
  private datos: Omit<Guardada, "token" | "creadaEn"> | null = null;
  private estado: EstadoSesion = "sin-sesion";
  private motivo: MotivoSinSesion = null;
  private sinRed = false;
  private vinculo: {
    secreto: string;
    usuario: string;
    url: string;
    urlCompleta: string;
    caducaEn: number;
    intervalo: number;
  } | null = null;
  private espera: ReturnType<typeof setTimeout> | null = null;
  private revalidador: ReturnType<typeof setInterval> | null = null;
  private envio = { ultimo: null as number | null, enviadas: 0, fallos: 0, fueraDePlan: false };
  private registro: EntradaBitacora[] = [];
  private ultimas = new Map<string, string>();
  /** Una escritura del fichero a la vez. */
  private cola: Promise<void> = Promise.resolve();

  constructor(private op: OpcionesCuenta) {
    this.api = apiPermitida(op.api) ?? API_POR_DEFECTO;
    this.f = op.fetch ?? fetch;
    this.ahora = op.ahora ?? Date.now;
    this.temporizadores = op.temporizadores ?? true;
    this.dir = op.dirConfig ?? carpetaDeConfiguracion();
    this.fichero = join(this.dir, "sesiones.json");
    // Una sesión por proyecto y por servidor: la de las pruebas (localhost) no sirve en majixlab.com.
    this.clave = createHash("sha256").update(`${this.api}\n${op.raiz}`).digest("hex").slice(0, 32);
    this.etiqueta = textoLimpio(op.etiqueta ?? basename(op.raiz), 80) || "proyecto";
  }

  // ── Arranque y cierre ───────────────────────────────────────────────────────────────────

  /** Lee la sesión guardada y la comprueba con MAJIX. No bloquea: la herramienta ya está arrancando. */
  async arrancar(): Promise<void> {
    await this.cargar();
    if (this.token) await this.validar();
    if (this.temporizadores && !this.revalidador) {
      this.revalidador = setInterval(() => void this.validar(), REVALIDAR_MS);
      this.revalidador.unref?.();
    }
  }

  parar(): void {
    if (this.espera) clearTimeout(this.espera);
    if (this.revalidador) clearInterval(this.revalidador);
    this.espera = null;
    this.revalidador = null;
  }

  // ── Lo que ve el panel ──────────────────────────────────────────────────────────────────

  instantanea(): Instantanea {
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
      codigo: this.vinculo
        ? {
            usuario: this.vinculo.usuario,
            url: this.vinculo.url,
            urlCompleta: this.vinculo.urlCompleta,
            caducaEn: this.vinculo.caducaEn,
          }
        : null,
      envio: { ...this.envio },
      api: this.api,
    };
  }

  /** ¿Se puede usar la herramienta? Solo con una sesión comprobada (o dentro de las 24 h de gracia). */
  get conectada(): boolean {
    return this.estado === "conectada";
  }

  get plan(): Plan | null {
    return this.datos?.plan ?? null;
  }

  /** Plus y Pro: las mediciones llegan en vivo al panel de MAJIX. Con Libre no sale nada de tu ordenador. */
  get permiteEnVivo(): boolean {
    return this.conectada && this.datos?.enVivo === true;
  }

  get permiteSearchConsole(): boolean {
    return this.conectada && this.datos?.searchConsole === true;
  }

  bitacora(): { entradas: EntradaBitacora[]; ultimas: Record<string, string> } {
    return { entradas: [...this.registro].reverse(), ultimas: Object.fromEntries(this.ultimas) };
  }

  // ── Iniciar sesión (código de dispositivo) ──────────────────────────────────────────────

  async iniciar(): Promise<Instantanea> {
    if (this.espera) clearTimeout(this.espera);
    this.espera = null;
    this.vinculo = null;
    this.motivo = null;

    const r = await this.llamar("iniciar", null, {
      proyecto: PROYECTO_ID,
      etiqueta: this.etiqueta,
      version: this.op.version,
    });
    const c = r.cuerpo;
    if (
      !r.ok ||
      typeof c.codigo_dispositivo !== "string" ||
      typeof c.codigo_usuario !== "string" ||
      typeof c.url !== "string" ||
      typeof c.url_completa !== "string"
    ) {
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
      caducaEn: this.ahora() + Math.min(caduca, 900) * 1000,
      intervalo: segundos * 1000,
    };
    this.estado = "esperando";
    this.programarSondeo();
    return this.instantanea();
  }

  cancelar(): Instantanea {
    if (this.espera) clearTimeout(this.espera);
    this.espera = null;
    this.vinculo = null;
    if (this.estado === "esperando") this.estado = this.token ? "conectada" : "sin-sesion";
    return this.instantanea();
  }

  private programarSondeo(): void {
    if (!this.temporizadores || !this.vinculo) return;
    if (this.espera) clearTimeout(this.espera);
    this.espera = setTimeout(() => void this.sondearUnaVez(), this.vinculo.intervalo);
    this.espera.unref?.();
  }

  /** Una pregunta a MAJIX: ¿ya lo has aprobado? Pública para poder probarla sin esperar. */
  async sondearUnaVez(): Promise<void> {
    const v = this.vinculo;
    if (!v || this.estado !== "esperando") return;
    if (this.ahora() > v.caducaEn) {
      this.vinculo = null;
      this.estado = this.token ? "conectada" : "sin-sesion";
      this.motivo = "expirada";
      return;
    }
    const r = await this.llamar("sondear", null, { codigo: v.secreto });
    if (this.vinculo !== v) return; // se canceló o se pidió otro código mientras tanto
    if (r.http === 429) {
      v.intervalo = Math.min(v.intervalo * 2, 30_000); // más despacio
    } else if (r.ok) {
      switch (r.cuerpo.estado) {
        case "aprobado": {
          const token = r.cuerpo.token;
          if (typeof token !== "string" || !RE_TOKEN.test(token)) {
            this.vinculo = null;
            this.estado = this.token ? "conectada" : "sin-sesion";
            this.motivo = "error";
            return;
          }
          this.vinculo = null;
          this.token = token;
          this.motivo = null;
          this.estado = "conectada"; // provisional: `validar` rellena el resto
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
  async validar(guardarSiempre = false): Promise<Instantanea> {
    if (!this.token) return this.instantanea();
    const r = await this.llamar("sesion", this.token, { version: this.op.version });
    if (r.ok && r.cuerpo.ok === true) {
      const plan = (["libre", "plus", "pro"] as const).find((p) => p === r.cuerpo.plan) ?? "libre";
      this.datos = {
        validadaEn: this.ahora(),
        correo: typeof r.cuerpo.correo === "string" ? r.cuerpo.correo : null,
        etiqueta: textoLimpio(r.cuerpo.etiqueta, 80) || this.etiqueta,
        plan,
        webs: typeof r.cuerpo.webs === "number" ? r.cuerpo.webs : 1,
        diasHistorial: typeof r.cuerpo.dias_historial === "number" ? r.cuerpo.dias_historial : 7,
        searchConsole: r.cuerpo.search_console === true,
        enVivo: r.cuerpo.en_vivo === true,
        dominio: typeof r.cuerpo.dominio === "string" ? r.cuerpo.dominio : null,
      };
      this.estado = this.vinculo ? "esperando" : "conectada";
      this.sinRed = false;
      this.motivo = null;
      this.envio.fueraDePlan = false;
      await this.guardar();
      return this.instantanea();
    }
    if (r.http === 401) {
      // Revocada desde el panel o caducada: se borra y se vuelve a pedir sesión.
      const caducada = r.cuerpo.error === "caducada";
      await this.olvidar();
      this.motivo = caducada ? "caducada" : "revocada";
      return this.instantanea();
    }
    // Sin red o error del servidor: no se puede saber. Se sigue 24 h con la última comprobación buena.
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

  async cerrar(): Promise<Instantanea> {
    if (this.token) await this.llamar("cerrar", this.token, {});
    await this.olvidar();
    this.motivo = null;
    return this.instantanea();
  }

  private async olvidar(): Promise<void> {
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

  async enviarMuestras(entrada: unknown): Promise<{ http: number; aceptadas: number }> {
    if (!this.token || !this.conectada) return { http: 401, aceptadas: 0 };
    // Plan Libre: la medición es solo local. No se llama a la red ni se anota nada como «enviado».
    if (!this.permiteEnVivo) return { http: 403, aceptadas: 0 };
    const muestras = limpiarMuestras(entrada);
    if (muestras.length === 0) return { http: 400, aceptadas: 0 };
    const r = await this.llamar("muestras", this.token, { muestras }, resumenMuestras(muestras));
    return this.tratarEnvio(r, "aceptadas");
  }

  async enviarSearchConsole(dias: DiaSearchConsole[]): Promise<{ http: number; aceptadas: number }> {
    if (!this.token || !this.permiteSearchConsole || dias.length === 0) return { http: 403, aceptadas: 0 };
    const r = await this.llamar("search-console", this.token, { dias }, `${dias.length} días`);
    return this.tratarEnvio(r, "aceptados");
  }

  private async tratarEnvio(
    r: { ok: boolean; http: number; cuerpo: Record<string, unknown> },
    campo: "aceptadas" | "aceptados",
  ): Promise<{ http: number; aceptadas: number }> {
    if (r.ok) {
      this.envio.ultimo = this.ahora();
      this.envio.enviadas += typeof r.cuerpo[campo] === "number" ? (r.cuerpo[campo] as number) : 0;
      this.envio.fueraDePlan = false;
      return { http: 200, aceptadas: typeof r.cuerpo[campo] === "number" ? (r.cuerpo[campo] as number) : 0 };
    }
    this.envio.fallos++;
    if (r.http === 401) await this.validar(); // quizá la han revocado: se confirma y se pide sesión de nuevo
    if (r.http === 403 && r.cuerpo.error === "plan") this.envio.fueraDePlan = true;
    return { http: r.http, aceptadas: 0 };
  }

  // ── La llamada a MAJIX ──────────────────────────────────────────────────────────────────

  private async llamar(
    accion: EntradaBitacora["accion"],
    token: string | null,
    cuerpo: Record<string, unknown>,
    resumenPropio?: string,
  ): Promise<{ ok: boolean; http: number; cuerpo: Record<string, unknown> }> {
    const texto = JSON.stringify(cuerpo);
    const control = new AbortController();
    const plazo = setTimeout(() => control.abort(), PLAZO_MS);
    let http = 0;
    let datos: Record<string, unknown> = {};
    try {
      const res = await this.f(`${this.api}/api/herramientas/${accion}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "User-Agent": `majix-tools/${this.op.version}`,
        },
        body: texto,
        signal: control.signal,
        redirect: "error", // un redirect podría llevar el token a otro servidor
      });
      http = res.status;
      const crudo = await res.text();
      if (crudo.length <= 256 * 1024) {
        try {
          const j = JSON.parse(crudo) as unknown;
          if (typeof j === "object" && j !== null && !Array.isArray(j)) datos = j as Record<string, unknown>;
        } catch {
          /* no era JSON: se trata como fallo */
        }
      }
    } catch {
      http = 0; // sin red, tiempo agotado o redirección
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
      bytes: Buffer.byteLength(texto),
    });
    // Para poder enseñarlo tal cual salió, SIN el token (el token va en una cabecera, no en el cuerpo)
    // y SIN el código de dispositivo (que es un secreto mientras dura el inicio de sesión).
    if (accion === "muestras" || accion === "search-console" || accion === "sesion" || accion === "iniciar") {
      this.ultimas.set(accion, texto.length > 4000 ? `${texto.slice(0, 4000)}…` : texto);
    }
    return { ok, http, cuerpo: datos };
  }

  private anotar(e: EntradaBitacora): void {
    this.registro.push(e);
    if (this.registro.length > MAX_BITACORA) this.registro.shift();
  }

  // ── El fichero de la sesión ─────────────────────────────────────────────────────────────

  private async leerFichero(): Promise<Fichero> {
    try {
      const j = JSON.parse(await readFile(this.fichero, "utf8")) as Fichero;
      if (j?.version === 1 && typeof j.sesiones === "object" && j.sesiones !== null) return j;
    } catch {
      /* no existe o está roto: se empieza de cero */
    }
    return { version: 1, sesiones: {} };
  }

  private async cargar(): Promise<void> {
    const g = (await this.leerFichero()).sesiones[this.clave];
    if (!g || typeof g.token !== "string" || !RE_TOKEN.test(g.token)) return;
    this.token = g.token;
    this.datos = {
      validadaEn: typeof g.validadaEn === "number" ? g.validadaEn : null,
      correo: typeof g.correo === "string" ? g.correo : null,
      etiqueta: textoLimpio(g.etiqueta, 80) || this.etiqueta,
      plan: (["libre", "plus", "pro"] as const).find((p) => p === g.plan) ?? "libre",
      webs: typeof g.webs === "number" ? g.webs : 1,
      diasHistorial: typeof g.diasHistorial === "number" ? g.diasHistorial : 7,
      searchConsole: g.searchConsole === true,
      enVivo: g.enVivo === true,
      dominio: typeof g.dominio === "string" ? g.dominio : null,
    };
    this.estado = "conectada";
  }

  private async escribirFichero(cambiar: (f: Fichero) => void): Promise<void> {
    const trabajo = async () => {
      const f = await this.leerFichero();
      cambiar(f);
      await mkdir(this.dir, { recursive: true, mode: 0o700 });
      await chmod(this.dir, 0o700).catch(() => {});
      const temporal = `${this.fichero}.${process.pid}.tmp`;
      await writeFile(temporal, JSON.stringify(f), { mode: 0o600 });
      await chmod(temporal, 0o600).catch(() => {});
      await rename(temporal, this.fichero);
    };
    this.cola = this.cola.then(trabajo, trabajo).catch(() => {});
    await this.cola;
  }

  private async guardar(): Promise<void> {
    const t = this.token;
    const d = this.datos;
    if (!t || !d) return;
    await this.escribirFichero((f) => {
      f.sesiones[this.clave] = {
        token: t,
        creadaEn: f.sesiones[this.clave]?.creadaEn ?? this.ahora(),
        ...d,
      };
    });
  }

  private async borrarGuardada(): Promise<void> {
    await this.escribirFichero((f) => {
      delete f.sesiones[this.clave];
    });
  }
}

function resumenMuestras(m: MuestraEnviada[]): string {
  const rutas = [...new Set(m.map((x) => x.ruta))].slice(0, 3).join(", ");
  return `${m.length} ${m.length === 1 ? "muestra" : "muestras"} · ${rutas}`;
}

function resumenDe(accion: EntradaBitacora["accion"], cuerpo: Record<string, unknown>): string {
  switch (accion) {
    case "iniciar":
      return `proyecto ${String(cuerpo.proyecto)} · ${String(cuerpo.etiqueta)} · v${String(cuerpo.version)}`;
    case "sesion":
      return `comprobar sesión · v${String(cuerpo.version)}`;
    case "sondear":
      return "esperando tu aprobación";
    case "cerrar":
      return "cerrar sesión";
    default:
      return accion;
  }
}
