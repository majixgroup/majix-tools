<!-- Proceso de la organización: https://github.com/majixgroup/docs/blob/main/desarrollo/FLUJO-DE-CAMBIOS.md -->

## Qué cambia y por qué

<!-- El diff ya dice el qué; aquí va el porqué. -->

## Cómo se ha probado

- [ ] `npm run typecheck` — 0 errores
- [ ] `npm test` y `npm run test:integracion` — en verde
- [ ] `npm run build` ejecutado y los cambios de `dist/` incluidos en el PR
- [ ] Probado a mano en: <!-- proyecto Vite, gestor de paquetes, Node… -->

## Antes de fusionar

- [ ] **Qué se envía a MAJIX:** no cambia / actualizados a la vez `src/servidor/muestras.ts`, la lista de «Privacidad» del README y las pruebas
- [ ] Textos de la interfaz en español e inglés, con registro profesional
- [ ] Sin dependencias nuevas en tiempo de ejecución (el paquete no tiene ninguna)
- [ ] Sin secretos en el diff
- [ ] **Labels:** un tipo (`bug` / `feature` / `docs` / `chore` / `ci`), el área si aplica y una prioridad
- [ ] Si cambia el comportamiento: versión nueva en `package.json` y `CHANGELOG.md` (las etiquetas publicadas no se mueven)
