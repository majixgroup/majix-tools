import { useEffect, useMemo, useState } from "react";
import { ExternalLink, LineChart, Plug, Radio, Trash2 } from "lucide-react";
import {
  COLOR_NIVEL,
  UMBRALES,
  nivelDe,
  nivelDePuntuacion,
  puntuacion,
  rutaDeCarga,
  type Metricas,
} from "../metricas";
import { borrarHistorial, leerHistorial, type Muestra } from "../historial";
import { resumenCarga } from "../monitor";
import { Anillo, GraficaBarras, GraficaLineas, Leyenda } from "../graficas";
import { useIdioma } from "../idioma";
import { useSesion } from "../sesion";
import { PROYECTO } from "../proyecto";

/* ---------------------------------------------------------------------- *
 * LA PESTAÑA "DASHBOARD" — la vista general
 *
 * Cuatro anillos arriba, dos gráficas en medio y tres tarjetas abajo. Todo
 * lo que se pinta es real:
 *   · los anillos puntúan las Web Vitals de ESTA carga con la curva de
 *     Lighthouse (ver `puntuacion` en metricas.ts);
 *   · las gráficas salen del historial de cargas guardado en este navegador
 *     (historial.ts) más la carga actual;
 *   · "Rendimiento por página" agrupa ese mismo historial por ruta.
 * El tráfico necesita un conector (Google Analytics): hasta que exista, su
 * tarjeta lo dice, en vez de enseñar cifras de ejemplo que alguien podría
 * tomar por buenas. Los pagos no se tocan desde aquí: se hacen en la web.
 * ---------------------------------------------------------------------- */

const MORADO = "#a78bfa";
const NARANJA = "#f59e5b";
const LIMA = "#a3e635";
const ROSA = "#ff5470";
const VISIBLES = 29;

function Tarjeta({
  titulo,
  accion,
  children,
}: {
  titulo: string;
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-[16px] border border-white/[0.08] bg-white/[0.025] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[13.5px] font-bold text-foreground">{titulo}</h3>
        {accion}
      </div>
      {children}
    </section>
  );
}

function Kpi({
  sigla,
  valor,
  unidad,
  p,
}: {
  sigla: string;
  valor: string;
  unidad?: string;
  p: number | null;
}) {
  const nivel = nivelDePuntuacion(p);
  const color = nivel ? COLOR_NIVEL[nivel] : "rgb(255 255 255 / 30%)";
  return (
    <div className="flex items-center gap-3.5 rounded-[16px] border border-white/[0.08] bg-white/[0.025] p-3.5">
      <Anillo valor={p} color={color}>
        <span className="font-mono text-[11.5px] font-bold text-foreground">
          {p == null ? "—" : Math.round(p * 100)}
        </span>
      </Anillo>
      <div className="min-w-0">
        <p className="text-[11.5px] text-muted-foreground">{sigla}</p>
        <p className="mt-0.5 truncate font-mono text-[19px] font-bold leading-tight text-foreground">
          {valor}
          {unidad && <span className="ml-1 text-[11px] text-muted-foreground">{unidad}</span>}
        </p>
      </div>
    </div>
  );
}

function PendienteDeConector({
  Icono,
  titulo,
  texto,
  etiqueta,
}: {
  Icono: typeof LineChart;
  titulo: string;
  texto: string;
  etiqueta: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed border-white/[0.1] px-4 py-6 text-center">
      <span className="grid h-9 w-9 place-items-center rounded-[10px] border border-white/[0.1] bg-white/[0.04] text-[color:var(--brand-soft)]">
        <Icono className="h-4 w-4" />
      </span>
      <p className="text-[12.5px] font-semibold text-foreground">{titulo}</p>
      <p className="max-w-[30ch] text-[11.5px] leading-snug text-muted-foreground">{texto}</p>
      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[color:var(--brand)]/12 px-2 py-0.5 text-[10px] font-bold text-[color:var(--brand-soft)]">
        <Plug className="h-3 w-3" /> {etiqueta}
      </span>
    </div>
  );
}

/* ── EL ENLACE CON TU PANEL DE MAJIX ──
   Dice, con datos reales, si lo que mides se está viendo en tu panel: cuándo
   fue el último envío y cuántas cargas llevas. Nada inventado: si todavía no
   se ha enviado nada, lo dice. */
function TarjetaVivo() {
  const { t, idioma } = useIdioma();
  const { sesion } = useSesion();
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);
  const envio = sesion?.envio;
  const hace = (ms: number) => {
    const seg = Math.max(0, Math.round((ahora - ms) / 1000));
    const f = new Intl.RelativeTimeFormat(idioma, { numeric: "auto" });
    if (seg < 60) return f.format(-seg, "second");
    if (seg < 3600) return f.format(-Math.round(seg / 60), "minute");
    return f.format(-Math.round(seg / 3600), "hour");
  };
  const enVivo = envio?.ultimo != null && ahora - envio.ultimo < 120_000 && !envio.fueraDePlan;
  /* Plan Libre: la medición se queda en local. En vez de una tarjeta vacía, se explica qué da el plan de pago. */
  if (sesion && !sesion.enVivo) {
    return (
      <Tarjeta titulo={t("dash.vivo.libreTitulo")}>
        <div className="flex flex-1 flex-col justify-between gap-3">
          <div>
            <span className="grid h-9 w-9 place-items-center rounded-[10px] border border-white/[0.1] bg-white/[0.04] text-[color:var(--brand-soft)]">
              <Radio className="h-4 w-4" aria-hidden />
            </span>
            <p className="mt-3 text-[12px] leading-snug text-foreground/80">{t("dash.vivo.libre")}</p>
          </div>
          <a
            href={PROYECTO.planes}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 self-start rounded-full border border-white/[0.12] px-3.5 py-1.5 text-[12px] font-semibold text-foreground/85 transition-colors hover:bg-white/[0.07] hover:text-foreground"
          >
            {t("dash.vivo.ver")} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
      </Tarjeta>
    );
  }
  return (
    <Tarjeta
      titulo={t("dash.vivo.titulo")}
      accion={
        enVivo ? (
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-[#3ddc84]">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#3ddc84] shadow-[0_0_8px_#3ddc84]" />
            {t("dash.vivo.estado")}
          </span>
        ) : undefined
      }
    >
      <div className="flex flex-1 flex-col justify-between gap-3">
        <div>
          <span className="grid h-9 w-9 place-items-center rounded-[10px] border border-white/[0.1] bg-white/[0.04] text-[color:var(--brand-soft)]">
            <Radio className="h-4 w-4" aria-hidden />
          </span>
          <p className="mt-3 text-[12px] leading-snug text-foreground/80">
            {envio?.fueraDePlan ? t("dash.vivo.fuera") : t("dash.vivo.texto")}
          </p>
          <p className="mt-2 font-mono text-[11.5px] text-muted-foreground">
            {envio?.ultimo != null ? (
              t("dash.vivo.ultimo")(hace(envio.ultimo))
            ) : (
              t("dash.vivo.nunca")
            )}
          </p>
        </div>
        <a
          href={PROYECTO.panel}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 self-start rounded-full border border-white/[0.12] px-3.5 py-1.5 text-[12px] font-semibold text-foreground/85 transition-colors hover:bg-white/[0.07] hover:text-foreground"
        >
          {t("dash.vivo.abrir")} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
    </Tarjeta>
  );
}

export default function Dashboard({ m }: { m: Metricas }) {
  const { t } = useIdioma();
  const locale = t("locale");
  const [historial, setHistorial] = useState<Muestra[]>(() => leerHistorial());

  const hora = (x: number) =>
    new Date(x).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  /** Para el tooltip: la hora si es de hoy, y el día delante si no lo es —
   *  "10:42" de ayer y "10:42" de hoy no son el mismo punto. */
  const momento = (x: number) => {
    const d = new Date(x);
    const hoy = new Date();
    const mismoDia =
      d.getFullYear() === hoy.getFullYear() &&
      d.getMonth() === hoy.getMonth() &&
      d.getDate() === hoy.getDate();
    return mismoDia
      ? hora(x)
      : `${d.toLocaleDateString(locale, { day: "numeric", month: "short" })}, ${hora(x)}`;
  };

  /* La carga actual, como una muestra más (la última). Su ruta es la de la
     CARGA, no la de ahora: tras navegar dentro de la web, el LCP sigue
     siendo el de la página por la que entraste (ver `rutaDeCarga`). */
  const actual: Muestra = useMemo(
    () => ({
      t: Date.now(),
      ruta: rutaDeCarga(),
      lcp: m.lcp,
      cls: m.cls,
      inp: m.inp,
      ttfb: m.ttfb,
      ...resumenCarga(),
    }),
    [m],
  );

  const muestras = [...historial.slice(-VISIBLES), actual];
  const ultima = muestras.length - 1;
  const etiquetas = muestras.map((x, i) => (i === ultima ? t("ahora") : hora(x.t)));
  /* El tooltip dice también QUÉ página era: dos puntos a las 10:42 pueden
     ser /web y /precios, y sin la ruta no se sabe cuál fue la lenta. */
  const titulos = muestras.map((x, i) => `${i === ultima ? t("ahora") : momento(x.t)} · ${x.ruta}`);

  const porPagina = useMemo(() => {
    const grupos = new Map<string, { suma: number; n: number; cargas: number }>();
    for (const x of [...historial, actual]) {
      const g = grupos.get(x.ruta) ?? { suma: 0, n: 0, cargas: 0 };
      g.cargas++;
      if (x.lcp != null) {
        g.suma += x.lcp;
        g.n++;
      }
      grupos.set(x.ruta, g);
    }
    return [...grupos.entries()]
      .map(([ruta, g]) => ({ ruta, cargas: g.cargas, lcp: g.n ? Math.round(g.suma / g.n) : null }))
      .sort((a, b) => b.cargas - a.cargas)
      .slice(0, 6);
  }, [historial, actual]);
  const maxLcpPagina = Math.max(1, ...porPagina.map((p) => p.lcp ?? 0));

  const subtitulo =
    historial.length === 0
      ? t("dash.soloEsta")
      : historial.length > VISIBLES
        ? t("dash.conAnterioresRecorte")(VISIBLES, historial.length)
        : t("dash.conAnteriores")(historial.length);

  return (
    /* `@container`: la rejilla se adapta al ancho del PANEL, no al de la
       ventana — el panel compacto es más estrecho que la pantalla, y en un
       móvil apenas deja 270 px de contenido. */
    <div className="@container h-full overflow-y-auto p-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[18px] font-bold tracking-[-0.01em] text-foreground">
            {t("dash.titulo")}
          </p>
          <p className="text-[11.5px] text-muted-foreground">
            {subtitulo} · {t("dash.curva")}
          </p>
        </div>
        {historial.length > 0 && (
          <button
            onClick={() => {
              borrarHistorial();
              setHistorial([]);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] px-2.5 py-1 text-[11px] font-semibold text-foreground/60 transition-colors hover:border-white/[0.2] hover:text-foreground"
          >
            <Trash2 className="h-3 w-3" /> {t("dash.borrar")}
          </button>
        )}
      </div>

      {/* ── LOS CUATRO ANILLOS ── */}
      <div className="grid grid-cols-1 gap-2.5 @[400px]:grid-cols-2 @[736px]:grid-cols-4">
        <Kpi
          sigla={t("dash.kpi.lcp")}
          valor={m.lcp == null ? "—" : String(m.lcp)}
          unidad={m.lcp == null ? undefined : "ms"}
          p={m.soporte.lcp ? puntuacion(m.lcp, UMBRALES.lcp) : null}
        />
        <Kpi
          sigla={t("dash.kpi.cls")}
          valor={m.cls == null ? "—" : m.cls.toFixed(3)}
          p={m.soporte.cls ? puntuacion(m.cls, UMBRALES.cls) : null}
        />
        <Kpi
          sigla={t("dash.kpi.inp")}
          valor={m.inp == null ? "—" : String(m.inp)}
          unidad={m.inp == null ? undefined : "ms"}
          p={m.soporte.inp ? puntuacion(m.inp, UMBRALES.inp) : null}
        />
        <Kpi
          sigla={t("dash.kpi.ttfb")}
          valor={m.ttfb == null ? "—" : String(m.ttfb)}
          unidad={m.ttfb == null ? undefined : "ms"}
          p={puntuacion(m.ttfb, UMBRALES.ttfb)}
        />
      </div>

      {/* ── LAS DOS GRÁFICAS ── */}
      <div className="mt-2.5 grid gap-2.5 @[640px]:grid-cols-2">
        <Tarjeta
          titulo={t("dash.rendimientoWeb")}
          accion={
            <Leyenda
              items={[
                { nombre: "LCP", color: NARANJA },
                { nombre: "TTFB", color: LIMA },
              ]}
            />
          }
        >
          <GraficaLineas
            tituloEjeY="ms"
            etiquetas={etiquetas}
            titulos={titulos}
            series={[
              { nombre: "LCP", color: NARANJA, valores: muestras.map((x) => x.lcp) },
              { nombre: "TTFB", color: LIMA, valores: muestras.map((x) => x.ttfb) },
            ]}
          />
          {historial.length === 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">{t("dash.vacio")}</p>
          )}
        </Tarjeta>
        <Tarjeta
          titulo={t("dash.redPorCarga")}
          accion={
            <Leyenda
              items={[
                { nombre: t("dash.peticiones"), color: MORADO },
                { nombre: t("dash.errores"), color: ROSA },
              ]}
            />
          }
        >
          <GraficaBarras
            tituloEjeY={t("dash.cantidad")}
            etiquetas={etiquetas}
            titulos={titulos}
            series={[
              {
                nombre: t("dash.peticiones"),
                color: MORADO,
                valores: muestras.map((x) => x.peticiones),
              },
              { nombre: t("dash.errores"), color: ROSA, valores: muestras.map((x) => x.errores) },
            ]}
          />
        </Tarjeta>
      </div>

      {/* ── LAS TRES TARJETAS ── */}
      <div className="mt-2.5 grid gap-2.5 @[736px]:grid-cols-3">
        <TarjetaVivo />
        <Tarjeta titulo={t("dash.trafico")}>
          <PendienteDeConector
            Icono={LineChart}
            titulo={t("dash.ga4.titulo")}
            texto={t("dash.ga4.texto")}
            etiqueta={t("dash.proximamente")}
          />
        </Tarjeta>
        <Tarjeta titulo={t("dash.porPagina")}>
          <ul className="space-y-2">
            {porPagina.map((p) => {
              const nivel = nivelDe(p.lcp, UMBRALES.lcp);
              return (
                <li key={p.ruta}>
                  <div className="flex items-center justify-between gap-2 text-[11.5px]">
                    <span className="truncate font-mono text-foreground/80">{p.ruta}</span>
                    <span className="shrink-0 font-mono text-muted-foreground">
                      {p.lcp == null ? "—" : `${p.lcp} ms`} · {p.cargas}×
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${p.lcp == null ? 0 : Math.max(4, (p.lcp / maxLcpPagina) * 100)}%`,
                        background: nivel ? COLOR_NIVEL[nivel] : "transparent",
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[10.5px] text-muted-foreground">{t("dash.porPagina.nota")}</p>
        </Tarjeta>
      </div>
    </div>
  );
}
