/* ---------------------------------------------------------------------- *
 * LAS MÉTRICAS — umbrales, niveles, puntuación y tipos
 *
 * Solo funciones puras: aquí no se mide nada. Quien mide es `medidor.ts`
 * (desde el primer instante, sin React) y quien lo lee en el panel es
 * `usar-metricas.ts`.
 * ---------------------------------------------------------------------- */

export type Nivel = "bien" | "mejorable" | "mal";

export const COLOR_NIVEL: Record<Nivel, string> = {
  bien: "#3ddc84",
  mejorable: "#f5a623",
  mal: "#ff5470",
};

/** Umbrales oficiales de Web Vitals (web.dev), los mismos que usa Lighthouse:
 *  `[bueno hasta, mejorable hasta]`; por encima del segundo, malo. */
export const UMBRALES = {
  lcp: [2500, 4000],
  cls: [0.1, 0.25],
  inp: [200, 500],
  ttfb: [800, 1800],
} as const;

export function nivelDe(valor: number | null, [bueno, mejorable]: readonly [number, number]) {
  if (valor == null) return null;
  return valor <= bueno ? "bien" : valor <= mejorable ? "mejorable" : "mal";
}

/* ── PUNTUACIÓN 0–100, CON LA CURVA DE LIGHTHOUSE ──
   Lighthouse no puntúa una métrica con una regla de tres: usa una curva
   log-normal definida por dos puntos de control (el valor que saca un 90 y el
   que saca un 50). Esta es la misma función (`computeLogNormalScore` de
   Lighthouse), con la misma aproximación de `erf`. Para LCP y CLS los puntos
   de control coinciden con los de Lighthouse (2,5 s / 4 s y 0,1 / 0,25); para
   INP y TTFB, que Lighthouse no puntúa en laboratorio, se usan los umbrales
   de web.dev con la misma curva — y la interfaz lo dice. */
function erf(x: number): number {
  const signo = Math.sign(x);
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    t *
    (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return signo * (1 - y * Math.exp(-ax * ax));
}

export function puntuacion(valor: number | null, [p10, mediana]: readonly [number, number]) {
  if (valor == null) return null;
  if (valor <= 0) return 1;
  const INVERSA_ERFC_UN_QUINTO = 0.9061938024368232;
  const xLog = Math.log(Math.max(Number.MIN_VALUE, valor / mediana));
  const p10Log = -Math.log(Math.max(Number.MIN_VALUE, p10 / mediana));
  const percentil = (1 - erf((xLog * INVERSA_ERFC_UN_QUINTO) / p10Log)) / 2;
  if (valor <= p10) return Math.max(0.9, Math.min(1, percentil));
  if (valor <= mediana) return Math.max(0.5, Math.min(0.8999999999999999, percentil));
  return Math.max(0, Math.min(0.49999999999999994, percentil));
}

/** El color de una puntuación, con los mismos cortes que Lighthouse (90 / 50). */
export function nivelDePuntuacion(p: number | null): Nivel | null {
  if (p == null) return null;
  return p >= 0.9 ? "bien" : p >= 0.5 ? "mejorable" : "mal";
}

/** FPS va al revés que el resto: más es mejor. */
export function nivelFps(fps: number): Nivel | null {
  if (fps === 0) return null;
  return fps >= 55 ? "bien" : fps >= 40 ? "mejorable" : "mal";
}

export function nivelFotogramasLargos(cuenta: number): Nivel {
  return cuenta === 0 ? "bien" : cuenta <= 3 ? "mejorable" : "mal";
}

/** El peor de los niveles no nulos: lo que manda en el punto del botón. */
export function peorNivel(niveles: (Nivel | null)[]): Nivel | null {
  const vivos = niveles.filter((n): n is Nivel => n !== null);
  if (vivos.includes("mal")) return "mal";
  if (vivos.includes("mejorable")) return "mejorable";
  return vivos.length ? "bien" : null;
}

export type Metricas = {
  lcp: number | null;
  cls: number | null;
  inp: number | null;
  ttfb: number | null;
  fps: number;
  fotogramasLargos: number;
  bloqueoMs: number;
  /** Qué mide ESTE navegador. Safari y Firefox no tienen todas las APIs
   *  (fotogramas largos, a veces Event Timing o Layout Instability): sin
   *  esto, "0 fotogramas largos" saldría como "Bueno" en un navegador que
   *  simplemente no los cuenta. */
  soporte: { lcp: boolean; cls: boolean; inp: boolean; largos: boolean };
};

export function soportado(tipo: string): boolean {
  return (
    typeof PerformanceObserver !== "undefined" &&
    !!PerformanceObserver.supportedEntryTypes?.includes(tipo)
  );
}

/** La navegación que cargó este documento (no cambia con la navegación
 *  interna de la SPA). */
export function navegacion(): (PerformanceNavigationTiming & { activationStart?: number }) | undefined {
  if (typeof performance === "undefined") return undefined;
  return performance.getEntriesByType("navigation")[0] as
    (PerformanceNavigationTiming & { activationStart?: number }) | undefined;
}

/** La ruta de la CARGA, no la de ahora. Las Web Vitals de `useMetricas`
 *  son las del documento que se cargó; si después se navega dentro de la
 *  SPA, `location.pathname` cambia pero el LCP y el TTFB siguen siendo los
 *  de la primera página. Atribuirlos a la ruta actual sería culpar a una
 *  página del tiempo de carga de otra. */
export function rutaDeCarga(): string {
  const nav = navegacion();
  try {
    if (nav?.name) return new URL(nav.name).pathname;
  } catch {
    /* URL no parseable: se cae a la actual */
  }
  return typeof window === "undefined" ? "/" : window.location.pathname;
}

/* ── INP ──
   No es la peor interacción a secas: es el percentil 98. Con menos de 50
   interacciones coincide con la peor; a partir de ahí se descarta una de las
   más lentas por cada 50, como hace Chrome (y la librería `web-vitals`), para
   que un único atasco raro no defina toda la página. */
export function inpDe(duraciones: number[]): number | null {
  if (!duraciones.length) return null;
  const ordenadas = [...duraciones].sort((a, b) => b - a);
  const saltar = Math.min(ordenadas.length - 1, Math.floor(duraciones.length / 50));
  return Math.round(ordenadas[saltar]);
}
