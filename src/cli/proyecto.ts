import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/* ---------------------------------------------------------------------- *
 * QUÉ PROYECTO ES ESTE — lo que la CLI averigua antes de tocar nada
 * ---------------------------------------------------------------------- */

export type GestorPaquetes = "npm" | "pnpm" | "yarn" | "bun";

export type Framework =
  | { id: "spa"; nombre: string }
  | { id: "tanstack-start"; nombre: string; raiz: string | null }
  | { id: "react-router"; nombre: string; raiz: string | null }
  | { id: "remix"; nombre: string; raiz: string | null }
  | { id: "sveltekit"; nombre: string; raiz: string }
  | { id: "no-soportado"; nombre: string; motivo: string };

export type Proyecto = {
  dir: string;
  paquete: {
    name?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  gestor: GestorPaquetes;
  viteDeclarado: string | null;
  viteInstalado: string | null;
  configVite: string | null;
  framework: Framework;
  instalado: string | null;
};

const CONFIGS = ["vite.config.ts", "vite.config.mts", "vite.config.js", "vite.config.mjs", "vite.config.cts", "vite.config.cjs"];

function leerJson<T>(ruta: string): T | null {
  try {
    return JSON.parse(readFileSync(ruta, "utf8")) as T;
  } catch {
    return null;
  }
}

function primeroQueExista(dir: string, rutas: string[]): string | null {
  for (const r of rutas) if (existsSync(join(dir, r))) return r;
  return null;
}

export function detectarGestor(dir: string): GestorPaquetes {
  /* El que lanzó la orden manda (`pnpm dlx majix-tools init` → pnpm). */
  const agente = process.env.npm_config_user_agent ?? "";
  if (agente.startsWith("pnpm")) return "pnpm";
  if (agente.startsWith("yarn")) return "yarn";
  if (agente.startsWith("bun")) return "bun";
  if (existsSync(join(dir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(dir, "yarn.lock"))) return "yarn";
  if (existsSync(join(dir, "bun.lockb")) || existsSync(join(dir, "bun.lock"))) return "bun";
  return "npm";
}

export function ordenInstalar(gestor: GestorPaquetes, que: string): [string, string[]] {
  switch (gestor) {
    case "pnpm":
      return ["pnpm", ["add", "-D", que]];
    case "yarn":
      return ["yarn", ["add", "-D", que]];
    case "bun":
      return ["bun", ["add", "-d", que]];
    default:
      return ["npm", ["install", "-D", que]];
  }
}

export function ordenDesinstalar(gestor: GestorPaquetes): [string, string[]] {
  switch (gestor) {
    case "pnpm":
      return ["pnpm", ["remove", "majix-tools"]];
    case "yarn":
      return ["yarn", ["remove", "majix-tools"]];
    case "bun":
      return ["bun", ["remove", "majix-tools"]];
    default:
      return ["npm", ["uninstall", "majix-tools"]];
  }
}

function detectarFramework(dir: string, deps: Record<string, string>): Framework {
  if (deps.next) {
    return { id: "no-soportado", nombre: "Next.js", motivo: "next" };
  }
  if (deps.nuxt) return { id: "no-soportado", nombre: "Nuxt", motivo: "nuxt" };
  if (deps.astro) return { id: "no-soportado", nombre: "Astro", motivo: "astro" };
  if (deps["@angular/core"] && !deps.vite) {
    return { id: "no-soportado", nombre: "Angular", motivo: "sin-vite" };
  }
  if (deps["@tanstack/react-start"] || deps["@tanstack/solid-start"]) {
    return {
      id: "tanstack-start",
      nombre: "TanStack Start",
      raiz: primeroQueExista(dir, [
        "src/routes/__root.tsx",
        "app/routes/__root.tsx",
        "src/routes/__root.jsx",
        "app/routes/__root.jsx",
      ]),
    };
  }
  if (deps["@react-router/dev"]) {
    return {
      id: "react-router",
      nombre: "React Router",
      raiz: primeroQueExista(dir, ["app/root.tsx", "app/root.jsx", "src/root.tsx"]),
    };
  }
  if (deps["@remix-run/dev"]) {
    return {
      id: "remix",
      nombre: "Remix",
      raiz: primeroQueExista(dir, ["app/root.tsx", "app/root.jsx"]),
    };
  }
  if (deps["@sveltejs/kit"]) {
    return {
      id: "sveltekit",
      nombre: "SvelteKit",
      raiz: primeroQueExista(dir, ["src/hooks.client.ts", "src/hooks.client.js"]) ?? "src/hooks.client.ts",
    };
  }
  const nombre = deps.react
    ? "React + Vite"
    : deps.vue
      ? "Vue + Vite"
      : deps.svelte
        ? "Svelte + Vite"
        : deps["solid-js"]
          ? "Solid + Vite"
          : deps.preact
            ? "Preact + Vite"
            : deps.lit
              ? "Lit + Vite"
              : "Vite";
  return { id: "spa", nombre };
}

/** Lee el proyecto de `dir`. `null` si no hay package.json. */
export function leerProyectoLocal(dir: string): Proyecto | null {
  const paquete = leerJson<Proyecto["paquete"]>(join(dir, "package.json"));
  if (!paquete) return null;
  const deps = { ...paquete.dependencies, ...paquete.devDependencies };
  const viteInstalado = leerJson<{ version: string }>(join(dir, "node_modules", "vite", "package.json"))?.version ?? null;
  const instalado =
    leerJson<{ version: string }>(join(dir, "node_modules", "majix-tools", "package.json"))?.version ?? null;
  return {
    dir,
    paquete,
    gestor: detectarGestor(dir),
    viteDeclarado: deps.vite ?? null,
    viteInstalado,
    configVite: primeroQueExista(dir, CONFIGS),
    framework: detectarFramework(dir, deps),
    instalado,
  };
}

/** Versión mayor de Vite, de lo instalado o, si no, de lo declarado. */
export function mayorDeVite(p: Proyecto): number | null {
  const fuente = p.viteInstalado ?? p.viteDeclarado;
  const m = fuente?.match(/(\d+)\./) ?? fuente?.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}
