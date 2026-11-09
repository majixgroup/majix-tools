import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { medidas, suscribirMedidas } from "./medidor";
import { registrarFps } from "./fps";
import type { Metricas } from "./metricas";

/* ---------------------------------------------------------------------- *
 * LAS MÉTRICAS, DENTRO DEL PANEL
 *
 * Lee lo que el medidor lleva observando desde el principio y añade los
 * FPS, que solo se cuentan mientras el panel existe: un bucle de
 * `requestAnimationFrame` funcionando desde que carga la página sería un
 * coste que tu web no tiene.
 * ---------------------------------------------------------------------- */

export function useMetricas(): Metricas {
  const base = useSyncExternalStore(suscribirMedidas, medidas, medidas);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let vivo = true;
    let frames = 0;
    let ultimoSegundo = performance.now();
    /* `!(transcurrido < 1000)` en vez de `>= 1000`: un NaN accidental
       también reinicia el conteo, en vez de dejarlo atascado para siempre. */
    const tick = () => {
      if (!vivo) return;
      frames++;
      const ahora = performance.now();
      const transcurrido = ahora - ultimoSegundo;
      if (!(transcurrido < 1000)) {
        const valor = Math.round((frames * 1000) / transcurrido);
        if (Number.isFinite(valor)) {
          setFps(valor);
          registrarFps(valor);
        }
        frames = 0;
        ultimoSegundo = ahora;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => {
      vivo = false;
    };
  }, []);

  return useMemo(() => ({ ...base, fps }), [base, fps]);
}
