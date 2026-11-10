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
| **TRANSICIÓN** | La **forma** de los viajes de CLIC, con dos interruptores (pulsar en cualquier parte de la caja cambia al otro). **DE GOLPE**: la estructura se aguanta y todo cambia a la vez en el 1 de la llegada. **PROGRESIVA**: cambia durante el viaje; entonces el segundo elige **SUAVE** (todos a la vez, a lo largo del viaje) o **ESCALONADA** (uno tras otro, cada uno en su compás). Ver "Formas del viaje". Debajo, cuánto dura el viaje de CLIC (INSTANTÁNEO, 1, 2, 4, 8, 16, 32 compases) y **FX**: si lleva efectos de transición. Por defecto, 4 compases con FX. El CORTE no se ajusta: siempre instantáneo (la forma no le afecta), en la siguiente corchea, sin FX. |
| **LOOP** | Repite los últimos 1/2/4/8 compases con todo congelado. Por debajo mueves lo que quieras sin que se oiga (fantasma en los pads, instrumentos pendientes parpadean). Al soltarlo entra el cambio en el siguiente compás. |
| **SALIDA** | INSTANTÁNEA: todo salta a la vez. PROGRESIVA: viaja al nuevo estado durante 1–16 compases. |
| **COMPLEJIDAD** (4 faders) | KICK · PERCS · BASS · INSTR.: cuánta información dice cada grupo (ver abajo). Se aplica en el siguiente compás. Doble clic = 0,5. |
| **GLOBAL** (barra en la cabecera) | SIMPLE ← → COMPLEJO. Escala a la vez los cuatro faders, en proporción. Rueda = fino, doble clic = 0,8. En DJ y en móvil las etiquetas son − / +. |
| **NUEVO UNIVERSO** | Otros motivos, otro kit de percusión, otro **color** de sonido y otros valores de los cuatro faders de complejidad (en el siguiente compás; si está en loop, al soltarlo). El GLOBAL no cambia. |

## Estructura: los momentos de un tema

Ocho **partes** en una rejilla 2×4, como los pads de un controlador (8 por universo; en DJ, 16).
Se llaman por lo que son en la estructura de un tema (minimal, rominimal, deep house, techno,
experimental), no por lo que suena: más adelante, la parte decidirá también arreglos, mezcla y
transiciones (no es lo mismo ir de BREAK a DROP que de DROP a BREAK).

```
sin kick │ BREAK   DRIFT   BUILD   KICK-OUT
con kick │ INTRO   GROOVE  MAIN    DROP
```

Cada parte tiene **dos versiones** (botón **VER 1 · 2**, ver abajo): dos posibilidades del mismo
momento, no «más» o «menos». La 1 es la de siempre. En cada versión suena **solo** lo que dice
la tabla (auditado: en las 16 combinaciones, nada de lo que no toca programa notas ni deja sonido
por encima de −80 dB una vez asentada la parte).

| Parte | Qué es | Versión 1 | Versión 2 |
|---|---|---|---|
| **INTRO** | la pista de entrada (y de salida): batería seca para mezclar | kick, hats y algo de percusión | toda la batería: + clap y open hat |
| **GROOVE** | el «roller» hipnótico, el corazón del rominimal: donde el tema vive más tiempo | kick, bajo, hats y algo de percusión | toda la batería y bajo, sin música: + clap, open hat y percusión entera |
| **MAIN** | el groove lleno antes del pico | kick, bajo, toda la batería y acordes suaves; sin pad | lo mismo con los acordes enteros; aún sin pad |
| **DROP** | el pico: todo dentro | todo; el pad algo al fondo | todo, con acordes y pad enteros |
| **BREAK** | el breakdown: cae la batería y manda la atmósfera | el pad a tope, acordes flojos y un hat lejano | el pad, acordes enteros, un hat lejano y algo de percusión |
| **DRIFT** | lo experimental / ambient: flota, bajo y armonía suspendidos | bajo, acordes y pad | lo mismo con pulso: hats lejanos y percusión |
| **BUILD** | la subida: sin graves, arriba el ritmo; pide un drop | hats, percusión, clap, open hat, acordes y pad | hats, percusión, acordes y pad (sin clap ni open hat) |
| **KICK-OUT** | el bajo sigue rodando sin kick: tensión antes de que vuelva | todo menos el kick | bajo, hats, percusión y acordes |

**VERSIÓN** (**VER 1 · 2**, a la derecha de las partes; en DJ, una por universo):
- Es **del universo**, no de cada parte: la parte que suena y cualquiera a la que vayas van en la
  versión elegida. En cada botón, K B T M enseña las capas de esa versión; el botón se marca en la 2.
- **Clic** (al soltar): cambia de versión.
  - **Quieto**: la otra versión de la misma parte entra en el **siguiente compás**. DE GOLPE, de
    golpe en ese 1; PROGRESIVA, en 1 compás (SUAVE o ESCALONADA). Sin FX: es la misma parte de
    otra forma, no un viaje.
  - **En un viaje** (esperando la frase o a medias): el viaje sigue igual (inicio, duración, FX) y
    **llega a la otra versión**, sin saltos: cada instrumento sigue desde donde está. Así, para ir
    de GROOVE 1 a MAIN 2 no hace falta acertar antes: pulsa MAIN y luego VER mientras llega.
  - Dos clics antes de que empiece el cambio de versión lo anulan.
  - Con **LOOP** queda pendiente y entra al soltar el loop, como las partes. **Parado**, salta directo.
- **Mantener VER + pulsar una parte** (como SHIFT en un controlador): ir a esa parte **en la otra
  versión**, sin tocar la que suena hasta que empiece el viaje. Si es la parte que ya suena, es
  como un clic. Al soltar VER no cambia nada más.
- **CORTE** (mantener una parte): suena en la versión que mande y, al soltarlo, se vuelve a la
  parte elegida en la versión que mande en ese momento.

Se basan en lo que se repite en estos géneros: intro y outro de batería para que el DJ mezcle,
un groove que se mantiene mucho tiempo con cambios pequeños (rominimal, Villalobos), el drop
como llegada de todo, el breakdown donde cae la batería, la subida sin graves y el kick-out con
el bajo rodando. DRIFT viene del ambient y de los directos modulares: algo que flota y se disuelve.

- En cada botón, **K B T M** dice qué capas tiene: kick, bajo, tops (hats/perc/clap) y música
  (acordes/pad).
- Parejas: **KICK-OUT** es el DROP sin kick y **BUILD**, el MAIN sin graves. **Bajar** = entra
  el kick.
- La parte que suena se ilumina (en cualquiera de sus versiones); en un viaje se iluminan las dos
  a medias. El borde marca la parte elegida; el destino de un viaje parpadea y, arriba, se lee
  con su versión («→ MAIN 2 · ENTRA EN 3»).
- **Formas del viaje** (TRANSICIÓN):
  - **DE GOLPE**: suena el origen hasta el final del viaje y en el 1 de la llegada todo salta
    al destino (**drop**). Los compases son la espera, con sus FX (riser, redoble, tensión).
  - **PROGRESIVA · SUAVE**: todos los instrumentos cambian a la vez, poco a poco, durante todo
    el viaje. De INTRO a DROP en 8 compases, el bajo y los acordes van subiendo juntos.
  - **PROGRESIVA · ESCALONADA**: uno tras otro, cada uno con un barrido corto que acaba justo
    en su compás. Primero lo que sale y luego lo que entra; de adorno a cimiento (pad, open
    hat, percusión, acordes, hat, clap, bajo y el kick el último). El viaje se reparte en
    tramos: uno por compás si caben (en viajes de 1–2 compases, medios compases); si cambian
    más instrumentos que tramos, algunos van juntos. El orden varía un poco con cada universo.
  - En los progresivos, **cada instrumento entra y sale a su manera** (además de con su
    densidad): kick y bajo con un high-pass, acordes con un low-pass resonante, hats, clap,
    percusión y pad sobre todo con volumen. Cada universo lo mueve un poco.
- **CLIC** (pulsar y soltar): cambia a esa escena con los compases y el FX de CLIC.
- **CORTE** (mantener más de 0,15 s; un clic normal dura menos):
  cambia a esa escena al instante (en la
  siguiente corchea) mientras lo mantienes; al soltar vuelve a la escena elegida, igual. La escena elegida
  no cambia. Se pueden mantener varias a la vez (manda la última; al soltarla, la anterior).
- **Viajar a una escena**: tarda los compases elegidos y
  **aterriza en frase**: la llegada cae en el inicio de una frase (cada 4 compases para
  viajes de 1–2, cada 8 para 4 o más), así que puede esperar unos compases antes de
  empezar. No hay un loop por universo: es una rejilla de frases común, contada desde el
  primer compás. Junto a ESTRUCTURA, un trazo por compás de la frase (el que suena,
  encendido) y, **antes de pulsar**, "ENTRA YA" o "ENTRA EN N": cuándo empezaría un viaje
  con los compases de CLIC. Después, "→ ESCENA · ENTRA EN N" mientras espera y
  "→ ESCENA · N COMP." durante el viaje. INSTANTÁNEO = en la siguiente negra. Pulsa la **misma
  escena** otra vez para **pausar** y otra más para seguir (si aún no había empezado,
  vuelve a esperar frase). Pulsar **otra escena** cambia el destino desde donde estés.
- Cada viaje lleva su **transición** si su gesto tiene **FX** (ver abajo). Sin FX, el viaje
  es solo el cambio (de golpe o progresivo, según TRANSICIÓN).
- **Al abrir**, los universos empiezan en **INTRO**. **Parado** (antes del primer GENERAR
  o en PAUSA), pulsar una escena salta a ella directamente, sin viaje ni FX: es desde donde
  empieza (o sigue) a sonar. Un viaje que quedó a medias al pausar sigue al volver a tocar,
  salvo que pulses una escena antes.
- Con **LOOP** activo, pulsar una escena la deja pendiente (borde discontinuo); al soltar el
  loop se aplica según SALIDA (instantánea o progresiva).

## Transiciones

Al viajar a una escena (con FX), el universo compone solo la transición: sabe de dónde sale, a
dónde va y cuántos compases dura. Todo sintetizado y seco (sin reverb ni delay).

| Viaje | Qué pasa |
|---|---|
| **Entra el kick** (de la fila de arriba a la de abajo) | **build**: riser (ruido y/o tono que sube), redoble que acelera (negras → corcheas → semicorcheas → fusas), el universo se va adelgazando con un high-pass e impacto y plato al llegar. DE GOLPE, a veces, además, un silencio de ½–2 tiempos antes del 1. |
| **Entra la música sobre el kick** (INTRO → DROP, GROOVE → MAIN, MAIN → DROP…) | riser suave, redoble corto y plato al llegar |
| **Se va el kick** (de la fila de abajo a la de arriba) | downfilter (el universo entero se cierra los últimos compases), plato al revés que muere en el 1, golpe grave y caída de ruido después |
| **Se va la música** (DROP → INTRO, DROP → GROOVE…) | un reverse corto, redoble del último tiempo y plato |
| **Sin kick** (entre escenas de la fila de arriba) | solo un barrido suave |

- **Cuantos más compases, más capas**: con INSTANTÁNEO solo hay golpe o plato al llegar; con 1–2,
  un redoble corto y un soplo de ruido; con 4, riser y tensión; con 8 o más, todo (el
  riser dura como mucho 16 compases y el redoble 4).
- **Paleta por universo**: qué riser (ruido, tono o los dos, cuánto sube, si late), qué
  redoble (caja, clap, rim o tom, si sube de tono), qué golpe (grave afinado en la tónica,
  sordo o los dos), cómo son los platos, cuánta tensión y si hay silencio antes del drop
  salen de la semilla del universo, igual que su color. Hay universos sobrios y universos
  intensos; NUEVO UNIVERSO cambia también la paleta.
- **Cada transición es distinta**: la paleta es la *familia* del universo, no un sonido fijo.
  Cada transición tira sus propios detalles alrededor de ella (afinaciones, colas, cómo crece el
  riser, hasta dónde suben los filtros) y una combinación principal (riser · voz del redoble ·
  patrón · impacto) que **no repite ninguna de las 3 anteriores**. Se reconoce el universo, pero
  nunca suena idéntico.
  - **Riser TONAL**: un arpegio en la escala y la tónica del momento (grado a grado, la tríada o
    tónica y quinta) que sube, acelera (corcheas → semicorcheas → fusas) y se abre de filtro, con
    un soplo de ruido debajo. Suena a ese tema, no a un efecto pegado. Solo en viajes de 4
    compases o más (en los cortos, el riser es un soplo de ruido).
  - **Redoble con la voz PROPIA**: el clap del universo, con su color, más corto y subiendo de tono.
  - **Patrones de redoble**: ACELERA (negras → fusas), RECTO (semicorcheas), TRESILLOS (de
    corchea y luego de semicorchea) y FANTASMAS (acento en los tiempos, el resto flojo y con huecos).
  - **Impacto con el KICK del universo**: su propio kick, con más caída de tono y más cola.
  - Los **básicos** siguen todos: riser de ruido blanco, riser de tono (ahora también con
    **senoidal** pura, la más probable cuando cambia la onda), los dos juntos, caída de ruido,
    barridos de filtro (HP de tensión, LP de caída), reverse, redobles, golpes y platos. Lo
    tonal y lo propio se suman a ellos; no los sustituyen.
- **VOLUMEN DE FX** de cada universo: un fader bajo el botón FX de su columna TRANSICIÓN (A a la
  izquierda, B a la derecha) y, el mismo, en el **MIXER** (caja FX, A y B, nunca vinculados, con
  medidor). 0 dB = el pico más alto de los efectos en 0 dBFS; el preset MINIMAL lo deja en
  −7 dB (ver MIXER). +6 arriba, −48 y silencio abajo; imán a 0 dB y al valor del preset; doble
  clic = el valor del preset. Mueve
  solo las voces de transición (riser, redoble, golpes, platos, reverse, caída): los barridos
  de filtro y el silencio antes del drop son la propia música. En el móvil, solo en el MIXER.
- Pulsar otra escena o activar el LOOP corta la transición en curso.
  Las transiciones suenan por el canal del universo (en DJ, pasan por su EQ y su fader).

## Instrumentos

KICK · BASS · HAT · PERC · CLAP · OPEN (hat abierto) · **CHORD** · **PAD**.

- **CHORD** — acordes dub: stabs cortos con filtro que se cierra. Ritmo en
  contratiempo que nunca pisa al kick. A tope en DRIFT y en DROP, un poco en el BREAK.
- **PAD** — la atmósfera: un acorde largo con filtro que respira y un poco de aire (ruido
  filtrado). Manda en el BREAK y en DRIFT; en DROP se aparta.
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
| **EASY EQ** (botón, encendido por defecto; se recuerda) | La forma fácil de mezclar. En vez de la EQ de cada canal, **una perilla por banda (HI · MID · LOW) que pasa de A (izquierda) a B (derecha)**; en el centro suenan los dos. Al encenderlo los dos faders suben a tope y las perillas empiezan en A. **HI y MID**: sin hueco, en el centro los dos enteros y cada lado solo baja el otro. **LOW** = los graves, que se reparten por instrumento y no por frecuencia: **en la mezcla suena como mucho un kick y un bajo**. Si solo un universo tiene kick (o bajo), suena, y en el centro se mezcla con lo del otro; el kick que suena hace **sidechain al bajo que suena**, venga de donde venga. Si los dos tienen kick (o los dos bajo), suena solo uno y cambia de dueño según giras: de A a B, primero el bajo (al 40 %) y luego el kick (al 60 %); de B a A, igual al revés. El centro nunca choca: el kick del que se va con el bajo del que llega. Cada cambio espera al siguiente tiempo. Bajo la perilla, **KICK · BAJO** dicen de qué universo sale cada uno (parpadean si van a cambiar). **Al encender o apagar EASY EQ no salta nada**: se traduce lo que suena. De EASY a normal, la EQ de cada canal queda donde da la misma ganancia, y si en LOW se mezclaba (p. ej. kick A + bajo B) esos silencios se **heredan**: se ven bajo LOW y se sueltan solos, en el siguiente tiempo, cuando el otro universo deja de sonar en ese papel (bajas su LOW o su fader, o cambia de escena) o cuando mueves el LOW del universo callado. Con la música parada (antes de GENERAR o en PAUSA) no se hereda nada. De normal a EASY, cada perilla va donde da la misma proporción A : B (fader × EQ) y los faders, al del universo que más sonaba; si sonaban dos bajos o dos kicks, se queda el del universo con más graves y el otro se va en el siguiente tiempo. Lo único que no se traduce exacto: dos lados recortados a la vez o realces (EASY siempre deja un lado entero). Como el modo Frequency Mix del Pioneer DJM-2000. Doble clic = centro. Apagado: la EQ de siempre. |
| HI / MID / LOW (sin EASY EQ) | EQ de 3 bandas por canal (cortes en 250 Hz y 3,5 kHz). Centro = 0 dB (plano), derecha hasta +6 dB. A la izquierda, según OPCIONES → DJ: **ISOLATOR** (por defecto) silencia la banda del todo (−∞); **EQ** baja hasta −26 dB. |
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
- **AUTO-ARREGLOS**: trucos que en producción se hacen a mano y aquí el programa hace solo,
  en vivo. Cada uno se enciende o se apaga pulsando su caja.
  - **HUECO ANTES DEL KICK** (encendido por defecto, **30 ms**): cuando el kick **entra de
    golpe** viniendo de una escena sin kick (DE GOLPE, INSTANTÁNEO, un CORTE o soltar el LOOP
    de golpe), el universo entero (con sus FX de transición) calla un instante justo antes del
    primer golpe del kick. Da más pegada a la entrada. Si el kick entra poco a poco
    (PROGRESIVA), no hay entrada que marcar y no se hace. Rampas de 4 ms al bajar y 2 ms al
    volver, entero justo en el ataque del kick: medido sin clics.
  - Los tres siguientes miran el **drop**: un viaje **DE GOLPE** en el que entra el kick. Es el
    único que se sabe por adelantado. Lo INSTANTÁNEO o el CORTE caen en la siguiente negra o
    corchea y no dan tiempo, y en un viaje PROGRESIVO el kick ya suena antes de llegar. Si el
    viaje se cancela o se pausa, o se apaga la opción, todo vuelve a su sitio desde ese paso.
  - **BAJO FUERA ANTES DEL DROP** (encendido, **último tiempo**): el bajo calla el último
    tiempo antes del drop (baja en 4 ms) y vuelve en el 1 con el kick.
  - **GRAVES QUE BAJAN ANTES DEL DROP** (encendido, **−6 dB · último compás**): durante el
    último compás antes del drop, los graves de todo el universo (estante por debajo de
    ~200 Hz) bajan poco a poco y vuelven enteros en el 1.
  - **MENOS VOLUMEN SIN KICK** (encendido, **−1,5 dB**): mientras no hay kick el universo suena
    un poco más bajo (baja despacio, en ~1 s). Al entrar el kick recupera el nivel: de golpe en
    un drop, poco a poco si entra progresivo. Así el drop parece más grande.
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
- **RENDIMIENTO → Incidencias**: los fallos del audio que el programa ha visto, con la hora,
  dónde se atascó y lo que sonaba (al pasar el ratón). Si el audio se queda mudo o roto (un
  valor no numérico atrapado, el sistema suspende el audio, el reloj se para), el programa
  **rehace el audio solo** y la cabecera avisa **AUDIO RECUPERADO**: la música vuelve en un
  momento. Ver [RENDIMIENTO.md](RENDIMIENTO.md) §10.

## MIXER (volumen por instrumento)

Botón **MIXER** en la cabecera (o tecla **M**; Esc cierra). Un fader por instrumento y, al
lado de cada fader, un **medidor** con lo que suena ahora. En **DJ** salen **A y B** en cada
instrumento, **VINCULADOS** por defecto: mover un instrumento en un universo lo mueve igual en el
otro (conservando la diferencia que tuvieran, como un grupo de faders; doble clic, los dos al
valor del preset). El botón VINCULADOS los separa. En el móvil, en DJ, no se ven los dB (no caben).

**0 dB = el pico máximo del instrumento en 0 dBFS.** Cada instrumento (y los FX) sale de su
canal con su pico más alto en 0 dB, y la mezcla es **solo la posición de los faders**. Arriba,
**MEZCLA** elige el **preset**: **MINIMAL** (por defecto) o **PLANO** (todo a 0 dB). Elegir uno
mueve los faders de instrumentos y FX de los dos universos (el máster no). Si luego tocas alguno,
sale **RETOCADA** y el dB de ese fader se enciende. Ver "Mezcla por defecto".
Los medidores de instrumentos y FX van en la **misma escala que el fader** (0 dB a tres cuartos,
+6 arriba, −48 abajo): como cada canal tiene su pico en 0 dB antes del fader, el medidor de un
instrumento llega como mucho a la altura de su fader (según el universo, puede pasarse unas
décimas). El del máster sigue en dBFS (de −60 a 0, arriba del todo).

Arriba +6 dB, abajo hasta −48 dB y silencio. **Imán** a 0 dB y al valor del preset: mientras lo mueves va libre; si lo sueltas a menos de 0,75 dB de uno de los dos, se va ahí (el sonido al instante; el mando se desliza unas milésimas). En DJ, cada instrumento va en su caja (A y B juntos). Doble clic = el valor del preset. RESTABLECER = el preset entero (y el máster a 0 dB).
La música sigue sonando mientras está abierto. (Todavía no se guarda: vendrá con las cuentas.)

**MASTER** (a la derecha, aparte): la **ganancia del máster** va **antes del limitador**: subirla
empuja la mezcla contra él (más nivel, más limitación). 0 dB = como sonaba siempre; arriba +12 dB,
abajo −48 dB y silencio; mismo imán y doble clic = 0 dB, y nunca va vinculado. Al lado, el
**medidor del máster** (pico de L y R de lo que sale, tras el techo) y el de **LIM**, en naranja,
bajando desde arriba: lo que está quitando el limitador (0–12 dB). Abajo, las cifras: el pico en
dBFS y lo que quita, retenidos 1,5 s para que dé tiempo a leerlos. En **DJ**, la mesa enseña
siempre el máster **entre los dos faders**: L y R y LIM en vertical, del mismo tamaño que los
medidores de canal, y debajo las mismas cifras; la ganancia se toca en el MIXER.
Solo el máster tiene limitador: A, B y los canales llevan medidor de nivel, no de limitación.
(Provisional: con la sesión de mezcla y máster, con cadenas de clippers y limitadores, se
replantea qué mide LIM; ver [HOJA_DE_RUTA.md](HOJA_DE_RUTA.md).)

## Mezcla por defecto

Es el mismo género en todos los universos, así que hay un solo perfil.

**Nivel de cada instrumento** (`LEVEL` en `src/audio/dsp.js`): todos salen de su canal con el
**pico máximo en 0 dBFS**, antes del fader. Se midió el pico más alto de cada canal en 8
universos al azar con todo sonando a tope, y la ganancia lo lleva a 0 dB. Según el color del
universo, el pico real queda entre +0,6 y unos −4 dB (comprobado en 3 universos más). Los
**FX de transición**, igual (`FX_LEVEL` en `transitionFx.js`: medidos en 9 viajes con FX).

**Presets** (`src/audio/mix.js`), solo la posición de los faders:

| Fader | MINIMAL | PLANO | Por qué (MINIMAL) |
|---|---|---|---|
| Kick | −4 | 0 | el ancla; por debajo de 0 para dejar margen a la suma |
| Bass | −9 | 0 | rodando justo bajo el kick; kick y bajo mandan |
| Perc | −10 | 0 | en rominimal la percusión es la protagonista: por encima de clap y hats |
| Clap | −12 | 0 | marca, pero detrás (no golpea como en tech house) |
| Hat | −13 | 0 | presentes y sin morder |
| Open | −15 | 0 | es largo: se oye más de lo que marca el pico |
| Chord | −14 | 0 | los acordes de deep/minimal acompañan, no tapan el groove |
| Pad | −16 | 0 | el fondo: se siente más que se oye |
| FX | −7 | 0 | las transiciones se insinúan; sin retocar, los golpes de llegada sonaban casi como el kick |

- **MINIMAL** parte de la mezcla de antes (que ya seguía esas reglas: en estos dB era kick −3,7,
  bass −9,3, perc −11,6, clap −10,7, hat −12,7, open −14,4, chord −12,9, pad −14,9 y FX −4) y la
  retoca: percusión +1,6 dB; clap, acordes y pad algo más atrás; FX −3 dB. El nivel total sin FX
  queda casi igual, así que la saturación del universo, el glue y el limitador trabajan como
  siempre. Medido: picos de cada canal a ±1,5 dB de su fader (el pad, hasta −4) y el universo
  entero con picos ≈ −4 dBFS.
- **PLANO** pone cada canal con su pico en 0 dBFS: suena mucho más fuerte y la saturación del
  universo y el limitador trabajan bastante más. Es el punto de partida neutro.
- Esto es solo el balance. Cuánto suena la mezcla al final (RMS, LUFS) es cosa de la futura
  sesión de mezcla y máster (ver [HOJA_DE_RUTA.md](HOJA_DE_RUTA.md)).

- **Master**: ≈ −13 LUFS con picos ≈ −4 dBFS. Deja margen: no va "a tope" (los masters de
  club suelen estar entre −9 y −6 LUFS, pero esto es un instrumento en directo que entra en
  una mesa). Limitador de seguridad con techo ≈ −1 dBFS.
- **Graves en mono**: por debajo de 120 Hz todo es mono (Mid/Side en el master), como
  piden los equipos de club.
- **Limpieza**: high-pass en todo menos kick y bass (clap 160 Hz, perc/acordes 150, pad
  140, hats 300), y un recorte de "barro" en acordes (−5 dB a 550 Hz) y pad (−3 dB a 380 Hz).
  El pad ya no dobla la tónica grave: esa octava es del bajo.
- **Sidechain**: el kick aparta al bajo ≈ 3 dB (quieto) a 7 dB (intenso), a acordes y pad un
  poco. En **DJ** es **cruzado** cuando hace falta: si un universo tiene un bajo sonando **sin
  kick propio** (p. ej. A en INTRO y B en DRIFT), el kick que suena del otro también
  lo aparta, en proporción a lo que la mesa deja oír de ese kick (fader y LOW). Con EASY EQ ya
  era así; ahora también con la EQ normal. Si el bajo tiene su propio kick, solo lo empuja el
  suyo (no hay doble bombeo).
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

- `src/audio/engine.js` — reloj común (Worker + lookahead), BPM, tónica y modo globales, master (ganancia → glue + limitador → techo; medidor L/R y lo que quita el limitador).
- `src/ui/meters.js` — escala de los medidores y el máster (se lee una vez por fotograma; lo pintan la mesa DJ y el MIXER).
- `src/audio/deck.js` — un universo: 8 canales, loop, secuenciador. Sin reverb ni delay: todo seco.
- `src/audio/strip.js` — canal de mezcla: EQ 3 bandas (crossover Linkwitz-Riley, ISOLATOR o EQ; curvas de EASY EQ), filtro DJ, fader, medidor.
- `src/audio/lowRoles.js` — EASY EQ · GRAVES: reparte los papeles KICK y BAJO entre los dos universos (dueño según el giro, cambio en el tiempo, sidechain cruzado; con la EQ normal, cruzado cuando un bajo suena sin kick propio).
- `src/audio/dsp.js` — canal de instrumento (drive → HP → LP → fade → duck), saturación.
- `src/audio/voices.js` — kick, clap, hats tipo 808, percusión (tono / FM / ruido), bajo, acordes dub y pad.
- `src/music/emotion.js` — el color de cada universo → timbre, golpe, duraciones y swing; las escalas.
- `src/music/generators.js` — motivos estables con mutación lenta, percusión polimétrica, bajo y armonía en grados de escala.
- `src/music/arrangement.js` — las 8 escenas (presencia por instrumento), umbrales, viajes.
- `src/music/complexity.js` — la complejidad por grupos y el global: reglas por instrumento, presupuesto de protagonismo.
- `src/ui/` — sliders, knobs y la vista de universo (se instancia dos veces).
