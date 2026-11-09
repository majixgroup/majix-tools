import "./monitor";
import { medidas } from "./medidor";
import { guardarMuestra } from "./historial";
import { resumenCarga } from "./monitor";
import { rutaDeCarga } from "./metricas";
import { programarEnvio } from "./sincronizar";

/* ---------------------------------------------------------------------- *
 * EL PUNTO DE ENTRADA DEL NAVEGADOR — `majix-tools/cliente`
 *
 * Importar este módulo basta. El plugin de Vite lo pone el primero del
 * <head> en las webs con `index.html`; en las que se pintan en el servidor
 * lo importa una línea que añade `npx majix-tools init`, siempre detrás de
 * `import.meta.env.DEV`.
 *
 * ── DOS TIEMPOS, PARA NO ESTROPEAR LO QUE SE MIDE ──
 *   1. Ahora mismo, unos pocos KB sin React: el grabador de consola y red,
 *      el medidor de Web Vitals y el guardado del historial. Tiene que ser
 *      pronto para no perderse nada.
 *   2. Cuando la página ha terminado de cargar y el navegador está libre, el
 *      panel (React, animaciones, iconos: el trozo pesado).
 * Si el panel entero se cargara al principio, retrasaría la web que está
 * midiendo, y cada cifra que enseña estaría un poco peor de lo que es.
 * ---------------------------------------------------------------------- */

type Estado = { arrancado: boolean; panel: Promise<typeof import("./montar")> | null };
const g = globalThis as typeof globalThis & { __majixToolsArranque?: Estado };
const estado: Estado = (g.__majixToolsArranque ??= { arrancado: false, panel: null });

function cargarPanel() {
  estado.panel ??= import("./montar");
  return estado.panel;
}

/** Monta el panel ya, sin esperar. Devuelve la función que lo desmonta. */
export async function montar(): Promise<() => void> {
  const m = await cargarPanel();
  return m.montar();
}

/** Quita el panel de la página (el medidor y el grabador siguen activos). */
export async function desmontar(): Promise<void> {
  if (!estado.panel) return;
  (await estado.panel).desmontar();
}

/** Alias en inglés de `montar` y `desmontar`. */
export const mount = montar;
export const unmount = desmontar;

function arrancar() {
  if (estado.arrancado || typeof window === "undefined") return;
  estado.arrancado = true;

  /* ── EL HISTORIAL ──
     Una muestra por carga, al OCULTAR la página (recarga, cambio de
     pestaña, cierre): es el único momento en que LCP y CLS ya no cambian —
     el mismo criterio que usa la librería `web-vitals` de Google. Una sola
     vez por carga. */
  const ruta = rutaDeCarga();
  const envio = programarEnvio(ruta);
  let guardada = false;
  const guardar = () => {
    if (guardada || document.visibilityState !== "hidden") return;
    guardada = true;
    envio.final();
    const x = medidas();
    guardarMuestra({
      t: Date.now(),
      ruta,
      lcp: x.soporte.lcp ? x.lcp : null,
      cls: x.soporte.cls ? x.cls : null,
      inp: x.soporte.inp ? x.inp : null,
      ttfb: x.ttfb,
      ...resumenCarga(),
    });
  };
  document.addEventListener("visibilitychange", guardar);
  window.addEventListener("pagehide", guardar);

  /* ── EL PANEL, CUANDO HAYA SITIO ── */
  const programar = () => {
    const ir = () => void montar();
    if ("requestIdleCallback" in window) requestIdleCallback(ir, { timeout: 2000 });
    else setTimeout(ir, 200);
  };
  if (document.readyState === "complete") programar();
  else window.addEventListener("load", programar, { once: true });
}

arrancar();
