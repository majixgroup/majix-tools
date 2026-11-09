import { useState, type FormEvent } from "react";
import { AlertCircle, Check, ChevronDown, Loader2, Radar, ShieldCheck, X as XIcon } from "lucide-react";
import { API } from "../proyecto";
import { useIdioma, type Clave } from "../idioma";

/* ---------------------------------------------------------------------- *
 * LA PESTAÑA "OTRAS WEBS" — un informe HTTP real de cualquier dirección
 *
 * El servidor de desarrollo pide la web (ver `src/servidor/comprobar-web.ts`)
 * y devuelve: tiempo de respuesta, cabeceras de seguridad, compresión, peso y
 * un vistazo al HTML. No es un Lighthouse, y lo dice: no mide el LCP ni el
 * CLS de esa web. Lo que no se puede saber sale como "—".
 * ---------------------------------------------------------------------- */

type Seguridad = {
  hsts: boolean;
  csp: boolean;
  xContentTypeOptions: boolean;
  xFrameOptions: boolean;
  referrerPolicy: boolean;
  permissionsPolicy: boolean;
};

type Resultado = {
  solicitada: string;
  urlFinal: string;
  redirigida: boolean;
  estado: number;
  ok: boolean;
  tiempoMs: number;
  servidor: string | null;
  tipoContenido: string | null;
  comprimido: boolean;
  codificacion: string | null;
  tamanoTransferidoBytes: number | null;
  tamanoDescomprimidoBytes: number | null;
  cabeceras: Record<string, string>;
  seguridad: Seguridad;
  html: {
    titulo: string | null;
    scripts: number;
    imagenes: number;
    imagenesConLazy: number;
    hojasEstilo: number;
    tieneViewport: boolean;
    tieneCharset: boolean;
  } | null;
};

const CODIGOS_ERROR = [
  "falta-url",
  "url-invalida",
  "protocolo",
  "red-privada",
  "tiempo",
  "sin-conexion",
  "redirecciones",
  "dns",
] as const;

const SEGURIDAD: [keyof Seguridad, string | null][] = [
  ["hsts", "Strict-Transport-Security"],
  ["csp", "Content-Security-Policy"],
  ["xContentTypeOptions", "X-Content-Type-Options"],
  ["xFrameOptions", null],
  ["referrerPolicy", "Referrer-Policy"],
  ["permissionsPolicy", "Permissions-Policy"],
];

function formatoBytes(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function colorEstado(estado: number): string {
  if (estado >= 500) return "#ff5470";
  if (estado >= 400) return "#f5a623";
  if (estado >= 200 && estado < 300) return "#3ddc84";
  return "#8b8b96";
}

function colorTiempo(ms: number): string {
  if (ms <= 400) return "#3ddc84";
  if (ms <= 1200) return "#f5a623";
  return "#ff5470";
}

function Metrica({ etiqueta, valor, color }: { etiqueta: string; valor: string; color?: string }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {etiqueta}
      </p>
      <p className="mt-0.5 truncate font-mono text-[15px] font-bold tabular-nums" style={{ color }}>
        {valor}
      </p>
    </div>
  );
}

function Marca({ si }: { si: boolean }) {
  return si ? (
    <Check className="h-3.5 w-3.5 shrink-0 text-[#3ddc84]" />
  ) : (
    <XIcon className="h-3.5 w-3.5 shrink-0 text-[#ff5470]" />
  );
}

export default function OtrasWebs() {
  const { t } = useIdioma();
  const [entrada, setEntrada] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [verCabeceras, setVerCabeceras] = useState(false);

  const analizar = async (e: FormEvent) => {
    e.preventDefault();
    const url = entrada.trim();
    if (!url || cargando) return;
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`${API}/comprobar-web?url=${encodeURIComponent(url)}`);
      const datos = (await res.json()) as Resultado | { codigo: string };
      if (!res.ok || "codigo" in datos) {
        const codigo = "codigo" in datos ? datos.codigo : "";
        setError(
          (CODIGOS_ERROR as readonly string[]).includes(codigo)
            ? (t(`web.err.${codigo}` as Clave) as string)
            : t("web.err.generico"),
        );
        setResultado(null);
      } else {
        setResultado(datos);
        setVerCabeceras(false);
      }
    } catch {
      setError(t("web.err.generico"));
      setResultado(null);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <form
        onSubmit={analizar}
        className="flex items-center gap-1.5 border-b border-white/[0.06] px-3 py-2.5"
      >
        <input
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          placeholder={t("web.placeholder")}
          aria-label="URL"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-md border border-white/[0.09] bg-white/[0.03] px-2.5 py-1.5 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 focus:border-[color:var(--brand-soft)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={cargando || !entrada.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity disabled:opacity-40"
          style={{ background: "var(--brand)" }}
        >
          {cargando ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Radar className="h-3.5 w-3.5" />
          )}
          {t("web.analizar")}
        </button>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && (
          <p className="flex items-start gap-2 px-4 py-3 text-[11.5px] leading-snug text-[#ff5470]">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}

        {!error && !resultado && !cargando && (
          <p className="px-4 py-6 text-center text-[11.5px] leading-snug text-muted-foreground">
            {t("web.intro")}
          </p>
        )}

        {resultado && (
          <div className="px-3 py-3">
            <div className="mb-3 flex items-center gap-2">
              <span
                className="shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold text-white"
                style={{ background: colorEstado(resultado.estado) }}
              >
                {resultado.estado}
              </span>
              <a
                href={resultado.urlFinal}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-foreground/85 hover:underline"
              >
                {resultado.urlFinal}
              </a>
            </div>
            {resultado.redirigida && (
              <p className="mb-3 text-[10.5px] text-muted-foreground">
                {t("web.redirigida")(resultado.solicitada)}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Metrica
                etiqueta={t("web.respuesta")}
                valor={`${resultado.tiempoMs} ms`}
                color={colorTiempo(resultado.tiempoMs)}
              />
              <Metrica
                etiqueta={t("web.peso")}
                valor={formatoBytes(resultado.tamanoTransferidoBytes)}
              />
              <Metrica
                etiqueta={t("web.compresion")}
                valor={resultado.comprimido ? (resultado.codificacion ?? t("web.si")) : t("web.no")}
                color={resultado.comprimido ? "#3ddc84" : "#f5a623"}
              />
              <Metrica etiqueta={t("web.servidor")} valor={resultado.servidor ?? "—"} />
            </div>

            <p className="mb-1.5 mt-4 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <ShieldCheck className="h-3 w-3" /> {t("web.seguridad")}
            </p>
            <div className="divide-y divide-white/[0.05] rounded-lg border border-white/[0.06]">
              {SEGURIDAD.map(([clave, nombre]) => (
                <div key={clave} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                  <span className="text-[11px] text-foreground/80">{nombre ?? t("web.iframes")}</span>
                  <Marca si={resultado.seguridad[clave]} />
                </div>
              ))}
            </div>

            {resultado.html && (
              <>
                <p className="mb-1.5 mt-4 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {t("web.pagina")}
                </p>
                <div className="space-y-1 rounded-lg border border-white/[0.06] px-2.5 py-2 text-[11px] text-foreground/80">
                  {resultado.html.titulo && (
                    <p className="truncate">
                      <span className="text-muted-foreground">{t("web.tituloPagina")}</span>
                      {resultado.html.titulo}
                    </p>
                  )}
                  <p>
                    {t("web.resumen")(
                      resultado.html.scripts,
                      resultado.html.hojasEstilo,
                      resultado.html.imagenes,
                    )}
                    {resultado.html.imagenes > 0 && t("web.lazy")(resultado.html.imagenesConLazy)}
                  </p>
                  <p className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Marca si={resultado.html.tieneViewport} /> viewport
                    </span>
                    <span className="flex items-center gap-1">
                      <Marca si={resultado.html.tieneCharset} /> charset
                    </span>
                  </p>
                </div>
              </>
            )}

            <button
              onClick={() => setVerCabeceras((v) => !v)}
              aria-expanded={verCabeceras}
              className="mt-4 flex w-full items-center justify-between rounded-lg border border-white/[0.06] px-2.5 py-2 text-[11px] font-semibold text-foreground/70 hover:text-foreground"
            >
              {t("web.cabeceras")(Object.keys(resultado.cabeceras).length)}
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${verCabeceras ? "rotate-180" : ""}`}
              />
            </button>
            {verCabeceras && (
              <div className="mt-1.5 space-y-1 rounded-lg bg-black/20 p-2.5 font-mono text-[10.5px] leading-relaxed text-foreground/70">
                {Object.entries(resultado.cabeceras).map(([clave, valor]) => (
                  <p key={clave} className="break-all">
                    <span className="text-[color:var(--brand-soft)]">{clave}</span>: {valor}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <p className="shrink-0 border-t border-white/[0.06] px-4 py-2 text-[10.5px] leading-snug text-muted-foreground">
        {t("web.nota")}
      </p>
    </div>
  );
}
