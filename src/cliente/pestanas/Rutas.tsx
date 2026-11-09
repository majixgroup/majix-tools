import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useIdioma } from "../idioma";

/* ---------------------------------------------------------------------- *
 * LA PESTAÑA "RUTAS" — lo que cualquier web expone sobre sus páginas
 *
 * No hay un router del que preguntar —MAJIX Tools funciona con cualquier
 * proyecto de Vite, no con un framework concreto—, así que se recogen las
 * dos fuentes que cualquier web tiene sin exponer nada propio:
 *
 *   1. Los enlaces internos que hay AHORA MISMO en la página.
 *   2. El sitemap.xml, si existe (también si es un índice de sitemaps).
 *
 * Los enlaces del propio panel no cuentan: viven en su Shadow DOM, y
 * `document.querySelectorAll` no entra ahí.
 * ---------------------------------------------------------------------- */

type Enlace = { ruta: string; veces: number; texto: string };

const MAX_SITEMAPS_HIJOS = 20;

function recogerEnlaces(): Enlace[] {
  const mapa = new Map<string, Enlace>();
  for (const a of document.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    let url: URL;
    try {
      url = new URL(a.href, window.location.origin);
    } catch {
      continue;
    }
    if (url.origin !== window.location.origin) continue;
    const ruta = url.pathname || "/";
    const existente = mapa.get(ruta);
    if (existente) existente.veces++;
    else mapa.set(ruta, { ruta, veces: 1, texto: a.textContent?.trim().slice(0, 60) || "" });
  }
  return [...mapa.values()].sort((a, b) => a.ruta.localeCompare(b.ruta));
}

async function leerXml(url: string): Promise<Document | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const doc = new DOMParser().parseFromString(await res.text(), "application/xml");
    return doc.querySelector("parsererror") ? null : doc;
  } catch {
    return null;
  }
}

const locs = (doc: Document, padre: string) =>
  [...doc.querySelectorAll(`${padre} > loc`)]
    .map((n) => n.textContent?.trim())
    .filter((u): u is string => !!u);

/* Un sitemap puede ser un ÍNDICE: sus <loc> no son páginas sino otros
   sitemaps. Se leen (hasta 20) y se juntan sus páginas; tomar los <loc> del
   índice como si fueran rutas sería listar ficheros .xml como páginas. */
async function recogerSitemap(): Promise<string[] | null> {
  const raiz = await leerXml("/sitemap.xml");
  if (!raiz) return null;
  if (raiz.documentElement.localName === "sitemapindex") {
    const hijos = locs(raiz, "sitemap").slice(0, MAX_SITEMAPS_HIJOS);
    const docs = await Promise.all(hijos.map((u) => leerXml(u)));
    const paginas = docs.flatMap((d) => (d ? locs(d, "url") : []));
    return paginas.length ? [...new Set(paginas)] : null;
  }
  const paginas = locs(raiz, "url");
  return paginas.length ? paginas : null;
}

export default function Rutas() {
  const { t } = useIdioma();
  const [enlaces, setEnlaces] = useState<Enlace[]>([]);
  const [sitemap, setSitemap] = useState<string[] | null | "cargando">("cargando");
  const [sub, setSub] = useState<"pagina" | "sitemap">("pagina");

  const actualizar = () => setEnlaces(recogerEnlaces());

  useEffect(() => {
    let vivo = true;
    actualizar();
    void recogerSitemap().then((s) => vivo && setSitemap(s));
    return () => {
      vivo = false;
    };
  }, []);

  const pestana = (id: "pagina" | "sitemap", texto: string, deshabilitada = false) => (
    <button
      role="tab"
      aria-selected={sub === id}
      disabled={deshabilitada}
      onClick={() => setSub(id)}
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-40 ${
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
          {pestana("pagina", `${t("rutas.pagina")}${enlaces.length ? ` (${enlaces.length})` : ""}`)}
          {pestana(
            "sitemap",
            `${t("rutas.sitemap")}${Array.isArray(sitemap) ? ` (${sitemap.length})` : ""}`,
            !Array.isArray(sitemap),
          )}
        </div>
        {sub === "pagina" && (
          <button
            onClick={actualizar}
            aria-label={t("actualizar")}
            title={t("actualizar")}
            className="grid h-6 w-6 place-items-center rounded-full text-foreground/50 transition-colors hover:bg-white/[0.08] hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {sub === "pagina" && (
        <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
          {enlaces.length === 0 ? (
            <p className="px-2 py-4 text-[11.5px] text-muted-foreground">{t("rutas.sinEnlaces")}</p>
          ) : (
            enlaces.map((e) => (
              <a
                key={e.ruta}
                href={e.ruta}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-white/[0.06]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[11.5px] text-foreground/85">
                    {e.ruta}
                  </span>
                  {e.texto && (
                    <span className="block truncate text-[10.5px] text-muted-foreground">
                      {e.texto}
                    </span>
                  )}
                </span>
                {e.veces > 1 && (
                  <span className="shrink-0 rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[9.5px] font-bold text-foreground/60">
                    ×{e.veces}
                  </span>
                )}
              </a>
            ))
          )}
        </div>
      )}

      {sub === "sitemap" && (
        <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
          {sitemap === "cargando" && (
            <p className="px-2 py-4 text-[11.5px] text-muted-foreground">{t("rutas.buscando")}</p>
          )}
          {sitemap === null && (
            <p className="px-2 py-4 text-[11.5px] text-muted-foreground">{t("rutas.sinSitemap")}</p>
          )}
          {Array.isArray(sitemap) &&
            sitemap.map((url) => {
              let ruta = url;
              try {
                ruta = new URL(url).pathname || "/";
              } catch {
                /* deja la URL completa si no se puede leer */
              }
              return (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-white/[0.06]"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-foreground/85">
                    {ruta}
                  </span>
                  <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                </a>
              );
            })}
        </div>
      )}

      <p className="shrink-0 border-t border-white/[0.06] px-4 py-2 text-[10.5px] leading-snug text-muted-foreground">
        {t("rutas.nota")}
      </p>
    </div>
  );
}
