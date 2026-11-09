/* ---------------------------------------------------------------------- *
 * EL HISTORIAL DE CARGAS — de donde salen las gráficas del Dashboard
 *
 * Una muestra por carga de página: las Web Vitals con las que terminó, las
 * peticiones de red, el peso transferido y los errores de consola. Se guarda
 * al OCULTAR la página (cambio de pestaña, recarga, cierre), que es el único
 * momento en que el LCP y el CLS ya son definitivos — el mismo criterio que
 * usa la librería `web-vitals` de Google para enviar sus datos.
 *
 * Vive en `localStorage` del navegador de quien desarrolla: no sale de su
 * máquina. Tope de 120 muestras, las más antiguas se descartan.
 * ---------------------------------------------------------------------- */

export type Muestra = {
  t: number;
  ruta: string;
  lcp: number | null;
  cls: number | null;
  inp: number | null;
  ttfb: number | null;
  peticiones: number;
  kb: number;
  errores: number;
};

const CLAVE = "majix-tools:historial";
const TOPE = 120;

export function leerHistorial(): Muestra[] {
  try {
    const crudo = localStorage.getItem(CLAVE);
    const lista = crudo ? (JSON.parse(crudo) as Muestra[]) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export function guardarMuestra(m: Muestra): void {
  try {
    const lista = leerHistorial();
    lista.push(m);
    localStorage.setItem(CLAVE, JSON.stringify(lista.slice(-TOPE)));
  } catch {
    /* Sin almacenamiento (modo privado, cuota llena): el historial no crece,
       el resto del panel sigue funcionando. */
  }
}

export function borrarHistorial(): void {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* nada que borrar */
  }
}
