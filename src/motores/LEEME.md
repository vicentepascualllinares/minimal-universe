# Motores

Un **motor** es todo el código que hace sonar un universo: generadores, estilos y arquetipos, sintes
(kick, bajo, acordes, pad), el taller de hats y percs, transiciones, espacio (delay, sala, fondo) y el
Deck que lo junta todo. Una **semilla** es una receta para ese motor: si el motor cambia, la misma
semilla da otra cosa. Para que un universo que gusta no se pierda, sus motores se **congelan**.

- `src/` es el motor **EN OBRAS**: el que se sigue cambiando (hoy, el MOTOR 2). Sus semillas pueden
  sonar distinto hasta que se congele.
- `src/motores/N/` es el motor N **CONGELADO**: una copia exacta de `src/audio`, `src/music`,
  `src/core` y `src/motor.js` del día en que se congeló. **No se toca.**
- `src/motores/index.js` es el registro: qué motores hay, cuál está en obras y cuál usa NUEVO
  UNIVERSO de partida.

| Motor | Estado | Desde | Qué tiene |
|---|---|---|---|
| **1** | congelado | 2026-11-11 | el de «Génesis» y todos los universos guardados hasta ese día |
| **2** | en obras | 2026-11-11 | el que se sigue cambiando. Desde 2026-11-12: AFINAR (TECHO, ZONA y 8 del bajo, NOTA del kick; por defecto nada) y registro del bajo en NORMAL (40–140 Hz). ROMINIMAL, igual que el 1 |

## Cómo se usa en la app

- Cada universo **apunta a su motor**: `-M1` al final del código de semilla
  (`968782145-RO100-124-F#EOL-M1`) y `motor` en el archivo. **Sin nada = MOTOR 1** (los códigos y
  archivos de antes de los motores).
- **Traer** un universo (BIBLIOTECA → EN COLA, OPCIONES → UNIVERSOS) lo trae con su motor: el punto
  marca el suyo. Se puede elegir otro para **comparar** la misma semilla en otro motor. En otro motor
  entra **tal como nace** (semilla, estilo, tempo y escala): lo que mutó o se tocó es de los
  generadores de su motor y en otro no tiene por qué encajar.
- **MOTOR** (en GENERAR UNIVERSO, junto al ESTILO; en DJ, en la cabecera de cada universo): con cuál
  nace el próximo NUEVO UNIVERSO. Como el fader de ESTILO: solo cuenta al generar, y traer un universo
  lo pone en el suyo. Punto = el motor del que suena; parpadea = el del que espera al compás; el EN
  OBRAS va subrayado.
- Los dos universos de DJ pueden ser de motores distintos.

## Cómo funciona por dentro

Cada puesto (A y B) tiene el Deck del motor del universo que suena (`src/audio/slots.js`). Si el
universo que espera es de otro motor, su Deck se prepara antes (sus hats y percs grabados con el banco
de su motor, su audio montado) y en el 1 del compás el puesto pasa a él. El Deck viejo suelta lo que
sostiene, deja sonar sus colas 12 s y se desconecta. Lo del intérprete (la parte que suena y su viaje,
lo pulsado, los viajes, el GLOBAL, el fader de ESTILO y la PUREZA, las perillas del PARECIDO) pasa de
uno a otro. El resto del programa ve siempre el mismo objeto por puesto (un Proxy) y no sabe de
motores. Cada motor tiene su propio BANCO DE SONIDOS (su drumsynth).

Lo que **no** es del motor y es común a todos: la mesa y el MIXER, el máster (glue, limitador, techo),
LOW, GRABAR y la interfaz (`src/audio/engine.js`, `strip.js`, `lowRoles.js`, `recorder.js`, `mix.js`,
`src/ui/`). Si se cambian, cambian también para los universos de motores congelados: es la mesa, no
el universo.

## Comprobar que un motor congelado sigue igual (`herramientas/huella.mjs`)

La huella apunta **todo** lo que el motor programa en el audio (cada nodo, conexión, valor, rampa,
golpe y búfer) tocando unos universos fijos (`herramientas/referencias/universos/`) con cambios de
parte, un NUEVO y un PARECIDO por medio. Desde `herramientas/`:

```bash
node huella.mjs ../src/motores/1 --comprobar referencias/huella-motor-1.json
```

```bash
node huella.mjs ../src 1 --comprobar referencias/huella-app-motor-1.json
```

- La primera es la **copia congelada sola**: tiene que dar SIEMPRE «IDÉNTICO». Si no, alguien ha tocado
  `src/motores/1`.
- La segunda es **la app** (la mesa y los puestos de ahora) con universos del MOTOR 1. Si da distinto
  y la primera no, lo que cambió es común (mesa, máster, puestos, lo del intérprete): mirar si era a
  propósito. Si lo era, se guarda otra vez su referencia (`--guardar` en vez de `--comprobar`) y se
  apunta aquí por qué.
- `huella-motor-1.json` se sacó del código de antes de los motores (commit d8587b4): el MOTOR 1 suena
  exactamente como sonaba la app ese día. Sirve para la primera siempre.
- `huella-app-motor-1.json` (2026-11-12): la de la app desde que **los viajes aterrizan en una rejilla
  de su tamaño** (`LANDING` en `slots.js`: un viaje de 4, cada 4 y no cada 8). Es lo único que cambió:
  con la regla de antes, la app daba IDÉNTICO a `huella-motor-1.json`. El sonido de los universos es
  el mismo; cambia en qué compás aterrizan los viajes de la prueba.
- Lo único que cambia de una vez a otra, como siempre, es lo que el programa sortea al tocar con
  `Math.random` (el humanizado de cada golpe, dónde empieza un ruido): eso nunca fue parte del
  universo.

## Reglas

1. **No se edita nada dentro de `src/motores/N/`.** Si algún día el resto del programa cambia de forma
   que un motor congelado ya no encaja (p. ej. el Engine deja de tener algo que su Deck usa), se
   arregla preferiblemente en el lado común (`engine.js`, `slots.js`); si no hay más remedio, el cambio
   mínimo dentro de la copia, y las dos comprobaciones de arriba tienen que seguir dando «IDÉNTICO».
2. Lo que el Deck de un motor usa del Engine (el contrato): `slotOf`, `bankOf`, `instGain`, `fxLevel`,
   `styleMix`, `bornMix`, `universeLoaded`, `applyGlobals`, `stepDur`, `barDur`, `rootHz`, `scale`,
   `bpm`, `rootMidi`, `scaleI`, `scaleNext`, `step`, `nextGrid`, `q`, `noise`, `low` (y lo que llama
   de LOW), `auto`, `generated`, `playing`, `inst`, `mute`, `fxPos`, `fxGain`. Cambiar o quitar algo de esto rompe los motores
   congelados.
3. Antes de un cambio que vaya a cambiar cómo suenan las semillas del motor EN OBRAS, mirar si hay
   universos guardados de ese motor (`motor` en `universos/`). Si los hay y se quieren conservar,
   **congelar primero** (abajo).

## Congelar el motor en obras (p. ej. el 2)

1. Copiar: `src/audio`, `src/music`, `src/core` y `src/motor.js` → `src/motores/2/` (tal cual).
2. En `index.js`: importar `./2/motor.js` como MOTOR 2 `frozen: true` (con fecha y qué tiene), el de
   `../motor.js` pasa a ser el 3 (en obras) y `DEV_MOTOR = 3`.
3. Su huella: `node huella.mjs ../src/motores/2 --guardar referencias/huella-motor-2.json`, y comprobar
   que `node huella.mjs ../src 2 --comprobar referencias/huella-motor-2.json` da «IDÉNTICO».
4. Apuntarlo en la tabla de arriba, en el README («Motores») y en el registro de cambios.

Cada copia ocupa ~430 KB de código (el navegador la carga entera al abrir la app; es poco).
