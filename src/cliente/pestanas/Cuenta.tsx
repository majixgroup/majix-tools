import { useEffect, useState } from "react";
import { CircleAlert, ExternalLink, Loader2, LogOut, RefreshCw, ShieldCheck, WifiOff } from "lucide-react";
import type { EntradaBitacora } from "../../servidor/cuenta";
import { API, PROYECTO } from "../proyecto";
import { useIdioma, type Clave } from "../idioma";
import { useSesion } from "../sesion";

/* ---------------------------------------------------------------------- *
 * LA PESTAÑA "CUENTA" — tu sesión, tu plan y, sobre todo, lo que se envía
 *
 * Lo más importante de esta pantalla es la lista de abajo: cada vez que
 * MAJIX Tools habla con MAJIX queda anotado aquí, con la hora, lo que era y
 * lo que salió exactamente. Si algún día quieres comprobar la promesa de
 * «no sale nada más», no tienes que creerla: la ves.
 * ---------------------------------------------------------------------- */

type Bitacora = { entradas: EntradaBitacora[]; ultimas: Record<string, string> };

const PLAN_CLAVE = {
  libre: "cuenta.plan.libre",
  plus: "cuenta.plan.plus",
  pro: "cuenta.plan.pro",
} as const satisfies Record<string, Clave>;

/* Libre, neutro; Plus, el violeta de la casa; Pro, el único con oro («el oro es solo para lo mejor»). */
const ESTILO_PLAN = {
  libre: { fondo: "rgb(255 255 255 / 7%)", borde: "rgb(255 255 255 / 14%)", texto: "rgb(255 255 255 / 75%)" },
  plus: { fondo: "color-mix(in oklab, var(--brand) 24%, transparent)", borde: "color-mix(in oklab, var(--brand-soft) 55%, transparent)", texto: "var(--brand-soft)" },
  pro: { fondo: "rgb(245 197 66 / 14%)", borde: "rgb(245 197 66 / 55%)", texto: "#f5c542" },
} as const;

export default function Cuenta() {
  const { t, idioma } = useIdioma();
  const { sesion, cerrar, refrescar } = useSesion();
  const [bitacora, setBitacora] = useState<Bitacora | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const [comprobando, setComprobando] = useState(false);

  useEffect(() => {
    let vivo = true;
    const leer = async () => {
      try {
        const r = await fetch(`${API}/bitacora`, { cache: "no-store" });
        if (r.ok && vivo) setBitacora((await r.json()) as Bitacora);
      } catch {
        /* sin servidor: se queda lo último */
      }
    };
    void leer();
    const id = window.setInterval(() => void leer(), 3000);
    return () => {
      vivo = false;
      window.clearInterval(id);
    };
  }, []);

  if (!sesion || !sesion.plan) {
    return (
      <div className="grid h-full place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      </div>
    );
  }

  const plan = sesion.plan;
  const estilo = ESTILO_PLAN[plan];
  const hora = (x: number) =>
    new Date(x).toLocaleTimeString(t("locale"), { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const ultimo = bitacora?.ultimas.muestras ?? bitacora?.ultimas["search-console"] ?? null;
  const envios = (bitacora?.entradas ?? []).filter((e) => e.accion !== "sondear").slice(0, 12);
  const inicial = (sesion.correo ?? "?").slice(0, 1).toUpperCase();

  return (
    <div className="@container h-full overflow-y-auto p-4">
      <div className="grid gap-2.5 @[640px]:grid-cols-2">
        {/* ── TU SESIÓN ── */}
        <section className="rounded-[16px] border border-white/[0.08] bg-white/[0.025] p-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/[0.14] text-[17px] font-bold text-foreground"
              style={{ background: "linear-gradient(145deg, color-mix(in oklab, var(--brand) 40%, transparent), color-mix(in oklab, var(--brand) 12%, transparent))" }}
            >
              {inicial}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">{t("cuenta.conectadaComo")}</p>
              <p className="truncate font-mono text-[13.5px] font-bold text-foreground">
                {sesion.correo ?? "—"}
              </p>
            </div>
          </div>
          <dl className="mt-4 space-y-2 text-[12px]">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t("cuenta.web")}</dt>
              <dd className="truncate font-mono font-semibold text-foreground/90">{sesion.etiqueta}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t("cuenta.dominio")}</dt>
              <dd className="truncate font-mono font-semibold text-foreground/90">
                {sesion.dominio ?? t("cuenta.sinDominio")}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">MAJIX Tools</dt>
              <dd className="font-mono font-semibold text-foreground/90">v{PROYECTO.version}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={PROYECTO.panel}
              target="_blank"
              rel="noreferrer"
              className="pulsable inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-white"
              style={{ background: "var(--brand)" }}
            >
              {t("cuenta.abrirPanel")} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
            <button
              onClick={async () => {
                setCerrando(true);
                await cerrar();
                setCerrando(false);
              }}
              disabled={cerrando}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] px-3.5 py-1.5 text-[12px] font-semibold text-foreground/80 transition-colors hover:bg-white/[0.07] hover:text-foreground disabled:opacity-60"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              {cerrando ? t("cuenta.cerrando") : t("cuenta.cerrarSesion")}
            </button>
          </div>
        </section>

        {/* ── TU PLAN ── */}
        <section className="rounded-[16px] border border-white/[0.08] bg-white/[0.025] p-4">
          <p className="text-[11px] text-muted-foreground">{t("cuenta.plan")}</p>
          <div className="mt-1.5 flex items-center gap-2.5">
            <span
              className="rounded-full border px-3 py-0.5 text-[15px] font-bold"
              style={{ background: estilo.fondo, borderColor: estilo.borde, color: estilo.texto }}
            >
              {t(PLAN_CLAVE[plan])}
            </span>
          </div>
          <p className="mt-3 text-[12.5px] leading-snug text-foreground/80">
            {t("cuenta.limites")(sesion.webs ?? 1, sesion.diasHistorial ?? 7, sesion.searchConsole, sesion.enVivo)}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={PROYECTO.planes}
              target="_blank"
              rel="noreferrer"
              className="pulsable inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-white"
              style={{ background: plan === "pro" ? "rgb(255 255 255 / 12%)" : "var(--brand)" }}
            >
              {plan === "pro" ? t("cuenta.verPlanes") : t("cuenta.mejorar")}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
            <button
              onClick={async () => {
                setComprobando(true);
                await refrescar();
                setComprobando(false);
              }}
              disabled={comprobando}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] px-3.5 py-1.5 text-[12px] font-semibold text-foreground/80 transition-colors hover:bg-white/[0.07] hover:text-foreground disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${comprobando ? "animate-spin" : ""}`} aria-hidden />
              {t("cuenta.comprobar")}
            </button>
          </div>
        </section>
      </div>

      {!sesion.enVivo && (
        <p
          role="status"
          className="mt-2.5 flex items-start gap-2 rounded-[12px] border border-white/[0.12] bg-white/[0.04] px-3 py-2.5 text-[12px] leading-snug text-foreground/80"
        >
          <ShieldCheck className="mt-[1px] h-4 w-4 shrink-0 text-[#3ddc84]" aria-hidden />
          {t("cuenta.soloLocal")}
        </p>
      )}
      {sesion.envio.fueraDePlan && (
        <p role="status" className="mt-2.5 flex items-start gap-2 rounded-[12px] border border-[#f59e5b]/30 bg-[#f59e5b]/[0.07] px-3 py-2.5 text-[12px] leading-snug text-foreground/85">
          <CircleAlert className="mt-[1px] h-4 w-4 shrink-0 text-[#f59e5b]" aria-hidden />
          {t("cuenta.fueraDePlan")}
        </p>
      )}
      {sesion.sinRed && (
        <p role="status" className="mt-2.5 flex items-start gap-2 rounded-[12px] border border-white/[0.12] bg-white/[0.04] px-3 py-2.5 text-[12px] leading-snug text-foreground/80">
          <WifiOff className="mt-[1px] h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          {t("cuenta.sinRed")}
        </p>
      )}

      {/* ── LO QUE SE HA ENVIADO ── */}
      <section className="mt-2.5 rounded-[16px] border border-white/[0.08] bg-white/[0.025] p-4">
        <h3 className="flex items-center gap-2 text-[13.5px] font-bold text-foreground">
          <ShieldCheck className="h-4 w-4 text-[#3ddc84]" aria-hidden />
          {t("cuenta.enviado.titulo")}
        </h3>
        <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">{t("cuenta.enviado.texto")}</p>

        {envios.length === 0 ? (
          <p className="mt-4 rounded-[12px] border border-dashed border-white/[0.1] px-4 py-5 text-center text-[12px] text-muted-foreground">
            {sesion.enVivo ? t("cuenta.enviado.vacio") : t("cuenta.enviado.vacioLocal")}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[460px] text-left text-[11.5px]">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1 pr-3 font-semibold">{t("cuenta.col.hora")}</th>
                  <th className="py-1 pr-3 font-semibold">{t("cuenta.col.que")}</th>
                  <th className="py-1 pr-3 font-semibold">{t("cuenta.col.resultado")}</th>
                  <th className="py-1 text-right font-semibold">{t("cuenta.col.bytes")}</th>
                </tr>
              </thead>
              <tbody>
                {envios.map((e, i) => (
                  <tr key={`${e.t}-${i}`} className="border-t border-white/[0.06]">
                    <td className="py-1.5 pr-3 font-mono tabular-nums text-foreground/70">{hora(e.t)}</td>
                    <td className="max-w-[260px] truncate py-1.5 pr-3 text-foreground/85" title={e.resumen}>
                      {e.resumen}
                    </td>
                    <td className="py-1.5 pr-3">
                      <span style={{ color: e.ok ? "#3ddc84" : "#ff5470" }} className="font-semibold">
                        {e.ok ? t("cuenta.ok") : t("cuenta.fallo")(e.http)}
                      </span>
                    </td>
                    <td className="py-1.5 text-right font-mono tabular-nums text-foreground/70">{e.bytes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {ultimo && (
          <div className="mt-4">
            <p className="text-[11px] font-semibold text-muted-foreground">{t("cuenta.ultimo")}</p>
            <pre
              lang={idioma}
              className="mt-1.5 max-h-[180px] overflow-auto rounded-[12px] border border-white/[0.09] bg-[#0d0b18] p-3 font-mono text-[11px] leading-[1.6] text-foreground/80"
            >
              {formatear(ultimo)}
            </pre>
          </div>
        )}
      </section>
    </div>
  );
}

/** El JSON tal cual salió, con sangría para poder leerlo. Si está recortado, se enseña tal cual. */
function formatear(crudo: string): string {
  try {
    return JSON.stringify(JSON.parse(crudo), null, 2);
  } catch {
    return crudo;
  }
}
