import { loadEnv, type Plugin, type ResolvedConfig } from "vite";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { enviarJson, leerCuerpoJson, permitido } from "../servidor/http";
import { leerProyecto } from "../servidor/archivos";
import { comprobarWeb } from "../servidor/comprobar-web";
import { credenciales, searchConsole } from "../servidor/search-console";
import { Cuenta, apiPermitida, API_POR_DEFECTO } from "../servidor/cuenta";
import { diasDeSearchConsole } from "../servidor/muestras";

/* ---------------------------------------------------------------------- *
 * EL PLUGIN DE VITE — `majix-tools/vite`
 *
 * Hace dos cosas, y solo mientras `vite` sirve en desarrollo
 * (`apply: "serve"`): en `vite build` este plugin ni se ejecuta, así que tu
 * web publicada no lleva ni un byte de MAJIX Tools.
 *
 *   1. Añade al servidor de desarrollo los endpoints que el navegador no
 *      puede hacer por sí mismo: leer tu disco, pedir otra web sin CORS y
 *      firmar con tu cuenta de servicio de Google. Viven en
 *      `/__majix-tools/api/*`, un prefijo que ninguna web usa.
 *
 *   2. En las webs con `index.html` (una SPA de Vite), inyecta el panel en
 *      el <head>. Las que se pintan en el servidor (TanStack Start, React
 *      Router, Remix…) no pasan por `index.html`: ahí el panel lo importa
 *      una línea que añade `npx majix-tools init`.
 *
 *   3. Guarda la sesión de tu cuenta de MAJIX (ver `servidor/cuenta.ts`). Sin
 *      sesión, los endpoints que leen tu disco, piden otras webs o usan tus
 *      claves de Google no responden: primero se inicia sesión. El token vive
 *      solo aquí, en el servidor de desarrollo: el navegador nunca lo ve.
 * ---------------------------------------------------------------------- */

declare const __MAJIX_TOOLS_VERSION__: string;

export type OpcionesMajixTools = {
  /**
   * Inyecta el panel en `index.html` automáticamente. Por defecto, `true`.
   * Ponlo a `false` si prefieres importarlo tú (`import("majix-tools/cliente")`).
   */
  inyectar?: boolean;
  /**
   * Deja usar los endpoints desde otros equipos de tu red (p. ej. si abres tu
   * web en el móvil con `vite --host`). Por defecto, `false`: solo desde este
   * ordenador. Actívalo solo en redes de confianza: da acceso de lectura al
   * árbol de tu proyecto y a tus datos de Search Console.
   */
  red?: boolean;
  /** Alias en inglés de `inyectar`. */
  inject?: boolean;
  /** Alias en inglés de `red`. */
  network?: boolean;
};

const PREFIJO = "/__majix-tools/";

/** El `name` de tu package.json: es el nombre con el que tu web aparece en tu panel de MAJIX. */
async function nombreDelProyecto(raiz: string): Promise<string | null> {
  try {
    const j = JSON.parse(await readFile(join(raiz, "package.json"), "utf8")) as { name?: unknown };
    return typeof j.name === "string" && j.name.trim() ? j.name.trim() : null;
  } catch {
    return null;
  }
}

export function majixTools(opcionesDadas: OpcionesMajixTools = {}): Plugin {
  /* Cada opción tiene su nombre en español y un alias en inglés; si vienen
     los dos, manda el español. */
  const opciones = {
    inyectar: opcionesDadas.inyectar ?? opcionesDadas.inject ?? true,
    red: opcionesDadas.red ?? opcionesDadas.network ?? false,
  };
  let config: ResolvedConfig;
  let env: Record<string, string> = {};
  let cuenta: Cuenta | null = null;
  let nombreProyecto: string | null = null;
  let ultimaSc = 0;

  return {
    name: "majix-tools",
    apply: "serve",
    enforce: "pre",

    /* El panel ya viene empaquetado y sin dependencias (lleva React dentro):
       Vite no tiene nada que pre-empaquetar. Excluirlo evita, además, que
       Vite lo descubra al pedirlo el navegador y recargue la página una vez
       ("new dependencies optimized"), y conserva la ruta
       /majix-tools/dist/ que el grabador de red usa para no contar las
       peticiones del propio panel. */
    config: () => ({ optimizeDeps: { exclude: ["majix-tools"] } }),

    async configResolved(c) {
      config = c;
      nombreProyecto = await nombreDelProyecto(c.root);
      /* Solo las variables MAJIX_TOOLS_*: el plugin no lee nada más de tu
         .env. Vite reinicia el servidor cuando cambia un .env, así que
         basta con guardar el fichero. */
      env = c.envDir === false ? {} : loadEnv(c.mode, c.envDir || c.root, "MAJIX_TOOLS_");
      for (const [k, v] of Object.entries(process.env)) {
        if (k.startsWith("MAJIX_TOOLS_") && v !== undefined && !(k in env)) env[k] = v;
      }
    },

    configureServer(server) {
      /* La cuenta: una sesión por proyecto. El servidor de MAJIX solo se puede cambiar con una variable del
         PROCESO (no del .env del proyecto: un .env ajeno no puede mandar tu token a otro sitio), y solo a
         majixlab.com o a localhost. */
      cuenta = new Cuenta({
        api: apiPermitida(process.env.MAJIX_TOOLS_API) ?? API_POR_DEFECTO,
        raiz: config.root,
        version: __MAJIX_TOOLS_VERSION__,
        etiqueta: nombreProyecto ?? undefined,
      });
      void cuenta.arrancar().catch(() => {});
      const programa = setInterval(() => void sincronizarSearchConsole(), 10 * 60 * 1000);
      programa.unref?.();
      server.httpServer?.once("close", () => {
        clearInterval(programa);
        cuenta?.parar();
      });

      const sincronizarSearchConsole = async () => {
        if (!cuenta?.permiteSearchConsole) return;
        if (Date.now() - ultimaSc < 6 * 60 * 60 * 1000) return;
        if (credenciales(env).falta.length) return;
        ultimaSc = Date.now();
        const dias = diasDeSearchConsole(await searchConsole(env, "90"));
        if (dias.length) await cuenta.enviarSearchConsole(dias);
      };

      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "";
        if (!url.startsWith(PREFIJO)) return next();

        const { pathname, searchParams } = new URL(url, "http://majix-tools.localhost");
        const metodo = req.method ?? "GET";
        const escritura = metodo === "POST";
        const acceso = {
          red: opciones.red,
          hostsPermitidos: server.config.server.allowedHosts ?? [],
        };
        if (!permitido(req, acceso, escritura)) return enviarJson(res, 403, { codigo: "prohibido" });
        if (metodo !== "GET" && metodo !== "POST") return enviarJson(res, 405, { codigo: "metodo" });
        const c = cuenta;
        if (!c) return enviarJson(res, 503, { codigo: "arrancando" });

        /* Lo que lee tu disco, pide otras webs o usa tus claves exige sesión. */
        const exigeSesion = () => {
          if (c.conectada) return true;
          enviarJson(res, 401, { codigo: "sesion", sesion: c.instantanea() });
          return false;
        };
        const soloGet = () => {
          if (metodo === "GET") return true;
          enviarJson(res, 405, { codigo: "metodo" });
          return false;
        };
        const soloPost = () => {
          if (metodo === "POST") return true;
          enviarJson(res, 405, { codigo: "metodo" });
          return false;
        };

        try {
          switch (pathname) {
            case `${PREFIJO}api/sesion`:
              if (!soloGet()) return;
              return enviarJson(res, 200, c.instantanea());
            case `${PREFIJO}api/sesion/iniciar`:
              if (!soloPost()) return;
              return enviarJson(res, 200, await c.iniciar());
            case `${PREFIJO}api/sesion/cancelar`:
              if (!soloPost()) return;
              return enviarJson(res, 200, c.cancelar());
            case `${PREFIJO}api/sesion/refrescar`:
              if (!soloPost()) return;
              return enviarJson(res, 200, await c.validar());
            case `${PREFIJO}api/sesion/cerrar`:
              if (!soloPost()) return;
              return enviarJson(res, 200, await c.cerrar());
            case `${PREFIJO}api/bitacora`:
              if (!soloGet()) return;
              return enviarJson(res, 200, c.bitacora());
            case `${PREFIJO}api/muestras`: {
              if (!soloPost()) return;
              if (!c.conectada) return enviarJson(res, 401, { codigo: "sesion" });
              const cuerpo = await leerCuerpoJson(req);
              if (cuerpo === null || typeof cuerpo !== "object") return enviarJson(res, 400, { codigo: "formato" });
              if (!c.permiteEnVivo) return enviarJson(res, 403, { codigo: "plan", requiere: "plus" });
              const r = await c.enviarMuestras((cuerpo as { muestras?: unknown }).muestras);
              return enviarJson(res, r.http === 200 ? 200 : r.http === 0 ? 502 : r.http, {
                ok: r.http === 200,
                aceptadas: r.aceptadas,
              });
            }
            case `${PREFIJO}api/archivos`:
              if (!soloGet() || !exigeSesion()) return;
              return enviarJson(res, 200, await leerProyecto(config.root));
            case `${PREFIJO}api/comprobar-web`: {
              if (!soloGet() || !exigeSesion()) return;
              const r = await comprobarWeb(searchParams.get("url"));
              return enviarJson(res, r.estado, r.cuerpo);
            }
            case `${PREFIJO}api/search-console`: {
              if (!soloGet() || !exigeSesion()) return;
              /* Search Console es de los planes de pago: con el plan Libre no se consulta nada. */
              if (!c.permiteSearchConsole) {
                return enviarJson(res, 403, { codigo: "plan", requiere: "plus", sesion: c.instantanea() });
              }
              const datos = await searchConsole(env, searchParams.get("dias"));
              /* Lo que ya se ha pedido a Google se aprovecha para el panel de MAJIX: ni una llamada más. */
              const dias = diasDeSearchConsole(datos);
              if (dias.length) {
                ultimaSc = Date.now();
                void c.enviarSearchConsole(dias);
              }
              return enviarJson(res, 200, datos);
            }
            /* Lo usa `npx majix-tools doctor` para comprobar que el plugin
               está vivo. No devuelve ningún secreto: solo si faltan. */
            case `${PREFIJO}api/estado`:
              if (!soloGet()) return;
              return enviarJson(res, 200, {
                ok: true,
                version: __MAJIX_TOOLS_VERSION__,
                raiz: config.root,
                inyecta: opciones.inyectar,
                red: opciones.red,
                searchConsole: { falta: credenciales(env).falta },
                sesion: { estado: c.instantanea().estado, plan: c.plan },
              });
            default:
              return enviarJson(res, 404, { codigo: "no-existe" });
          }
        } catch (e) {
          config.logger.error(`[majix-tools] ${e instanceof Error ? e.stack : String(e)}`);
          return enviarJson(res, 500, { codigo: "interno" });
        }
      });

      server.httpServer?.once("listening", () => {
        setTimeout(() => {
          /* En el idioma de tu terminal, como la CLI. */
          const es = (process.env.LC_ALL ?? process.env.LANG ?? "").toLowerCase().startsWith("es");
          const texto = es
            ? "el panel está abajo en el centro de tu web"
            : "the panel is at the bottom centre of your site";
          config.logger.info(
            `  \x1b[35m➜\x1b[0m  \x1b[1mMAJIX Tools\x1b[0m v${__MAJIX_TOOLS_VERSION__}: ${texto}`,
          );
        }, 0);
      });
    },

    transformIndexHtml() {
      if (!opciones.inyectar) return;
      return [
        /* El navegador guarda como mucho 250 peticiones hasta que alguien
           las observa, y Vite pide más que eso antes de que llegue el panel.
           Esta línea, la primera del <head>, amplía ese margen. */
        {
          tag: "script",
          children: "performance.setResourceTimingBufferSize&&performance.setResourceTimingBufferSize(5000)",
          injectTo: "head-prepend",
        },
        {
          tag: "script",
          attrs: { type: "module", src: "/@id/majix-tools/cliente" },
          injectTo: "head-prepend",
        },
      ];
    },
  };
}

export default majixTools;
