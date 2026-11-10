import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Check,
  CircleAlert,
  Copy,
  ExternalLink,
  Loader2,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { Logo } from "./logo";
import { useIdioma, type Clave } from "./idioma";
import { PROYECTO } from "./proyecto";
import { useSesion, type Sesion } from "./sesion";

/* ---------------------------------------------------------------------- *
 * LA PUERTA — iniciar sesión ANTES de ver nada
 *
 * MAJIX Tools es gratis pero necesita tu cuenta de MAJIX. Sin sesión no hay
 * panel, ni botón, ni menú: al cargar la web aparece esta pantalla —el logo,
 * «Iniciar sesión» y un botón— y nada más.
 *
 *   1. Pulsas «Iniciar sesión»: se pide un código y SE ABRE SOLA la página de
 *      MAJIX (`majixlab.com/devtool/conectar?codigo=…`) en otra pestaña.
 *   2. Allí inicias sesión con tu cuenta; la página te enseña el código y qué
 *      se va a conectar. Pulsas «Conectar».
 *   3. Esta pantalla lo detecta sola y se abre el panel. Nunca se escribe una
 *      contraseña aquí.
 *
 * Cubre toda la ventana mientras no haya sesión (el login es obligatorio).
 * ---------------------------------------------------------------------- */

const CURVA = [0.16, 1, 0.3, 1] as const;

/** Solo se enlaza a la dirección del servidor de MAJIX al que habla el plugin. */
function enlaceSeguro(
  url: string | undefined,
  api: string | undefined,
): string | null {
  return url && api && url.startsWith(`${api}/`) ? url : null;
}

/* Sin animación de entrada a propósito: en cuanto se abre la pestaña de MAJIX, esta queda en segundo plano y el
   navegador pausa las animaciones; un código a medio dibujar al volver sería peor que no animarlo. */
function Letra({ c }: { c: string }) {
  return (
    <span className="grid h-[58px] w-[42px] place-items-center rounded-[12px] border border-white/[0.12] bg-black/35 font-mono text-[29px] font-bold text-foreground shadow-[inset_0_1px_0_0_rgb(255_255_255/10%)]">
      {c}
    </span>
  );
}

function Codigo({
  sesion,
  bloqueada,
  alAbrir,
}: {
  sesion: Sesion;
  bloqueada: boolean;
  alAbrir: () => void;
}) {
  const { t } = useIdioma();
  const [copiado, setCopiado] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());
  const codigo = sesion.codigo!;

  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const restante = Math.max(0, Math.round((codigo.caducaEn - ahora) / 1000));
  const mmss = `${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, "0")}`;
  const letras = codigo.usuario.replace("-", "").split("");

  return (
    <div className="mt-8 flex flex-col items-center">
      <div
        className="flex items-center gap-2"
        role="group"
        aria-label={codigo.usuario.split("").join(" ")}
      >
        {letras.slice(0, 4).map((c, i) => (
          <Letra key={i} c={c} />
        ))}
        <span
          aria-hidden
          className="mx-1 h-[3px] w-3.5 rounded-full bg-white/25"
        />
        {letras.slice(4).map((c, i) => (
          <Letra key={i + 4} c={c} />
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
          className="ml-1 grid h-10 w-10 place-items-center rounded-lg text-foreground/55 transition-colors hover:bg-white/[0.08] hover:text-foreground"
        >
          {copiado ? (
            <Check className="h-4 w-4 text-[#3ddc84]" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>

      <p
        role="status"
        className="mt-6 max-w-[48ch] text-center text-[14px] leading-relaxed text-foreground/80"
      >
        {bloqueada ? t("puerta.bloqueada") : t("puerta.abierta")}
      </p>

      <button
        onClick={alAbrir}
        className="pulsable mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13.5px] font-semibold text-white"
        style={{
          background: bloqueada ? "var(--brand)" : "rgb(255 255 255 / 9%)",
        }}
      >
        {bloqueada ? t("sesion.abrir") : t("puerta.abrirDeNuevo")}
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </button>

      <div
        className="mt-6 flex items-center gap-2 text-[12px] text-muted-foreground"
        aria-live="polite"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        <span>{t("sesion.esperando")}</span>
        <span aria-hidden>·</span>
        <span className="font-mono tabular-nums">
          {t("sesion.caduca")(mmss)}
        </span>
      </div>
      <div className="mt-2 h-[3px] w-full max-w-[300px] overflow-hidden rounded-full bg-white/[0.07]">
        <span
          className="block h-full origin-left rounded-full"
          style={{
            background:
              "linear-gradient(90deg, var(--brand), var(--brand-soft))",
            transform: `scaleX(${Math.min(1, restante / 600)})`,
            transition: "transform 1s linear",
          }}
        />
      </div>
    </div>
  );
}

export default function PantallaSesion() {
  const { t, idioma, cambiar } = useIdioma();
  const { sesion, iniciar, cancelar, refrescar } = useSesion();
  const reducido = Boolean(useReducedMotion());
  const [pidiendo, setPidiendo] = useState(false);
  const [bloqueada, setBloqueada] = useState(false);

  /* Mientras la puerta está puesta, la página de detrás no se desplaza. */
  useEffect(() => {
    const html = document.documentElement;
    const antes = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = antes;
    };
  }, []);

  if (!sesion) return null;

  /** Vuelve a abrir majixlab.com/devtool/conectar con el código ya puesto (desde un clic: siempre se permite). */
  const abrirDeNuevo = (url: string | null) => {
    if (!url) return;
    window.open(url, "_blank", "noopener");
    setBloqueada(false);
  };

  const empezar = async () => {
    setPidiendo(true);
    /* La pestaña se abre YA, dentro del gesto del clic (si no, el navegador la bloquea), y se dirige al enlace
       cuando llega el código. */
    let ventana: Window | null = null;
    try {
      ventana = window.open("about:blank", "_blank");
      if (ventana) ventana.opener = null;
    } catch {
      ventana = null;
    }
    const s = await iniciar();
    setPidiendo(false);
    const url = enlaceSeguro(s?.codigo?.urlCompleta, s?.api);
    if (url && ventana) {
      ventana.location.href = url;
      setBloqueada(false);
    } else {
      ventana?.close();
      setBloqueada(true);
    }
  };

  const sinRed = sesion.estado === "sin-red";
  const esperando =
    sesion.estado === "esperando" && sesion.codigo ? sesion : null;
  const motivo = sesion.motivo
    ? (`sesion.motivo.${sesion.motivo}` as Clave)
    : null;
  const urlCodigo = esperando
    ? enlaceSeguro(esperando.codigo!.urlCompleta, esperando.api)
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={PROYECTO.nombre}
      className="tarjeta-huella pointer-events-auto z-[2147483647] grid place-items-center overflow-y-auto"
      /* `tarjeta-huella` fija `position: relative`: se vuelve a poner `fixed` aquí para cubrir toda la ventana. */
      style={{
        position: "fixed",
        inset: 0,
        border: 0,
        borderRadius: 0,
        boxShadow: "none",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[42%] h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--brand) 30%, transparent), transparent)",
        }}
      />

      <motion.main
        initial={reducido ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: CURVA }}
        className="relative flex w-full max-w-[640px] flex-col items-center px-6 py-16 text-center"
      >
        <div className="relative">
          <span aria-hidden className="halo-logo" />
          <Logo className="h-20 w-20" />
        </div>

        <h1 className="mt-8 text-[clamp(30px,5vw,44px)] font-bold leading-[1.05] tracking-[-0.03em] text-foreground">
          {t("sesion.iniciar")}
        </h1>

        {esperando ? (
          <>
            <Codigo
              sesion={esperando}
              bloqueada={bloqueada}
              alAbrir={() => abrirDeNuevo(urlCodigo)}
            />
            <button
              onClick={() => void cancelar()}
              className="mt-7 text-[12.5px] font-semibold text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              {t("sesion.cancelar")}
            </button>
          </>
        ) : sinRed ? (
          <>
            <p className="mt-6 flex items-center gap-2 text-[16px] font-semibold text-foreground">
              <WifiOff className="h-5 w-5 text-[#f59e5b]" aria-hidden />
              {t("sesion.sinRed.titulo")}
            </p>
            <p className="mt-2 max-w-[46ch] text-[14px] leading-relaxed text-muted-foreground">
              {t("sesion.sinRed.texto")}
            </p>
            <button
              onClick={() => void refrescar()}
              className="pulsable mt-7 inline-flex items-center rounded-full px-6 py-3 text-[14.5px] font-semibold text-white"
              style={{ background: "var(--brand)" }}
            >
              {t("sesion.reintentar")}
            </button>
          </>
        ) : (
          <>
            <p className="mt-4 max-w-[40ch] text-[15px] leading-relaxed text-muted-foreground">
              {t("puerta.texto")}
            </p>
            {motivo && (
              <p
                role="status"
                className="mt-5 flex max-w-[46ch] items-start gap-2 rounded-[12px] border border-[#f59e5b]/30 bg-[#f59e5b]/[0.07] px-3.5 py-2.5 text-left text-[12.5px] leading-snug text-foreground/85"
              >
                <CircleAlert
                  className="mt-[1px] h-4 w-4 shrink-0 text-[#f59e5b]"
                  aria-hidden
                />
                {t(motivo) as string}
              </p>
            )}
            <button
              onClick={() => void empezar()}
              disabled={pidiendo}
              autoFocus
              className="pulsable mt-8 inline-flex items-center gap-2.5 rounded-full px-8 py-3.5 text-[15.5px] font-semibold text-white disabled:opacity-70"
              style={{ background: "var(--brand)" }}
            >
              {pidiendo && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              )}
              {pidiendo ? t("sesion.iniciando") : t("sesion.iniciar")}
            </button>
          </>
        )}

        <footer className="mt-14 flex flex-col items-center gap-2 text-[11.5px] text-muted-foreground">
          <a
            href={`${PROYECTO.docs}/como-funciona/privacidad`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-semibold transition-colors hover:text-foreground"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-[#3ddc84]" aria-hidden />
            {t("puerta.datos")}
          </a>
          <span className="font-mono">{t("puerta.quitar")}</span>
          <div className="mt-1 flex items-center gap-3">
            <span className="font-mono">v{PROYECTO.version}</span>
            <div
              role="group"
              aria-label={t("panel.idioma")}
              className="flex overflow-hidden rounded-full border border-white/[0.1]"
            >
              {(["es", "en"] as const).map((i) => (
                <button
                  key={i}
                  onClick={() => cambiar(i)}
                  aria-pressed={idioma === i}
                  className={`px-1.5 font-mono text-[9.5px] font-bold uppercase leading-[16px] transition-colors ${
                    idioma === i
                      ? "bg-white/[0.1] text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
        </footer>
      </motion.main>
    </div>
  );
}
