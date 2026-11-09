import { useEffect, useRef, useState, type ReactNode } from "react";

/* ---------------------------------------------------------------------- *
 * LAS GRÁFICAS DE MAJIX TOOLS — SVG a mano, sin librería
 *
 * Una librería de gráficas pesaría más que el panel entero. Estas tres
 * piezas cubren lo que pide
 * un dashboard: un anillo de puntuación, líneas con varias series y barras
 * agrupadas. Todas miden su ancho real (ResizeObserver) y dibujan en píxeles
 * de verdad, así que el texto de los ejes nunca sale deformado.
 * ---------------------------------------------------------------------- */

function useAncho<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAncho(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, ancho] as const;
}

/** Ticks "redondos" para el eje Y: 0, 50, 100, 150…
 *  Nunca por debajo de 4: con todo a 0 o sin datos, un eje de 0 a 1,1 con
 *  pasos de 0,5 redondeados a entero pintaba "0, 1, 1, 2". */
function ticks(maximo: number, cuantos = 4): number[] {
  maximo = Math.max(4, maximo);
  const bruto = maximo / cuantos;
  const magnitud = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * magnitud).find((p) => p >= bruto) ?? bruto;
  return Array.from({ length: Math.ceil(maximo / paso) + 1 }, (_, i) => +(i * paso).toFixed(6));
}

/* ── CURVA MONÓTONA ──
   Una curva suave que NUNCA se sale del rango entre dos puntos seguidos
   (interpolación cúbica monótona de Fritsch–Carlson, la de `curveMonotoneX`
   de d3). Con Catmull-Rom la curva "se pasaba" antes de un pico y bajaba de
   cero: dibujaba un valor que no existe. Aquí, entre dos muestras, la línea
   solo sube o solo baja. */
function trazo(puntos: [number, number][]): string {
  const n = puntos.length;
  if (!n) return "";
  if (n === 1) return `M${puntos[0][0]},${puntos[0][1]}`;
  if (n === 2) return `M${puntos[0][0]},${puntos[0][1]} L${puntos[1][0]},${puntos[1][1]}`;
  const dx: number[] = [];
  const pend: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = puntos[i + 1][0] - puntos[i][0];
    pend[i] = dx[i] === 0 ? 0 : (puntos[i + 1][1] - puntos[i][1]) / dx[i];
  }
  const t: number[] = [pend[0]];
  for (let i = 1; i < n - 1; i++) {
    t[i] = pend[i - 1] * pend[i] <= 0 ? 0 : (pend[i - 1] + pend[i]) / 2;
  }
  t[n - 1] = pend[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (pend[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / pend[i];
    const b = t[i + 1] / pend[i];
    const h = a * a + b * b;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      t[i] = k * a * pend[i];
      t[i + 1] = k * b * pend[i];
    }
  }
  let d = `M${puntos[0][0]},${puntos[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = puntos[i];
    const [x1, y1] = puntos[i + 1];
    const tercio = dx[i] / 3;
    d += ` C${x0 + tercio},${y0 + t[i] * tercio} ${x1 - tercio},${y1 - t[i + 1] * tercio} ${x1},${y1}`;
  }
  return d;
}

/** Corta una serie en tramos seguidos de valores: un `null` es un hueco
 *  (una carga sin ese dato), y unirlo con una línea sería inventar los
 *  valores de en medio. */
function tramos(valores: (number | null)[]): { i: number; v: number }[][] {
  const salida: { i: number; v: number }[][] = [];
  let actual: { i: number; v: number }[] = [];
  valores.forEach((v, i) => {
    if (v == null) {
      if (actual.length) salida.push(actual);
      actual = [];
    } else {
      actual.push({ i, v });
    }
  });
  if (actual.length) salida.push(actual);
  return salida;
}

export function Leyenda({ items }: { items: { nombre: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((i) => (
        <span key={i.nombre} className="flex items-center gap-1.5 text-[11px] text-foreground/70">
          <span className="h-2 w-2 rounded-full" style={{ background: i.color }} />
          {i.nombre}
        </span>
      ))}
    </div>
  );
}

/* ── ANILLO ── */
export function Anillo({
  valor,
  color,
  tamano = 56,
  grosor = 5,
  children,
}: {
  /** De 0 a 1, o `null` si todavía no hay dato. */
  valor: number | null;
  color: string;
  tamano?: number;
  grosor?: number;
  children?: ReactNode;
}) {
  const r = (tamano - grosor) / 2;
  const c = 2 * Math.PI * r;
  const lleno = valor == null ? 0 : Math.max(0, Math.min(1, valor));
  return (
    <div className="relative shrink-0" style={{ width: tamano, height: tamano }}>
      <svg width={tamano} height={tamano} className="-rotate-90" aria-hidden>
        <circle
          cx={tamano / 2}
          cy={tamano / 2}
          r={r}
          fill="none"
          stroke="rgb(255 255 255 / 9%)"
          strokeWidth={grosor}
        />
        <circle
          cx={tamano / 2}
          cy={tamano / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={grosor}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - lleno)}
          className="transition-[stroke-dashoffset] duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

type Serie = {
  nombre: string;
  color: string;
  valores: (number | null)[];
  /** Si la serie se dibuja normalizada (varias escalas en una gráfica, como
      hace Search Console), el valor real para el tooltip y su formato. */
  reales?: (number | null)[];
  formatoReal?: (v: number) => string;
};

const MARGEN_BASE = { izq: 42, der: 10, arr: 10, aba: 24 };

/* ── LÍNEAS ── */
export function GraficaLineas({
  series,
  etiquetas,
  titulos,
  alto = 200,
  formato = (v: number) => String(Math.round(v)),
  tituloEjeY,
  sinEjeY = false,
}: {
  series: Serie[];
  etiquetas: string[];
  /** Título del tooltip de cada punto; por defecto, la etiqueta del eje. */
  titulos?: string[];
  alto?: number;
  formato?: (v: number) => string;
  tituloEjeY?: string;
  /** Sin números en el eje Y: para series normalizadas, donde un eje común
      no significaría nada. */
  sinEjeY?: boolean;
}) {
  const [ref, ancho] = useAncho<HTMLDivElement>();
  const [foco, setFoco] = useState<number | null>(null);
  const n = etiquetas.length;
  const maximo = Math.max(
    1,
    ...series.flatMap((s) => s.valores.filter((v): v is number => v != null)),
  );
  const eje = ticks(maximo * 1.1);
  const tope = eje[eje.length - 1];
  const MARGEN = sinEjeY ? { ...MARGEN_BASE, izq: 12 } : MARGEN_BASE;
  const w = Math.max(0, ancho - MARGEN.izq - MARGEN.der);
  const h = alto - MARGEN.arr - MARGEN.aba;
  const x = (i: number) => MARGEN.izq + (n <= 1 ? w / 2 : (i / (n - 1)) * w);
  const y = (v: number) => MARGEN.arr + h - (v / tope) * h;
  const cadaCuantas = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(w / 64))));
  const enfocar = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - MARGEN.izq) / Math.max(1, w)) * (n - 1));
    setFoco(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div ref={ref} className="relative w-full" style={{ height: alto }}>
      {ancho > 0 && (
        /* Eventos de puntero, no de ratón: así el tooltip también sale al
           tocar la gráfica en una tableta o un móvil. */
        <svg
          width={ancho}
          height={alto}
          className="touch-pan-y"
          onPointerLeave={() => setFoco(null)}
          onPointerMove={enfocar}
          onPointerDown={enfocar}
        >
          {eje.map((t) => (
            <g key={t}>
              <line
                x1={MARGEN.izq}
                x2={ancho - MARGEN.der}
                y1={y(t)}
                y2={y(t)}
                stroke="rgb(255 255 255 / 6%)"
              />
              {!sinEjeY && (
                <text
                  x={MARGEN.izq - 8}
                  y={y(t) + 3.5}
                  textAnchor="end"
                  fontSize="10"
                  fill="rgb(255 255 255 / 45%)"
                >
                  {formato(t)}
                </text>
              )}
            </g>
          ))}
          {tituloEjeY && !sinEjeY && (
            <text
              transform={`translate(10 ${MARGEN.arr + h / 2}) rotate(-90)`}
              textAnchor="middle"
              fontSize="10"
              fill="rgb(255 255 255 / 45%)"
            >
              {tituloEjeY}
            </text>
          )}
          {etiquetas.map((e, i) =>
            i % cadaCuantas === 0 ? (
              <text
                key={i}
                x={x(i)}
                y={alto - 6}
                textAnchor="middle"
                fontSize="10"
                fill="rgb(255 255 255 / 45%)"
              >
                {e}
              </text>
            ) : null,
          )}
          {series.map((s) =>
            tramos(s.valores).map((tramo) =>
              tramo.length === 1 ? (
                /* Un valor suelto entre dos huecos no forma línea: se
                   pinta como punto para que no desaparezca. */
                <circle
                  key={`${s.nombre}-${tramo[0].i}`}
                  cx={x(tramo[0].i)}
                  cy={y(tramo[0].v)}
                  r={2.5}
                  fill={s.color}
                />
              ) : (
                <path
                  key={`${s.nombre}-${tramo[0].i}`}
                  d={trazo(tramo.map(({ i, v }) => [x(i), y(v)]))}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ),
            ),
          )}
          {foco != null && (
            <g>
              <line
                x1={x(foco)}
                x2={x(foco)}
                y1={MARGEN.arr}
                y2={MARGEN.arr + h}
                stroke="rgb(255 255 255 / 18%)"
              />
              {series.map((s) =>
                s.valores[foco] == null ? null : (
                  <circle
                    key={s.nombre}
                    cx={x(foco)}
                    cy={y(s.valores[foco]!)}
                    r={3.5}
                    fill="#0d0b18"
                    stroke={s.color}
                    strokeWidth={2}
                  />
                ),
              )}
            </g>
          )}
        </svg>
      )}
      {foco != null && ancho > 0 && (
        <Burbuja x={x(foco)} ancho={ancho} titulo={(titulos ?? etiquetas)[foco]}>
          {series.map((s) => {
            const real = s.reales ? s.reales[foco] : s.valores[foco];
            const fmt = s.formatoReal ?? formato;
            return (
              <p key={s.nombre} className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                {s.nombre}: <b className="font-mono">{real == null ? "—" : fmt(real)}</b>
              </p>
            );
          })}
        </Burbuja>
      )}
    </div>
  );
}

/* ── BARRAS AGRUPADAS ── */
export function GraficaBarras({
  series,
  etiquetas,
  titulos,
  alto = 200,
  formato = (v: number) => String(Math.round(v)),
  tituloEjeY,
}: {
  series: Serie[];
  etiquetas: string[];
  /** Título del tooltip de cada punto; por defecto, la etiqueta del eje. */
  titulos?: string[];
  alto?: number;
  formato?: (v: number) => string;
  tituloEjeY?: string;
}) {
  const [ref, ancho] = useAncho<HTMLDivElement>();
  const [foco, setFoco] = useState<number | null>(null);
  const n = etiquetas.length;
  const maximo = Math.max(
    1,
    ...series.flatMap((s) => s.valores.filter((v): v is number => v != null)),
  );
  const eje = ticks(maximo * 1.1);
  const tope = eje[eje.length - 1];
  const MARGEN = MARGEN_BASE;
  const w = Math.max(0, ancho - MARGEN.izq - MARGEN.der);
  const h = alto - MARGEN.arr - MARGEN.aba;
  const grupo = n ? w / n : 0;
  const barra = Math.max(2, Math.min(14, (grupo * 0.7) / Math.max(1, series.length)));
  const y = (v: number) => MARGEN.arr + h - (v / tope) * h;
  const cadaCuantas = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(w / 64))));

  return (
    <div ref={ref} className="relative w-full" style={{ height: alto }}>
      {ancho > 0 && (
        <svg
          width={ancho}
          height={alto}
          className="touch-pan-y"
          onPointerLeave={() => setFoco(null)}
        >
          {eje.map((t) => (
            <g key={t}>
              <line
                x1={MARGEN.izq}
                x2={ancho - MARGEN.der}
                y1={y(t)}
                y2={y(t)}
                stroke="rgb(255 255 255 / 6%)"
              />
              <text
                x={MARGEN.izq - 8}
                y={y(t) + 3.5}
                textAnchor="end"
                fontSize="10"
                fill="rgb(255 255 255 / 45%)"
              >
                {formato(t)}
              </text>
            </g>
          ))}
          {tituloEjeY && (
            <text
              transform={`translate(10 ${MARGEN.arr + h / 2}) rotate(-90)`}
              textAnchor="middle"
              fontSize="10"
              fill="rgb(255 255 255 / 45%)"
            >
              {tituloEjeY}
            </text>
          )}
          {etiquetas.map((e, i) => {
            const centro = MARGEN.izq + grupo * i + grupo / 2;
            return (
              <g key={i} onPointerEnter={() => setFoco(i)} onPointerDown={() => setFoco(i)}>
                <rect
                  x={MARGEN.izq + grupo * i}
                  y={MARGEN.arr}
                  width={grupo}
                  height={h}
                  fill={foco === i ? "rgb(255 255 255 / 4%)" : "transparent"}
                />
                {series.map((s, j) => {
                  const v = s.valores[i];
                  if (v == null) return null;
                  const bx = centro - (barra * series.length) / 2 + j * barra;
                  const alturaBarra = Math.max(1, MARGEN.arr + h - y(v));
                  return (
                    <rect
                      key={s.nombre}
                      x={bx + 0.5}
                      y={y(v)}
                      width={barra - 1}
                      height={alturaBarra}
                      rx={Math.min(3, barra / 2)}
                      fill={s.color}
                    />
                  );
                })}
                {i % cadaCuantas === 0 && (
                  <text
                    x={centro}
                    y={alto - 6}
                    textAnchor="middle"
                    fontSize="10"
                    fill="rgb(255 255 255 / 45%)"
                  >
                    {e}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {foco != null && ancho > 0 && (
        <Burbuja
          x={MARGEN.izq + grupo * foco + grupo / 2}
          ancho={ancho}
          titulo={(titulos ?? etiquetas)[foco]}
        >
          {series.map((s) => (
            <p key={s.nombre} className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
              {s.nombre}:{" "}
              <b className="font-mono">
                {s.valores[foco] == null ? "—" : formato(s.valores[foco]!)}
              </b>
            </p>
          ))}
        </Burbuja>
      )}
    </div>
  );
}

function Burbuja({
  x,
  ancho,
  titulo,
  children,
}: {
  x: number;
  ancho: number;
  titulo: string;
  children: ReactNode;
}) {
  const aLaIzquierda = x > ancho * 0.6;
  return (
    <div
      className="pointer-events-none absolute top-1 z-10 rounded-lg border border-white/[0.1] bg-[#16131f] px-2.5 py-1.5 text-[11px] leading-[1.5] text-foreground/85 shadow-[0_10px_30px_-10px_rgb(0_0_0/80%)]"
      style={aLaIzquierda ? { right: ancho - x + 10 } : { left: x + 10 }}
    >
      <p className="mb-0.5 font-semibold text-foreground">{titulo}</p>
      {children}
    </div>
  );
}
