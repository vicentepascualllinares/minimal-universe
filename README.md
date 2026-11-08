# MINIMAL UNIVERSE

Instrumento generativo en directo para minimal / rominimal / deep / house experimental.
No se tocan parámetros de sonido: se toca **estructura** (qué suena) y **complejidad**
(cuánto pasa). El color del sonido lo pone cada universo.

Al entrar eliges el modo:

- **UN UNIVERSO** — un solo mundo, con los controles grandes (estructura · transición · complejidad · loop en una fila).
- **DJ** — dos universos (A y B) a la vez, siempre en fase, mezclados en una mesa central.

En móvil o tablet la interfaz se adapta para que quepa todo sin scroll y se puede tocar
con varios dedos a la vez (cada control sigue a su propio dedo). En vertical, estructura
arriba y complejidad abajo; en horizontal, todo en una fila. En modo DJ, pestañas
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

- **Ordenador**: CALIDAD **NORMAL** (hats grabados del mismo motor: suena igual y gasta ~⅓
  menos que antes) y búfer de ~50 ms.
- **Móvil** (Android / iPhone / iPad): CALIDAD **LIGERA** (además, saturación sin
  sobremuestreo, un oscilador por nota en acordes y pad, bajo sin osciladores inaudibles,
  panorama fijo por carril de percusión), búfer de ~45 ms, margen de 150 ms que sube solo si
  el móvil se atasca, ajustes solo cuando cambian, canvas a menor resolución y sin osciloscopio.

Todo esto se cambia en **OPCIONES → RENDIMIENTO** (ver abajo y RENDIMIENTO.md).

En la cabecera, en los dos perfiles, el medidor de salud del audio: **AUDIO OK**, **CORTES n**
(el audio se quedó sin datos) o **TARDE n** (notas programadas fuera de tiempo). Clic = poner
a cero. En **OPCIONES → RENDIMIENTO** se elige cuáles se ven (siguen midiendo aunque no se vean). Qué vigilar, cómo medir y qué hacer cuando haga falta optimizar (incluido el motor en
el hilo de audio y lo que hay que decidir antes de samples y MIDI): **[RENDIMIENTO.md](RENDIMIENTO.md)**.

Para forzar un perfil: añade `?movil` o `?pc` a la dirección. Si en algún móvil hay cortes,
`?estable` usa el búfer MÁXIMO (más latencia, máxima estabilidad) sin tocar lo guardado.

Con auriculares Bluetooth el propio Bluetooth añade unos 150–250 ms que el programa no puede
quitar; con cable o con el altavoz la respuesta es mucho más inmediata.

## Cada universo (izquierda A, derecha B)

| Control | Qué hace |
|---|---|
| **ESTRUCTURA** (8 escenas) | Los momentos de un tema, uno por botón (ver abajo). **Clic** = cambiar a esa escena. **Mantener** = CORTE: suena mientras lo mantienes y al soltar vuelve. |
| **TRANSICIÓN** | La **forma** de los viajes de CLIC, con dos interruptores. **DE GOLPE**: la estructura se aguanta y todo cambia a la vez en el 1 de la llegada. **PROGRESIVA**: cambia durante el viaje; entonces el segundo elige **SUAVE** (todos a la vez, a lo largo del viaje) o **ESCALONADA** (uno tras otro, cada uno en su compás). Ver "Formas del viaje". Debajo, **CLIC · CORTE**: qué gesto ajustas. CLIC: cuánto dura el viaje (YA, 1, 2, 4, 8, 16, 32 compases). CORTE: siempre instantáneo, **CUANTIZADO** (en la siguiente corchea) o **SIN CUANTIZAR** (en la siguiente semicorchea, lo antes posible). Los dos: **FX**, si el cambio lleva efectos de transición. Por defecto CLIC = 4 compases con FX, CORTE = cuantizado sin FX. |
| **LOOP** | Repite los últimos 1/2/4/8 compases con todo congelado. Por debajo mueves lo que quieras sin que se oiga (fantasma en los pads, instrumentos pendientes parpadean). Al soltarlo entra el cambio en el siguiente compás. |
| **SALIDA** | INSTANTÁNEA: todo salta a la vez. PROGRESIVA: viaja al nuevo estado durante 1–16 compases. |
| **COMPLEJIDAD** (4 faders) | KICK · PERCS · BASS · INSTR.: cuánta información dice cada grupo (ver abajo). Se aplica en el siguiente compás. Doble clic = 0,5. |
| **GLOBAL** (barra en la cabecera) | SIMPLE ← → COMPLEJO. Escala a la vez los cuatro faders, en proporción. Rueda = fino, doble clic = 0,8. En DJ y en móvil las etiquetas son − / +. |
| **NUEVO UNIVERSO** | Otros motivos, otro kit de percusión, otro **color** de sonido y otros valores de los cuatro faders de complejidad (en el siguiente compás; si está en loop, al soltarlo). El GLOBAL no cambia. |

## Estructura: los momentos de un tema

Ocho escenas en una rejilla 2×4, como los pads de un controlador (8 por universo; en DJ, 16):

```
sin kick │ BREAK       SIN DRUMS   SIN GRAVES   SIN KICK
con kick │ SOLO DRUMS  ESQUELETO   SIN BAJO     TODO
```

| Escena | Qué suena |
|---|---|
| **BREAK** | el pad a tope, algo de percusión, unos acordes y un hat lejano. Sin kick ni bajo |
| **SIN DRUMS** | bajo, acordes y pad |
| **SIN GRAVES** | hats, percusión, clap, acordes y pad: el groove arriba, sin kick ni bajo |
| **SIN KICK** | todo menos el kick: el bajo sigue rodando (kick-out) |
| **SOLO DRUMS** | kick, hats, clap, open hat y percusión: la entrada / salida para mezclar |
| **ESQUELETO** | kick, bajo y hat (algo de percusión): el núcleo del rominimal |
| **SIN BAJO** | todo menos el bajo |
| **TODO** | todo; el pad algo al fondo y filtrado |

- En cada botón, **K B T M** dice qué capas tiene: kick, bajo, tops (hats/perc/clap) y música
  (acordes/pad).
- En las dos columnas de la derecha, la escena de abajo es la de arriba con kick: **bajar** =
  DROP, **subir** = kick-out.
- La escena que suena se ilumina; en un viaje se iluminan las dos a medias. El borde marca
  la escena elegida; el destino de un viaje parpadea.
- **Formas del viaje** (TRANSICIÓN):
  - **DE GOLPE**: suena el origen hasta el final del viaje y en el 1 de la llegada todo salta
    al destino (**drop**). Los compases son la espera, con sus FX (riser, redoble, tensión).
  - **PROGRESIVA · SUAVE**: todos los instrumentos cambian a la vez, poco a poco, durante todo
    el viaje. De SOLO DRUMS a TODO en 8 compases, el bajo y los acordes van subiendo juntos.
  - **PROGRESIVA · ESCALONADA**: uno tras otro, cada uno con un barrido corto que acaba justo
    en su compás. Primero lo que sale y luego lo que entra; de adorno a cimiento (pad, open
    hat, percusión, acordes, hat, clap, bajo y el kick el último). El viaje se reparte en
    tramos: uno por compás si caben (en viajes de 1–2 compases, medios compases); si cambian
    más instrumentos que tramos, algunos van juntos. El orden varía un poco con cada universo.
  - En los progresivos, **cada instrumento entra y sale a su manera** (además de con su
    densidad): kick y bajo con un high-pass, acordes con un low-pass resonante, hats, clap,
    percusión y pad sobre todo con volumen. Cada universo lo mueve un poco.
- **CLIC** (pulsar y soltar): cambia a esa escena con los compases y el FX de CLIC.
- **CORTE** (mantener más de ⅓ de segundo): cambia a esa escena al instante (cuantizado o
  no, y con el FX de CORTE) mientras lo mantienes; al soltar vuelve a la escena elegida, igual. La escena elegida
  no cambia. Se pueden mantener varias a la vez (manda la última; al soltarla, la anterior).
- **Viajar a una escena**: tarda los compases elegidos y
  **aterriza en frase**: la llegada cae en el inicio de una frase (cada 4 compases para
  viajes de 1–2, cada 8 para 4 o más), así que puede esperar unos compases antes de
  empezar. No hay un loop por universo: es una rejilla de frases común, contada desde el
  primer compás. Junto a ESTRUCTURA, un trazo por compás de la frase (el que suena,
  encendido) y, **antes de pulsar**, "ENTRA YA" o "ENTRA EN N": cuándo empezaría un viaje
  con los compases de CLIC. Después, "→ ESCENA · ENTRA EN N" mientras espera y
  "→ ESCENA · N COMP." durante el viaje. YA = en la siguiente negra. Pulsa la **misma
  escena** otra vez para **pausar** y otra más para seguir (si aún no había empezado,
  vuelve a esperar frase). Pulsar **otra escena** cambia el destino desde donde estés.
- Cada viaje lleva su **transición** si su gesto tiene **FX** (ver abajo). Sin FX, el viaje
  es solo el cambio (de golpe o progresivo, según TRANSICIÓN).
- Con **LOOP** activo, pulsar una escena la deja pendiente (borde discontinuo); al soltar el
  loop se aplica según SALIDA (instantánea o progresiva).

## Transiciones

Al viajar a una escena (con FX), el universo compone solo la transición: sabe de dónde sale, a
dónde va y cuántos compases dura. Todo sintetizado y seco (sin reverb ni delay).

| Viaje | Qué pasa |
|---|---|
| **Entra el kick** (de la fila de arriba a la de abajo) | **build**: riser (ruido y/o tono que sube), redoble que acelera (negras → corcheas → semicorcheas → fusas), el universo se va adelgazando con un high-pass e impacto y plato al llegar. DE GOLPE, a veces, además, un silencio de ½–2 tiempos antes del 1. |
| **Entra la música sobre el kick** (SOLO DRUMS → TODO, ESQUELETO → TODO, SIN BAJO → TODO…) | riser suave, redoble corto y plato al llegar |
| **Se va el kick** (de la fila de abajo a la de arriba) | downfilter (el universo entero se cierra los últimos compases), plato al revés que muere en el 1, golpe grave y caída de ruido después |
| **Se va la música** (TODO → SOLO DRUMS, TODO → SIN BAJO…) | un reverse corto, redoble del último tiempo y plato |
| **Sin kick** (entre escenas de la fila de arriba) | solo un barrido suave |

- **Cuantos más compases, más capas**: con YA solo hay golpe o plato al llegar; con 1–2,
  un redoble corto y un soplo de ruido; con 4, riser y tensión; con 8 o más, todo (el
  riser dura como mucho 16 compases y el redoble 4).
- **Paleta por universo**: qué riser (ruido, tono o los dos, cuánto sube, si late), qué
  redoble (caja, clap, rim o tom, si sube de tono), qué golpe (grave afinado en la tónica,
  sordo o los dos), cómo son los platos, cuánta tensión y si hay silencio antes del drop
  salen de la semilla del universo, igual que su color. Hay universos sobrios y universos
  intensos; NUEVO UNIVERSO cambia también la paleta.
- Pulsar otra escena o activar el LOOP corta la transición en curso.
  Las transiciones suenan por el canal del universo (en DJ, pasan por su EQ y su fader).

## Instrumentos

KICK · BASS · HAT · PERC · CLAP · OPEN (hat abierto) · **CHORD** · **PAD**.

- **CHORD** — acordes dub: stabs cortos con filtro que se cierra. Ritmo en
  contratiempo que nunca pisa al kick. A tope en SIN DRUMS y en TODO, un poco en el BREAK.
- **PAD** — la atmósfera: un acorde largo con filtro que respira y un poco de aire (ruido
  filtrado). Manda en el BREAK y en SIN DRUMS; en TODO se aparta.
- Los dos comparten una progresión de 8 compases en grados de escala (un solo acorde, o la
  casa y otro: iv, VI, VII o v). Si el modo cambia, se recolorean al compás siguiente.
- El kick los hace bombear un poco (sidechain), y NUEVO UNIVERSO cambia también la armonía.

## Complejidad

Cuatro faders por universo, uno por grupo, y la barra GLOBAL de la cabecera que los escala
a todos en proporción (lo que suena = fader × global; el número y la línea fina de cada
fader muestran ese resultado). Así puedes tener, por ejemplo, un kick simple a negras, un
bajo con movimiento pero de solo 2–3 notas, unos percs juguetones y los instrumentos a
medias, y bajar o subir todo el universo con el GLOBAL sin perder ese carácter.

| Grupo | SIMPLE | COMPLEJO |
|---|---|---|
| **KICK** | negras rectas, sin caídas | kicks fantasma (al máximo, dos) y caída del último tiempo al final de frase |
| **PERCS** (hat, open hat, clap, perc) | el hat en contratiempo, 1 capa de percusión, clap recto | semicorcheas, hasta 4 capas de polimetría, clap con fantasmas, redobles al final de frase (al máximo, redoble largo de semicorcheas) |
| **BASS** | corcheas en contratiempo con tónica y octava, siempre el mismo motivo | semicorcheas, todas las notas, variación cada 4 compases |
| **INSTR.** (acordes, pad) | un solo acorde de 2 notas, stabs muy espaciados, el pad cambia cada 4–8 compases | progresión, 4 notas, stabs seguidos, el pad cada 2–4 |

Cada grupo también decide cuánto cambian sus motivos con el tiempo (poco = hipnótico).

Con el GLOBAL, dos reglas para que no compita todo a la vez:

- **Protagonismo**: hay un presupuesto de instrumentos "a tope" (≈2 con el GLOBAL al
  mínimo, todos al máximo). Si en la estructura entran más, ceden densidad por orden:
  primero percusión, acordes y open hat; luego clap y hat; el bajo casi nada. El kick y el
  pad no ceden.
- **Turnos** (GLOBAL por debajo de 0,6): los acordes esquivan al bajo (se mueven una
  corchea, como respuesta) y la percusión deja libres los golpes de acordes y clap.

## Color de cada universo

Ya no hay pad de EMOCIÓN. Cada universo sale con su propio color de sonido (más oscuro o
más brillante, golpes más blandos o más duros, notas más largas o más cortas, más o menos
swing), que cambia con NUEVO UNIVERSO, con un fundido de unos 2 s. El kick siempre suena en
la tónica y el swing no pasa del 58 %. El color del universo en pantalla lo refleja.

## Mesa de mezcla (centro)

| Control | Qué hace |
|---|---|
| HI / MID / LOW | EQ de 3 bandas por canal (cortes en 250 Hz y 3,5 kHz). Centro = 0 dB (plano), derecha hasta +6 dB. A la izquierda, según OPCIONES → DJ: **ISOLATOR** (por defecto) silencia la banda del todo (−∞); **EQ** baja hasta −26 dB. |
| FILTRO | Centro abierto. Izquierda = low pass, derecha = high pass, con algo de resonancia. |
| Faders | Volumen de cada universo, con medidor al lado. A empieza arriba y B abajo. |

Knobs: arrastrar en vertical (Shift = fino), rueda, doble clic = centro.

## GENERAR y GRABAR

- Al elegir modo (UN UNIVERSO o DJ) el programa se prepara pero **no hace música** hasta que
  pulsas **GENERAR** en la cabecera (o ESPACIO). Después ese botón es EN VIVO / PAUSA.
- **● GRABAR** (o R) graba exactamente lo que sale por los altavoces (los dos universos y la
  mesa, tras el master) en **WAV estéreo de 24 bits** a la frecuencia del audio (normalmente
  48 kHz), sin pérdidas.
  - Al pulsarlo queda **armado** ("ESPERANDO SONIDO") y no guarda nada hasta la primera muestra
    con sonido: se puede armar antes de GENERAR y el archivo empieza justo en el primer golpe,
    sin silencio delante.
  - Mientras graba enseña el tiempo y el tamaño (unos 17 MB por minuto).
  - Al pulsarlo otra vez se para y se **descarga** el archivo
    (`minimal-universe-AAAAMMDD-HHMMSS.wav`). Si no llegó a sonar nada, no se descarga nada.
  - Sigue en el mismo archivo aunque cambies el búfer o la calidad (el audio se rehace) o
    pongas PAUSA (eso queda grabado como silencio).
  - La captura va en el hilo de audio (AudioWorklet), así que no pierde muestras aunque la
    pantalla se atasque. Abierto desde el móvil por la wifi (sin HTTPS) el navegador no deja
    usar AudioWorklet y graba con un método más antiguo, en el hilo principal.

## OPCIONES

Botón **OPCIONES** en la cabecera (Esc cierra). La música sigue sonando. Calidad, búfer, margen
y salida de audio se guardan en ese navegador (son del aparato, no de la persona); el resto todavía no
se guarda (vendrá con las cuentas).

- **DJ → EQ de la mesa**: las mismas dos opciones que «EQ Type» en rekordbox (y los
  mixers Pioneer DJM):
  - **ISOLATOR** — a la izquierda del todo la banda desaparece (−∞ … +6 dB).
  - **EQ** — atenúa sin llegar a silenciar (−26 … +6 dB).
En RENDIMIENTO cada ajuste muestra solo el nombre (la descripción sale al pasar el ratón) y
sus opciones van de menos a más calidad; AUTO, que se mueve solo por esa escala, va al final.

- **RENDIMIENTO → Calidad del motor**: cuánto trabaja el audio por nota. **Si hay cortes, lo
  primero es bajar aquí.** Al cambiarla, el audio se rehace (hueco corto).
  - **ALTA** — todo sintetizado al momento y filtros recalculados muestra a muestra. La de
    antes; la que más gasta.
  - **NORMAL** (por defecto en ordenador) — los hats se graban con el mismo motor y cada
    golpe reproduce la grabación (y el filtro lento del pad se recalcula cada ~3 ms). Suena igual.
  - **LIGERA** (por defecto en móvil) — además, saturación sin sobremuestreo y voces más
    sencillas.
- **RENDIMIENTO → Búfer de audio**: cuánto audio prepara el navegador por adelantado. Más
  búfer = menos cortes y un poco más de retraso al tocar (casi no se nota: los cambios caen a
  la negra o al compás).
  - **AUTO** (por defecto) — empieza en ESTABLE y, si hay 3 cortes en un minuto, sube un
    escalón (~50 → ~100 → ~170 ms) y lo recuerda. Nunca baja solo; elegir AUTO otra vez lo
    vuelve a empezar desde ESTABLE.
  - **BAJO** (~10 ms) — ordenadores potentes y, en el futuro, MIDI. Puede dar cortes.
  - **ESTABLE** (~50 ms) — el equilibrio.
  - **MÁXIMO** (~170 ms) — ordenadores flojos.
  - Al cambiarlo, el audio se rehace sin recargar la página y vuelve en el siguiente compás,
    con un hueco corto (como Ableton al cambiar el búfer). Debajo se lee lo que ha dado de
    verdad el equipo: búfer, salida, margen y respuesta al tocar.
- **RENDIMIENTO → Margen**: cuánto se adelanta el programa al preparar las notas (contra las
  notas TARDE). **AUTO** (por defecto) empieza en ~120 ms y sube solo si el ordenador se atasca;
  **CORTO** 60 ms; **NORMAL** 120 ms; **LARGO** 250 ms. Se aplica al momento.
- **RENDIMIENTO → Salida de audio** (solo Chrome y Edge): tarjeta, auriculares, etc. Para ver
  los nombres de las salidas el navegador pide permiso de micrófono (solo para eso, no se
  graba nada). Si la salida guardada desaparece, vuelve a la del sistema.
- **RENDIMIENTO → Medidores**: qué se ve en la cabecera (CORTES, TARDE).

## MIXER (volumen por instrumento)

Botón **MIXER** en la cabecera (o tecla **M**; Esc cierra). Un fader por instrumento que
afecta a todos los universos a la vez. Siempre arranca en 0 dB = la mezcla por defecto.
Arriba +6 dB, abajo hasta −48 dB y silencio. Doble clic = 0 dB. RESTABLECER = todo a 0 dB.
La música sigue sonando mientras está abierto. (Todavía no se guarda: vendrá con las cuentas.)

## Mezcla por defecto

Es el mismo género en todos los universos, así que el perfil es uno solo (`src/audio/dsp.js`).
Medido con todo sonando y un color neutro (loudness K-ponderado ≈ LUFS):

| | Respecto al kick |
|---|---|
| Kick | pico ≈ −3 dBFS en su canal |
| Bass | picos ≈ 3–5 dB por debajo; kick y bass mandan |
| Clap | picos ≈ 6–8 dB por debajo |
| Perc · acordes | ≈ 9–10 dB por debajo |
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
  poco.
- **Compresión de bus** (glue): 2:1, ataque 20 ms para dejar pasar el golpe del kick,
  ≈ 1–2 dB de reducción.
- **Saturación**: cada canal satura según el color del universo, pero compensando el
  volumen. El color cambia el timbre, no el balance.

## Global (cabecera)

- **BPM**: arrastrar o rueda (100–140).
- **Tónica**: arrastrar o rueda (E–B). El kick de ambos universos se afina a ella.
- **Modo** (frigio · eólico · dórico · mixolidio): global, clic = el siguiente. El cambio parpadea y entra al empezar el siguiente compás. Igual para A y B, así nunca chocan armónicamente.

## Teclado

ESPACIO play/pausa (o tocar EN VIVO / PAUSA en la cabecera)

- UN UNIVERSO: L loop · N nuevo universo (también Q / W)
- DJ: Q loop A · W nuevo universo A · O nuevo universo B · P loop B

## Cómo está hecho

Todo es síntesis en tiempo real con Web Audio, sin samples ni dependencias.

- `src/audio/engine.js` — reloj común (Worker + lookahead), BPM, tónica y modo globales, master (glue + limitador).
- `src/audio/deck.js` — un universo: 8 canales, loop, secuenciador. Sin reverb ni delay: todo seco.
- `src/audio/strip.js` — canal de mezcla: EQ 3 bandas (crossover Linkwitz-Riley, ISOLATOR o EQ), filtro DJ, fader, medidor.
- `src/audio/dsp.js` — canal de instrumento (drive → HP → LP → fade → duck), saturación.
- `src/audio/voices.js` — kick, clap, hats tipo 808, percusión (tono / FM / ruido), bajo, acordes dub y pad.
- `src/music/emotion.js` — el color de cada universo → timbre, golpe, duraciones y swing; las escalas.
- `src/music/generators.js` — motivos estables con mutación lenta, percusión polimétrica, bajo y armonía en grados de escala.
- `src/music/arrangement.js` — las 8 escenas (presencia por instrumento), umbrales, viajes.
- `src/music/complexity.js` — la complejidad por grupos y el global: reglas por instrumento, presupuesto de protagonismo.
- `src/ui/` — sliders, knobs y la vista de universo (se instancia dos veces).
