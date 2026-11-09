/* ---------------------------------------------------------------------- *
 * EL GRABADOR DE CONSOLA Y RED — no es un componente, es estado compartido
 *
 * La pestaña "Consola y red" necesita datos que existían ANTES de que se
 * abriera el panel: el primer error de la página, la primera petición.
 * Por eso esto se engancha en cuanto se IMPORTA, no cuando se abre una
 * pestaña. El plugin de Vite pone el panel al principio del <head>, así que
 * se importa antes que el código de tu web.
 *
 * Solo APIs estándar del navegador: `console.error`/`console.warn`
 * envueltos (nunca silenciados: se les sigue llamando) y un
 * `PerformanceObserver` de tipo "resource" para la red.
 * ---------------------------------------------------------------------- */

export type EntradaConsola = {
  id: number;
  nivel: "error" | "warn";
  /** De dónde salió: una llamada a la consola, una excepción sin capturar o
   *  una promesa rechazada sin `catch`. El panel lo traduce al pintarlo. */
  origen: "consola" | "excepcion" | "promesa";
  mensaje: string;
  cuando: number;
};

export type EntradaRed = {
  id: number;
  url: string;
  origen: string;
  tipo: string;
  estado: number | null;
  duracionMs: number;
  bytes: number | null;
  cuando: number;
};

const TOPE = 200;
const PROPIAS = ["/__majix-tools/", "/@id/majix-tools", "/majix-tools/dist/"];

type Oyente = () => void;

/* ── EL ESTADO VIVE EN `globalThis`, NO EN EL MÓDULO ──
   Si Vite recarga este módulo en caliente, sus variables se crean de nuevo
   pero `console.error` sigue envuelto por la versión ANTERIOR, que escribe en
   las listas anteriores. Un `let yaEnganchado` de módulo no lo evita (se
   reinicia con el módulo) y se acababa envolviendo la consola dos veces.
   Guardando el estado en `globalThis`, la versión nueva reutiliza el mismo
   estado y sabe que ya está enganchada. */
type Estado = {
  consola: EntradaConsola[];
  red: EntradaRed[];
  contador: number;
  /* Totales de la carga, APARTE de las listas: las listas guardan solo las
     200 últimas entradas (para no crecer sin límite), pero en desarrollo
     Vite pide cientos de módulos y contarlas daría siempre "200". */
  totales: { peticiones: number; bytes: number; errores: number };
  oyentes: Set<Oyente>;
  enganchado: boolean;
};
const g = globalThis as typeof globalThis & { __majixToolsMonitor?: Estado };
const estado: Estado = (g.__majixToolsMonitor ??= {
  consola: [],
  red: [],
  contador: 0,
  totales: { peticiones: 0, bytes: 0, errores: 0 },
  oyentes: new Set(),
  enganchado: false,
});
const { totales, oyentes } = estado;

export function resumenCarga(): { peticiones: number; kb: number; errores: number } {
  return {
    peticiones: totales.peticiones,
    kb: Math.round(totales.bytes / 1024),
    errores: totales.errores,
  };
}

/* ── AVISAR, SIN PRISA ──
   Se avisa en una microtarea y una sola vez por tanda: React escribe errores
   en la consola MIENTRAS pinta, y avisar en ese mismo instante a un
   componente suscrito provoca un "actualizar durante el render", que React
   vuelve a escribir en la consola... y otra vez aquí. */
let avisoPendiente = false;
const avisar = () => {
  if (avisoPendiente) return;
  avisoPendiente = true;
  queueMicrotask(() => {
    avisoPendiente = false;
    oyentes.forEach((f) => f());
  });
};

/** Punto único de suscripción, compatible con `useSyncExternalStore`. */
export function suscribirse(oyente: Oyente): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

/* Las listas NO se modifican: cada cambio crea una nueva. `useSyncExternalStore`
   compara la instantánea con la anterior por referencia; si fuera el mismo
   array modificado por dentro, React no se enteraría del cambio. */
export function instantaneaConsola(): EntradaConsola[] {
  return estado.consola;
}
export function instantaneaRed(): EntradaRed[] {
  return estado.red;
}

export function limpiarConsola(): void {
  estado.consola = [];
  avisar();
}
export function limpiarRed(): void {
  estado.red = [];
  avisar();
}

function empujarConsola(entrada: EntradaConsola) {
  if (entrada.nivel === "error") totales.errores++;
  estado.consola = [entrada, ...estado.consola].slice(0, TOPE);
  avisar();
}

function empujarRed(entradas: EntradaRed[]) {
  if (!entradas.length) return;
  for (const e of entradas) {
    totales.peticiones++;
    totales.bytes += e.bytes ?? 0;
  }
  estado.red = [...entradas.reverse(), ...estado.red].slice(0, TOPE);
  avisar();
}

function textoDe(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === "string") return a;
      if (a instanceof Error) return a.message;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(" ");
}

/* ── LA CONSOLA ──
   Envuelve, no sustituye: la llamada original sigue yendo a la consola de
   verdad. `estado.enganchado` (en `globalThis`, ver arriba) evita envolverla
   dos veces si el módulo se recarga en caliente. */
if (typeof window !== "undefined" && !estado.enganchado) {
  estado.enganchado = true;

  (["error", "warn"] as const).forEach((nivel) => {
    const original = console[nivel].bind(console);
    console[nivel] = (...args: unknown[]) => {
      empujarConsola({
        id: ++estado.contador,
        nivel,
        origen: "consola",
        mensaje: textoDe(args),
        cuando: performance.now(),
      });
      original(...args);
    };
  });

  window.addEventListener("error", (e) => {
    empujarConsola({
      id: ++estado.contador,
      nivel: "error",
      origen: "excepcion",
      mensaje: `${e.message} (${e.filename ?? "?"}:${e.lineno ?? "?"})`,
      cuando: performance.now(),
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const razon = e.reason instanceof Error ? e.reason.message : String(e.reason);
    empujarConsola({
      id: ++estado.contador,
      nivel: "error",
      origen: "promesa",
      mensaje: razon,
      cuando: performance.now(),
    });
  });

  /* ── LA RED ──
     `buffered: true` recoge también lo que ya se pidió antes de que este
     módulo llegara a evaluarse (CSS, el propio JS de la página…). */
  if (PerformanceObserver.supportedEntryTypes?.includes("resource")) {
    const obs = new PerformanceObserver((list) => {
      const nuevas: EntradaRed[] = [];
      for (const entrada of list.getEntries() as PerformanceResourceTiming[]) {
        /* Las peticiones del propio panel no son de tu web: contarlas
           inflaría los totales del Dashboard (el árbol de archivos se pide
           cada 8 s) y llenaría la lista de ruido. */
        if (PROPIAS.some((p) => entrada.name.includes(p))) continue;
        let origen = "—";
        try {
          origen = new URL(entrada.name).origin;
        } catch {
          /* URL relativa o no parseable: se deja el guion. */
        }
        nuevas.push({
          id: ++estado.contador,
          url: entrada.name,
          origen,
          tipo: entrada.initiatorType || "otro",
          /* `responseStatus` (Resource Timing L2) solo está disponible si el
             recurso es del mismo origen o manda `Timing-Allow-Origin`. Si no,
             queda en blanco en vez de mentir con un 200 que no se ha
             comprobado. */
          estado:
            (entrada as PerformanceResourceTiming & { responseStatus?: number }).responseStatus ||
            null,
          duracionMs: Math.round(entrada.duration),
          bytes: entrada.transferSize || null,
          /* Cuándo se PIDIÓ, no cuándo lo vio el observador: las recogidas
             con `buffered` llegan todas juntas y tendrían la misma hora. */
          cuando: entrada.startTime,
        });
      }
      empujarRed(nuevas);
    });
    obs.observe({ type: "resource", buffered: true });
  }
}
