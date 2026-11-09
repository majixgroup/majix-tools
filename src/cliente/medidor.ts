import { inpDe, navegacion, soportado, type Metricas } from "./metricas";

/* ---------------------------------------------------------------------- *
 * EL MEDIDOR — Web Vitals desde el primer instante, sin React
 *
 * Empieza a observar en cuanto se IMPORTA, mucho antes de que se cargue el
 * panel: así el panel —que pesa y se carga cuando el navegador está libre—
 * no retrasa la página que está midiendo. Una herramienta de rendimiento que
 * empeora el rendimiento que mide mentiría con cada cifra.
 *
 * Todo sale de `PerformanceObserver`, las mismas fuentes que usa Lighthouse
 * y la librería `web-vitals` de Google, con sus mismas reglas:
 *   · LCP: solo lo pintado mientras la pestaña estaba visible, y desde la
 *     activación si la página se precargó (prerender);
 *   · CLS: la peor VENTANA de saltos (1 s de separación, 5 s como mucho),
 *     no la suma de toda la vida de la página;
 *   · INP: el percentil 98 de las interacciones, contando cada una una vez.
 *
 * El estado vive en `globalThis`: si Vite recarga el módulo, no se empieza
 * de cero ni se duplican los observadores.
 * ---------------------------------------------------------------------- */

export type Medidas = Omit<Metricas, "fps">;
type Oyente = () => void;

type Estado = { medidas: Medidas; oyentes: Set<Oyente>; iniciado: boolean };
const g = globalThis as typeof globalThis & { __majixToolsMedidor?: Estado };
const estado: Estado = (g.__majixToolsMedidor ??= {
  medidas: {
    lcp: null,
    cls: null,
    inp: null,
    ttfb: null,
    fotogramasLargos: 0,
    bloqueoMs: 0,
    soporte: { lcp: true, cls: true, inp: true, largos: true },
  },
  oyentes: new Set(),
  iniciado: false,
});

let avisoPendiente = false;
function actualizar(cambio: Partial<Medidas>) {
  /* Un objeto NUEVO en cada cambio: `useSyncExternalStore` compara por
     referencia. Y un solo aviso por tanda de cambios. */
  estado.medidas = { ...estado.medidas, ...cambio };
  if (avisoPendiente) return;
  avisoPendiente = true;
  queueMicrotask(() => {
    avisoPendiente = false;
    estado.oyentes.forEach((f) => f());
  });
}

export function medidas(): Medidas {
  return estado.medidas;
}

export function suscribirMedidas(oyente: Oyente): () => void {
  estado.oyentes.add(oyente);
  return () => estado.oyentes.delete(oyente);
}

function iniciar() {
  if (estado.iniciado || typeof window === "undefined" || typeof PerformanceObserver === "undefined") {
    return;
  }
  estado.iniciado = true;

  actualizar({
    soporte: {
      lcp: soportado("largest-contentful-paint"),
      cls: soportado("layout-shift"),
      inp: soportado("event"),
      largos: soportado("long-animation-frame"),
    },
    /* Hasta el primer salto el CLS es 0, no "sin dato": una página que no
       salta tiene un CLS perfecto, y el navegador no avisa de lo que no pasa. */
    cls: soportado("layout-shift") ? 0 : null,
  });

  const nav = navegacion();
  const activacion = nav?.activationStart ?? 0;
  if (nav && nav.responseStart > 0) {
    actualizar({ ttfb: Math.round(Math.max(0, nav.responseStart - activacion)) });
  }

  /* Cuándo se ocultó la página por primera vez: un LCP pintado en segundo
     plano no lo vio nadie. Si nació oculta, desde 0. */
  let primeraOcultacion = document.visibilityState === "hidden" ? 0 : Infinity;
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.visibilityState === "hidden" && primeraOcultacion === Infinity) {
        primeraOcultacion = performance.now();
      }
    },
    true,
  );

  const observar = (
    tipo: string,
    cb: (entradas: PerformanceObserverEntryList) => void,
    opts: PerformanceObserverInit = { buffered: true },
  ) => {
    if (!soportado(tipo)) return;
    try {
      new PerformanceObserver(cb).observe({ type: tipo, ...opts } as PerformanceObserverInit);
    } catch {
      /* Dice que lo soporta pero falla al observarlo: esa cifra se queda en
         blanco en vez de romper el resto. */
    }
  };

  observar("largest-contentful-paint", (lista) => {
    const validas = lista.getEntries().filter((e) => e.startTime < primeraOcultacion);
    const ultima = validas[validas.length - 1];
    if (ultima) actualizar({ lcp: Math.round(Math.max(0, ultima.startTime - activacion)) });
  });

  const cls = { valor: 0, ventana: 0, inicio: 0, ultimo: 0 };
  observar("layout-shift", (lista) => {
    for (const e of lista.getEntries() as (PerformanceEntry & {
      value: number;
      hadRecentInput: boolean;
    })[]) {
      if (e.hadRecentInput) continue;
      const seguida = cls.ventana > 0 && e.startTime - cls.ultimo < 1000;
      const cabe = e.startTime - cls.inicio < 5000;
      if (seguida && cabe) {
        cls.ventana += e.value;
      } else {
        cls.ventana = e.value;
        cls.inicio = e.startTime;
      }
      cls.ultimo = e.startTime;
      cls.valor = Math.max(cls.valor, cls.ventana);
    }
    actualizar({ cls: cls.valor });
  });

  /* Un clic genera varios eventos (pointerdown, pointerup, click): la
     interacción cuenta una vez, con el más lento. */
  const interacciones = new Map<number, number>();
  const anotar = (lista: PerformanceObserverEntryList) => {
    let cambia = false;
    for (const e of lista.getEntries() as (PerformanceEntry & { interactionId?: number })[]) {
      if (!e.interactionId) continue;
      if (e.duration > (interacciones.get(e.interactionId) ?? 0)) {
        interacciones.set(e.interactionId, e.duration);
        cambia = true;
      }
    }
    if (cambia) actualizar({ inp: inpDe([...interacciones.values()]) });
  };
  /* 16 ms es el mínimo que admite el navegador: con un umbral más alto, las
     interacciones rápidas no contarían y el INP se quedaría "sin dato"
     aunque hubieras hecho clic veinte veces. */
  observar("event", anotar, { buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
  observar("first-input", anotar);

  const largos = { cuenta: 0, bloqueo: 0 };
  observar("long-animation-frame", (lista) => {
    for (const e of lista.getEntries() as (PerformanceEntry & { blockingDuration: number })[]) {
      largos.cuenta++;
      largos.bloqueo += e.blockingDuration;
    }
    actualizar({ fotogramasLargos: largos.cuenta, bloqueoMs: Math.round(largos.bloqueo) });
  });
}

iniciar();
