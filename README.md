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

## Versión móvil y versión ordenador

El mismo programa elige solo su perfil:

- **Ordenador**: el motor completo, sin cambios.
- **Móvil** (Android / iPhone / iPad): misma música, optimizada para que el audio no se corte:
  búfer de audio de ~45 ms, margen de programación adaptativo (150–300 ms, sube solo si el
  móvil se atasca), hats grabados en segundo plano con el mismo motor del PC y reproducidos
  como sample (2 nodos por golpe en vez de 9; se regraban si la emoción cambia el timbre),
  un panorama fijo por carril de percusión, bajo sin osciladores inaudibles, reverb de 2 s,
  saturación sin sobremuestreo, ajustes solo cuando cambian, canvas a menor resolución y sin
  osciloscopio. Unos la mitad de nodos de audio por segundo. En la cabecera aparece
  **AUDIO OK** o **CORTES n** (cortes detectados).

Para forzar un perfil: añade `?movil` o `?pc` a la dirección. Si en algún móvil hay cortes,
`?estable` usa el búfer más grande posible (más latencia, máxima estabilidad).

Con auriculares Bluetooth el propio Bluetooth añade unos 150–250 ms que el programa no puede
quitar; con cable o con el altavoz la respuesta es mucho más inmediata.

## Cada universo (izquierda A, derecha B)

| Control | Qué hace |
|---|---|
| **ESTRUCTURA** (XY) | Los momentos de un tema (ver abajo). X = ritmo, Y = música. Al mover el cursor el sonido lo sigue de forma progresiva. Pulsar el nombre de una esquina = viajar ahí. |
| **TRANSICIÓN** (vertical) | Cómo entra y sale cada instrumento. Arriba: con filtro (HP para kick/bass, LP para el resto, con resonancia). Abajo: con volumen. En medio: mezcla. Debajo, **A ESQUINA**: cuánto dura el viaje al pulsar una esquina (YA, 1, 2, 4, 8, 16, 32 compases). |
| **EMOCIÓN** (XY) | X oscuro → luminoso, Y quieto → intenso. Esquinas: TENSIÓN, EUFORIA, ABISMO, CALIDEZ. Tiene inercia (~2 s). |
| **LOOP** | Repite los últimos 1/2/4/8 compases con todo congelado. Por debajo mueves lo que quieras sin que se oiga (fantasma en los pads, instrumentos pendientes parpadean). Al soltarlo entra el cambio en el siguiente compás. |
| **SALIDA** | INSTANTÁNEA: todo salta a la vez. PROGRESIVA: viaja al nuevo estado durante 1–16 compases. |
| **COMPLEJIDAD** (barra en la cabecera) | SIMPLE ← → COMPLEJO. Cuánta información dice el universo entero (ver abajo). Se aplica en el siguiente compás. Rueda = fino, doble clic = valor inicial (0,4). En DJ y en móvil las etiquetas son − / +. |
| **NUEVO UNIVERSO** | Otros motivos y otro kit de percusión para ese universo (en el siguiente compás; si está en loop, al soltarlo). |

## Estructura: los momentos de un tema

```
SIN DRUMS ┌───────────┐ TODO
          │           │
BREAK     └───────────┘ SOLO DRUMS
```

| Esquina | Qué suena |
|---|---|
| **SOLO DRUMS** | kick, hats, clap, open hat y percusión: la entrada / salida para mezclar |
| **TODO** | todo; el pad algo al fondo y filtrado |
| **SIN DRUMS** | bajo, acordes y pad: el momento en que se quita el kick |
| **BREAK** | el pad a tope, algo de percusión, unos acordes y un hat lejano. Sin kick ni bajo |

- Cada borde es una transición típica: **derecha** = la subida (entra la música sobre los
  drums), **arriba** = se quitan los drums, **izquierda** = se va el bajo y queda la
  atmósfera, **abajo** = entra el groove.
- **Progresivo**: al pasar el umbral de un instrumento no entra de golpe. Su cantidad
  (filtro o volumen, según TRANSICIÓN, y su densidad) crece poco a poco hasta llegar a la
  esquina. Por el borde de abajo, por ejemplo, el kick va 0 → 6 % → 20 % → 40 % → 60 % → 80 % → 100 %.
- **Viajar a una esquina**: pulsa su nombre. Empieza en la siguiente negra y tarda los
  compases elegidos en A ESQUINA (YA = al instante). El título muestra
  "→ ESQUINA · N COMP.". Pulsa la **misma esquina** otra vez para **pausar** y otra más para
  seguir. Pulsar **otra esquina** cambia el destino desde donde estés. **Mover el cursor
  cancela** el viaje.
- Con **LOOP** activo, pulsar una esquina la deja pendiente; al soltar el loop se aplica
  según SALIDA (instantánea o progresiva).

## Instrumentos

KICK · BASS · HAT · PERC · CLAP · OPEN (hat abierto) · **CHORD** · **PAD**.

- **CHORD** — acordes dub: stabs cortos con filtro que se cierra y mucho delay. Ritmo en
  contratiempo que nunca pisa al kick. A tope en SIN DRUMS y en TODO, un poco en el BREAK.
- **PAD** — la atmósfera: un acorde largo con filtro que respira y un poco de aire (ruido
  filtrado). Manda en el BREAK y en SIN DRUMS; en TODO se aparta. Mientras suena sigue a la emoción en vivo.
- Los dos comparten una progresión de 8 compases en grados de escala (un solo acorde, o la
  casa y otro: iv, VI, VII o v). Si el modo cambia, se recolorean al compás siguiente.
- La emoción decide el resto: ABISMO = acordes oscuros con cola larga y pad presente;
  EUFORIA = stabs cortos y brillantes, pad al fondo; TENSIÓN = sierra, resonancia, desafinado.
- El kick los hace bombear un poco (sidechain), y NUEVO UNIVERSO cambia también la armonía.

## Complejidad

Un solo control por universo que decide cuántas cosas pasan, sin tocar el sonido:

| | SIMPLE | COMPLEJO |
|---|---|---|
| Rejilla | corcheas: el hat es el "tss" en contratiempo | semicorcheas en hats, bajo, acordes y percusión |
| Percusión | 1 capa de polimetría | hasta 4 capas |
| Bajo | tónica y octava, siempre el mismo motivo | todas las notas, variación cada 4 compases |
| Acordes | 2 notas, un solo acorde, stabs muy espaciados | 4 notas, progresión, stabs seguidos |
| Pad | respira cada 4–8 compases | cada 2–4 |
| Clap / open hat | rectos | fantasmas, estilos desplazados, golpe extra |
| Kick | sin kicks fantasma | kicks fantasma (tensión, euforia) |
| Redobles y mutación | casi nada: hipnótico | frecuentes |

Además, dos reglas para que no compita todo a la vez:

- **Protagonismo**: hay un presupuesto de instrumentos "a tope" (≈2 en SIMPLE, todos en
  COMPLEJO). Si en la estructura entran más, ceden densidad por orden: primero percusión,
  acordes y open hat; luego clap y hat; el bajo casi nada. El kick y el pad no ceden.
- **Turnos** (por debajo de 0,6): los acordes esquivan al bajo (se mueven una corchea, como
  respuesta) y la percusión deja libres los golpes de acordes y clap.

## Mesa de mezcla (centro)

| Control | Qué hace |
|---|---|
| HI / MID / LOW | EQ por canal. Centro = 0 dB, derecha hasta +6 dB, izquierda hasta −40 dB (casi corte total). |
| FILTRO | Centro abierto. Izquierda = low pass, derecha = high pass, con algo de resonancia. |
| Faders | Volumen de cada universo, con medidor al lado. A empieza arriba y B abajo. |

Knobs: arrastrar en vertical (Shift = fino), rueda, doble clic = centro.

## MIXER (volumen por instrumento)

Botón **MIXER** en la cabecera (o tecla **M**; Esc cierra). Un fader por instrumento que
afecta a todos los universos a la vez. Siempre arranca en 0 dB = la mezcla por defecto.
Arriba +6 dB, abajo hasta −48 dB y silencio. Doble clic = 0 dB. RESTABLECER = todo a 0 dB.
La música sigue sonando mientras está abierto. (Todavía no se guarda: vendrá con las cuentas.)

## Mezcla por defecto

Es el mismo género en todos los universos, así que el perfil es uno solo (`src/audio/dsp.js`).
Medido con todo sonando y emoción neutra (loudness K-ponderado ≈ LUFS):

| | Respecto al kick |
|---|---|
| Kick | pico ≈ −3 dBFS en su canal |
| Bass | picos ≈ 3–5 dB por debajo; kick y bass mandan |
| Clap | picos ≈ 6–8 dB por debajo |
| Perc · acordes | ≈ 9–10 dB por debajo (los acordes, con mucho delay/reverb) |
| Hats · open hat | ≈ 12–13 dB por debajo |
| Pad | ≈ 16 LU por debajo: es el fondo |

- **Master**: ≈ −13 LUFS con picos ≈ −4 dBFS. Deja margen: no va "a tope" (los masters de
  club suelen estar entre −9 y −6 LUFS, pero esto es un instrumento en directo que entra en
  una mesa). Limitador de seguridad con techo ≈ −1 dBFS.
- **Graves en mono**: por debajo de 120 Hz todo es mono (Mid/Side en el master), como
  piden los equipos de club.
- **Limpieza**: high-pass en todo menos kick y bass (clap 160 Hz, perc/acordes 150, pad
  140, hats 300), y un recorte de "barro" en acordes (−5 dB a 550 Hz) y pad (−3 dB a 380 Hz).
  El pad ya no dobla la tónica grave: esa octava es del bajo.
- **Sidechain**: el kick aparta al bajo ≈ 3 dB (quieto) a 7 dB (intenso), a acordes y pad un
  poco, y también a la cola de la reverb.
- **Compresión de bus** (glue): 2:1, ataque 20 ms para dejar pasar el golpe del kick,
  ≈ 1–2 dB de reducción.
- **Saturación**: cada canal satura según la emoción, pero compensando el volumen. La
  emoción cambia el color, no el balance.

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
- `src/audio/deck.js` — un universo: 8 canales, reverb y delay propios, loop, secuenciador.
- `src/audio/strip.js` — canal de mezcla: EQ 3 bandas, filtro DJ, fader, medidor.
- `src/audio/dsp.js` — canal de instrumento (drive → HP → LP → fade → duck), saturación, reverb.
- `src/audio/voices.js` — kick, clap, hats tipo 808, percusión (tono / FM / ruido), bajo, acordes dub y pad.
- `src/music/emotion.js` — el mapa emoción → mundo sonoro (valencia × activación).
- `src/music/generators.js` — motivos estables con mutación lenta, percusión polimétrica, bajo y armonía en grados de escala.
- `src/music/arrangement.js` — presencia por instrumento, umbrales, transiciones.
- `src/music/complexity.js` — la complejidad: reglas por instrumento, presupuesto de protagonismo.
- `src/ui/` — pads XY, sliders, knobs y la vista de universo (se instancia dos veces).
