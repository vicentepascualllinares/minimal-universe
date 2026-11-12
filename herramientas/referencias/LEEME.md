# Referencias de la huella

- `universos/` — los universos con los que toca `huella.mjs` (copia fija de la biblioteca del
  2026-11-11: «Génesis», «Génesis 2», «Génesis 3» y los dos DUB). No se cambian: si cambian, cambia la
  huella. Están en el formato de antes de ALPHA (sin `motor`): así la huella comprueba también que los
  archivos de antes se siguen leyendo enteros.
- `huella-alpha.json` — la huella del motor ALPHA (2026-11-12, al unificar el MOTOR 1 y el 2). Ver
  `src/motores/LEEME.md`. Antes de unificar se comprobó, con `SINFX=1` (sin efectos de transición), que
  la app con el MOTOR 1 y con ALPHA daban la misma huella en todos los casos.
- Las de antes (`huella-motor-1.json`, `huella-app-motor-1.json`) se borraron con el MOTOR 1 congelado
  (están en git, en c866517 y anteriores).
