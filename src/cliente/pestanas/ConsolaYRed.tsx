import { useState, useSyncExternalStore } from "react";
import { AlertCircle, AlertTriangle, Trash2 } from "lucide-react";
import {
  instantaneaConsola,
  instantaneaRed,
  limpiarConsola,
  limpiarRed,
  suscribirse,
  type EntradaConsola,
  type EntradaRed,
} from "../monitor";
import { useIdioma } from "../idioma";

/* ---------------------------------------------------------------------- *
 * LA PESTAÑA "CONSOLA Y RED" — errores capturados y peticiones recientes
 *
 * Los datos ya existen: los reúne `monitor.ts` desde antes de que se abra
 * el panel. Aquí solo se leen con `useSyncExternalStore`, la forma correcta
 * de leer un estado externo que cambia sin avisar.
 * ---------------------------------------------------------------------- */

type Sub = "consola" | "red";

function formatoBytes(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function colorEstado(estado: number | null): string {
  if (estado == null) return "text-muted-foreground";
  if (estado >= 500) return "text-[#ff5470]";
  if (estado >= 400) return "text-[#f5a623]";
  if (estado >= 200) return "text-[#3ddc84]";
  return "text-muted-foreground";
}

function FilaConsola({ e }: { e: EntradaConsola }) {
  const { t } = useIdioma();
  const Icono = e.nivel === "error" ? AlertCircle : AlertTriangle;
  const color = e.nivel === "error" ? "#ff5470" : "#f5a623";
  return (
    <div className="flex items-start gap-2 border-b border-white/[0.05] px-3 py-2 last:border-0">
      <Icono className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color }} />
      <p className="min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-[11px] leading-snug text-foreground/85">
        {e.origen === "promesa" && t("cons.promesa")}
        {e.origen === "excepcion" && t("cons.excepcion")}
        {e.mensaje || t("cons.sinMensaje")}
      </p>
      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
        {(e.cuando / 1000).toFixed(1)}s
      </span>
    </div>
  );
}

function FilaRed({ e }: { e: EntradaRed }) {
  let ruta = e.url;
  try {
    const u = new URL(e.url);
    ruta = (u.origin === window.location.origin ? "" : u.host) + u.pathname + u.search;
  } catch {
    /* URL rara: se deja tal cual. */
  }
  return (
    <div className="flex items-center gap-2 border-b border-white/[0.05] px-3 py-1.5 last:border-0">
      <span
        className={`w-8 shrink-0 font-mono text-[10.5px] font-bold tabular-nums ${colorEstado(e.estado)}`}
      >
        {e.estado ?? "—"}
      </span>
      <span
        className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground/80"
        title={e.url}
      >
        {ruta}
      </span>
      <span className="shrink-0 text-[10px] text-muted-foreground">{e.tipo}</span>
      <span className="w-12 shrink-0 text-right font-mono text-[10.5px] tabular-nums text-muted-foreground">
        {e.duracionMs} ms
      </span>
      <span className="w-14 shrink-0 text-right font-mono text-[10.5px] tabular-nums text-muted-foreground">
        {formatoBytes(e.bytes)}
      </span>
    </div>
  );
}

export default function ConsolaYRed() {
  const { t } = useIdioma();
  const [sub, setSub] = useState<Sub>("consola");
  const consola = useSyncExternalStore(suscribirse, instantaneaConsola);
  const red = useSyncExternalStore(suscribirse, instantaneaRed);

  const errores = consola.filter((e) => e.nivel === "error").length;
  const avisos = consola.length - errores;

  const pestana = (id: Sub, texto: string) => (
    <button
      role="tab"
      aria-selected={sub === id}
      onClick={() => setSub(id)}
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
        sub === id ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground/80"
      }`}
    >
      {texto}
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2">
        <div role="tablist" className="flex gap-1">
          {pestana("consola", `${t("cons.consola")}${consola.length ? ` (${consola.length})` : ""}`)}
          {pestana("red", `${t("cons.red")}${red.length ? ` (${red.length})` : ""}`)}
        </div>
        <button
          onClick={() => (sub === "consola" ? limpiarConsola() : limpiarRed())}
          aria-label={t("limpiar")}
          title={t("limpiar")}
          className="grid h-6 w-6 place-items-center rounded-full text-foreground/50 transition-colors hover:bg-white/[0.08] hover:text-foreground"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {sub === "consola" && (
        <>
          {consola.length > 0 && (
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-3 py-1.5 text-[10.5px]">
              {errores > 0 && (
                <span className="flex items-center gap-1 font-semibold text-[#ff5470]">
                  <AlertCircle className="h-3 w-3" /> {t("cons.errores")(errores)}
                </span>
              )}
              {avisos > 0 && (
                <span className="flex items-center gap-1 font-semibold text-[#f5a623]">
                  <AlertTriangle className="h-3 w-3" /> {t("cons.avisos")(avisos)}
                </span>
              )}
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {consola.length === 0 ? (
              <p className="px-3 py-4 text-[11.5px] text-muted-foreground">{t("cons.vacia")}</p>
            ) : (
              consola.map((e) => <FilaConsola key={e.id} e={e} />)
            )}
          </div>
        </>
      )}

      {sub === "red" && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {red.length === 0 ? (
            <p className="px-3 py-4 text-[11.5px] text-muted-foreground">{t("cons.redVacia")}</p>
          ) : (
            red.map((e) => <FilaRed key={e.id} e={e} />)
          )}
        </div>
      )}

      <p className="shrink-0 border-t border-white/[0.06] px-4 py-2 text-[10.5px] leading-snug text-muted-foreground">
        {t("cons.nota")}
      </p>
    </div>
  );
}
