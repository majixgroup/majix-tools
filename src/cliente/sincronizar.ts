import { medidas } from "./medidor";
import { resumenCarga } from "./monitor";
import { fpsMedios } from "./fps";

/* ---------------------------------------------------------------------- *
 * EL ENVÍO EN VIVO A TU PANEL DE MAJIX
 *
 * Cada carga de página se manda a TU servidor de desarrollo
 * (`/__majix-tools/api/muestras`), y es él —que es quien tiene tu sesión—
 * quien la reenvía a MAJIX. El navegador nunca habla con MAJIX y nunca ve tu
 * token: aquí no hay nada que robar.
 *
 * Dos envíos por carga, con el mismo identificador (el segundo ACTUALIZA al
 * primero, no lo duplica):
 *   1. Unos segundos después de cargar: para que tu panel se mueva «en vivo».
 *   2. Al ocultar la página (cambio de pestaña, recarga, cierre): el único
 *      momento en que LCP y CLS ya son definitivos.
 *
 * Lo que se envía está definido y filtrado en `servidor/muestras.ts`.
 * Sin sesión el servidor contesta 401, y con el plan Libre 403 (la medición se queda en local): en los dos casos se deja
 * de insistir un rato.
 * ---------------------------------------------------------------------- */

const ENDPOINT = "/__majix-tools/api/muestras";
const PRIMER_ENVIO_MS = 4000;
const PAUSA_SIN_SESION_MS = 30_000;
const PAUSA_SIN_PLAN_MS = 5 * 60_000;

let pausaHasta = 0;
/** El envío provisional de la carga actual, para poder lanzarlo en cuanto hay sesión. */
let enviarAhora: (() => void) | null = null;

function identificador(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    /* contexto no seguro: se cae al respaldo */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Programa los dos envíos de esta carga. Devuelve la función del envío final. */
export function programarEnvio(ruta: string): { final: () => void } {
  const id = identificador();
  let terminado = false;

  const enviar = (esFinal: boolean) => {
    if (typeof fetch === "undefined" || Date.now() < pausaHasta) return;
    const x = medidas();
    const cuerpo = JSON.stringify({
      muestras: [
        {
          id,
          momento: Date.now(),
          ruta,
          lcp: x.soporte.lcp ? x.lcp : null,
          cls: x.soporte.cls ? x.cls : null,
          inp: x.soporte.inp ? x.inp : null,
          ttfb: x.ttfb,
          ...resumenCarga(),
          /* FPS: solo hay dato si el panel ha estado abierto (ver `fps.ts`). Los fotogramas largos sí se miden siempre. */
          fps: fpsMedios(),
          largos: x.soporte.largos ? x.fotogramasLargos : null,
          bloqueo: x.soporte.largos ? x.bloqueoMs : null,
        },
      ],
    });
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Majix-Tools": "1" },
      body: cuerpo,
      keepalive: esFinal,
      cache: "no-store",
    })
      .then((r) => {
        if (r.status === 401) pausaHasta = Date.now() + PAUSA_SIN_SESION_MS;
        /* 403 = el plan no incluye el directo (Libre): la medición se queda en local y no se insiste. */
        else if (r.status === 403) pausaHasta = Date.now() + PAUSA_SIN_PLAN_MS;
      })
      .catch(() => {
        /* sin servidor local o sin red: no pasa nada, se reintenta en la próxima carga */
      });
  };

  enviarAhora = () => {
    if (!terminado && document.visibilityState === "visible") enviar(false);
  };

  /* Cambiar de pestaña cierra la carga (`final`), pero la página sigue viva: quien aprueba su inicio de sesión
     en OTRA pestaña vuelve a esta con la misma carga abierta. Al volver, se reanuda con el mismo identificador
     y el envío siguiente ACTUALIZA el anterior (más interacciones, mismas Web Vitals definitivas). */
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !terminado) return;
    terminado = false;
    window.setTimeout(() => enviarAhora?.(), 1500);
  });

  const arrancar = () => {
    window.setTimeout(() => {
      if (!terminado && document.visibilityState === "visible") enviar(false);
    }, PRIMER_ENVIO_MS);
  };
  if (document.readyState === "complete") arrancar();
  else window.addEventListener("load", arrancar, { once: true });

  return {
    final: () => {
      if (terminado) return;
      terminado = true;
      enviar(true);
    },
  };
}

/** Para cuando el panel detecta que se ha iniciado sesión: se reanuda y la carga actual se manda ya, sin esperar
 *  a la próxima (quien inicia sesión con su web abierta ve su primer dato al momento). */
export function reanudarEnvio(): void {
  pausaHasta = 0;
  enviarAhora?.();
}
