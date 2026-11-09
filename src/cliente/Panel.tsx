import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  BookOpen,
  FolderTree,
  Gauge,
  Globe2,
  LayoutDashboard,
  Linkedin,
  Lock,
  Maximize2,
  Minimize2,
  Route,
  Search,
  Terminal,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import Dashboard from "./pestanas/Dashboard";
import Rendimiento from "./pestanas/Rendimiento";
import SearchConsole from "./pestanas/SearchConsole";
import Archivos from "./pestanas/Archivos";
import ConsolaYRed from "./pestanas/ConsolaYRed";
import Rutas from "./pestanas/Rutas";
import OtrasWebs from "./pestanas/OtrasWebs";
import Cuenta from "./pestanas/Cuenta";
import PantallaSesion from "./PantallaSesion";
import { useSesion } from "./sesion";
import { COLOR_NIVEL, UMBRALES, nivelDe, peorNivel } from "./metricas";
import { useMetricas } from "./usar-metricas";
import { IconoX, Logo } from "./logo";
import { PROYECTO } from "./proyecto";
import { useIdioma, type Clave } from "./idioma";

/* ---------------------------------------------------------------------- *
 * EL PANEL
 *
 * Una ventana que se abre sobre el botón de abajo en el centro, con la
 * columna de herramientas a la izquierda y el contenido a la derecha. Tiene
 * dos tamaños —compacta y ampliada— y ninguno depende de la pestaña: una
 * herramienta que cambia de tamaño bajo el cursor no se siente profesional,
 * se siente rota.
 *
 * Todo se mueve solo con `transform` y `opacity`, las dos propiedades que
 * el navegador anima sin recalcular la página. Con "reducir movimiento"
 * activado en tu sistema, no se anima nada.
 * ---------------------------------------------------------------------- */

type PestanaId =
  | "dashboard"
  | "rendimiento"
  | "search-console"
  | "archivos"
  | "consola"
  | "rutas"
  | "otras-webs"
  | "cuenta";

const PESTANAS: { id: PestanaId; etiqueta: Clave; descripcion: Clave; Icono: LucideIcon }[] = [
  { id: "dashboard", etiqueta: "tab.dashboard", descripcion: "tab.dashboard.desc", Icono: LayoutDashboard },
  { id: "rendimiento", etiqueta: "tab.rendimiento", descripcion: "tab.rendimiento.desc", Icono: Gauge },
  { id: "search-console", etiqueta: "tab.searchConsole", descripcion: "tab.searchConsole.desc", Icono: Search },
  { id: "archivos", etiqueta: "tab.archivos", descripcion: "tab.archivos.desc", Icono: FolderTree },
  { id: "consola", etiqueta: "tab.consola", descripcion: "tab.consola.desc", Icono: Terminal },
  { id: "rutas", etiqueta: "tab.rutas", descripcion: "tab.rutas.desc", Icono: Route },
  { id: "otras-webs", etiqueta: "tab.otrasWebs", descripcion: "tab.otrasWebs.desc", Icono: Globe2 },
  { id: "cuenta", etiqueta: "tab.cuenta", descripcion: "tab.cuenta.desc", Icono: UserRound },
];

/* Curva de salida fuerte: arranca rápido y frena largo. */
const CURVA = [0.16, 1, 0.3, 1] as const;

const leer = (clave: string) => {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
};
const escribir = (clave: string, valor: string) => {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    /* sin almacenamiento: funciona igual, solo no se recuerda */
  }
};

/* ── LA PANTALLA DE CARGA ──
   Solo la PRIMERA vez que se abre en cada carga de la página: el logo, el
   nombre y la versión instalada. Después abre directamente — repetirla cada
   vez sería hacer esperar por decoración. */
function PantallaCarga({ reducido }: { reducido: boolean }) {
  return (
    <motion.div
      className="absolute inset-0 z-20 grid place-items-center"
      style={{ background: "var(--fondo)" }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35, ease: CURVA } }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--brand) 30%, transparent), transparent)",
        }}
      />
      <div className="relative flex flex-col items-center">
        <motion.div
          initial={reducido ? false : { scale: 0.6, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ duration: 0.6, ease: CURVA }}
          className="relative"
        >
          <span aria-hidden className="halo-logo" />
          <Logo className="h-16 w-16" />
        </motion.div>
        <motion.p
          initial={reducido ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.18, ease: CURVA }}
          className="mt-5 text-[22px] font-bold tracking-[-0.02em] text-foreground"
        >
          {PROYECTO.nombre}
        </motion.p>
        <motion.span
          initial={reducido ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.28, ease: CURVA }}
          className="mt-2 rounded-full border border-white/[0.12] bg-white/[0.05] px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[color:var(--brand-soft)]"
        >
          v{PROYECTO.version}
        </motion.span>
        <div className="mt-6 h-[3px] w-40 overflow-hidden rounded-full bg-white/[0.08]">
          <motion.span
            className="block h-full w-full origin-left rounded-full"
            style={{ background: "linear-gradient(90deg, var(--brand), var(--brand-soft))" }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: reducido ? 0.3 : 0.95, ease: [0.65, 0, 0.35, 1] }}
          />
        </div>
      </div>
    </motion.div>
  );
}

export default function Panel() {
  const { t, idioma, cambiar } = useIdioma();
  const [abierto, setAbierto] = useState(false);
  const [pestana, setPestana] = useState<PestanaId>(() => {
    const guardada = leer("majix-tools:pestana");
    return PESTANAS.some((p) => p.id === guardada) ? (guardada as PestanaId) : "dashboard";
  });
  const [cargando, setCargando] = useState(false);
  const [ampliado, setAmpliado] = useState(() => leer("majix-tools:ampliado") === "1");
  const yaCargado = useRef(false);
  const m = useMetricas();
  const { sesion } = useSesion();
  /* Sin sesión, el panel entero es la puerta de entrada: no hay herramientas que usar. */
  const conectada = sesion?.estado === "conectada";
  const reducido = Boolean(useReducedMotion());

  const elegir = (id: PestanaId) => {
    setPestana(id);
    escribir("majix-tools:pestana", id);
  };
  const alternarAmpliado = () =>
    setAmpliado((a) => {
      escribir("majix-tools:ampliado", a ? "0" : "1");
      return !a;
    });

  const general = peorNivel([
    m.soporte.lcp ? nivelDe(m.lcp, UMBRALES.lcp) : null,
    m.soporte.cls ? nivelDe(m.cls, UMBRALES.cls) : null,
    m.soporte.inp ? nivelDe(m.inp, UMBRALES.inp) : null,
  ]);
  const actual = PESTANAS.find((p) => p.id === pestana)!;

  const abrir = () => {
    setAbierto((a) => !a);
    if (!yaCargado.current) {
      yaCargado.current = true;
      setCargando(true);
    }
  };

  useEffect(() => {
    if (!cargando) return;
    const id = window.setTimeout(() => setCargando(false), reducido ? 450 : 1150);
    return () => window.clearTimeout(id);
  }, [cargando, reducido]);

  /* Escape cierra, como cualquier ventana que se respete. */
  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [abierto]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[2147483000] flex justify-center px-2">
      <div className="relative flex flex-col items-center">
        {/* ── LA VENTANA ──
            Solo existe mientras está abierta: cerrada no hay pestañas
            montadas, así que ninguna sigue pidiendo datos de fondo. */}
        <AnimatePresence>
          {abierto && (
            <motion.div
              role="dialog"
              aria-label={PROYECTO.nombre}
              className={`tarjeta-huella pointer-events-auto absolute bottom-[calc(100%+14px)] flex overflow-hidden rounded-[22px] ${
                ampliado
                  ? "h-[calc(100dvh-88px)] w-[min(calc(100vw-24px),1480px)]"
                  : "h-[min(74vh,560px)] w-[min(96vw,900px)]"
              }`}
              style={{ position: "absolute", transformOrigin: "50% 100%" }}
              initial={reducido ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                reducido
                  ? { opacity: 0, transition: { duration: 0.12 } }
                  : { opacity: 0, y: 10, scale: 0.98, transition: { duration: 0.18, ease: CURVA } }
              }
              transition={{ duration: 0.32, ease: CURVA }}
            >
              <span aria-hidden className="filo-superior" />

              <AnimatePresence>{cargando && <PantallaCarga reducido={reducido} />}</AnimatePresence>

              {/* ── LA COLUMNA DE HERRAMIENTAS ── */}
              <nav
                aria-label={t("panel.herramientas")}
                className="relative z-10 flex w-[56px] shrink-0 flex-col items-center gap-1 border-r border-white/[0.08] bg-black/25 py-3"
              >
                <a
                  href={PROYECTO.portada}
                  target="_blank"
                  rel="noreferrer"
                  className="mb-2 grid h-10 w-10 place-items-center rounded-xl transition-colors hover:bg-white/[0.06]"
                  aria-label={t("panel.irDocs")}
                >
                  <Logo className="h-6 w-6" />
                </a>
                <span aria-hidden className="mb-1 h-px w-7 bg-white/[0.08]" />
                {PESTANAS.map(({ id, etiqueta, Icono }) => {
                  const activa = pestana === id;
                  return (
                    <button
                      key={id}
                      onClick={() => elegir(id)}
                      disabled={!conectada}
                      aria-label={t(etiqueta) as string}
                      aria-current={activa && conectada ? "page" : undefined}
                      className={`group relative grid h-10 w-10 place-items-center rounded-xl ${
                        conectada ? "" : "cursor-not-allowed opacity-40"
                      }`}
                    >
                      {activa && conectada && (
                        <motion.span
                          layoutId="majix-tools-activa"
                          aria-hidden
                          className="absolute inset-0 rounded-xl border border-white/[0.1]"
                          style={{
                            background:
                              "linear-gradient(145deg, color-mix(in oklab, var(--brand) 32%, transparent), color-mix(in oklab, var(--brand) 12%, transparent))",
                          }}
                          transition={{ duration: reducido ? 0 : 0.35, ease: CURVA }}
                        />
                      )}
                      <Icono
                        className={`relative h-[18px] w-[18px] transition-colors duration-200 ${
                          activa
                            ? "text-[color:var(--brand-soft)]"
                            : "text-foreground/45 group-hover:text-foreground/85"
                        }`}
                      />
                      {/* El nombre, al pasar el ratón: una columna de iconos
                          sin etiquetas obliga a adivinar. En pantallas
                          táctiles no hay "pasar por encima": no se enseña. */}
                      <span
                        aria-hidden
                        className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-30 -translate-y-1/2 translate-x-[-4px] whitespace-nowrap rounded-lg border border-white/[0.1] bg-[#16131f] px-2.5 py-1 text-[11.5px] font-semibold text-foreground opacity-0 shadow-[0_10px_30px_-10px_rgb(0_0_0/80%)] transition-[opacity,transform] duration-200 group-hover:translate-x-0 group-hover:opacity-100 [@media(hover:none)]:hidden"
                      >
                        {t(etiqueta) as string}
                      </span>
                    </button>
                  );
                })}

                <div className="mt-auto flex flex-col items-center gap-1">
                  {(
                    [
                      [IconoX, PROYECTO.x, t("panel.enX")],
                      [Linkedin, PROYECTO.linkedin, t("panel.enLinkedin")],
                    ] as const
                  ).map(([Icono, href, etiqueta]) => (
                    <a
                      key={href}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={etiqueta}
                      className="grid h-8 w-8 place-items-center rounded-lg text-foreground/40 transition-colors hover:bg-white/[0.06] hover:text-foreground"
                    >
                      <Icono className="h-3.5 w-3.5" />
                    </a>
                  ))}
                </div>
              </nav>

              {/* ── EL CONTENIDO ── */}
              <div className="relative z-10 flex min-w-0 flex-1 flex-col">
                <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] px-4">
                  <div className="flex min-w-0 items-center gap-3">
                    {conectada ? (
                      <actual.Icono className="h-4 w-4 shrink-0 text-[color:var(--brand-soft)]" />
                    ) : (
                      <Lock className="h-4 w-4 shrink-0 text-[color:var(--brand-soft)]" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-bold leading-tight text-foreground">
                        {conectada ? (t(actual.etiqueta) as string) : t("sesion.iniciar")}
                      </p>
                      <p className="truncate text-[11px] leading-tight text-muted-foreground">
                        {conectada
                          ? (t(actual.descripcion) as string)
                          : sesion?.estado === "esperando"
                            ? t("sesion.esperando")
                            : t("sesion.cabecera")}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="hidden rounded-full border border-white/[0.1] bg-white/[0.04] px-2 py-0.5 font-mono text-[10.5px] font-semibold text-muted-foreground sm:inline">
                      v{PROYECTO.version}
                    </span>
                    <a
                      href={PROYECTO.docs}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={t("panel.documentacion")}
                      title={t("panel.documentacion")}
                      className="grid h-8 w-8 place-items-center rounded-lg text-foreground/55 transition-colors hover:bg-white/[0.07] hover:text-foreground"
                    >
                      <BookOpen className="h-4 w-4" />
                    </a>
                    <button
                      onClick={alternarAmpliado}
                      aria-label={ampliado ? t("panel.reducir") : t("panel.ampliar")}
                      title={ampliado ? t("panel.reducir") : t("panel.ampliar")}
                      aria-pressed={ampliado}
                      className="grid h-8 w-8 place-items-center rounded-lg text-foreground/55 transition-colors hover:bg-white/[0.07] hover:text-foreground"
                    >
                      {ampliado ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => setAbierto(false)}
                      aria-label={t("panel.cerrar")}
                      title={t("panel.cerrar")}
                      className="grid h-8 w-8 place-items-center rounded-lg text-foreground/55 transition-colors hover:bg-white/[0.07] hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </header>

                <div className="relative min-h-0 flex-1">
                  {!conectada ? (
                    <div className="absolute inset-0">
                      <PantallaSesion />
                    </div>
                  ) : (
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={pestana}
                      className="absolute inset-0"
                      initial={reducido ? false : { opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={reducido ? undefined : { opacity: 0, x: -10 }}
                      transition={{ duration: 0.18, ease: CURVA }}
                    >
                      {pestana === "dashboard" ? (
                        <Dashboard m={m} />
                      ) : pestana === "rendimiento" ? (
                        <Rendimiento m={m} />
                      ) : pestana === "search-console" ? (
                        <SearchConsole />
                      ) : pestana === "archivos" ? (
                        <Archivos />
                      ) : pestana === "consola" ? (
                        <ConsolaYRed />
                      ) : pestana === "rutas" ? (
                        <Rutas />
                      ) : pestana === "cuenta" ? (
                        <Cuenta />
                      ) : (
                        <OtrasWebs />
                      )}
                    </motion.div>
                  </AnimatePresence>
                  )}
                </div>

                <footer className="flex h-8 shrink-0 items-center justify-between gap-3 border-t border-white/[0.08] bg-black/20 px-4 text-[10.5px] text-muted-foreground">
                  <span className="flex min-w-0 items-center gap-1.5 truncate">
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: COLOR_NIVEL.bien }}
                    />
                    <span className="truncate">{t("panel.soloDesarrollo")}</span>
                  </span>
                  <div className="flex shrink-0 items-center gap-3">
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
                    <a
                      href={PROYECTO.web}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold transition-colors hover:text-foreground"
                    >
                      majixlab.com
                    </a>
                  </div>
                </footer>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── EL BOTÓN ──
            Una píldora con el logo, el LCP de la página y un punto con el
            peor nivel de las Core Web Vitals. Al pasar el ratón se enciende:
            un halo que solo cambia de OPACIDAD —se pinta una vez y el
            compositor lo funde— y un filete de luz alrededor. Con el panel
            abierto se queda encendido: dice qué ventana es la suya. */}
        <button
          onClick={abrir}
          aria-expanded={abierto}
          aria-label={abierto ? t("panel.cerrarPanel") : t("panel.abrir")}
          className="group pointer-events-auto relative"
        >
          <span
            aria-hidden
            className={`pointer-events-none absolute -inset-3 rounded-full blur-[14px] transition-opacity duration-300 group-hover:opacity-100 ${
              abierto ? "opacity-100" : "opacity-0"
            }`}
            style={{
              background:
                "radial-gradient(closest-side, color-mix(in oklab, var(--brand) 70%, transparent), transparent)",
            }}
          />
          <span className="tarjeta-huella pulsable flex h-10 items-center gap-2 rounded-full pl-2.5 pr-3.5">
            <span
              aria-hidden
              className={`pointer-events-none absolute inset-[-1px] rounded-full transition-opacity duration-300 group-hover:opacity-100 ${
                abierto ? "opacity-100" : "opacity-0"
              }`}
              style={{
                border: "1px solid var(--brand-soft)",
                boxShadow:
                  "0 0 0 3px color-mix(in oklab, var(--brand) 22%, transparent), 0 12px 34px -8px color-mix(in oklab, var(--brand) 75%, transparent)",
              }}
            />
            <Logo className="relative h-5 w-5" />
            {conectada ? (
              <span className="font-mono text-[12px] font-bold tabular-nums text-foreground/90">
                {!m.soporte.lcp || m.lcp == null ? "—" : `${m.lcp} ms`}
              </span>
            ) : (
              <Lock className="h-3.5 w-3.5 text-[color:var(--brand-soft)]" aria-hidden />
            )}
            {conectada && general && (
              <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{
                  background: COLOR_NIVEL[general],
                  boxShadow: `0 0 8px ${COLOR_NIVEL[general]}`,
                }}
              />
            )}
          </span>
        </button>
      </div>
    </div>
  );
}
