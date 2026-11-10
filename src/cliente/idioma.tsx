import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/* ---------------------------------------------------------------------- *
 * LOS IDIOMAS DEL PANEL
 *
 * Español e inglés. El panel elige solo, en este orden:
 *   1. lo que eligieras con el botón ES/EN de la barra de abajo (se recuerda
 *      en este navegador);
 *   2. el idioma de tu web (`<html lang="…">`);
 *   3. el idioma de tu navegador.
 *
 * `en` se declara con el MISMO tipo que `es`: si falta un texto en inglés,
 * el paquete no compila. Un panel medio traducido no llega a publicarse.
 * ---------------------------------------------------------------------- */

export type Idioma = "es" | "en";

const es = {
  locale: "es-ES",

  // ── Panel ──
  "panel.abrir": "Abrir MAJIX Tools",
  "panel.cerrarPanel": "Cerrar MAJIX Tools",
  "panel.herramientas": "Herramientas",
  "panel.irDocs": "MAJIX Tools — documentación",
  "panel.documentacion": "Documentación",
  "panel.ampliar": "Pantalla completa",
  "panel.reducir": "Reducir",
  "panel.cerrar": "Cerrar",
  "panel.soloDesarrollo": "Solo en desarrollo · 0 bytes en la web publicada",
  "panel.idioma": "Idioma del panel",
  "panel.enX": "MAJIX en X",
  "panel.enLinkedin": "MAJIX en LinkedIn",

  "tab.dashboard": "Dashboard",
  "tab.dashboard.desc":
    "Vista general: puntuaciones, evolución y rendimiento por página",
  "tab.rendimiento": "Rendimiento",
  "tab.rendimiento.desc":
    "Core Web Vitals y fotogramas de esta página, en vivo",
  "tab.searchConsole": "Search Console",
  "tab.searchConsole.desc":
    "Clics, impresiones, CTR y posición de tu web en Google",
  "tab.archivos": "Archivos",
  "tab.archivos.desc": "El árbol del proyecto con el peso real de cada fichero",
  "tab.consola": "Consola y red",
  "tab.consola.desc": "Errores, avisos y peticiones capturados en esta página",
  "tab.rutas": "Rutas",
  "tab.rutas.desc": "Enlaces internos de la página y el sitemap.xml",
  "tab.otrasWebs": "Otras webs",
  "tab.otrasWebs.desc":
    "Informe HTTP real de cualquier web: respuesta, seguridad, peso",

  // ── Niveles ──
  "nivel.bien": "Bueno",
  "nivel.mejorable": "Mejorable",
  "nivel.mal": "Malo",
  "nivel.esperando": "Esperando…",
  "nivel.noSoportado": "No disponible",
  noSoportado: "Tu navegador no lo mide (prueba en Chrome o Edge)",

  // ── Comunes ──
  actualizar: "Actualizar",
  limpiar: "Limpiar",
  reintentar: "Reintentar",
  ahora: "Ahora",
  copiar: "Copiar",

  // ── Dashboard ──
  "dash.titulo": "Dashboard",
  "dash.soloEsta": "Esta carga",
  "dash.conAnteriores": (n: number) =>
    n === 1
      ? "Esta carga y la anterior, guardadas en este navegador"
      : `Esta carga y las ${n} anteriores, guardadas en este navegador`,
  "dash.conAnterioresRecorte": (visibles: number, total: number) =>
    `Esta carga y las ${visibles} anteriores (de ${total} guardadas en este navegador)`,
  "dash.curva": "puntuación con la curva de Lighthouse",
  "dash.borrar": "Borrar historial",
  "dash.kpi.lcp": "LCP · carga",
  "dash.kpi.cls": "CLS · estabilidad",
  "dash.kpi.inp": "INP · respuesta",
  "dash.kpi.ttfb": "TTFB · servidor",
  "dash.rendimientoWeb": "Rendimiento web",
  "dash.redPorCarga": "Red por carga",
  "dash.peticiones": "Peticiones",
  "dash.errores": "Errores",
  "dash.cantidad": "cantidad",
  "dash.vacio":
    "Cada carga de página deja una muestra cuando la ocultas: al recargar, al cambiar de pestaña o al cerrarla. Recarga un par de veces y la evolución aparece aquí.",
  "dash.trafico": "Tráfico",
  "dash.porPagina": "Rendimiento por página",
  "dash.porPagina.nota":
    "LCP medio por página de entrada, de tu historial local.",
  "dash.ga4.titulo": "Conecta Google Analytics",
  "dash.ga4.texto":
    "Usuarios, sesiones y canales (orgánico, directo, social, de pago) de tu propiedad GA4.",
  "dash.proximamente": "Llega en la próxima versión",

  // ── Rendimiento ──
  "rend.veredicto": "Core Web Vitals de esta página",
  "rend.veredicto.desc":
    "LCP, CLS e INP — las tres que usa Google para puntuar la experiencia.",
  "rend.lcp": "Pintado del contenido principal",
  "rend.cls": "Peor ráfaga de saltos de maquetación",
  "rend.inp": "Interacción más lenta (p98)",
  "rend.inp.sin": "Sin interacciones todavía",
  "rend.ttfb": "Primer byte del servidor",
  "rend.fps": "Fotogramas por segundo, en vivo",
  "rend.largos": "Fotogramas largos",
  "rend.bloqueo": (ms: number) => `${ms} ms de bloqueo del hilo principal`,
  "rend.nota":
    "Umbrales oficiales de web.dev: LCP ≤ 2,5 s, CLS ≤ 0,1, INP ≤ 200 ms, TTFB ≤ 800 ms. El LCP solo cuenta mientras la pestaña está visible, el CLS es la peor ráfaga de saltos (ventanas de hasta 5 s) y el INP no existe hasta la primera interacción.",

  // ── Search Console ──
  "gsc.consultando": "Consultando Search Console…",
  "gsc.conecta": "Conecta Search Console",
  "gsc.faltan": "Faltan",
  "gsc.lasCredenciales": "las credenciales",
  "gsc.intro":
    "Son cuatro pasos y solo se hacen una vez. Las credenciales se quedan en tu ordenador: la clave privada no llega nunca al navegador.",
  "gsc.paso1":
    "En Google Cloud Console, crea un proyecto (o usa uno) y activa la «Google Search Console API».",
  "gsc.paso2":
    "En «IAM y administración → Cuentas de servicio», crea una cuenta de servicio y descarga una clave en formato JSON.",
  "gsc.paso3":
    "En Search Console, abre tu propiedad → Ajustes → Usuarios y permisos → Añadir usuario, y pega el correo de la cuenta de servicio (con permiso «Restringido» basta: solo lee).",
  "gsc.paso4":
    "Copia client_email y private_key del JSON a tu .env, junto con tu propiedad, y reinicia el servidor de desarrollo.",
  "gsc.comprobar": "Comprobar de nuevo",
  "gsc.titulo": "Rendimiento en Google",
  "gsc.provisional": (fecha: string) => `provisional desde el ${fecha}`,
  "gsc.7": "7 días",
  "gsc.28": "28 días",
  "gsc.90": "3 meses",
  "gsc.clics": "Clics totales",
  "gsc.impresiones": "Impresiones totales",
  "gsc.ctr": "CTR medio",
  "gsc.posicion": "Posición media",
  "gsc.col.clics": "Clics",
  "gsc.col.impresiones": "Impresiones",
  "gsc.col.ctr": "CTR",
  "gsc.col.posicion": "Posición",
  "gsc.consultas": "Consultas",
  "gsc.paginas": "Páginas",
  "gsc.paises": "Países",
  "gsc.dispositivos": "Dispositivos",
  "gsc.DESKTOP": "Ordenador",
  "gsc.MOBILE": "Móvil",
  "gsc.TABLET": "Tablet",
  "gsc.sinDatosPropiedad":
    "Google todavía no tiene datos de esta propiedad para este periodo.",
  "gsc.sinDatos": "Sin datos en este periodo.",
  "gsc.nota":
    "Datos de la API oficial de Search Console, incluidos los más recientes: Google tarda unos días en consolidarlos, así que los últimos pueden cambiar todavía. El periodo termina ayer.",
  "gsc.err.servidor":
    "El servidor de desarrollo no respondió con datos. Comprueba que sigue arrancado y vuelve a intentarlo.",
  "gsc.err.clave":
    "La clave privada no tiene un formato válido. Copia el valor de private_key del JSON tal cual, entre comillas y con sus \\n, incluidas las líneas BEGIN y END.",
  "gsc.err.credenciales": (detalle: string) =>
    `Google no aceptó las credenciales (${detalle}). Revisa el correo y la clave privada de la cuenta de servicio.`,
  "gsc.err.acceso": (sitio: string) =>
    `La cuenta de servicio no tiene acceso a «${sitio}». Añádela como usuario de la propiedad en Search Console (Ajustes → Usuarios y permisos). Si es una propiedad de dominio, el valor debe empezar por sc-domain:.`,
  "gsc.err.google": (estado: number, detalle: string) =>
    `Search Console respondió ${estado}: ${detalle}`,
  "gsc.err.red":
    "No se pudo contactar con Google. Comprueba tu conexión a internet.",

  // ── Archivos ──
  "arch.ficheros": (n: number) => `${n.toLocaleString("es-ES")} ficheros`,
  "arch.porNombre": "Ordenar por nombre",
  "arch.porPeso": "Ordenar por peso",
  "arch.ordenadoPeso": "Ordenado por peso",
  "arch.ordenadoNombre": "Ordenado por nombre",
  "arch.actualizarAhora": "Actualizar ahora",
  "arch.error": "No se pudo leer el proyecto",
  "arch.leyendo": "Leyendo el proyecto…",
  "arch.vacio": "No se encontró nada que mostrar.",
  "arch.fuenteGit":
    "Lo que git no ignora de tu proyecto, leído del disco por el servidor de desarrollo.",
  "arch.fuenteDisco":
    "Tu proyecto leído del disco por el servidor de desarrollo (sin dependencias, builds ni secretos).",
  "arch.recortado": (n: number) =>
    `Proyecto muy grande: se muestran los primeros ${n.toLocaleString("es-ES")} ficheros.`,

  // ── Consola y red ──
  "cons.consola": "Consola",
  "cons.red": "Red",
  "cons.errores": (n: number) => `${n} ${n === 1 ? "error" : "errores"}`,
  "cons.avisos": (n: number) => `${n} ${n === 1 ? "aviso" : "avisos"}`,
  "cons.sinMensaje": "(sin mensaje)",
  "cons.promesa": "Promesa rechazada sin catch: ",
  "cons.excepcion": "Excepción sin capturar: ",
  "cons.vacia": "Sin errores ni avisos de momento.",
  "cons.redVacia": "Sin peticiones registradas todavía.",
  "cons.nota":
    "La consola se captura desde que MAJIX Tools se carga en la página; la red, desde el primer byte gracias a buffered.",

  // ── Rutas ──
  "rutas.pagina": "En esta página",
  "rutas.sitemap": "Sitemap",
  "rutas.sinEnlaces": "No se encontraron enlaces internos en esta página.",
  "rutas.buscando": "Buscando sitemap.xml…",
  "rutas.sinSitemap": "No hay sitemap.xml en esta web.",
  "rutas.nota":
    "Enlaces del DOM y sitemap.xml: sin un router del que leer, esto es lo que cualquier web expone.",

  // ── Otras webs ──
  "web.placeholder": "ejemplo.com",
  "web.analizar": "Analizar",
  "web.intro":
    "Pon la dirección de cualquier web y pide un informe real: tiempo de respuesta, cabeceras de seguridad, compresión y peso.",
  "web.redirigida": (desde: string) => `Redirigida desde ${desde}`,
  "web.respuesta": "Respuesta",
  "web.peso": "Peso transferido",
  "web.compresion": "Compresión",
  "web.servidor": "Servidor",
  "web.si": "sí",
  "web.no": "no",
  "web.seguridad": "Cabeceras de seguridad",
  "web.iframes": "Protección contra iframes ajenos",
  "web.pagina": "Página",
  "web.tituloPagina": "Título: ",
  "web.resumen": (s: number, h: number, i: number) =>
    `${s} scripts · ${h} hojas de estilo · ${i} imágenes`,
  "web.lazy": (n: number) => ` (${n} con carga diferida)`,
  "web.cabeceras": (n: number) => `Todas las cabeceras (${n})`,
  "web.nota":
    "Petición real del servidor a la web que pongas — no es Lighthouse: no mide LCP/CLS de esa web, solo lo que da una petición HTTP.",
  "web.err.falta-url": "Falta la URL a comprobar.",
  "web.err.url-invalida": "Esa URL no es válida.",
  "web.err.protocolo": "Solo se aceptan direcciones http:// o https://.",
  "web.err.red-privada":
    "Esa dirección apunta a una red local o privada — no se comprueba.",
  "web.err.tiempo": "La web no respondió en 10 segundos.",
  "web.err.sin-conexion": "No se pudo conectar con esa dirección.",
  "web.err.redirecciones": "Demasiadas redirecciones (más de 5).",
  "web.err.dns": "Ese dominio no existe o no se pudo resolver.",
  "web.err.generico": "No se pudo completar la comprobación.",

  // ── Cuenta de MAJIX (inicio de sesión obligatorio) ──
  "tab.cuenta": "Cuenta",
  "tab.cuenta.desc": "Sesión, plan y registro de lo que se envía a MAJIX",
  "sesion.cabecera": "Se requiere una cuenta de MAJIX",
  "sesion.titulo": "Inicia sesión para usar MAJIX Tools",
  "sesion.texto":
    "MAJIX Tools es gratuito y requiere una cuenta de MAJIX. La contraseña no se introduce aquí: la autorización se realiza en majixlab.com mediante un código de un solo uso.",
  "sesion.iniciar": "Iniciar sesión",
  "sesion.iniciando": "Solicitando el código…",
  "sesion.confirma": "Confirma este código en majixlab.com",
  "sesion.abrir": "Abrir majixlab.com/conectar",
  "sesion.copiar": "Copiar código",
  "sesion.paso1": "Abre la dirección con tu cuenta de MAJIX.",
  "sesion.paso2":
    "Verifica que el código mostrado coincide con el de esta pantalla.",
  "sesion.paso3":
    "Selecciona «Conectar». Este panel se activará automáticamente.",
  "sesion.caduca": (mmss: string) => `El código caduca en ${mmss}`,
  "sesion.cancelar": "Cancelar",
  "sesion.esperando": "Esperando la autorización…",
  "sesion.motivo.denegada":
    "La conexión fue denegada. Si no fue intencionada, inicia sesión de nuevo.",
  "sesion.motivo.expirada": "El código ha caducado. Solicita uno nuevo.",
  "sesion.motivo.caducada": "La sesión ha caducado. Inicia sesión de nuevo.",
  "sesion.motivo.revocada":
    "La sesión se cerró desde tu panel de MAJIX. Inicia sesión de nuevo.",
  "sesion.motivo.error":
    "No se ha podido contactar con MAJIX. Comprueba la conexión e inténtalo de nuevo.",
  "sesion.sinRed.titulo": "No se puede verificar la sesión",
  "sesion.sinRed.texto":
    "MAJIX Tools necesita conexión con MAJIX para verificar la cuenta, y la última verificación tiene más de 24 horas.",
  "sesion.reintentar": "Reintentar",
  "puerta.texto": "Con tu cuenta de MAJIX. La contraseña no se introduce aquí.",
  "puerta.abierta":
    "Hemos abierto majixlab.com en otra pestaña. Inicia sesión con tu cuenta de MAJIX y comprueba que el código que aparece allí coincide con este.",
  "puerta.bloqueada":
    "Tu navegador ha bloqueado la ventana emergente. Pulsa el botón para abrir majixlab.com y confirmar el código.",
  "puerta.abrirDeNuevo": "Abrir de nuevo",
  "puerta.datos": "Qué datos salen de tu equipo",
  "puerta.quitar": "¿No quieres usarlo? Ejecuta npx majix-tools remove",
  "sesion.seguro.titulo": "Qué datos salen de tu equipo",
  "sesion.seguro.1":
    "Con cualquier plan: el nombre de tu web y la versión de MAJIX Tools, únicamente para iniciar y mantener la sesión.",
  "sesion.seguro.2":
    "Con Plus y Pro: por cada carga, la ruta sin parámetros y las mediciones (LCP, CLS, INP, TTFB, FPS, fotogramas largos, peticiones, KB y errores).",
  "sesion.seguro.3":
    "Nunca: código, archivos, claves, URL completas, cabeceras ni dirección IP.",
  "sesion.seguro.4":
    "El token reside únicamente en tu servidor de desarrollo: ni esta pantalla ni el navegador pueden leerlo.",
  "cuenta.conectadaComo": "Sesión iniciada como",
  "cuenta.web": "Web conectada",
  "cuenta.dominio": "Dominio publicado",
  "cuenta.sinDominio": "Sin definir",
  "cuenta.plan": "Plan",
  "cuenta.plan.libre": "Libre",
  "cuenta.plan.plus": "Plus",
  "cuenta.plan.pro": "Pro",
  "cuenta.limites": (webs: number, dias: number, sc: boolean, vivo: boolean) =>
    vivo
      ? `Monitorización en vivo · ${webs} ${webs === 1 ? "web" : "webs"} · ${dias >= 365 ? "12 meses" : `${dias} días`} de historial${sc ? " · Search Console" : ""}`
      : `Medición local · ${webs} ${webs === 1 ? "web" : "webs"}`,
  "cuenta.mejorar": "Mejorar plan",
  "cuenta.verPlanes": "Ver planes",
  "cuenta.abrirPanel": "Abrir mi panel de MAJIX",
  "cuenta.cerrarSesion": "Cerrar sesión",
  "cuenta.cerrando": "Cerrando…",
  "cuenta.comprobar": "Comprobar el plan",
  "cuenta.soloLocal":
    "Con el plan Libre, las mediciones permanecen en este equipo. La monitorización en vivo en el panel de MAJIX está disponible desde el plan Plus.",
  "cuenta.fueraDePlan":
    "Esta web no está incluida en el plan actual, por lo que no se envían sus datos. Mejora el plan o elimina otra web desde tu panel de MAJIX.",
  "cuenta.sinRed":
    "No se puede verificar la sesión con MAJIX en este momento. Se mantiene dentro del periodo de gracia de 24 horas.",
  "cuenta.enviado.titulo": "Registro de envíos a MAJIX",
  "cuenta.enviado.texto":
    "Cada envío, exactamente como salió de este equipo. No incluye el token, el código de autorización ni claves.",
  "cuenta.enviado.vacio":
    "Aún no se ha enviado ninguna medición. Recarga tu web y aparecerá aquí.",
  "cuenta.enviado.vacioLocal":
    "Con el plan Libre no se envían mediciones a MAJIX: permanecen en este equipo.",
  "cuenta.col.hora": "Hora",
  "cuenta.col.que": "Concepto",
  "cuenta.col.resultado": "Resultado",
  "cuenta.col.bytes": "Bytes",
  "cuenta.ultimo": "Último envío, sin modificar",
  "cuenta.ok": "Recibido",
  "cuenta.fallo": (http: number) =>
    http === 0 ? "Sin conexión" : `Error ${http}`,
  "dash.vivo.titulo": "Panel de MAJIX",
  "dash.vivo.estado": "En vivo",
  "dash.vivo.texto":
    "Cada carga de tu web se muestra en tu panel de MAJIX y se contrasta con tu dominio publicado.",
  "dash.vivo.ultimo": (hace: string) => `Último envío ${hace}`,
  "dash.vivo.nunca": "Aún no se ha enviado ninguna carga. Recarga tu web.",
  "dash.vivo.abrir": "Abrir mi panel",
  "dash.vivo.fuera":
    "Esta web no está incluida en el plan actual: no se envían datos.",
  "dash.vivo.libreTitulo": "Monitorización en vivo",
  "dash.vivo.libre":
    "Con el plan Libre, las mediciones permanecen en este equipo. Con Plus o Pro se muestran en tiempo real en tu panel de MAJIX y se contrastan con tu dominio publicado.",
  "dash.vivo.ver": "Ver planes",
  "gsc.plan.titulo": "Search Console forma parte de los planes de pago",
  "gsc.plan.texto":
    "Con Plus o Pro consultas aquí tus clics, impresiones, CTR y posición, que además se muestran día a día en tu panel de MAJIX. El pago se realiza en la web y la activación es automática.",
  "gsc.plan.ver": "Ver planes",
  "gsc.plan.comprobar": "Ya he contratado el plan: comprobar",
};

type Textos = {
  [K in keyof typeof es]: (typeof es)[K] extends (...a: infer A) => string
    ? (...a: A) => string
    : string;
};

const en: Textos = {
  locale: "en-US",

  "panel.abrir": "Open MAJIX Tools",
  "panel.cerrarPanel": "Close MAJIX Tools",
  "panel.herramientas": "Tools",
  "panel.irDocs": "MAJIX Tools — documentation",
  "panel.documentacion": "Documentation",
  "panel.ampliar": "Full screen",
  "panel.reducir": "Restore size",
  "panel.cerrar": "Close",
  "panel.soloDesarrollo": "Development only · 0 bytes in your published site",
  "panel.idioma": "Panel language",
  "panel.enX": "MAJIX on X",
  "panel.enLinkedin": "MAJIX on LinkedIn",

  "tab.dashboard": "Dashboard",
  "tab.dashboard.desc": "Overview: scores, trends and performance per page",
  "tab.rendimiento": "Performance",
  "tab.rendimiento.desc": "Core Web Vitals and frames of this page, live",
  "tab.searchConsole": "Search Console",
  "tab.searchConsole.desc":
    "Clicks, impressions, CTR and position of your site on Google",
  "tab.archivos": "Files",
  "tab.archivos.desc": "Your project tree with the real size of every file",
  "tab.consola": "Console & network",
  "tab.consola.desc": "Errors, warnings and requests captured on this page",
  "tab.rutas": "Routes",
  "tab.rutas.desc": "Internal links on this page and the sitemap.xml",
  "tab.otrasWebs": "Other sites",
  "tab.otrasWebs.desc":
    "A real HTTP report of any site: response, security, weight",

  "nivel.bien": "Good",
  "nivel.mejorable": "Needs work",
  "nivel.mal": "Poor",
  "nivel.esperando": "Waiting…",
  "nivel.noSoportado": "Unavailable",
  noSoportado: "Your browser doesn't measure it (try Chrome or Edge)",

  actualizar: "Refresh",
  limpiar: "Clear",
  reintentar: "Try again",
  ahora: "Now",
  copiar: "Copy",

  "dash.titulo": "Dashboard",
  "dash.soloEsta": "This page load",
  "dash.conAnteriores": (n) =>
    n === 1
      ? "This load and the previous one, saved in this browser"
      : `This load and the previous ${n}, saved in this browser`,
  "dash.conAnterioresRecorte": (visibles, total) =>
    `This load and the previous ${visibles} (of ${total} saved in this browser)`,
  "dash.curva": "scored with the Lighthouse curve",
  "dash.borrar": "Clear history",
  "dash.kpi.lcp": "LCP · loading",
  "dash.kpi.cls": "CLS · stability",
  "dash.kpi.inp": "INP · responsiveness",
  "dash.kpi.ttfb": "TTFB · server",
  "dash.rendimientoWeb": "Web performance",
  "dash.redPorCarga": "Network per load",
  "dash.peticiones": "Requests",
  "dash.errores": "Errors",
  "dash.cantidad": "count",
  "dash.vacio":
    "Every page load leaves a sample when you hide it: when you reload, switch tabs or close it. Reload a couple of times and the trend shows up here.",
  "dash.trafico": "Traffic",
  "dash.porPagina": "Performance per page",
  "dash.porPagina.nota":
    "Average LCP per landing page, from your local history.",
  "dash.ga4.titulo": "Connect Google Analytics",
  "dash.ga4.texto":
    "Users, sessions and channels (organic, direct, social, paid) from your GA4 property.",
  "dash.proximamente": "Coming in the next version",

  "rend.veredicto": "Core Web Vitals of this page",
  "rend.veredicto.desc":
    "LCP, CLS and INP — the three Google uses to score the experience.",
  "rend.lcp": "Main content painted",
  "rend.cls": "Worst burst of layout shifts",
  "rend.inp": "Slowest interaction (p98)",
  "rend.inp.sin": "No interactions yet",
  "rend.ttfb": "First byte from the server",
  "rend.fps": "Frames per second, live",
  "rend.largos": "Long frames",
  "rend.bloqueo": (ms) => `${ms} ms of main-thread blocking`,
  "rend.nota":
    "Official web.dev thresholds: LCP ≤ 2.5 s, CLS ≤ 0.1, INP ≤ 200 ms, TTFB ≤ 800 ms. LCP only counts while the tab is visible, CLS is the worst burst of shifts (windows of up to 5 s) and INP doesn't exist until the first interaction.",

  "gsc.consultando": "Querying Search Console…",
  "gsc.conecta": "Connect Search Console",
  "gsc.faltan": "Missing:",
  "gsc.lasCredenciales": "the credentials",
  "gsc.intro":
    "Four steps, done once. The credentials stay on your computer: the private key never reaches the browser.",
  "gsc.paso1":
    "In Google Cloud Console, create a project (or use one) and enable the “Google Search Console API”.",
  "gsc.paso2":
    "In “IAM & Admin → Service accounts”, create a service account and download a key in JSON format.",
  "gsc.paso3":
    "In Search Console, open your property → Settings → Users and permissions → Add user, and paste the service account email (“Restricted” is enough: it only reads).",
  "gsc.paso4":
    "Copy client_email and private_key from the JSON into your .env, together with your property, and restart the dev server.",
  "gsc.comprobar": "Check again",
  "gsc.titulo": "Performance on Google",
  "gsc.provisional": (fecha) => `provisional since ${fecha}`,
  "gsc.7": "7 days",
  "gsc.28": "28 days",
  "gsc.90": "3 months",
  "gsc.clics": "Total clicks",
  "gsc.impresiones": "Total impressions",
  "gsc.ctr": "Average CTR",
  "gsc.posicion": "Average position",
  "gsc.col.clics": "Clicks",
  "gsc.col.impresiones": "Impressions",
  "gsc.col.ctr": "CTR",
  "gsc.col.posicion": "Position",
  "gsc.consultas": "Queries",
  "gsc.paginas": "Pages",
  "gsc.paises": "Countries",
  "gsc.dispositivos": "Devices",
  "gsc.DESKTOP": "Desktop",
  "gsc.MOBILE": "Mobile",
  "gsc.TABLET": "Tablet",
  "gsc.sinDatosPropiedad":
    "Google has no data for this property in this period yet.",
  "gsc.sinDatos": "No data in this period.",
  "gsc.nota":
    "Data from the official Search Console API, including the freshest days: Google takes a few days to finalise them, so the last ones may still change. The period ends yesterday.",
  "gsc.err.servidor":
    "The dev server didn't answer with data. Check it's still running and try again.",
  "gsc.err.clave":
    "The private key isn't in a valid format. Copy the private_key value from the JSON as is, in quotes and with its \\n, including the BEGIN and END lines.",
  "gsc.err.credenciales": (detalle) =>
    `Google rejected the credentials (${detalle}). Check the service account email and private key.`,
  "gsc.err.acceso": (sitio) =>
    `The service account has no access to “${sitio}”. Add it as a user of the property in Search Console (Settings → Users and permissions). For a domain property the value must start with sc-domain:.`,
  "gsc.err.google": (estado, detalle) =>
    `Search Console answered ${estado}: ${detalle}`,
  "gsc.err.red": "Couldn't reach Google. Check your internet connection.",

  "arch.ficheros": (n) => `${n.toLocaleString("en-US")} files`,
  "arch.porNombre": "Sort by name",
  "arch.porPeso": "Sort by size",
  "arch.ordenadoPeso": "Sorted by size",
  "arch.ordenadoNombre": "Sorted by name",
  "arch.actualizarAhora": "Refresh now",
  "arch.error": "Couldn't read the project",
  "arch.leyendo": "Reading the project…",
  "arch.vacio": "Nothing to show.",
  "arch.fuenteGit":
    "Everything git doesn't ignore in your project, read from disk by the dev server.",
  "arch.fuenteDisco":
    "Your project read from disk by the dev server (without dependencies, builds or secrets).",
  "arch.recortado": (n) =>
    `Very large project: showing the first ${n.toLocaleString("en-US")} files.`,

  "cons.consola": "Console",
  "cons.red": "Network",
  "cons.errores": (n) => `${n} ${n === 1 ? "error" : "errors"}`,
  "cons.avisos": (n) => `${n} ${n === 1 ? "warning" : "warnings"}`,
  "cons.sinMensaje": "(no message)",
  "cons.promesa": "Unhandled promise rejection: ",
  "cons.excepcion": "Uncaught exception: ",
  "cons.vacia": "No errors or warnings so far.",
  "cons.redVacia": "No requests recorded yet.",
  "cons.nota":
    "The console is captured from the moment MAJIX Tools loads in the page; the network, from the first byte thanks to buffered.",

  "rutas.pagina": "On this page",
  "rutas.sitemap": "Sitemap",
  "rutas.sinEnlaces": "No internal links found on this page.",
  "rutas.buscando": "Looking for sitemap.xml…",
  "rutas.sinSitemap": "This site has no sitemap.xml.",
  "rutas.nota":
    "DOM links and sitemap.xml: without a router to read from, this is what any site exposes.",

  "web.placeholder": "example.com",
  "web.analizar": "Analyse",
  "web.intro":
    "Type the address of any site and get a real report: response time, security headers, compression and weight.",
  "web.redirigida": (desde) => `Redirected from ${desde}`,
  "web.respuesta": "Response",
  "web.peso": "Transferred",
  "web.compresion": "Compression",
  "web.servidor": "Server",
  "web.si": "yes",
  "web.no": "no",
  "web.seguridad": "Security headers",
  "web.iframes": "Protection against foreign iframes",
  "web.pagina": "Page",
  "web.tituloPagina": "Title: ",
  "web.resumen": (s, h, i) => `${s} scripts · ${h} stylesheets · ${i} images`,
  "web.lazy": (n) => ` (${n} lazy-loaded)`,
  "web.cabeceras": (n) => `All headers (${n})`,
  "web.nota":
    "A real request from the server to the site you type — it isn't Lighthouse: it doesn't measure that site's LCP/CLS, only what an HTTP request tells.",
  "web.err.falta-url": "The URL to check is missing.",
  "web.err.url-invalida": "That URL isn't valid.",
  "web.err.protocolo": "Only http:// or https:// addresses are accepted.",
  "web.err.red-privada":
    "That address points to a local or private network — it isn't checked.",
  "web.err.tiempo": "The site didn't answer within 10 seconds.",
  "web.err.sin-conexion": "Couldn't connect to that address.",
  "web.err.redirecciones": "Too many redirects (more than 5).",
  "web.err.dns": "That domain doesn't exist or couldn't be resolved.",
  "web.err.generico": "The check couldn't be completed.",

  // ── MAJIX account (sign-in required) ──
  "tab.cuenta": "Account",
  "tab.cuenta.desc": "Session, plan and a record of what is sent to MAJIX",
  "sesion.cabecera": "A MAJIX account is required",
  "sesion.titulo": "Sign in to use MAJIX Tools",
  "sesion.texto":
    "MAJIX Tools is free and requires a MAJIX account. Your password is never entered here: authorisation takes place at majixlab.com using a single-use code.",
  "sesion.iniciar": "Sign in",
  "sesion.iniciando": "Requesting the code…",
  "sesion.confirma": "Confirm this code at majixlab.com",
  "sesion.abrir": "Open majixlab.com/conectar",
  "sesion.copiar": "Copy code",
  "sesion.paso1": "Open the address with your MAJIX account.",
  "sesion.paso2": "Verify that the code shown matches the one on this screen.",
  "sesion.paso3": "Select “Connect”. This panel activates automatically.",
  "sesion.caduca": (mmss: string) => `The code expires in ${mmss}`,
  "sesion.cancelar": "Cancel",
  "sesion.esperando": "Waiting for authorisation…",
  "sesion.motivo.denegada":
    "The connection was denied. If that was unintended, sign in again.",
  "sesion.motivo.expirada": "The code has expired. Request a new one.",
  "sesion.motivo.caducada": "The session has expired. Sign in again.",
  "sesion.motivo.revocada":
    "The session was closed from your MAJIX dashboard. Sign in again.",
  "sesion.motivo.error":
    "MAJIX could not be reached. Check your connection and try again.",
  "sesion.sinRed.titulo": "The session cannot be verified",
  "sesion.sinRed.texto":
    "MAJIX Tools needs a connection to MAJIX to verify the account, and the last verification is more than 24 hours old.",
  "sesion.reintentar": "Try again",
  "puerta.texto":
    "With your MAJIX account. Your password is never entered here.",
  "puerta.abierta":
    "We have opened majixlab.com in another tab. Sign in with your MAJIX account and check that the code shown there matches this one.",
  "puerta.bloqueada":
    "Your browser blocked the pop-up. Press the button to open majixlab.com and confirm the code.",
  "puerta.abrirDeNuevo": "Open again",
  "puerta.datos": "What data leaves your computer",
  "puerta.quitar": "Don't want to use it? Run npx majix-tools remove",
  "sesion.seguro.titulo": "What data leaves your computer",
  "sesion.seguro.1":
    "On any plan: your site's name and the MAJIX Tools version, solely to start and maintain the session.",
  "sesion.seguro.2":
    "On Plus and Pro: for each page load, the path without parameters and the measurements (LCP, CLS, INP, TTFB, FPS, long frames, requests, KB and errors).",
  "sesion.seguro.3":
    "Never: code, files, keys, full URLs, headers or an IP address.",
  "sesion.seguro.4":
    "The token resides only in your dev server: neither this screen nor the browser can read it.",
  "cuenta.conectadaComo": "Signed in as",
  "cuenta.web": "Connected site",
  "cuenta.dominio": "Published domain",
  "cuenta.sinDominio": "Not set",
  "cuenta.plan": "Plan",
  "cuenta.plan.libre": "Free",
  "cuenta.plan.plus": "Plus",
  "cuenta.plan.pro": "Pro",
  "cuenta.limites": (webs: number, dias: number, sc: boolean, vivo: boolean) =>
    vivo
      ? `Live monitoring · ${webs} ${webs === 1 ? "site" : "sites"} · ${dias >= 365 ? "12 months" : `${dias} days`} of history${sc ? " · Search Console" : ""}`
      : `Local measurement · ${webs} ${webs === 1 ? "site" : "sites"}`,
  "cuenta.mejorar": "Upgrade plan",
  "cuenta.verPlanes": "See plans",
  "cuenta.abrirPanel": "Open my MAJIX dashboard",
  "cuenta.cerrarSesion": "Sign out",
  "cuenta.cerrando": "Signing out…",
  "cuenta.comprobar": "Check the plan",
  "cuenta.soloLocal":
    "On the Free plan, measurements stay on this computer. Live monitoring in the MAJIX dashboard is available from the Plus plan.",
  "cuenta.fueraDePlan":
    "This site is not included in the current plan, so none of its data is sent. Upgrade the plan or remove another site from your MAJIX dashboard.",
  "cuenta.sinRed":
    "The session cannot be verified with MAJIX at the moment. It remains within the 24-hour grace period.",
  "cuenta.enviado.titulo": "Record of submissions to MAJIX",
  "cuenta.enviado.texto":
    "Every submission, exactly as it left this computer. It does not include the token, the authorisation code or any keys.",
  "cuenta.enviado.vacio":
    "No measurement has been sent yet. Reload your site and it will appear here.",
  "cuenta.enviado.vacioLocal":
    "On the Free plan no measurements are sent to MAJIX: they stay on this computer.",
  "cuenta.col.hora": "Time",
  "cuenta.col.que": "Item",
  "cuenta.col.resultado": "Result",
  "cuenta.col.bytes": "Bytes",
  "cuenta.ultimo": "Last submission, unmodified",
  "cuenta.ok": "Received",
  "cuenta.fallo": (http: number) =>
    http === 0 ? "No connection" : `Error ${http}`,
  "dash.vivo.titulo": "MAJIX dashboard",
  "dash.vivo.estado": "Live",
  "dash.vivo.texto":
    "Every page load of your site is shown in your MAJIX dashboard and compared with your published domain.",
  "dash.vivo.ultimo": (hace: string) => `Last sent ${hace}`,
  "dash.vivo.nunca": "No page load has been sent yet. Reload your site.",
  "dash.vivo.abrir": "Open my dashboard",
  "dash.vivo.fuera":
    "This site is not included in the current plan: no data is sent.",
  "dash.vivo.libreTitulo": "Live monitoring",
  "dash.vivo.libre":
    "On the Free plan, measurements stay on this computer. With Plus or Pro they are shown in real time in your MAJIX dashboard and compared with your published domain.",
  "dash.vivo.ver": "See plans",
  "gsc.plan.titulo": "Search Console is part of the paid plans",
  "gsc.plan.texto":
    "With Plus or Pro you can view your clicks, impressions, CTR and position here, and they are also shown day by day in your MAJIX dashboard. Payment is made on the website and activation is automatic.",
  "gsc.plan.ver": "See plans",
  "gsc.plan.comprobar": "I have already subscribed: check",
};

export type Clave = keyof typeof es;
type Valor<K extends Clave> = Textos[K];

const DICCIONARIOS: Record<Idioma, Textos> = { es: es as Textos, en };
const CLAVE_ALMACEN = "majix-tools:idioma";

function detectar(): Idioma {
  try {
    const guardado = localStorage.getItem(CLAVE_ALMACEN);
    if (guardado === "es" || guardado === "en") return guardado;
  } catch {
    /* sin almacenamiento: se detecta cada vez */
  }
  const web = document.documentElement.lang?.toLowerCase() ?? "";
  if (web) return web.startsWith("es") ? "es" : "en";
  return (navigator.language ?? "").toLowerCase().startsWith("es")
    ? "es"
    : "en";
}

type Contexto = {
  idioma: Idioma;
  cambiar: (i: Idioma) => void;
  t: <K extends Clave>(clave: K) => Valor<K>;
};

const Ctx = createContext<Contexto | null>(null);

export function ProveedorIdioma({ children }: { children: ReactNode }) {
  const [idioma, setIdioma] = useState<Idioma>(detectar);
  const cambiar = useCallback((i: Idioma) => {
    setIdioma(i);
    try {
      localStorage.setItem(CLAVE_ALMACEN, i);
    } catch {
      /* se cambia igual, solo no se recuerda */
    }
  }, []);
  const valor = useMemo<Contexto>(
    () => ({ idioma, cambiar, t: (clave) => DICCIONARIOS[idioma][clave] }),
    [idioma, cambiar],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useIdioma(): Contexto {
  const c = useContext(Ctx);
  if (!c) throw new Error("useIdioma fuera de <ProveedorIdioma>");
  return c;
}
