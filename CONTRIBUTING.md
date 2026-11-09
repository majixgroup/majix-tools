# Contribuir / Contributing

¡Gracias por querer mejorar MAJIX Tools! / Thank you for wanting to improve MAJIX Tools!

## Antes de empezar

- Abre una [incidencia](https://github.com/majixgroup/majix-tools/issues) para comentar el cambio si es grande: así evitamos trabajo duplicado.
- Los cambios que afecten a **lo que se envía a MAJIX** deben actualizar a la vez `src/servidor/muestras.ts`, la lista de «Privacidad» del README y las pruebas. Esa lista es una promesa a quien usa la herramienta.
- Nada de pagos, claves ni datos personales dentro de la herramienta: los planes se contratan siempre en majixlab.com.

## Cómo trabajar

```bash
git clone https://github.com/majixgroup/majix-tools.git && cd majix-tools
npm install
npm run typecheck
npm test
npm run test:integracion
```

La carpeta `dist/` se confirma en el repositorio a propósito (la instalación directa desde GitHub no compila nada): tras cambiar el código, ejecuta `npm run build` y confirma también `dist/`.

## Pull requests

- Una rama por cambio, desde `main`; un título claro y una descripción de qué cambia y por qué.
- Pruebas verdes (`npm test` y `npm run test:integracion`) y sin errores de `npm run typecheck`.
- Textos de la interfaz en español e inglés (`src/cliente/idioma.tsx`, `src/cli/textos.ts`), con registro profesional.
- Sin dependencias nuevas en tiempo de ejecución sin discutirlo antes: el paquete debe seguir sin ninguna.

## English

Open an issue first for large changes. Changes to what is sent to MAJIX must update `src/servidor/muestras.ts`, the README's privacy list and the tests together. Keep `dist/` committed (run `npm run build`). Tests must pass, UI text must exist in Spanish and English, and the package must keep zero runtime dependencies.
