<div align="center">

# MAJIX Tools

**Web performance, from development to production.**

A free, open-source tool that measures your site on your own computer while you build it: Web Vitals, FPS, network, console and files. With the Plus and Pro plans, the measurements reach your MAJIX dashboard in real time and are compared with your published domain.

[![MIT license](https://img.shields.io/badge/license-MIT-7b39fc)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.2.2%20preview-a484d7)](CHANGELOG.md)
[![Vite 5+](https://img.shields.io/badge/Vite-%E2%89%A5%205-646cff)](https://vite.dev)
[![Node 18.18+](https://img.shields.io/badge/Node-%E2%89%A5%2018.18-339933)](https://nodejs.org)
[![Zero bytes in production](https://img.shields.io/badge/production-0%20bytes-3ddc84)](#privacy-and-security)

[Documentation](https://majixlab.com/open-source/majix-tools/docs) · [Plans](https://majixlab.com/open-source/majix-tools/planes) · [Español](README.md) · [For AI assistants](AGENTS.md)

<br>

<img src="docs/capturas/dashboard-en.webp" alt="The MAJIX Tools panel over a site in development: LCP, CLS, INP and TTFB scores, performance over time and requests per load" width="860">

</div>

<br>

## Installation

There is nothing else to install and no application to download: MAJIX Tools is fetched **directly from this repository** and becomes a development dependency of your own project. In the root of your project (where its `package.json` is):

```bash
npx github:majixgroup/majix-tools init
npm run dev
```

That is all. `init` detects your package manager (npm, pnpm, yarn or bun) and your project type (Vite, TanStack Start, React Router, Remix or SvelteKit), adds the package pinned to the version published in this repository and hooks the plugin into your `vite.config`.

- **Review before applying:** `npx github:majixgroup/majix-tools init --dry-run` shows every change without touching anything.
- **Reversible:** `npx majix-tools remove` undoes everything `init` did, byte for byte.
- **It never touches your `.env`** or your keys, and it is safe to repeat.

<details>
<summary><b>Manual installation, step by step</b></summary>

```bash
npm install -D github:majixgroup/majix-tools#v0.2.2     # or: pnpm add -D · yarn add -D · bun add -d
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { majixTools } from "majix-tools/vite";

export default defineConfig({
  plugins: [majixTools() /* , your other plugins */],
});
```

In server-rendered projects (TanStack Start, React Router, Remix, SvelteKit), also add this line to the root of your application; it only acts in development (`init` adds it for you):

```ts
if (import.meta.env.DEV && typeof window !== "undefined") void import("majix-tools/cliente");
```

</details>

**Requirements:** Node ≥ 18.18 and Vite ≥ 5. It is not compatible with Next.js, which does not use Vite.

## Getting started

MAJIX Tools is used with your MAJIX account, the same one as [majixlab.com](https://majixlab.com). **The tool never asks for your password:** authorisation takes place at majixlab.com using a single-use code, just like `gh auth login`.

<table>
<tr>
<td width="50%"><img src="docs/capturas/puerta-en.webp" alt="The MAJIX Tools sign-in screen with the list of data that leaves the computer"></td>
<td width="50%"><img src="docs/capturas/codigo-en.webp" alt="The single-use code that is confirmed at majixlab.com"></td>
</tr>
<tr>
<td><b>1.</b> Open your site in development: before showing anything, MAJIX Tools presents the sign-in screen. Press <b>Sign in</b>.</td>
<td><b>2.</b> The code (<code>BCDF-GHJK</code>) appears and <code>majixlab.com/devtool/conectar</code> opens by itself in another tab. Sign in with your account, check that the code matches, optionally enter your site's published domain and press <b>Connect</b>. The panel opens by itself.</td>
</tr>
</table>

Without a session there is no panel, no button and no menu: only that screen, and the plugin endpoints that read your disk or use your keys answer `401`. If you do not want to use the tool, `npx majix-tools remove` removes it.

## What is included

| Tool | What it does |
|---|---|
| **Dashboard** | The score of each Web Vital using the Lighthouse curve, performance over time and requests per load |
| **Performance** | LCP, CLS, INP, TTFB, FPS and long frames, using Google's official definitions and thresholds |
| **Search Console** | Clicks, impressions, CTR and position per day (paid plans) |
| **Files** | Your project tree with the real size of every folder, without secrets or dependencies |
| **Console and network** | Errors, warnings and every request, recorded without modifying your code |
| **Routes** | The page's links and the addresses in your `sitemap.xml` |
| **Other sites** | An HTTP report for any address: response, headers, security and weight |
| **Account** | Session, plan and the exact record of what is sent to MAJIX |

<table>
<tr>
<td width="50%"><img src="docs/capturas/rendimiento-en.webp" alt="Performance tab with LCP, CLS, INP, TTFB, FPS and long frames"></td>
<td width="50%"><img src="docs/capturas/cuenta-en.webp" alt="Account tab with the session, the plan and the record of submissions to MAJIX"></td>
</tr>
<tr>
<td align="center"><sub>Performance, measured with the same interfaces as Chrome and Lighthouse.</sub></td>
<td align="center"><sub>Account: every submission to MAJIX, exactly as it left your computer.</sub></td>
</tr>
</table>

Local measurement uses `PerformanceObserver`, the same API used by Chrome, Lighthouse and Google's `web-vitals` library. The panel loads in two stages (about 8 KB at the start and the rest when the browser is idle) inside a Shadow DOM, so it does not alter what it measures or inherit your site's CSS.

## Plans

The Free plan measures only on your computer: **it sends no measurement to MAJIX**. The paid plans add real-time monitoring and the comparison with the published domain.

| | Free | Plus | Pro |
|---|:---:|:---:|:---:|
| Price (excluding VAT) | €0 | €5.99/month | €9.95/month |
| Full panel on your computer | ✓ | ✓ | ✓ |
| Real-time statistics in your MAJIX dashboard | — | ✓ | ✓ |
| Comparison with the published domain | — | ✓ | ✓ |
| Search Console in the tool and in the dashboard | — | ✓ | ✓ |
| Connected sites | 1 | 3 | 10 |
| History in your dashboard | — | 90 days | 12 months |
| MAJIX Tools' own CRM | — | — | coming soon |

Plans are purchased at <https://majixlab.com/open-source/majix-tools/planes> with your account. **Never inside the tool:** it does not ask for a card or payment details. The tool detects the plan within minutes, or immediately with **Check the plan** in its Account tab. No commitment.

## Real-time monitoring and comparison (Plus and Pro)

Each load measured in your development environment appears immediately in your MAJIX dashboard (**Open source → your site**), where it is compared with the **published domain** you confirmed when connecting:

<img src="docs/capturas/panel-cliente-1.webp" alt="The page of a connected site in the MAJIX dashboard: published domain and Web Vitals" width="860">

<img src="docs/capturas/panel-cliente-2.webp" alt="Comparison between local measurements and Chrome field data, and the published-domain check" width="860">

<sub>Screenshots of the customer dashboard with sample data. Real values come from your site.</sub>

- **Local measurement:** LCP, CLS, INP, TTFB, FPS, long frames and blocking time.
- **Published-domain check:** HTTP status, TTFB, size, compression and security headers, measured from the Cloudflare network while the page is open.
- **Chrome field data (CrUX):** LCP, INP, CLS and TTFB at the 75th percentile of real users over 28 days, when Google has data for the domain.

**The limits, plainly.** An external check can only rigorously measure what is observable from outside (server, network, headers). Production LCP, INP and CLS come exclusively from real users through CrUX: if Google has no data for the domain, the dashboard shows “no data” rather than an estimate. FPS is only measured while the tool's panel is open.

## Privacy and security

- **Sent, on any plan:** your site's name (the `name` in your `package.json`) and the MAJIX Tools version, solely to manage the session.
- **Sent, with Plus or Pro:** for each page load, the path **without parameters or fragment**, LCP, CLS, INP, TTFB, FPS, long frames, blocking time, number of requests, KB and number of errors; and the daily Search Console totals. In addition, MAJIX periodically checks **your published domain** and queries Chrome field data.
- **Never:** your code, your files, your keys or environment variables, full URLs, headers, cookies, your console's contents or your IP.
- That list is filtered **on your computer** before sending ([`src/servidor/muestras.ts`](src/servidor/muestras.ts)) and the **Account** tab shows every submission exactly as it went out.
- **The token** resides only in your dev server, in a 600-permission file in your configuration folder, outside the project. The browser never sees it; MAJIX keeps only its hash; it expires after 30 days without use and is revoked from your MAJIX dashboard. An automated test checks that it appears nowhere the browser can see.
- **Zero bytes in production:** the plugin only acts with `vite serve`, and an automated test verifies it on a real build.
- The plugin's endpoints only accept requests from your own site; those that change something also require the `X-Majix-Tools` header.
- It is open source: the panel's access control is done by the package itself. What cannot be copied is what resides on MAJIX's servers (your real-time statistics, the comparison with the published domain and your account's plan).

To report a vulnerability, see [SECURITY.md](SECURITY.md).

## Search Console

On a paid plan, create a Google Cloud **service account** with read-only access to your property and add to your `.env`:

```env
MAJIX_TOOLS_GSC_CLIENT_EMAIL="majix-tools@your-project.iam.gserviceaccount.com"
MAJIX_TOOLS_GSC_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----\n"
MAJIX_TOOLS_GSC_SITE="sc-domain:yourdomain.com"
```

The key is only read by the plugin, on your dev server; only numbers reach the browser. Step-by-step guide: <https://majixlab.com/open-source/majix-tools/docs/conectores/google-search-console>.

## Commands

| Command | What it does |
|---|---|
| `npx github:majixgroup/majix-tools init` | Installs and hooks the package (repeatable). `--dry-run` shows the changes without touching anything |
| `npx majix-tools doctor` | Checks the installation and, with the server running, whether you are signed in and on which plan |
| `npx majix-tools remove` | Undoes `init` byte for byte. Sign out first, in the Account tab |

Options: `--dry-run`, `--no-install` (`--sin-instalar`), `--from <path>` (`--desde`, to install from a `.tgz` or a folder), `--port <n>` (`--puerto`), `--lang es|en`.

## Development

```bash
git clone https://github.com/majixgroup/majix-tools.git && cd majix-tools
npm install
npm run build              # builds the CSS, the client, the plugin and the CLI (dist/)
npm run typecheck
npm test                   # unit tests (CLI and account)
npm run test:integracion   # end to end, with a real Vite and a simulated MAJIX
```

The integration test installs the package in a new project, signs in against a simulated MAJIX, checks that the token appears nowhere the browser can see, runs the production build (0 traces) and uninstalls it.

> **Note:** the `dist/` folder is published in the repository on purpose, so that installing directly from GitHub works without building anything. If you change the code, run `npm run build` and commit the `dist/` changes as well.

## Contributing and support

Issues and proposals are welcome in [Issues](https://github.com/majixgroup/majix-tools/issues); see [CONTRIBUTING.md](CONTRIBUTING.md). Full documentation in 6 languages: <https://majixlab.com/open-source/majix-tools/docs>. Contact: <contact@majixlab.com>.

## License

[MIT](LICENSE) © MAJIX
