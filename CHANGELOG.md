# Changelog

## 0.2.1 · preview — 2026-11-10

- **Inicio de sesión a pantalla completa, antes de mostrar nada.** Al cargar tu web aparece solo el logo de MAJIX y «Iniciar sesión»: ni panel, ni botón, ni menú. Al pulsarlo se pide el código y **se abre sola `majixlab.com/conectar`** en otra pestaña con el código ya puesto; allí inicias sesión con tu cuenta, compruebas el código y pulsas «Conectar», y el panel se abre solo.
- La instalación por defecto queda fijada a la etiqueta `v0.2.1`: `npx github:majixgroup/majix-tools init`.

*Full-screen sign-in before anything is shown: only the MAJIX logo and “Sign in”. Pressing it requests the code and opens `majixlab.com/conectar` by itself in another tab with the code filled in; once confirmed, the panel opens by itself. Default install is now pinned to the `v0.2.1` tag.*

## 0.2.0 · preview — 2026-11-09

**Instalación desde GitHub.** `npx github:majixgroup/majix-tools init` instala la herramienta directamente desde este repositorio, como dependencia de desarrollo del proyecto y fijada a la etiqueta `v0.2.0`; no hay nada global que instalar. `dist/` se confirma en el repositorio para que no haga falta compilar.
*Install from GitHub: `npx github:majixgroup/majix-tools init` installs the tool straight from this repository as a dev dependency pinned to the `v0.2.0` tag; nothing global. `dist/` is committed so no build is needed.*

Todavía sin publicar en npm. Cambia lo que se explica en «Privacidad»: ahora hay inicio de sesión.
*Not yet published on npm. It changes what «Privacy» explains: there is now a sign-in.*

- **Inicio de sesión obligatorio, a pantalla completa**: al cargar la web, antes de mostrar nada, aparece el logo de MAJIX y «Iniciar sesión» (sin panel, ni botón, ni menú). Al pulsarlo se pide un código y se abre sola `majixlab.com/conectar` con el código puesto; al confirmarlo, el panel se abre solo. Cuenta de MAJIX por código de dispositivo (la herramienta nunca ve la contraseña). Sin sesión, los endpoints del plugin (`archivos`, `comprobar-web`, `search-console`, `muestras`) responden `401`.
- **Monitorización en tiempo real en tu panel de MAJIX (Plus y Pro)**: cada carga se envía con sus Web Vitals, FPS, fotogramas largos, tiempo de bloqueo, peticiones, KB y errores (ver la lista exacta en «Privacidad») y se contrasta con el **dominio publicado** que confirmas al conectar: verificación del servidor desde la red de Cloudflare y datos de campo de Chrome (CrUX). El plan Libre mide solo en local y no envía ninguna medición.
- **Planes Libre, Plus y Pro** (4,95 € y 9,95 €/mes + IVA). Se pagan en la web, nunca dentro de la herramienta; la herramienta detecta el plan sola. Tiempo real, contraste y Search Console pasan a los planes de pago.
- Nueva pestaña **Cuenta**: sesión, plan y la bitácora de cada envío a MAJIX, tal cual salió.
- El token vive solo en el servidor de desarrollo, en un fichero de permisos 600 de la carpeta de configuración (fuera del proyecto); el navegador nunca lo ve y MAJIX solo guarda su hash.
- Los endpoints exigen ahora que la petición venga de la propia web (se rechaza también `Sec-Fetch-Site: same-site`) y, para lo que cambia algo, la cabecera `X-Majix-Tools`.
- Quitada la tarjeta «Tendencia de ingresos» (Stripe) y el conector de Stripe de la hoja de ruta.
- `majix-tools doctor` dice si has iniciado sesión y con qué plan.

## 0.1.0 · preview — 2026-09-27

Primera versión: panel (Dashboard, Rendimiento, Search Console, Archivos, Consola y red, Rutas, Otras webs), plugin de Vite con endpoints protegidos, CLI `init`/`doctor`/`remove` reversible byte a byte.
