/** Monta el panel ya, sin esperar a que el navegador esté libre. Devuelve la función que lo desmonta. */
export declare function montar(): Promise<() => void>;
/** Quita el panel de la página (el medidor y el grabador siguen activos). */
export declare function desmontar(): Promise<void>;
/** Mounts the panel now (English alias of `montar`). */
export declare const mount: typeof montar;
/** Removes the panel (English alias of `desmontar`). */
export declare const unmount: typeof desmontar;
