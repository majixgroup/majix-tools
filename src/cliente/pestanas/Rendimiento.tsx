import {
  COLOR_NIVEL,
  UMBRALES,
  nivelDe,
  nivelFotogramasLargos,
  nivelFps,
  peorNivel,
  type Metricas,
  type Nivel,
} from "../metricas";
import { useIdioma } from "../idioma";

/* ---------------------------------------------------------------------- *
 * LA PESTAÑA "RENDIMIENTO" — una tarjeta por métrica, con su escala
 *
 * Cada cifra lleva debajo la franja de umbrales oficial (verde, ámbar, rojo)
 * y una marca donde cae el valor. Un número suelto ("2744 ms") no dice si
 * está bien; la marca sobre la franja lo dice sin tener que saberse los
 * umbrales de memoria.
 * ---------------------------------------------------------------------- */

/** Coloca un valor sobre tres tramos iguales: [0, bueno], [bueno, mejorable]
 *  y [mejorable, mejorable × 1,6]. Devuelve un porcentaje de 0 a 100. */
function posicion(valor: number, [bueno, mejorable]: readonly [number, number]): number {
  if (valor <= bueno) return (valor / bueno) * 33.3;
  if (valor <= mejorable) return 33.3 + ((valor - bueno) / (mejorable - bueno)) * 33.3;
  const tope = mejorable * 1.6;
  return Math.min(99, 66.6 + ((valor - mejorable) / (tope - mejorable)) * 33.3);
}

function Escala({ pct }: { pct: number | null }) {
  return (
    <div className="relative mt-3 h-1.5">
      <div className="flex h-full gap-[3px] overflow-hidden rounded-full">
        <span className="flex-1 rounded-l-full" style={{ background: `${COLOR_NIVEL.bien}66` }} />
        <span className="flex-1" style={{ background: `${COLOR_NIVEL.mejorable}66` }} />
        <span className="flex-1 rounded-r-full" style={{ background: `${COLOR_NIVEL.mal}66` }} />
      </div>
      {pct != null && (
        <span
          aria-hidden
          className="absolute -top-[3px] h-3 w-[3px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_2px_#0d0b18] transition-[left] duration-500 motion-reduce:transition-none"
          style={{ left: `${pct}%` }}
        />
      )}
    </div>
  );
}

function Tarjeta({
  sigla,
  nombre,
  valor,
  unidad,
  nivel,
  pct,
  soportado = true,
}: {
  sigla: string;
  nombre: string;
  valor: string;
  unidad?: string;
  nivel: Nivel | null;
  pct: number | null;
  /** Si el navegador no tiene la API, la tarjeta lo dice en vez de enseñar
      un 0 que parecería un buen resultado. */
  soportado?: boolean;
}) {
  const { t } = useIdioma();
  if (!soportado) {
    valor = "—";
    unidad = undefined;
    nivel = null;
    pct = null;
    nombre = t("noSoportado");
  }
  return (
    <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.025] p-3.5 transition-colors duration-300 hover:border-white/[0.14] hover:bg-white/[0.04]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground/70">
          {sigla}
        </p>
        {nivel ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ color: COLOR_NIVEL[nivel], background: `${COLOR_NIVEL[nivel]}1a` }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: COLOR_NIVEL[nivel] }} />
            {t(`nivel.${nivel}`)}
          </span>
        ) : (
          <span className="text-[10px] font-semibold text-muted-foreground">
            {soportado ? t("nivel.esperando") : t("nivel.noSoportado")}
          </span>
        )}
      </div>
      <p className="mt-2 font-mono text-[22px] font-bold leading-none tabular-nums text-foreground">
        {valor}
        {unidad && (
          <span className="ml-1 text-[12px] font-semibold text-muted-foreground">{unidad}</span>
        )}
      </p>
      <p className="mt-1.5 text-[11.5px] leading-snug text-muted-foreground">{nombre}</p>
      <Escala pct={pct} />
    </div>
  );
}

export default function Rendimiento({ m }: { m: Metricas }) {
  const { t } = useIdioma();
  const { soporte } = m;
  const nLCP = soporte.lcp ? nivelDe(m.lcp, UMBRALES.lcp) : null;
  const nCLS = soporte.cls ? nivelDe(m.cls, UMBRALES.cls) : null;
  const nINP = soporte.inp ? nivelDe(m.inp, UMBRALES.inp) : null;
  const general = peorNivel([nLCP, nCLS, nINP]);

  return (
    <div className="@container h-full overflow-y-auto p-4">
      {/* ── EL VEREDICTO ──
          Lo primero que se lee: cómo está la página según las tres Core Web
          Vitals, que son las que cuentan para Google. El resto es contexto. */}
      <div className="mb-4 flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.08] bg-black/20 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            {t("rend.veredicto")}
          </p>
          <p className="mt-1 text-[13px] leading-snug text-foreground/85">
            {t("rend.veredicto.desc")}
          </p>
        </div>
        {general && (
          <span
            className="shrink-0 rounded-full px-3 py-1 text-[12px] font-bold"
            style={{ color: COLOR_NIVEL[general], background: `${COLOR_NIVEL[general]}1f` }}
          >
            {t(`nivel.${general}`)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2.5 @[400px]:grid-cols-2 @[640px]:grid-cols-3">
        <Tarjeta
          sigla="LCP"
          nombre={t("rend.lcp")}
          valor={m.lcp == null ? "—" : String(m.lcp)}
          unidad={m.lcp == null ? undefined : "ms"}
          nivel={nLCP}
          pct={m.lcp == null ? null : posicion(m.lcp, UMBRALES.lcp)}
          soportado={soporte.lcp}
        />
        <Tarjeta
          sigla="CLS"
          nombre={t("rend.cls")}
          valor={m.cls == null ? "—" : m.cls.toFixed(3)}
          nivel={nCLS}
          pct={m.cls == null ? null : posicion(m.cls, UMBRALES.cls)}
          soportado={soporte.cls}
        />
        <Tarjeta
          sigla="INP"
          nombre={m.inp == null ? t("rend.inp.sin") : t("rend.inp")}
          valor={m.inp == null ? "—" : String(m.inp)}
          unidad={m.inp == null ? undefined : "ms"}
          nivel={nINP}
          pct={m.inp == null ? null : posicion(m.inp, UMBRALES.inp)}
          soportado={soporte.inp}
        />
        <Tarjeta
          sigla="TTFB"
          nombre={t("rend.ttfb")}
          valor={m.ttfb == null ? "—" : String(m.ttfb)}
          unidad={m.ttfb == null ? undefined : "ms"}
          nivel={nivelDe(m.ttfb, UMBRALES.ttfb)}
          pct={m.ttfb == null ? null : posicion(m.ttfb, UMBRALES.ttfb)}
        />
        <Tarjeta
          sigla="FPS"
          nombre={t("rend.fps")}
          valor={m.fps === 0 ? "—" : String(m.fps)}
          nivel={nivelFps(m.fps)}
          pct={m.fps === 0 ? null : Math.max(1, 100 - Math.min(99, (m.fps / 60) * 100))}
        />
        <Tarjeta
          sigla={t("rend.largos")}
          nombre={t("rend.bloqueo")(m.bloqueoMs)}
          valor={String(m.fotogramasLargos)}
          nivel={nivelFotogramasLargos(m.fotogramasLargos)}
          pct={Math.min(99, (m.fotogramasLargos / 6) * 100)}
          soportado={soporte.largos}
        />
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">{t("rend.nota")}</p>
    </div>
  );
}
