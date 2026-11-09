/* ---------------------------------------------------------------------- *
 * LOS DATOS DEL PROYECTO, EN UN SOLO SITIO
 *
 * La versión la pone el script de compilación (`__MAJIX_TOOLS_VERSION__`,
 * leída de package.json): así la pantalla de carga del panel nunca puede
 * decir una versión distinta de la que está instalada.
 * ---------------------------------------------------------------------- */

declare const __MAJIX_TOOLS_VERSION__: string;

export const PROYECTO = {
  nombre: "MAJIX Tools",
  version: typeof __MAJIX_TOOLS_VERSION__ === "string" ? __MAJIX_TOOLS_VERSION__ : "0.0.0",
  docs: "https://majixlab.com/open-source/majix-tools/docs",
  portada: "https://majixlab.com/open-source/majix-tools",
  repositorio: "https://github.com/majixgroup/majix-tools",
  web: "https://majixlab.com",
  planes: "https://majixlab.com/open-source/majix-tools/planes",
  panel: "https://panel.majixlab.com/open-source",
  x: "https://x.com/majixlab",
  linkedin: "https://www.linkedin.com/company/majix-lab",
} as const;

/** Donde responde el plugin de Vite (ver `src/vite/index.ts`). */
export const API = "/__majix-tools/api";
