# MINIMAL UNIVERSE

Instrumento generativo en directo para minimal / rominimal / deep / house experimental.
No se tocan parámetros de sonido: se toca **estructura** y **emoción**, y el sistema
traduce eso a timbre, decay, saturación, espacio, densidad, swing y armonía.

Al entrar eliges el modo:

- **UN UNIVERSO** — un solo mundo, con los pads grandes (estructura · transición · emoción · loop en una fila).
- **DJ** — dos universos (A y B) a la vez, siempre en fase, mezclados en una mesa central.

En móvil o tablet la interfaz se adapta para que quepa todo sin scroll y se puede tocar
con varios dedos a la vez (cada control sigue a su propio dedo). En vertical, estructura
arriba y emoción abajo; en horizontal, todo en una fila. En modo DJ, pestañas
UNIVERSO A · MEZCLA · UNIVERSO B. Para usarlo desde el móvil, el móvil tiene que llegar
al servidor (ver abajo).

## Arrancar

Doble clic en **INICIAR.bat**: arranca el servidor local y abre el navegador.
Deja abierta la ventana negra mientras tocas; ciérrala para apagar.

(No abras `index.html` directamente: el navegador bloquea el motor en `file://`.)

**Desde el móvil:** doble clic en **INICIAR (movil).bat** en el ordenador. La ventana negra
muestra una dirección tipo `http://192.168.x.x:5317`: ábrela en el navegador del móvil,
conectado a la misma wifi. La primera vez Windows puede preguntar por el firewall: permite
redes privadas. Si ya tenías abierto INICIAR.bat, ciérralo antes. En iPhone, si no suena,
quita el modo silencio.
Requiere [Node.js](https://nodejs.org). Alternativa manual: `node serve.mjs` y abrir http://localhost:5317.

## Cada universo (izquierda A, derecha B)

| Control | Qué hace |
|---|---|
| **ESTRUCTURA** (XY) | TODO ↗ · DEEP ↘ (kick + bass) · NADA ↙ · NO DEEP ↖ (todo menos kick y bass). Cada instrumento entra al superar su umbral; lo que sobra es su densidad. |
| **TRANSICIÓN** (vertical) | Arriba: entradas/salidas con filtro (HP para kick/bass, LP para el resto, con resonancia). Abajo: con volumen. En medio: mezcla. Duración: 1–16 compases. Se cuantiza a la siguiente negra. |
| **EMOCIÓN** (XY) | X oscuro → luminoso, Y quieto → intenso. Esquinas: TENSIÓN, EUFORIA, ABISMO, CALIDEZ. Tiene inercia (~2 s). |
| **LOOP** | Repite los últimos 1/2/4/8 compases con todo congelado. Por debajo mueves lo que quieras sin que se oiga (fantasma en los pads, instrumentos pendientes parpadean). Al soltarlo entra el cambio en el siguiente compás. |
| **SALIDA** | INSTANTÁNEA: todo salta a la vez. PROGRESIVA: viaja al nuevo estado durante 1–16 compases. |
| **NUEVO UNIVERSO** | Otros motivos y otro kit de percusión para ese universo (en el siguiente compás; si está en loop, al soltarlo). |

## Mesa de mezcla (centro)

| Control | Qué hace |
|---|---|
| HI / MID / LOW | EQ por canal. Centro = 0 dB, derecha hasta +6 dB, izquierda hasta −40 dB (casi corte total). |
| FILTRO | Centro abierto. Izquierda = low pass, derecha = high pass, con algo de resonancia. |
| Faders | Volumen de cada universo, con medidor al lado. A empieza arriba y B abajo. |

Knobs: arrastrar en vertical (Shift = fino), rueda, doble clic = centro.

## Global (cabecera)

- **BPM**: arrastrar o rueda (100–140).
- **Tónica**: arrastrar o rueda (E–B). El kick de ambos universos se afina a ella.
- **Modo** (frigio · eólico · dórico · mixolidio): global, lo decide la emoción del universo que más suena (valencia ponderada por los faders). Así A y B nunca chocan armónicamente.

## Teclado

ESPACIO play/pausa (o tocar EN VIVO / PAUSA en la cabecera)

- UN UNIVERSO: L loop · N nuevo universo (también Q / W)
- DJ: Q loop A · W nuevo universo A · O nuevo universo B · P loop B

## Cómo está hecho

Todo es síntesis en tiempo real con Web Audio, sin samples ni dependencias.

- `src/audio/engine.js` — reloj común (Worker + lookahead), BPM, tónica y modo globales, master (glue + limitador).
- `src/audio/deck.js` — un universo: 6 canales, reverb y delay propios, loop, secuenciador.
- `src/audio/strip.js` — canal de mezcla: EQ 3 bandas, filtro DJ, fader, medidor.
- `src/audio/dsp.js` — canal de instrumento (drive → HP → LP → fade → duck), saturación, reverb.
- `src/audio/voices.js` — kick, clap, hats tipo 808, percusión (tono / FM / ruido), bajo.
- `src/music/emotion.js` — el mapa emoción → mundo sonoro (valencia × activación).
- `src/music/generators.js` — motivos estables con mutación lenta, percusión polimétrica, bajo en grados de escala.
- `src/music/arrangement.js` — presencia por instrumento, umbrales, transiciones.
- `src/ui/` — pads XY, sliders, knobs y la vista de universo (se instancia dos veces).
