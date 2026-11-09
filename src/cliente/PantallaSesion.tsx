import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, CircleAlert, ExternalLink, Copy, Loader2, ShieldCheck, WifiOff, X } from "lucide-react";
import { Logo } from "./logo";
import { useIdioma, type Clave } from "./idioma";
import { useSesion, type Sesion } from "./sesion";

/* ---------------------------------------------------------------------- *
 * LA PUERTA — iniciar sesión antes de usar MAJIX Tools
 *
 * MAJIX Tools es gratis pero necesita tu cuenta de MAJIX. Esta pantalla
 * ocupa el panel entero hasta que hay sesión: no hay un modo «sin cuenta».
 *
 * No pide contraseña. Enseña un código; lo confirmas en majixlab.com con tu
 * cuenta (ahí ves QUÉ se conecta antes de aprobarlo) y este panel se abre
 * solo. Al lado, la lista exacta de lo que sale de tu ordenador: la promesa
 * está a la vista ANTES de que la aceptes, no en una política aparte.
 * ---------------------------------------------------------------------- */

const CURVA = [0.16, 1, 0.3, 1] as const;

const SEGURO: Clave[] = ["sesion.seguro.1", "sesion.seguro.2", "sesion.seguro.3", "sesion.seguro.4"];

/** Solo se enlaza a la dirección del servidor de MAJIX al que habla el plugin. */
function enlaceSeguro(url: string, api: string): string | null {
  return url.startsWith(`${api}/`) ? url : null;
}

function Seguridad() {
  const { t } = useIdioma();
  return (
    <aside className="rounded-[16px] border border-white/[0.09] bg-white/[0.025] p-4">
      <p className="flex items-center gap-2 text-[12.5px] font-bold text-foreground">
        <ShieldCheck className="h-4 w-4 text-[#3ddc84]" aria-hidden />
        {t("sesion.seguro.titulo")}
      </p>
      <ul className="mt-3 space-y-2.5">
        {SEGURO.map((k, i) => (
          <li key={k} className="flex gap-2.5 text-[12px] leading-snug text-foreground/75">
            {i === 2 ? (
              <X className="mt-[2px] h-3.5 w-3.5 shrink-0 text-[#ff5470]" aria-hidden />
            ) : (
              <Check className="mt-[2px] h-3.5 w-3.5 shrink-0 text-[#3ddc84]" aria-hidden />
            )}
            <span>{t(k) as string}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function Letra({ c, i, reducido }: { c: string; i: number; reducido: boolean }) {
  return (
    <motion.span
      initial={reducido ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.05 * i, ease: CURVA }}
      className="grid h-[52px] w-[38px] place-items-center rounded-[11px] border border-white/[0.12] bg-black/35 font-mono text-[26px] font-bold text-foreground shadow-[inset_0_1px_0_0_rgb(255_255_255/10%)]"
    >
      {c}
    </motion.span>
  );
}

function Codigo({ sesion }: { sesion: Sesion }) {
  const { t } = useIdioma();
  const reducido = Boolean(useReducedMotion());
  const [copiado, setCopiado] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());
  const codigo = sesion.codigo!;

  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const restante = Math.max(0, Math.round((codigo.caducaEn - ahora) / 1000));
  const mmss = `${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, "0")}`;
  const enlace = enlaceSeguro(codigo.urlCompleta, sesion.api);
  const letras = codigo.usuario.replace("-", "").split("");

  return (
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[color:var(--brand-soft)]">
        {t("sesion.confirma")}
      </p>

      <ol className="mt-3 space-y-1.5 text-[12.5px] leading-snug text-foreground/75">
        {(["sesion.paso1", "sesion.paso2", "sesion.paso3"] as const).map((k, i) => (
          <li key={k} className="flex gap-2.5">
            <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-[color:var(--brand)]/22 font-mono text-[10.5px] font-bold text-[color:var(--brand-soft)]">
              {i + 1}
            </span>
            <span>{t(k) as string}</span>
          </li>
        ))}
      </ol>

      <div
        className="mt-5 flex items-center gap-2"
        role="group"
        aria-label={codigo.usuario.split("").join(" ")}
      >
        {letras.slice(0, 4).map((c, i) => (
          <Letra key={i} c={c} i={i} reducido={reducido} />
        ))}
        <span aria-hidden className="mx-0.5 h-[3px] w-3 rounded-full bg-white/25" />
        {letras.slice(4).map((c, i) => (
          <Letra key={i + 4} c={c} i={i + 4} reducido={reducido} />
        ))}
        <button
          onClick={() =>
            void navigator.clipboard?.writeText(codigo.usuario).then(() => {
              setCopiado(true);
              window.setTimeout(() => setCopiado(false), 1500);
            })
          }
          aria-label={t("sesion.copiar")}
          title={t("sesion.copiar")}
          className="ml-1 grid h-9 w-9 place-items-center rounded-lg text-foreground/55 transition-colors hover:bg-white/[0.08] hover:text-foreground"
        >
          {copiado ? <Check className="h-4 w-4 text-[#3ddc84]" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        {enlace && (
          <a
            href={enlace}
            target="_blank"
            rel="noreferrer"
            className="pulsable inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold text-white"
            style={{ background: "var(--brand)" }}
          >
            {t("sesion.abrir")} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        )}
      </div>

      <div className="mt-5 flex items-center gap-2 text-[12px] text-muted-foreground" aria-live="polite">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        <span>{t("sesion.esperando")}</span>
        <span aria-hidden>·</span>
        <span className="font-mono tabular-nums">{t("sesion.caduca")(mmss)}</span>
      </div>
      <div className="mt-2 h-[3px] w-full max-w-[300px] overflow-hidden rounded-full bg-white/[0.07]">
        <span
          className="block h-full origin-left rounded-full"
          style={{
            background: "linear-gradient(90deg, var(--brand), var(--brand-soft))",
            transform: `scaleX(${Math.min(1, restante / 600)})`,
            transition: "transform 1s linear",
          }}
        />
      </div>
    </div>
  );
}

export default function PantallaSesion() {
  const { t } = useIdioma();
  const { sesion, iniciar, cancelar, refrescar } = useSesion();
  const reducido = Boolean(useReducedMotion());
  const [pidiendo, setPidiendo] = useState(false);

  if (!sesion) {
    return (
      <div className="grid h-full place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      </div>
    );
  }

  const empezar = async () => {
    setPidiendo(true);
    await iniciar();
    setPidiendo(false);
  };

  const sinRed = sesion.estado === "sin-red";
  const esperando = sesion.estado === "esperando" && sesion.codigo;
  const motivo = sesion.motivo ? (`sesion.motivo.${sesion.motivo}` as Clave) : null;

  return (
    <div className="@container h-full overflow-y-auto">
      <div className="mx-auto grid max-w-[900px] gap-6 px-5 py-6 @[640px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] @[640px]:gap-8 @[640px]:py-9">
        <motion.div
          initial={reducido ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: CURVA }}
        >
          <div className="relative inline-block">
            <span aria-hidden className="halo-logo" />
            <Logo className="h-11 w-11" />
          </div>

          {esperando ? (
            <div className="mt-5">
              <Codigo sesion={sesion} />
              <button
                onClick={() => void cancelar()}
                className="mt-5 text-[12px] font-semibold text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {t("sesion.cancelar")}
              </button>
            </div>
          ) : sinRed ? (
            <>
              <h2 className="mt-5 flex items-center gap-2 text-[20px] font-bold tracking-[-0.02em] text-foreground">
                <WifiOff className="h-5 w-5 text-[#f59e5b]" aria-hidden />
                {t("sesion.sinRed.titulo")}
              </h2>
              <p className="mt-2 max-w-[44ch] text-[13px] leading-relaxed text-muted-foreground">
                {t("sesion.sinRed.texto")}
              </p>
              <button
                onClick={() => void refrescar()}
                className="pulsable mt-5 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold text-white"
                style={{ background: "var(--brand)" }}
              >
                {t("sesion.reintentar")}
              </button>
            </>
          ) : (
            <>
              <h2 className="mt-5 text-[22px] font-bold leading-tight tracking-[-0.02em] text-foreground">
                {t("sesion.titulo")}
              </h2>
              <p className="mt-2 max-w-[46ch] text-[13px] leading-relaxed text-muted-foreground">
                {t("sesion.texto")}
              </p>
              {motivo && (
                <p
                  role="status"
                  className="mt-4 flex max-w-[46ch] items-start gap-2 rounded-[12px] border border-[#f59e5b]/30 bg-[#f59e5b]/[0.07] px-3 py-2.5 text-[12px] leading-snug text-foreground/85"
                >
                  <CircleAlert className="mt-[1px] h-4 w-4 shrink-0 text-[#f59e5b]" aria-hidden />
                  {t(motivo) as string}
                </p>
              )}
              <button
                onClick={() => void empezar()}
                disabled={pidiendo}
                className="pulsable mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-70"
                style={{ background: "var(--brand)" }}
              >
                {pidiendo && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {pidiendo ? t("sesion.iniciando") : t("sesion.iniciar")}
              </button>
            </>
          )}
        </motion.div>

        <motion.div
          initial={reducido ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08, ease: CURVA }}
        >
          <Seguridad />
        </motion.div>
      </div>
    </div>
  );
}
