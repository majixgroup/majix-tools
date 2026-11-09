import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import Panel from "./Panel";
import { ProveedorIdioma } from "./idioma";
import { ProveedorSesion } from "./sesion";
import { PROYECTO } from "./proyecto";
import estilos from "./estilos.css?texto";

/* ---------------------------------------------------------------------- *
 * EL MONTAJE DEL PANEL — el trozo pesado, que se carga el último
 *
 * Lo importa `index.ts` cuando el navegador está desocupado tras la carga
 * (ver allí el porqué).
 *
 * ── POR QUÉ UN SHADOW DOM ──
 * El panel se pinta dentro de un Shadow DOM con su propia hoja de estilos:
 * el CSS de tu web no le llega, y el suyo no toca tu web. Da igual que uses
 * Tailwind, otro sistema o nada.
 *
 * ── POR QUÉ SU PROPIO REACT ──
 * Este fichero lleva React dentro (solo existe en desarrollo, así que el
 * peso no le llega a nadie). El panel es un árbol aparte: no comparte
 * estado ni contexto con tu aplicación, y funciona igual si tu web está
 * hecha con Vue, Svelte, React 18, React 19 o JavaScript sin framework.
 * ---------------------------------------------------------------------- */

const ID = "majix-tools";

type Montaje = { host: HTMLElement; raiz: Root };
const g = globalThis as typeof globalThis & { __majixToolsMontaje?: Montaje };

/** Monta el panel si no lo está ya. Devuelve una función que lo desmonta. */
export function montar(): () => void {
  if (typeof document === "undefined") return () => {};
  if (g.__majixToolsMontaje) return desmontar;

  const host = document.createElement("div");
  host.id = ID;
  host.setAttribute("data-majix-tools", PROYECTO.version);
  const sombra = host.attachShadow({ mode: "open" });

  const hoja = document.createElement("style");
  hoja.textContent = estilos;
  sombra.appendChild(hoja);

  const contenedor = document.createElement("div");
  contenedor.className = "raiz";
  sombra.appendChild(contenedor);

  /* Al final del <body>: queda por encima de todo sin tocar nada de lo que
     ya hay. Si el <body> todavía no existe (el panel se importó desde el
     <head>), se espera a que exista. */
  const colgar = () => document.body.appendChild(host);
  if (document.body) colgar();
  else document.addEventListener("DOMContentLoaded", colgar, { once: true });

  const raiz = createRoot(contenedor);
  raiz.render(
    <StrictMode>
      <ProveedorIdioma>
        <ProveedorSesion>
          <Panel />
        </ProveedorSesion>
      </ProveedorIdioma>
    </StrictMode>,
  );
  g.__majixToolsMontaje = { host, raiz };
  return desmontar;
}

export function desmontar(): void {
  const m = g.__majixToolsMontaje;
  if (!m) return;
  m.raiz.unmount();
  m.host.remove();
  g.__majixToolsMontaje = undefined;
}

