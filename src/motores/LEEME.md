# Motores

Un **motor** es todo el código que hace sonar un universo: generadores, estilos y arquetipos, sintes
(kick, bajo, acordes, pad), el taller de hats y percs, transiciones, espacio (delay, sala, fondo) y el
Deck que lo junta todo. Una **semilla** es una receta para ese motor: si el motor cambia, la misma
semilla puede dar otra cosa.

## Hoy: un solo motor, ALPHA (desde 2026-11-12)

| Motor | Estado | Desde | Qué tiene |
|---|---|---|---|
| **ALPHA** | en `src/`, se sigue cambiando | 2026-11-12 | todo. Une el MOTOR 1 (congelado el 2026-11-11) y el MOTOR 2 (en obras): el 1 cabía entero en el 2 |

**Por qué se unificaron.** El 2026-11-12 se comprobó que el MOTOR 2 no quitaba nada del 1: AFINAR,
por defecto, no cambia nada; el azar de las transiciones es aparte del de la música; y el registro del
bajo de NORMAL (40–140 Hz) es lo que se quiere para todos (ningún bajo de minimal tiene la fundamental
por encima). Con `herramientas/huella.mjs` y los viajes **sin efectos de transición** (`SINFX=1`), los
universos guardados del MOTOR 1 y las semillas de prueba suenan con ALPHA **idénticos** a como sonaban
en el 1. Lo único distinto son las transiciones (las nuevas: SHH, redoble y kick que suben, sin riser
tonal), que era lo que se quería.

**Cómo se sigue trabajando.** ALPHA se cambia **sin congelar**, con cambios que **no quitan nada de lo
que había**: lo nuevo nace apagado o en lo de antes para los universos de antes (p. ej. un canal de
percusión nuevo, en silencio en los universos generados cuando no existía; un generador nuevo, con su
propio azar para no mover los números del resto). Comprobación, después de cada cambio así (abajo):
la huella de ALPHA tiene que seguir dando «IDÉNTICO».

**Cuándo habrá otro motor.** Cuando lo acumulado (o una feature: capas, ADN, cambios de patrones)
**niegue algo que existía** y los universos guardados ya no puedan sonar igual. Entonces, o se
unifica otra vez (si lo que cambia se acepta para todos, como el 2026-11-12) o se **salta a un motor
nuevo**: ALPHA se congela y el nuevo lleva **otro nombre** (BETA...), nunca un número de los de antes.

## Cómo se ve en la app

- Cada universo **apunta a su motor**: `-ALPHA` al final del código de semilla
  (`968782145-RO100-124-F#EOL-ALPHA`) y `motor: "alpha"` en el archivo. Todos los de `universos/` se
  reescribieron así el 2026-11-12 (y pasaron a `universos/Alpha/`).
- Los códigos y archivos **de antes** (`-M1`, `-M2` o sin motor; `motor: 1`, `2` o nada) se siguen
  leyendo y suenan con ALPHA, enteros (con lo que mutó y se tocó). El `-M1`/`-M2` no se vuelve a
  escribir.
- **MOTOR** (en GENERAR UNIVERSO; en DJ, en el panel de cada universo) enseña el motor con el que nace
  el próximo NUEVO UNIVERSO: hoy, solo ALPHA. Al TRAER un universo, la línea MOTOR (para comparar una
  semilla en otro motor) solo aparece si hay más de uno.

## Cómo funciona por dentro (listo para cuando haya más de uno)

- `index.js` es el registro: qué motores hay (por nombre: `alpha`) y cuál usa NUEVO UNIVERSO de
  partida (`DEV_MOTOR`). Un universo de un motor que no está en el registro suena con el de partida.
- `src/music/universe.js` (`MOTOR_CODES`) traduce el nombre del código de semilla (`ALPHA` → `alpha`).
  Un motor nuevo se añade también ahí.
- Cada puesto (A y B) tiene el Deck del motor del universo que suena (`src/audio/slots.js`). Si el
  universo que espera es de otro motor, su Deck se prepara antes (sus hats y percs grabados con el banco
  de su motor, su audio montado) y en el 1 del compás el puesto pasa a él. El Deck viejo suelta lo que
  sostiene, deja sonar sus colas 12 s y se desconecta. Lo del intérprete (la parte que suena y su
  viaje, lo pulsado, los viajes, el GLOBAL, el fader de ESTILO y la PUREZA, las perillas del PARECIDO)
  pasa de uno a otro. El resto del programa ve siempre el mismo objeto por puesto (un Proxy). Cada
  motor tiene su propio BANCO DE SONIDOS (su drumsynth). Con un solo motor, nada de esto se nota.
- Lo que **no** es del motor y es común a todos: la mesa y el MIXER, el máster (glue, limitador,
  techo), LOW, GRABAR y la interfaz (`src/audio/engine.js`, `strip.js`, `lowRoles.js`, `recorder.js`,
  `mix.js`, `src/ui/`). Y lo del **intérprete**, que se pone en cada Deck desde `slots.js`: dónde
  aterriza un viaje (`LANDING`), cancelar un viaje, la ENTRADA DEL DROP y el HUECO ANTES DEL KICK
  (`src/audio/drop.js`) y la ESCALA de cada puesto (`Engine.keyView`).

## Comprobar que un cambio no quita nada (`herramientas/huella.mjs`)

La huella apunta **todo** lo que el motor programa en el audio (cada nodo, conexión, valor, rampa,
golpe y búfer) tocando unos universos fijos (`herramientas/referencias/universos/`, en formato de antes
de ALPHA: así también comprueba que se siguen leyendo) y unas semillas, con cambios de parte, un NUEVO
y un PARECIDO por medio. Desde `herramientas/`:

```bash
node huella.mjs ../src --comprobar referencias/huella-alpha.json
```

- Tiene que dar «IDÉNTICO» después de cualquier cambio que no deba tocar lo que ya suena.
- Si da distinto **a propósito** (un cambio aceptado para todos los universos), se guarda otra vez la
  referencia (`--guardar` en vez de `--comprobar`) y se apunta aquí por qué y qué fecha.
- Para comparar solo la música y el sonido, sin los efectos de transición: `SINFX=1`.
- Lo único que cambia de una vez a otra es lo que el programa sortea al tocar con `Math.random` (el
  humanizado de cada golpe, dónde empieza un ruido): eso nunca fue parte del universo, y la huella lo
  siembra.

Historial de la referencia:
- `huella-alpha.json` (2026-11-12): ALPHA recién unificado. Las de antes (`huella-motor-1.json`,
  `huella-app-motor-1.json`) se borraron con el MOTOR 1 congelado (están en git).

## Saltar a un motor nuevo (congelar ALPHA)

1. Copiar: `src/audio`, `src/music`, `src/core` y `src/motor.js` → `src/motores/alpha/` (tal cual). No
   se vuelve a editar nada dentro.
2. En `index.js`: importar `./alpha/motor.js` como `alpha` con `frozen: true` (con fecha y qué tiene) y
   el de `../motor.js` con su nombre nuevo (`beta`), que pasa a ser `DEV_MOTOR`.
3. En `src/music/universe.js`, `MOTOR_CODES`: añadir `BETA: 'beta'`.
4. Huella del congelado: `node huella.mjs ../src/motores/alpha --guardar referencias/huella-alpha-congelado.json`,
   y comprobar que `node huella.mjs ../src alpha --comprobar referencias/huella-alpha.json` sigue dando
   «IDÉNTICO» (la app con universos de ALPHA).
5. Lo que el Deck de un motor usa del Engine (el contrato, que no se puede romper mientras haya
   congelados): `slotOf`, `bankOf`, `instGain`, `fxLevel`, `styleMix`, `bornMix`, `universeLoaded`,
   `applyGlobals`, `stepDur`, `barDur`, `rootHz`, `scale`, `bpm`, `rootMidi`, `scaleI`, `scaleNext`,
   `step`, `nextGrid`, `q`, `noise`, `low` (y lo que llama de LOW), `auto`, `generated`, `playing`,
   `inst`, `mute`, `fxPos`, `fxGain`.
6. Apuntarlo en la tabla de arriba, en el README («Motores») y en el registro de cambios.

Cada copia ocupa ~430 KB de código (el navegador la carga entera al abrir la app; es poco).
