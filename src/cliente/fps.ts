/* ---------------------------------------------------------------------- *
 * LOS FPS MEDIOS, PARA ENVIARLOS
 *
 * Los FPS se cuentan con un bucle de `requestAnimationFrame`, y un bucle
 * permanente desde que carga la página sería un coste que tu web no tiene:
 * por eso solo funciona mientras el panel está montado (ver `usar-metricas.ts`).
 * Aquí se guarda la media de lo medido, para que el envío a tu panel de MAJIX la
 * lleve cuando exista. Sin panel abierto no hay dato, y se envía como vacío,
 * nunca como cero: un cero diría que la web iba a cero fotogramas por segundo.
 * ---------------------------------------------------------------------- */

const g = globalThis as typeof globalThis & { __majixToolsFps?: { suma: number; n: number } };
const acumulado = (g.__majixToolsFps ??= { suma: 0, n: 0 });

/** Registra una lectura de FPS de un segundo completo (0 no cuenta: es «aún no medido»). */
export function registrarFps(valor: number): void {
  if (!Number.isFinite(valor) || valor <= 0 || valor > 1000) return;
  acumulado.suma += valor;
  acumulado.n += 1;
}

/** La media de las lecturas de esta carga, o `null` si nunca se midió. */
export function fpsMedios(): number | null {
  return acumulado.n === 0 ? null : Math.round(acumulado.suma / acumulado.n);
}
