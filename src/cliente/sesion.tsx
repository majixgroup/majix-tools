import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Instantanea } from "../servidor/cuenta";
import { API } from "./proyecto";
import { reanudarEnvio } from "./sincronizar";

/* ---------------------------------------------------------------------- *
 * LA SESIÓN, DENTRO DEL PANEL
 *
 * El panel NO tiene tu token ni lo ve nunca: le pregunta a tu servidor de
 * desarrollo (`/__majix-tools/api/sesion`) y recibe solo «conectada», tu plan
 * y tu correo con asteriscos. Todo lo que cambia algo (iniciar o cerrar
 * sesión) es un POST con la cabecera `X-Majix-Tools`, que ninguna otra web
 * puede mandar desde tu navegador.
 * ---------------------------------------------------------------------- */

export type Sesion = Instantanea;

type Contexto = {
  /** `null` mientras se hace la primera pregunta. */
  sesion: Sesion | null;
  iniciar: () => Promise<void>;
  cancelar: () => Promise<void>;
  cerrar: () => Promise<void>;
  /** Vuelve a preguntar a MAJIX (por ejemplo, tras comprar un plan). */
  refrescar: () => Promise<void>;
};

const Ctx = createContext<Contexto | null>(null);

async function pedir(ruta: string, post: boolean): Promise<Sesion | null> {
  try {
    const res = await fetch(`${API}/${ruta}`, {
      method: post ? "POST" : "GET",
      headers: post ? { "X-Majix-Tools": "1" } : undefined,
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Sesion;
  } catch {
    return null;
  }
}

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const antes = useRef<string | null>(null);
  const ultimoRefresco = useRef(0);

  const aplicar = useCallback((s: Sesion | null) => {
    if (!s) return;
    if (s.estado === "conectada" && antes.current !== "conectada") reanudarEnvio();
    antes.current = s.estado;
    setSesion(s);
  }, []);

  const leer = useCallback(async () => aplicar(await pedir("sesion", false)), [aplicar]);

  /* Cada 2 s mientras se espera la aprobación; despacio el resto del tiempo. */
  const estado = sesion?.estado;
  useEffect(() => {
    void leer();
    const cada = estado === "esperando" ? 2000 : 30_000;
    const id = window.setInterval(() => void leer(), cada);
    return () => window.clearInterval(id);
  }, [estado, leer]);

  const refrescar = useCallback(async () => {
    ultimoRefresco.current = Date.now();
    aplicar(await pedir("sesion/refrescar", true));
  }, [aplicar]);

  /* Al volver a esta pestaña se vuelve a comprobar el plan (como mucho cada 30 s): así, tras pagar en la web,
     lo ves activado al volver, sin reiniciar nada. */
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState !== "visible") return;
      if (antes.current !== "conectada" && antes.current !== "sin-red") return;
      if (Date.now() - ultimoRefresco.current < 30_000) return;
      void refrescar();
    };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
    };
  }, [refrescar]);

  const valor = useMemo<Contexto>(
    () => ({
      sesion,
      iniciar: async () => aplicar(await pedir("sesion/iniciar", true)),
      cancelar: async () => aplicar(await pedir("sesion/cancelar", true)),
      cerrar: async () => aplicar(await pedir("sesion/cerrar", true)),
      refrescar,
    }),
    [sesion, aplicar, refrescar],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useSesion(): Contexto {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSesion fuera de <ProveedorSesion>");
  return c;
}
