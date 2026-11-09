import type { Plugin } from "vite";

export type OpcionesMajixTools = {
  /** Inyecta el panel en index.html automáticamente. Por defecto, true. */
  inyectar?: boolean;
  /** Permite usar los endpoints desde otros equipos de tu red. Por defecto, false. */
  red?: boolean;
  /** Alias en inglés de `inyectar`: injects the panel into index.html. Default: true. */
  inject?: boolean;
  /** Alias en inglés de `red`: lets other machines on your network use the endpoints. Default: false. */
  network?: boolean;
};

/** El plugin de MAJIX Tools. Solo se ejecuta con el servidor de desarrollo. */
export declare function majixTools(opciones?: OpcionesMajixTools): Plugin;
export default majixTools;
