<div align="center">

# MAJIX Tools

**Rendimiento web, del desarrollo a la producción.**

Herramienta gratuita y de código abierto que mide tu web en tu propio equipo mientras la construyes: Web Vitals, FPS, red, consola y archivos. Con los planes Plus y Pro, las mediciones llegan en tiempo real a tu panel de MAJIX y se contrastan con tu dominio publicado.

[![Licencia MIT](https://img.shields.io/badge/licencia-MIT-7b39fc)](LICENSE)
[![Versión](https://img.shields.io/badge/versi%C3%B3n-0.2.1%20preview-a484d7)](CHANGELOG.md)
[![Vite 5+](https://img.shields.io/badge/Vite-%E2%89%A5%205-646cff)](https://vite.dev)
[![Node 18.18+](https://img.shields.io/badge/Node-%E2%89%A5%2018.18-339933)](https://nodejs.org)
[![Cero bytes en producción](https://img.shields.io/badge/producci%C3%B3n-0%20bytes-3ddc84)](#privacidad-y-seguridad)

[Documentación](https://majixlab.com/open-source/majix-tools/docs) · [Planes](https://majixlab.com/open-source/majix-tools/planes) · [English](README.en.md) · [Para asistentes de IA](AGENTS.md)

<br>

<img src="docs/capturas/dashboard-es.webp" alt="El panel de MAJIX Tools sobre una web en desarrollo: puntuaciones de LCP, CLS, INP y TTFB, evolución del rendimiento y peticiones por carga" width="860">

</div>

<br>

## Instalación

No hay nada que instalar aparte ni ninguna aplicación: MAJIX Tools se descarga **directamente desde este repositorio** y queda como una dependencia de desarrollo de tu propio proyecto. En la raíz de tu proyecto (donde está su `package.json`):

```bash
npx github:majixgroup/majix-tools init
npm run dev
```

Eso es todo. `init` detecta tu gestor de paquetes (npm, pnpm, yarn o bun) y el tipo de proyecto (Vite, TanStack Start, React Router, Remix o SvelteKit), añade el paquete fijado a la versión publicada en este repositorio y engancha el plugin en tu `vite.config`.

- **Revisa antes de aplicar:** `npx github:majixgroup/majix-tools init --dry-run` muestra cada cambio sin tocar nada.
- **Reversible:** `npx majix-tools remove` deshace todo lo que hizo `init`, byte a byte.
- **No toca tu `.env`** ni tus claves, y se puede repetir sin riesgo.

<details>
<summary><b>Instalación manual, paso a paso</b></summary>

```bash
npm install -D github:majixgroup/majix-tools#v0.2.1     # o: pnpm add -D · yarn add -D · bun add -d
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { majixTools } from "majix-tools/vite";

export default defineConfig({
  plugins: [majixTools() /* , tus otros plugins */],
});
```

En proyectos que se pintan en el servidor (TanStack Start, React Router, Remix, SvelteKit), añade además en la raíz de la aplicación esta línea, que solo actúa en desarrollo (`init` la añade por ti):

```ts
if (import.meta.env.DEV && typeof window !== "undefined") void import("majix-tools/cliente");
```

</details>

**Requisitos:** Node ≥ 18.18 y Vite ≥ 5. No es compatible con Next.js, que no utiliza Vite.

## Primeros pasos

MAJIX Tools se utiliza con tu cuenta de MAJIX, la misma de [majixlab.com](https://majixlab.com). **La herramienta nunca solicita tu contraseña:** la autorización se realiza en majixlab.com mediante un código de un solo uso, igual que `gh auth login`.

<table>
<tr>
<td width="50%"><img src="docs/capturas/puerta-es.webp" alt="Pantalla de inicio de sesión de MAJIX Tools con la lista de datos que salen del equipo"></td>
<td width="50%"><img src="docs/capturas/codigo-es.webp" alt="El código de un solo uso que se confirma en majixlab.com"></td>
</tr>
<tr>
<td><b>1.</b> Abre tu web en desarrollo: antes de mostrar nada, MAJIX Tools presenta la pantalla de inicio de sesión. Pulsa <b>Iniciar sesión</b>.</td>
<td><b>2.</b> Aparece el código (<code>BCDF-GHJK</code>) y se abre sola <code>majixlab.com/conectar</code> en otra pestaña. Inicia sesión con tu cuenta, comprueba que el código coincide, indica opcionalmente el dominio publicado de tu web y pulsa <b>Conectar</b>. El panel se abre solo.</td>
</tr>
</table>

Sin sesión no hay panel, ni botón, ni menú: solo esa pantalla, y los endpoints del plugin que leen tu disco o utilizan tus claves responden `401`. Si no quieres usar la herramienta, `npx majix-tools remove` la quita.

## Qué incluye

| Herramienta | Qué hace |
|---|---|
| **Dashboard** | Puntuación de cada Web Vital con la curva de Lighthouse, evolución del rendimiento y peticiones por carga |
| **Rendimiento** | LCP, CLS, INP, TTFB, FPS y fotogramas largos, con las definiciones y los umbrales oficiales de Google |
| **Search Console** | Clics, impresiones, CTR y posición por día (planes de pago) |
| **Archivos** | El árbol de tu proyecto con el peso real de cada carpeta, sin secretos ni dependencias |
| **Consola y red** | Errores, avisos y cada petición, registrados sin modificar tu código |
| **Rutas** | Los enlaces de la página y las direcciones de tu `sitemap.xml` |
| **Otras webs** | Informe HTTP de cualquier dirección: respuesta, cabeceras, seguridad y peso |
| **Cuenta** | Sesión, plan y registro exacto de lo que se envía a MAJIX |

<table>
<tr>
<td width="50%"><img src="docs/capturas/rendimiento-es.webp" alt="Pestaña Rendimiento con LCP, CLS, INP, TTFB, FPS y fotogramas largos"></td>
<td width="50%"><img src="docs/capturas/cuenta-es.webp" alt="Pestaña Cuenta con la sesión, el plan y el registro de envíos a MAJIX"></td>
</tr>
<tr>
<td align="center"><sub>Rendimiento, medido con las mismas interfaces que Chrome y Lighthouse.</sub></td>
<td align="center"><sub>Cuenta: cada envío a MAJIX, tal cual salió de tu equipo.</sub></td>
</tr>
</table>

La medición local utiliza `PerformanceObserver`, la misma API que emplean Chrome, Lighthouse y la biblioteca `web-vitals` de Google. El panel carga en dos tiempos (unos 8 KB al principio y el resto cuando el navegador está libre) dentro de un Shadow DOM, para no alterar lo que mide ni heredar el CSS de tu web.

## Planes

El plan Libre mide únicamente en tu equipo: **no envía ninguna medición a MAJIX**. Los planes de pago añaden la monitorización en tiempo real y el contraste con el dominio publicado.

| | Libre | Plus | Pro |
|---|:---:|:---:|:---:|
| Precio (sin IVA) | 0 € | 4,95 €/mes | 9,95 €/mes |
| Panel completo en tu equipo | ✓ | ✓ | ✓ |
| Estadísticas en tiempo real en tu panel de MAJIX | — | ✓ | ✓ |
| Contraste con el dominio publicado | — | ✓ | ✓ |
| Search Console en la herramienta y en el panel | — | ✓ | ✓ |
| Webs conectadas | 1 | 3 | 10 |
| Historial en tu panel | — | 90 días | 12 meses |
| CRM propio de MAJIX Tools | — | — | próximamente |

La contratación se realiza en <https://majixlab.com/open-source/majix-tools/planes> con tu cuenta. **Nunca dentro de la herramienta:** no solicita tarjeta ni datos de pago. La herramienta detecta el plan en unos minutos, o de inmediato con **Comprobar el plan** en su pestaña Cuenta. Sin permanencia.

## Monitorización en tiempo real y contraste (Plus y Pro)

Cada carga medida en tu entorno de desarrollo aparece de inmediato en tu panel de MAJIX (**Open source → tu web**), donde se compara con el **dominio publicado** que confirmaste al conectar:

<img src="docs/capturas/panel-cliente-1.webp" alt="Ficha de una web conectada en el panel de MAJIX: dominio publicado y Web Vitals" width="860">

<img src="docs/capturas/panel-cliente-2.webp" alt="Contraste entre las mediciones locales y los datos de campo de Chrome, y verificación del dominio publicado" width="860">

<sub>Capturas del panel de cliente con datos de ejemplo. Los valores reales proceden de tu web.</sub>

- **Medición local:** LCP, CLS, INP, TTFB, FPS, fotogramas largos y tiempo de bloqueo.
- **Verificación del dominio publicado:** estado HTTP, TTFB, tamaño, compresión y cabeceras de seguridad, medidos desde la red de Cloudflare mientras la ficha está abierta.
- **Datos de campo de Chrome (CrUX):** LCP, INP, CLS y TTFB en el percentil 75 de usuarios reales durante 28 días, cuando Google dispone de datos del dominio.

**Los límites, con claridad.** Una verificación externa solo puede medir con rigor lo observable desde fuera (servidor, red, cabeceras). El LCP, el INP y el CLS de producción proceden exclusivamente de usuarios reales a través de CrUX: si Google no tiene datos del dominio, el panel muestra «sin datos» en lugar de una estimación. Los FPS solo se miden mientras el panel de la herramienta está abierto.

## Privacidad y seguridad

- **Se envía, con cualquier plan:** el nombre de tu web (el `name` de tu `package.json`) y la versión de MAJIX Tools, solo para gestionar la sesión.
- **Se envía, con Plus o Pro:** por cada carga de página, la ruta **sin parámetros ni fragmento**, LCP, CLS, INP, TTFB, FPS, fotogramas largos, tiempo de bloqueo, número de peticiones, KB y número de errores; y los totales diarios de Search Console. Además, MAJIX comprueba periódicamente **tu dominio publicado** y consulta los datos de campo de Chrome.
- **Nunca:** tu código, tus archivos, tus claves ni variables de entorno, URLs completas, cabeceras, cookies, el contenido de tu consola ni tu IP.
- Esa lista se filtra **en tu ordenador**, antes de enviar ([`src/servidor/muestras.ts`](src/servidor/muestras.ts)), y la pestaña **Cuenta** muestra cada envío tal cual salió.
- **El token** reside únicamente en tu servidor de desarrollo, en un fichero con permisos 600 de tu carpeta de configuración, fuera del proyecto. El navegador nunca lo ve; en MAJIX solo se guarda su hash; caduca a los 30 días sin uso y se revoca desde tu panel de MAJIX. Una prueba automática comprueba que no aparece en nada de lo que ve el navegador.
- **Cero bytes en producción:** el plugin solo actúa con `vite serve`, y una prueba automatizada lo verifica sobre una compilación real.
- Los endpoints del plugin solo aceptan peticiones de tu propia web; los que modifican algo exigen además la cabecera `X-Majix-Tools`.
- Es código abierto: el control de acceso del panel lo realiza el propio paquete. Lo que no se puede copiar es lo que reside en los servidores de MAJIX (tus estadísticas en tiempo real, el contraste con el dominio publicado y el plan de tu cuenta).

Para informar de una vulnerabilidad, consulta [SECURITY.md](SECURITY.md).

## Search Console

Con un plan de pago, crea una **cuenta de servicio** de Google Cloud con acceso de solo lectura a tu propiedad y añade a tu `.env`:

```env
MAJIX_TOOLS_GSC_CLIENT_EMAIL="majix-tools@tu-proyecto.iam.gserviceaccount.com"
MAJIX_TOOLS_GSC_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----\n"
MAJIX_TOOLS_GSC_SITE="sc-domain:tudominio.com"
```

La clave solo la lee el plugin, en tu servidor de desarrollo; al navegador solo llegan números. Guía paso a paso: <https://majixlab.com/open-source/majix-tools/docs/conectores/google-search-console>.

## Comandos

| Comando | Qué hace |
|---|---|
| `npx github:majixgroup/majix-tools init` | Instala y engancha el paquete (repetible). `--dry-run` muestra los cambios sin tocar nada |
| `npx majix-tools doctor` | Revisa la instalación y, con el servidor arrancado, si has iniciado sesión y con qué plan |
| `npx majix-tools remove` | Deshace `init` byte a byte. Cierra la sesión antes, en la pestaña Cuenta |

Opciones: `--dry-run`, `--sin-instalar` (`--no-install`), `--desde <ruta>` (`--from`, para instalar desde un `.tgz` o una carpeta), `--puerto <n>` (`--port`), `--lang es|en`.

## Desarrollo

```bash
git clone https://github.com/majixgroup/majix-tools.git && cd majix-tools
npm install
npm run build              # compila el CSS, el cliente, el plugin y la CLI (dist/)
npm run typecheck
npm test                   # pruebas unitarias (CLI y cuenta)
npm run test:integracion   # de punta a punta, con un Vite real y un MAJIX simulado
```

La prueba de integración instala el paquete en un proyecto nuevo, inicia sesión contra un MAJIX simulado, comprueba que el token no aparece en nada de lo que ve el navegador, realiza la compilación de producción (0 rastros) y lo desinstala.

> **Nota:** la carpeta `dist/` se publica en el repositorio a propósito, para que la instalación directa desde GitHub funcione sin compilar nada. Si modificas el código, ejecuta `npm run build` y confirma también los cambios de `dist/`.

## Contribuir y soporte

Las incidencias y las propuestas son bienvenidas en [Issues](https://github.com/majixgroup/majix-tools/issues); consulta [CONTRIBUTING.md](CONTRIBUTING.md). Documentación completa en 6 idiomas: <https://majixlab.com/open-source/majix-tools/docs>. Contacto: <contact@majixlab.com>.

## Licencia

[MIT](LICENSE) © MAJIX
