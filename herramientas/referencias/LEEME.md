# Referencias de la huella

- `universos/` — los universos con los que toca `huella.mjs` (copia fija de la biblioteca del
  2026-11-11: «Génesis», «Génesis 2», «Génesis 3» y los dos DUB). No se cambian: si cambian, cambia la
  huella de todos los motores.
- `huella-motor-1.json` — la huella del MOTOR 1, sacada del código de antes de los motores (commit
  d8587b4). Ver `src/motores/LEEME.md`.
- `huella-app-motor-1.json` — la de la app con universos del MOTOR 1 desde 2026-11-12, cuando los
  viajes pasaron a aterrizar en una rejilla de su tamaño (`LANDING`, `src/audio/slots.js`). Con la
  regla de antes la app daba IDÉNTICO a `huella-motor-1.json`. Ver `src/motores/LEEME.md`.
  Rehecha el mismo día con la ENTRADA DEL DROP y el HUECO común a todos los motores (`src/audio/drop.js`)
  y la ESCALA de cada puesto (`Engine.keyView`: en el caso de los DUB, B ya no toca en la tónica de A).
