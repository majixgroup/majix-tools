import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Copy, ExternalLink, Loader2, RefreshCw, Search } from "lucide-react";
import { GraficaLineas } from "../graficas";
import { API, PROYECTO } from "../proyecto";
import { useSesion } from "../sesion";
import { useIdioma, type Clave } from "../idioma";

/* ---------------------------------------------------------------------- *
 * LA PESTAÑA "SEARCH CONSOLE" — tu rendimiento en Google, dentro del panel
 *
 * Cuatro métricas que se encienden y apagan sobre una gráfica por días, y
 * debajo las tablas de consultas, páginas, países y dispositivos. Los datos
 * salen de la API oficial a través del plugin de Vite, con las credenciales
 * de tu `.env` (la clave privada nunca llega al navegador).
 *
 * Sin credenciales, la pestaña no enseña un ejemplo inventado: enseña los
 * pasos exactos para conectarla.
 * ---------------------------------------------------------------------- */

type FilaGsc = { clave: string; clics: number; impresiones: number; ctr: number; posicion: number };
/** Una fila de la serie por días: el servidor rellena los días que Google
 *  omite, y ahí CTR y posición no existen (y, en los días que Google aún no
 *  tiene, tampoco clics ni impresiones). */
type DiaGsc = {
  clave: string;
  clics: number | null;
  impresiones: number | null;
  ctr: number | null;
  posicion: number | null;
};

export type ErrorGsc =
  | { codigo: "clave" }
  | { codigo: "credenciales"; detalle: string }
  | { codigo: "acceso" }
  | { codigo: "google"; estado: number; detalle: string }
  | { codigo: "red" }
  | { codigo: "servidor" };

type Respuesta =
  | { configurado: false; falta: string[] }
  | { configurado: true; sitio: string; error: ErrorGsc }
  | {
      configurado: true;
      sitio: string;
      inicio: string;
      fin: string;
      dias: number;
      primerDiaProvisional: string | null;
      totales: FilaGsc;
      porDia: DiaGsc[];
      consultas: FilaGsc[];
      paginas: FilaGsc[];
      paises: FilaGsc[];
      dispositivos: FilaGsc[];
      error?: undefined;
    };

type Metrica = "clics" | "impresiones" | "ctr" | "posicion";

const METRICAS: { id: Metrica; nombre: Clave; columna: Clave; color: string }[] = [
  { id: "clics", nombre: "gsc.clics", columna: "gsc.col.clics", color: "#7cb4ff" },
  { id: "impresiones", nombre: "gsc.impresiones", columna: "gsc.col.impresiones", color: "#a78bfa" },
  { id: "ctr", nombre: "gsc.ctr", columna: "gsc.col.ctr", color: "#3ddc84" },
  { id: "posicion", nombre: "gsc.posicion", columna: "gsc.col.posicion", color: "#f59e5b" },
];

const TABLAS = [
  { id: "consultas", nombre: "gsc.consultas" },
  { id: "paginas", nombre: "gsc.paginas" },
  { id: "paises", nombre: "gsc.paises" },
  { id: "dispositivos", nombre: "gsc.dispositivos" },
] as const;

const ENV_EJEMPLO = `MAJIX_TOOLS_GSC_CLIENT_EMAIL="majix-tools@tu-proyecto.iam.gserviceaccount.com"
MAJIX_TOOLS_GSC_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n…\\n-----END PRIVATE KEY-----\\n"
MAJIX_TOOLS_GSC_SITE="sc-domain:tudominio.com"`;

function fechaCorta(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function Guia({ falta, reintentar }: { falta: string[]; reintentar: () => void }) {
  const { t } = useIdioma();
  const [copiado, setCopiado] = useState(false);
  const pasos = [t("gsc.paso1"), t("gsc.paso2"), t("gsc.paso3"), t("gsc.paso4")];
  return (
    <div className="mx-auto max-w-[620px] px-5 py-6">
      <span className="grid h-11 w-11 place-items-center rounded-[12px] border border-white/[0.1] bg-white/[0.04] text-[color:var(--brand-soft)]">
        <Search className="h-5 w-5" />
      </span>
      <p className="mt-4 text-[17px] font-bold text-foreground">{t("gsc.conecta")}</p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
        {t("gsc.faltan")}{" "}
        {falta.length === 3 ? (
          t("gsc.lasCredenciales")
        ) : (
          <span className="font-mono text-[11.5px] text-foreground/85">{falta.join(", ")}</span>
        )}
        . {t("gsc.intro")}
      </p>
      <ol className="mt-5 space-y-3">
        {pasos.map((p, i) => (
          <li key={i} className="flex gap-3 text-[12.5px] leading-relaxed text-foreground/80">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[color:var(--brand)]/20 text-[10.5px] font-bold text-[color:var(--brand-soft)]">
              {i + 1}
            </span>
            <span>{p}</span>
          </li>
        ))}
      </ol>
      <div className="relative mt-5 rounded-[12px] border border-white/[0.09] bg-[#0d0b18]">
        <div className="flex items-center justify-between border-b border-white/[0.07] py-1.5 pl-3.5 pr-1.5">
          <span className="font-mono text-[11.5px] text-foreground/60">.env</span>
          <button
            onClick={() =>
              void navigator.clipboard?.writeText(ENV_EJEMPLO).then(() => {
                setCopiado(true);
                window.setTimeout(() => setCopiado(false), 1500);
              })
            }
            aria-label={t("copiar")}
            className="grid h-7 w-7 place-items-center rounded-md text-foreground/50 hover:bg-white/[0.08] hover:text-foreground"
          >
            {copiado ? (
              <Check className="h-3.5 w-3.5 text-[#3ddc84]" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        <pre className="overflow-x-auto p-3.5 font-mono text-[11.5px] leading-[1.7] text-foreground/80">
          {ENV_EJEMPLO}
        </pre>
      </div>
      <button
        onClick={reintentar}
        className="mt-5 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold text-white"
        style={{ background: "var(--brand)" }}
      >
        <RefreshCw className="h-3.5 w-3.5" /> {t("gsc.comprobar")}
      </button>
    </div>
  );
}

export default function SearchConsole() {
  const { t } = useIdioma();
  const locale = t("locale");
  const [dias, setDias] = useState(28);
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [activas, setActivas] = useState<Set<Metrica>>(new Set(["clics", "impresiones"]));
  const [tabla, setTabla] = useState<(typeof TABLAS)[number]["id"]>("consultas");

  const numero = (v: number) => v.toLocaleString(locale);
  const formato: Record<Metrica, (v: number) => string> = {
    clics: numero,
    impresiones: numero,
    ctr: (v) =>
      `${(v * 100).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`,
    posicion: (v) => v.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  };

  const textoError = (e: ErrorGsc, sitio: string): string => {
    switch (e.codigo) {
      case "clave":
        return t("gsc.err.clave");
      case "credenciales":
        return t("gsc.err.credenciales")(e.detalle);
      case "acceso":
        return t("gsc.err.acceso")(sitio);
      case "google":
        return t("gsc.err.google")(e.estado, e.detalle);
      case "red":
        return t("gsc.err.red");
      default:
        return t("gsc.err.servidor");
    }
  };

  /* Solo cuenta la ÚLTIMA petición: si pasas de 7 a 90 días y la de 7 tarda
     más, llegaría después y pintaría 7 días con el botón de 90 marcado.
     Cada petición nueva aborta la anterior. */
  const enCurso = useRef<AbortController | null>(null);
  const [requierePlan, setRequierePlan] = useState(false);
  const { refrescar } = useSesion();
  const cargar = useCallback(async (d: number) => {
    enCurso.current?.abort();
    const control = new AbortController();
    enCurso.current = control;
    setCargando(true);
    try {
      const res = await fetch(`${API}/search-console?dias=${d}`, { signal: control.signal });
      const cuerpo = (await res.json()) as Respuesta | { codigo: string };
      if (control.signal.aborted) return;
      /* Search Console es de los planes de pago: con el plan Libre el plugin ni consulta a Google. */
      if (res.status === 403 && "codigo" in cuerpo && cuerpo.codigo === "plan") {
        setRequierePlan(true);
        return;
      }
      setRequierePlan(false);
      if (!("codigo" in cuerpo)) setDatos(cuerpo);
    } catch {
      if (control.signal.aborted) return;
      setDatos({ configurado: true, sitio: "", error: { codigo: "servidor" } });
    } finally {
      if (!control.signal.aborted) setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar(dias);
  }, [cargar, dias]);
  useEffect(() => () => enCurso.current?.abort(), []);

  if (requierePlan) {
    return (
      <div className="mx-auto max-w-[560px] px-5 py-8">
        <span
          className="grid h-11 w-11 place-items-center rounded-[12px] border text-[color:var(--brand-soft)]"
          style={{ borderColor: "color-mix(in oklab, var(--brand-soft) 45%, transparent)", background: "color-mix(in oklab, var(--brand) 18%, transparent)" }}
        >
          <Search className="h-5 w-5" aria-hidden />
        </span>
        <p className="mt-4 text-[17px] font-bold text-foreground">{t("gsc.plan.titulo")}</p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{t("gsc.plan.texto")}</p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <a
            href={PROYECTO.planes}
            target="_blank"
            rel="noreferrer"
            className="pulsable inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold text-white"
            style={{ background: "var(--brand)" }}
          >
            {t("gsc.plan.ver")} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
          <button
            onClick={async () => {
              await refrescar();
              void cargar(dias);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] px-4 py-2 text-[12.5px] font-semibold text-foreground/80 transition-colors hover:bg-white/[0.07] hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> {t("gsc.plan.comprobar")}
          </button>
        </div>
      </div>
    );
  }

  if (cargando && !datos) {
    return (
      <div className="grid h-full place-items-center text-[12.5px] text-muted-foreground">
        <span className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("gsc.consultando")}
        </span>
      </div>
    );
  }
  if (!datos) return null;
  if (!datos.configurado) {
    return (
      <div className="h-full overflow-y-auto">
        <Guia falta={datos.falta} reintentar={() => void cargar(dias)} />
      </div>
    );
  }
  if (datos.error !== undefined) {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div className="max-w-[460px]">
          <AlertCircle className="mx-auto h-6 w-6 text-[#ff5470]" />
          <p className="mt-3 text-[13px] leading-relaxed text-foreground/85">
            {textoError(datos.error, datos.sitio)}
          </p>
          <button
            onClick={() => void cargar(dias)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] px-3.5 py-1.5 text-[12px] font-semibold text-foreground/80 hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" /> {t("reintentar")}
          </button>
        </div>
      </div>
    );
  }

  const filasTabla = datos[tabla];
  /* Cada métrica en su propia escala de 0 a 100: clics (decenas) e
     impresiones (miles) en un mismo eje dejarían los clics pegados al suelo.
     El valor real va al tooltip. */
  const normalizada = (m: Metrica): (number | null)[] => {
    const valores = datos.porDia.map((f) => f[m]);
    const hay = valores.filter((v): v is number => v != null);
    if (!hay.length) return valores.map(() => null);
    const max = Math.max(...hay);
    if (m === "posicion") {
      /* La posición va al revés —la 1 es la mejor—, así que se dibuja
         invertida: arriba, las mejores. Y en su propio rango (p. ej. de 4,2
         a 7,8): partiendo de 0, un paso de la 5 a la 7 apenas se vería. */
      const min = Math.min(...hay);
      return valores.map((v) =>
        v == null ? null : max === min ? 50 : ((max - v) / (max - min)) * 90 + 5,
      );
    }
    return valores.map((v) => (v == null ? null : max ? (v / max) * 100 : 0));
  };

  return (
    <div className="@container h-full overflow-y-auto p-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[18px] font-bold tracking-[-0.01em] text-foreground">
            {t("gsc.titulo")}
          </p>
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            {datos.sitio} · {fechaCorta(datos.inicio)} – {fechaCorta(datos.fin)}
            {datos.primerDiaProvisional && datos.primerDiaProvisional <= datos.fin && (
              <> · {t("gsc.provisional")(fechaCorta(datos.primerDiaProvisional))}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-white/[0.1] bg-white/[0.03] p-0.5">
          {(
            [
              [7, "gsc.7"],
              [28, "gsc.28"],
              [90, "gsc.90"],
            ] as const
          ).map(([d, etiqueta]) => (
            <button
              key={d}
              onClick={() => setDias(d)}
              aria-pressed={dias === d}
              className={`rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors ${
                dias === d
                  ? "bg-white/[0.1] text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(etiqueta)}
            </button>
          ))}
          {cargando && (
            <Loader2 className="mx-1.5 h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {/* ── LAS CUATRO MÉTRICAS, CONMUTABLES ── */}
      <div className="grid grid-cols-2 gap-2 @[736px]:grid-cols-4">
        {METRICAS.map((m) => {
          const activa = activas.has(m.id);
          return (
            <button
              key={m.id}
              onClick={() =>
                setActivas((prev) => {
                  const s = new Set(prev);
                  if (s.has(m.id) && s.size > 1) s.delete(m.id);
                  else s.add(m.id);
                  return s;
                })
              }
              aria-pressed={activa}
              className="rounded-[14px] border p-3 text-left transition-colors"
              style={{
                borderColor: activa ? m.color : "rgb(255 255 255 / 8%)",
                background: activa
                  ? `color-mix(in oklab, ${m.color} 14%, transparent)`
                  : "rgb(255 255 255 / 2.5%)",
              }}
            >
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground/75">
                <span
                  className="grid h-3.5 w-3.5 place-items-center rounded-[4px] border"
                  style={{ borderColor: m.color, background: activa ? m.color : "transparent" }}
                >
                  {activa && <Check className="h-2.5 w-2.5 text-[#0d0b18]" strokeWidth={3} />}
                </span>
                {t(m.nombre) as string}
              </p>
              <p className="mt-1.5 font-mono text-[21px] font-bold text-foreground">
                {formato[m.id](datos.totales[m.id])}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 rounded-[16px] border border-white/[0.08] bg-white/[0.025] p-4">
        {datos.porDia.every((f) => !f.impresiones) ? (
          <p className="py-10 text-center text-[12.5px] text-muted-foreground">
            {t("gsc.sinDatosPropiedad")}
          </p>
        ) : (
          <GraficaLineas
            sinEjeY
            alto={220}
            etiquetas={datos.porDia.map((f) => fechaCorta(f.clave))}
            series={METRICAS.filter((m) => activas.has(m.id)).map((m) => ({
              nombre: t(m.nombre) as string,
              color: m.color,
              valores: normalizada(m.id),
              reales: datos.porDia.map((f) => f[m.id]),
              formatoReal: formato[m.id],
            }))}
          />
        )}
      </div>

      {/* ── LAS TABLAS ── */}
      <div className="mt-2.5 overflow-hidden rounded-[16px] border border-white/[0.08] bg-white/[0.025]">
        <div
          role="tablist"
          className="flex gap-1 overflow-x-auto border-b border-white/[0.07] px-2 pt-2 [&::-webkit-scrollbar]:hidden"
        >
          {TABLAS.map((tb) => (
            <button
              key={tb.id}
              role="tab"
              aria-selected={tabla === tb.id}
              onClick={() => setTabla(tb.id)}
              className={`relative shrink-0 px-3 pb-2 pt-1 text-[12px] font-semibold transition-colors ${
                tabla === tb.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground/80"
              }`}
            >
              {t(tb.nombre)}
              {tabla === tb.id && (
                <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-[color:var(--brand-soft)]" />
              )}
            </button>
          ))}
        </div>
        {filasTabla.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12px] text-muted-foreground">
            {t("gsc.sinDatos")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="text-[11px] text-muted-foreground">
                  <th className="px-4 py-2 font-semibold">
                    {t(TABLAS.find((x) => x.id === tabla)!.nombre)}
                  </th>
                  {METRICAS.map((m) => (
                    <th key={m.id} className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                      {t(m.columna) as string}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filasTabla.map((f) => (
                  <tr key={f.clave} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                    <td
                      className="max-w-[340px] truncate px-4 py-2 text-foreground/85"
                      title={f.clave}
                    >
                      {tabla === "dispositivos"
                        ? f.clave === "DESKTOP" || f.clave === "MOBILE" || f.clave === "TABLET"
                          ? t(`gsc.${f.clave}`)
                          : f.clave
                        : tabla === "paises"
                          ? f.clave.toUpperCase()
                          : tabla === "paginas"
                            ? f.clave.replace(/^https?:\/\/[^/]+/, "") || "/"
                            : f.clave}
                    </td>
                    {METRICAS.map((m) => (
                      <td
                        key={m.id}
                        className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums text-foreground/75"
                      >
                        {formato[m.id](f[m.id])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="mt-3 text-[10.5px] text-muted-foreground">{t("gsc.nota")}</p>
    </div>
  );
}
