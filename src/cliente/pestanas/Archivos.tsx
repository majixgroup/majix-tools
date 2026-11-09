import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ChevronRight,
  File,
  Folder,
  RefreshCw,
} from "lucide-react";
import { API } from "../proyecto";
import { useIdioma } from "../idioma";

/* ---------------------------------------------------------------------- *
 * LA PESTAÑA "ARCHIVOS" — tu proyecto, con el peso real de cada fichero
 *
 * El navegador no puede leer tu disco: el árbol lo sirve el plugin de Vite
 * (ver `src/servidor/archivos.ts`), que solo existe con el servidor de
 * desarrollo. Si el proyecto es un repositorio git, se enseña exactamente lo
 * que git no ignora; si no, el disco sin dependencias, builds ni secretos.
 * ---------------------------------------------------------------------- */

type Nodo = {
  nombre: string;
  ruta: string;
  tipo: "carpeta" | "archivo";
  bytes: number;
  hijos?: Nodo[];
};

type Respuesta = {
  raiz: string;
  fuente: "git" | "disco";
  recortado: boolean;
  generadoEn: string;
  totalBytes: number;
  totalArchivos: number;
  totalCarpetas: number;
  arbol: Nodo[];
};

type Orden = "peso" | "nombre";

function formatoBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function ordenar(nodos: Nodo[], orden: Orden, locale: string): Nodo[] {
  const copia = [...nodos];
  copia.sort((a, b) =>
    orden === "peso" ? b.bytes - a.bytes : a.nombre.localeCompare(b.nombre, locale),
  );
  return copia;
}

function Fila({
  nodo,
  profundidad,
  maxHermano,
  orden,
  locale,
  expandidos,
  alternar,
}: {
  nodo: Nodo;
  profundidad: number;
  maxHermano: number;
  orden: Orden;
  locale: string;
  expandidos: Set<string>;
  alternar: (ruta: string) => void;
}) {
  const esCarpeta = nodo.tipo === "carpeta";
  const abierta = expandidos.has(nodo.ruta);
  /* Barra de fondo proporcional al hermano más pesado de su mismo nivel —
     el mismo lenguaje visual que un treemap, sin tener que dibujar uno. */
  const proporcion = maxHermano > 0 ? Math.max(4, Math.round((nodo.bytes / maxHermano) * 100)) : 0;
  const hijos = nodo.hijos ?? [];

  return (
    <div>
      <button
        onClick={() => esCarpeta && alternar(nodo.ruta)}
        aria-expanded={esCarpeta ? abierta : undefined}
        className={`relative flex w-full items-center gap-1.5 overflow-hidden rounded-md py-1.5 pr-2 text-left transition-colors ${esCarpeta ? "hover:bg-white/[0.06]" : "cursor-default"}`}
        style={{ paddingLeft: 8 + profundidad * 14 }}
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 bg-white/[0.05]"
          style={{ width: `${proporcion}%` }}
        />
        {esCarpeta ? (
          <ChevronRight
            className={`h-3 w-3 shrink-0 text-foreground/40 transition-transform duration-150 ${abierta ? "rotate-90" : ""}`}
          />
        ) : (
          <span className="w-3 shrink-0" />
        )}
        {esCarpeta ? (
          <Folder className="h-3.5 w-3.5 shrink-0 text-[color:var(--brand)]" />
        ) : (
          <File className="h-3.5 w-3.5 shrink-0 text-foreground/40" />
        )}
        <span className="relative min-w-0 flex-1 truncate text-[12px] text-foreground/85">
          {nodo.nombre}
        </span>
        <span className="relative shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
          {formatoBytes(nodo.bytes)}
        </span>
      </button>
      {esCarpeta && abierta && hijos.length > 0 && (
        <div>
          {ordenar(hijos, orden, locale).map((hijo) => (
            <Fila
              key={hijo.ruta}
              nodo={hijo}
              profundidad={profundidad + 1}
              maxHermano={Math.max(...hijos.map((h) => h.bytes), 1)}
              orden={orden}
              locale={locale}
              expandidos={expandidos}
              alternar={alternar}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Archivos() {
  const { t } = useIdioma();
  const locale = t("locale");
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [orden, setOrden] = useState<Orden>("peso");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  /* Una petición a la vez: en un proyecto grande leer el disco puede tardar
     más que el intervalo, y sin esto las peticiones se amontonarían. */
  const pidiendo = useRef(false);

  const cargar = useCallback(async () => {
    if (pidiendo.current) return;
    pidiendo.current = true;
    try {
      const res = await fetch(`${API}/archivos`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDatos((await res.json()) as Respuesta);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      pidiendo.current = false;
      setCargando(false);
    }
  }, []);

  /* Una foto nueva cada 8 s mientras la pestaña está abierta: un fichero que
     crece, o uno nuevo, aparece sin cerrar y abrir el panel. Al cambiar de
     pestaña el componente se desmonta y el intervalo se limpia. */
  useEffect(() => {
    void cargar();
    const id = window.setInterval(() => void cargar(), 8000);
    return () => window.clearInterval(id);
  }, [cargar]);

  const alternar = useCallback((ruta: string) => {
    setExpandidos((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(ruta)) siguiente.delete(ruta);
      else siguiente.add(ruta);
      return siguiente;
    });
  }, []);

  const maxRaiz = datos ? Math.max(...datos.arbol.map((n) => n.bytes), 1) : 1;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2">
        <p className="min-w-0 truncate text-[11px] text-muted-foreground">
          {datos ? (
            <>
              <span className="font-mono font-semibold text-foreground/80">
                {formatoBytes(datos.totalBytes)}
              </span>{" "}
              · {t("arch.ficheros")(datos.totalArchivos)}
            </>
          ) : (
            t("arch.leyendo")
          )}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setOrden((o) => (o === "peso" ? "nombre" : "peso"))}
            aria-label={orden === "peso" ? t("arch.porNombre") : t("arch.porPeso")}
            title={orden === "peso" ? t("arch.ordenadoPeso") : t("arch.ordenadoNombre")}
            className="grid h-6 w-6 place-items-center rounded-full text-foreground/60 transition-colors hover:bg-white/[0.08] hover:text-foreground"
          >
            {orden === "peso" ? (
              <ArrowDownWideNarrow className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownAZ className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={() => {
              setCargando(true);
              void cargar();
            }}
            aria-label={t("actualizar")}
            title={t("arch.actualizarAhora")}
            className="grid h-6 w-6 place-items-center rounded-full text-foreground/60 transition-colors hover:bg-white/[0.08] hover:text-foreground"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${cargando ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
        {/* Un fallo al refrescar no borra el árbol que ya había: se avisa
            encima y se sigue enseñando la última foto buena. */}
        {error && (
          <p className="px-2 py-3 text-[11.5px] leading-snug text-[#ff5470]">
            {t("arch.error")}: {error}
          </p>
        )}
        {datos?.recortado && (
          <p className="px-2 py-2 text-[11px] text-[#f5a623]">
            {t("arch.recortado")(datos.totalArchivos)}
          </p>
        )}
        {!datos && !error && (
          <p className="px-2 py-3 text-[11.5px] text-muted-foreground">{t("arch.leyendo")}</p>
        )}
        {datos && datos.arbol.length === 0 && (
          <p className="px-2 py-3 text-[11.5px] text-muted-foreground">{t("arch.vacio")}</p>
        )}
        {datos &&
          ordenar(datos.arbol, orden, locale).map((nodo) => (
            <Fila
              key={nodo.ruta}
              nodo={nodo}
              profundidad={0}
              maxHermano={maxRaiz}
              orden={orden}
              locale={locale}
              expandidos={expandidos}
              alternar={alternar}
            />
          ))}
      </div>
      <p className="shrink-0 border-t border-white/[0.06] px-4 py-2 text-[10.5px] leading-snug text-muted-foreground">
        {datos?.fuente === "disco" ? t("arch.fuenteDisco") : t("arch.fuenteGit")}
      </p>
    </div>
  );
}
