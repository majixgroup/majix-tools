/* ---------------------------------------------------------------------- *
 * QUÉ SALE DE TU ORDENADOR — la lista blanca de lo que se envía a MAJIX
 *
 * Cada carga de página que mide el panel se convierte en una «muestra». Esto
 * es lo ÚNICO que se envía, y se decide AQUÍ, en tu ordenador, antes de que
 * salga nada: un campo que no esté en esta lista no viaja, aunque otra pieza
 * del programa lo tuviera a mano.
 *
 *   id          un identificador aleatorio de la carga (para actualizarla, no duplicarla)
 *   momento     cuándo fue
 *   ruta        la ruta de la página SIN parámetros ni fragmento: `/precios`, nunca `/precios?token=…`
 *   lcp, cls, inp, ttfb   las Web Vitals con las que terminó
 *   peticiones  cuántas peticiones de red hizo
 *   kb          cuánto pesó
 *   errores     cuántos errores salieron en la consola
 *   fps, largos, bloqueo   FPS medios mientras el panel estuvo abierto, fotogramas largos y su tiempo de bloqueo
 *
 * Ni el contenido de la consola, ni las URL de las peticiones, ni cabeceras,
 * ni cookies, ni código, ni archivos, ni claves. El servidor de MAJIX vuelve a
 * filtrar lo mismo al recibirlo (defensa doble), y la pestaña «Cuenta» del
 * panel enseña el último envío tal cual salió.
 *
 * Esta lista y la del servidor (`web/src/lib/herramientas.ts`) tienen que decir
 * lo mismo: si cambia una, cambia la otra.
 * ---------------------------------------------------------------------- */

export type MuestraEnviada = {
  id: string;
  momento: number;
  ruta: string;
  lcp: number | null;
  cls: number | null;
  inp: number | null;
  ttfb: number | null;
  peticiones: number;
  kb: number;
  errores: number;
  /** Solo se mide con el panel abierto (un bucle permanente tendría un coste que tu web no tiene): sin panel, `null`. */
  fps: number | null;
  largos: number | null;
  bloqueo: number | null;
};

export type DiaSearchConsole = {
  dia: string;
  clics: number;
  impresiones: number;
  ctr: number | null;
  posicion: number | null;
};

/** Texto corto y limpio: sin caracteres de control, recortado. */
export function textoLimpio(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

function numero(v: unknown, min: number, max: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v < min || v > max ? null : v;
}

/** La ruta SIN parámetros ni fragmento. */
export function rutaLimpia(v: unknown): string {
  let r = textoLimpio(v, 300);
  const corte = r.search(/[?#]/);
  if (corte !== -1) r = r.slice(0, corte);
  if (!r.startsWith("/")) r = `/${r}`;
  return r.slice(0, 160);
}

/** Se queda SOLO con los campos conocidos; lo que no cuadra se descarta. Como mucho 50. */
export function limpiarMuestras(valor: unknown): MuestraEnviada[] {
  if (!Array.isArray(valor)) return [];
  const salida: MuestraEnviada[] = [];
  for (const x of valor.slice(0, 50)) {
    if (typeof x !== "object" || x === null) continue;
    const o = x as Record<string, unknown>;
    const id = textoLimpio(o.id, 40);
    const momento = numero(o.momento, 0, 8.64e15);
    if (id.length < 8 || momento === null) continue;
    salida.push({
      id,
      momento,
      ruta: rutaLimpia(o.ruta),
      lcp: numero(o.lcp, 0, 600_000),
      cls: numero(o.cls, 0, 100),
      inp: numero(o.inp, 0, 600_000),
      ttfb: numero(o.ttfb, 0, 600_000),
      peticiones: numero(o.peticiones, 0, 100_000) ?? 0,
      kb: numero(o.kb, 0, 100_000_000) ?? 0,
      errores: numero(o.errores, 0, 100_000) ?? 0,
      fps: numero(o.fps, 0, 1000),
      largos: numero(o.largos, 0, 100_000),
      bloqueo: numero(o.bloqueo, 0, 100_000_000),
    });
  }
  return salida;
}

/**
 * De la respuesta de Search Console de este plugin a los totales por día que se envían.
 * Los días que Google todavía no tiene (clics `null`) NO se envían: un hueco no es un cero.
 * Nunca viajan las consultas, las páginas ni los países: solo los cuatro números del día.
 */
export function diasDeSearchConsole(respuesta: unknown): DiaSearchConsole[] {
  const r = respuesta as { configurado?: boolean; error?: unknown; porDia?: unknown } | null;
  if (!r || r.configurado !== true || r.error || !Array.isArray(r.porDia)) return [];
  const salida: DiaSearchConsole[] = [];
  for (const f of r.porDia.slice(0, 400)) {
    if (typeof f !== "object" || f === null) continue;
    const o = f as Record<string, unknown>;
    if (typeof o.clave !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(o.clave)) continue;
    if (typeof o.clics !== "number" || typeof o.impresiones !== "number") continue;
    salida.push({
      dia: o.clave,
      clics: numero(o.clics, 0, 1_000_000_000) ?? 0,
      impresiones: numero(o.impresiones, 0, 1_000_000_000) ?? 0,
      ctr: numero(o.ctr, 0, 1),
      posicion: numero(o.posicion, 0, 10_000),
    });
  }
  return salida;
}
