# MINIMAL UNIVERSE

Instrumento generativo en directo para minimal / rominimal / deep / house experimental.
No se tocan parámetros de sonido: se toca **estructura** (qué suena) y **complejidad**
(cuánto pasa). El color del sonido lo pone cada universo.

Al entrar eliges el modo:

- **UN UNIVERSO** — un solo mundo, con los controles grandes (estructura · transición · complejidad en una fila).
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

- **Ordenador**: CALIDAD **NORMAL** (el filtro lento del pad por bloques: suena igual) y búfer
  de ~50 ms.
- **Móvil** (Android / iPhone / iPad): CALIDAD **LIGERA** (además, saturación sin
  sobremuestreo, un oscilador por nota en acordes y pad, bajo sin osciladores inaudibles),
  búfer de ~45 ms, margen de 150 ms que sube solo si el móvil se atasca, ajustes solo cuando
  cambian, canvas a menor resolución y sin osciloscopio, y 16 MB para el banco de sonidos (48
  en ordenador).
- En los dos, hats y percs salen del **banco de sonidos** (ver "Taller de percusión").

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
| **COMPLEJIDAD** (4 faders) | KICK · PERCS · BASS · INSTR.: cuánta información dice cada grupo (ver abajo). Se aplica en el siguiente compás. Doble clic = 0,5. |
| **OSCILADOR** (uno por fader) | La complejidad del grupo va y viene entre el fader (A) y la **marca** ◂ de su derecha (B): arrastrar = ponerla, doble clic = quitarla. El **cuadradito** junto al nombre del grupo = encenderlo / apagarlo. Debajo, el **GESTO** (‹ › o clic en la palabra) y la **línea de la frase**: arrastrar arriba / abajo = más rápido / más lento, de lado = en qué tramo de la frase; doble clic = como el gesto; mantener = editor de casillas. Ver "Osciladores". |
| **OSC** (junto a COMPLEJIDAD) | Todos los osciladores del universo encendidos / en silencio. En silencio suenan los faders, y los osciladores se siguen viendo y tocando: se preparan por debajo y entran al volver a encenderlo. |
| **GLOBAL** (barra en la cabecera) | SIMPLE ← → COMPLEJO. Escala a la vez los cuatro faders, en proporción. Rueda = fino, doble clic = 0,8. En DJ y en móvil las etiquetas son − / +. |
| **CANT · VAR** (bajo HAT, PERC y FOLEY) | Dos perillas por grupo, con el centro arriba (= lo normal). **CANT** (cantidad) = cuántos golpes da cada sonido; **VAR** (variedad) = cuántos sonidos distintos hay, de 1 a 5 (el número a su lado). Independientes de la COMPLEJIDAD. Arrastrar arriba / abajo, rueda; doble clic = centro. Se aplican en el siguiente compás. Ver "Cantidad y variedad". |
| **NUEVO UNIVERSO** | Otros motivos, otro kit de percusión, otro **color** de sonido y otros valores de los cuatro faders de complejidad y de las perillas CANT · VAR (en el siguiente compás). El GLOBAL no cambia. Nace con el **ESTILO** que marca el fader de al lado. |
| **ESTILO** (junto a NUEVO UNIVERSO) | **NORMAL ← → ROMINIMAL**: con qué género nace el **próximo** universo. NORMAL (izquierda) = lo de siempre, idéntico; ROMINIMAL (derecha) = el género puro; en medio, los valores intermedios. Cuenta al pulsar NUEVO UNIVERSO y, antes del primer GENERAR, también para el universo que espera (no hay que generar dos veces). En UN UNIVERSO es un fader; en DJ y en el móvil, una perilla (**RO**). Doble clic = NORMAL. La marca del fader = el estilo del universo que suena; al pasar el ratón, su arquetipo. Ver "Estilo: NORMAL ↔ ROMINIMAL". |

## Estructura: los momentos de un tema

Ocho **partes** en una rejilla 2×4, como los pads de un controlador (8 por universo; en DJ, 16).
Se llaman por lo que son en la estructura de un tema (minimal, rominimal, deep house, techno,
experimental), no por lo que suena: más adelante, la parte decidirá también arreglos, mezcla y
transiciones (no es lo mismo ir de BREAK a DROP que de DROP a BREAK).

```
sin kick │ BREAK   DRIFT   BUILD   KICK-OUT
con kick │ INTRO   GROOVE  MAIN    DROP
```

Cada parte tiene **dos versiones** (botones **AHORA** y **LUEGO**, ver abajo): dos posibilidades
del mismo momento. Para poder predecirlas, siempre en el mismo orden: **la 1 con menos elementos
(o energía) y la 2 con más**. En cada versión suena **solo** lo que dice la tabla (auditado: en
las 16 combinaciones, nada de lo que no toca programa notas ni deja sonido por encima de −80 dB
una vez asentada la parte).

| Parte | Qué es | Versión 1 | Versión 2 |
|---|---|---|---|
| **INTRO** | la pista de entrada (y de salida): batería seca para mezclar | kick, hats y algo de percusión | toda la batería: + clap y open hat |
| **GROOVE** | el «roller» hipnótico, el corazón del rominimal: donde el tema vive más tiempo | kick, bajo, hats y algo de percusión | toda la batería y bajo, sin música: + clap, open hat y percusión entera |
| **MAIN** | el groove lleno antes del pico | kick, bajo, toda la batería y acordes suaves; sin pad | lo mismo con los acordes enteros; aún sin pad |
| **DROP** | el pico: todo dentro | todo; el pad algo al fondo | todo, con acordes y pad enteros |
| **BREAK** | el breakdown: cae la batería y manda la atmósfera | el pad a tope, acordes flojos y un hat lejano | el pad, acordes enteros, un hat lejano y algo de percusión |
| **DRIFT** | lo experimental / ambient: flota, bajo y armonía suspendidos | bajo, acordes y pad | lo mismo con pulso: hats lejanos y percusión |
| **BUILD** | la subida: sin graves, arriba el ritmo; pide un drop | hats, percusión, acordes y pad (sin clap ni open hat) | + clap y open hat |
| **KICK-OUT** | el bajo sigue rodando sin kick: tensión antes de que vuelva | bajo, hats, percusión y acordes | todo menos el kick |

**FOLEY** (desde 2026-11-10) está en todas las partes, con más peso donde la batería se aclara:
BREAK 0,5 · 0,8; DRIFT 0,5 · 0,85; INTRO y GROOVE 0,5 · 0,8; KICK-OUT 0,6 · 0,75; BUILD 0,4 ·
0,6; y discreto en MAIN y DROP 0,3 · 0,5 (versión 1 · versión 2, presencia de 0 a 1).

**AHORA** y **LUEGO** (a la derecha de las partes, cada uno con 1 · 2; en DJ, en cada universo):
- **AHORA** = la versión de la parte que **suena**. **LUEGO** = la del **destino** del viaje; si
  no hay viaje, la de la **próxima parte que pulses**.
- **Se normalizan solas**: cuando ya solo suena una parte (al llegar un viaje), AHORA pasa a ser la
  de LUEGO. De BREAK 1 a DROP 2: al llegar, AHORA = 2 y LUEGO = 2.
- **AHORA**, al pulsar:
  - **Quieto**: la otra versión de la parte que suena entra en el **siguiente compás** (DE GOLPE,
    de golpe en ese 1; PROGRESIVA, en 1 compás, SUAVE o ESCALONADA; sin FX). LUEGO la sigue.
  - **En un viaje que espera la frase**, o **DE GOLPE** (el origen se aguanta hasta el 1): cambia
    la versión del origen, igual que quieto; el destino no se toca. Si el viaje empieza en ese
    mismo compás, ya no da tiempo.
  - **A mitad de un viaje PROGRESIVO**: no se puede (el botón se apaga): lo que suena ya es
    mezcla de las dos partes.
  - Dos pulsaciones antes de que empiece el cambio lo anulan. **Parado**, salta directo.
- **LUEGO**, al pulsar:
  - **En un viaje** (esperando la frase o a medias): el viaje sigue igual (inicio, duración, FX) y
    **llega a la otra versión**, sin saltos: cada instrumento sigue desde donde está.
  - **Quieto**: elige la versión de la próxima parte, sin tocar lo que suena (el botón se marca
    con borde discontinuo). Pulsar luego una parte (incluso la misma) va a esa versión.
- **CORTE** (mantener una parte): va en la versión de LUEGO y, al soltarlo, se vuelve a la parte
  elegida en esa misma versión.

Se basan en lo que se repite en estos géneros: intro y outro de batería para que el DJ mezcle,
un groove que se mantiene mucho tiempo con cambios pequeños (rominimal, Villalobos), el drop
como llegada de todo, el breakdown donde cae la batería, la subida sin graves y el kick-out con
el bajo rodando. DRIFT viene del ambient y de los directos modulares: algo que flota y se disuelve.

- Cada botón dice solo el nombre de la parte (lo que es en el tema); qué suena en cada versión
  está en la tabla de arriba.
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
  empezar. Es una rejilla de frases común, contada desde el
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

## Transiciones

Al viajar a una escena (con FX), el universo compone solo la transición: sabe de dónde sale, a
dónde va y cuántos compases dura. Todo sintetizado. Desde 2026-11-10 los platos, golpes y risers
suenan dentro de la **sala** del universo (ver "Espacio: delay, reverb y fondo").

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
  medidor). 0 dB = el pico más alto de los efectos en 0 dBFS; el preset ROMINIMAL lo deja en
  −11,8 dB (ver MIXER). +6 arriba, −70 y silencio abajo; imán a 0 dB y al valor del preset; doble
  clic = el valor del preset. Mueve
  solo las voces de transición (riser, redoble, golpes, platos, reverse, caída): los barridos
  de filtro y el silencio antes del drop son la propia música. En el móvil, solo en el MIXER.
- Pulsar otra escena corta la transición en curso.
  Las transiciones suenan por el canal del universo (en DJ, pasan por su EQ y su fader).

## Instrumentos

KICK · BASS · HAT · PERC · CLAP · OPEN (hat abierto) · **FOLEY** · **CHORD** · **PAD**.

- **FOLEY** (2026-11-10) — objetos que alguien **manipula**: un **material** (papel, plástico,
  aluminio, tela, madera, metal, vidrio, arena, agua) con una **acción** (estrujar, frotar,
  soltar, rebotar, derramar). Cada universo crea los suyos, distintos cada vez. No son golpes
  como una perc, son **gestos** de medio segundo a más de un segundo que suben, se sueltan y
  vuelven a subir (como un papel que se arruga, se suelta y se vuelve a arrugar), con su
  propio tiempo dentro del sonido (grabado en él; el golpe sigue cayendo en su paso). Sintetizados en el taller (ver "Taller de
  percusión") y por el banco, como hats y percs; preparados para que los samples entren
  después por el mismo canal. Canal propio en el MIXER (estéreo: cada objeto en su sitio del
  panorama), en la complejidad de PERCS y con sus perillas CANT · VAR. Seco, a propósito.
  Sin humanizar: el swing es el de todo el universo, sin desplazamientos al azar. (Desde
  2026-11-10 ya no va seco del todo: manda algo a la sala y al delay del universo, ver "Espacio".)
- **CHORD** — acordes dub: stabs cortos con filtro que se cierra. Ritmo en
  contratiempo que nunca pisa al kick. A tope en DRIFT y en DROP, un poco en el BREAK.
- **PAD** — la atmósfera: un acorde largo con filtro que respira y un poco de aire (ruido
  filtrado). Manda en el BREAK y en DRIFT; en DROP se aparta.
- Los dos comparten una progresión de 8 compases en grados de escala (un solo acorde, o la
  casa y otro: iv, VI, VII o v). Si el modo cambia, se recolorean al compás siguiente.
- El kick los hace bombear un poco (sidechain), y NUEVO UNIVERSO cambia también la armonía.

### Taller de percusión (hats y percs)

Cada hat y cada perc es una **receta**: un motor y sus números (`src/music/sounds.js`), con
el color del universo. El **taller** (`src/audio/drumsynth.js`, JavaScript puro, sin Web Audio)
la sintetiza y el **banco de sonidos** (`src/audio/soundBank.js`) la guarda grabada: 4
variantes por sonido (el ruido cambia de un golpe a otro), y dos capas (floja y fuerte) si
responde a la velocidad. Cada golpe solo reproduce la grabación: 2 nodos, cueste lo que cueste
el motor.

- **Graba en segundo plano** (un Worker): nunca para el reloj ni la pantalla. Un universo
  entero (11 sonidos) son ~100 ms de trabajo; el hat abierto largo, el más caro, ~40 ms.
- **NUEVO UNIVERSO** graba sus sonidos al pulsarlo, antes de que entre: suenan desde el
  primer golpe (medido: 0 golpes perdidos).
- **El color**: si viaja (universo nuevo), cada sonido se vuelve a grabar cada medio segundo y
  el cambio se oye gradual. Con la deriva lenta sola, una vez cada 4 s (no se oye la
  diferencia). Lo que cambia de verdad (un carril que muta, otra tónica o escala) entra al
  momento. Mientras se graba lo nuevo, suena lo anterior: nunca hay hueco.
- **Las colas**: cada sonido dice qué corta. El cerrado del hat del universo corta a su
  abierto; el MEDIO se corta a sí mismo; el resto suena entero. Tope de 8 colas vivas por
  sonido (la más vieja se apaga en ~20 ms).
- **Mismo sonido que antes**: los motores de hoy (metal tipo 808, tono, FM y ruido) se
  comprobaron contra los de Web Audio: tono y FM iguales a la muestra (diferencia −51…−74 dB),
  hats y ruido iguales en nivel (±0,4 dB) y en el reparto de frecuencias. La cuadrada de
  Chrome está normalizada (RMS 0,845): se midió y se iguala.
- **Etapas comunes**: palo (clic de 1,5 ms), envolvente de filtro, puerta (la cola se cierra a
  un largo fijo), saturación, bits y muestreo reducidos (antes de la envolvente, como en el
  909: la cola nunca crepita), capa floja más oscura y corta, y variación de altura y largo por
  golpe (sin usar: es humanización, para otra sesión).
- **Motores** (fase 2, 2026-11-10). Cada universo sortea con qué motor suena cada sonido:
  - **Hats** FINO, OSCURO, TICK y MEDIO, según su papel: **metal** (el 808 o un juego de
    proporciones propio del universo), **FM** (2 osciladores a proporción inarmónica, a 2× de
    muestreo: sin aliasing), **ruido 909/707** (paso alto resonante, a veces con 6 u 8 bits),
    **plato de resonadores** (14 resonadores de un mismo plato, golpeados por ruido) y
    **granos** (shaker, cabasa). FINO tira a granos y ruido; MEDIO a plato, ruido y metal.
    El hat del universo sigue siendo el metal 808 (la tabla de estilos, fase 3, lo decidirá).
  - **Percs** (cada carril): tono y FM (los de siempre), ruido estrecho, **resonador** (rim,
    clave o conga, el puente en T de la 808), **cowbell** (dos cuadradas a 587 : 845),
    **modal** (madera, barra o tubo, con modos inarmónicos), **Karplus-Strong** (tic de
    madera afinado), **glitch** (clics y ráfagas de 1–5 ms) y **granos** (semillas). La
    percusión principal solo sale de los que tienen tono (tono, FM, resonador, modal, KS).
    La altura del carril se lleva por octavas al registro de cada instrumento.
  - Todos siguen el color (brillo, largo, madera ↔ metal) y responden a la velocidad con dos
    capas (el golpe flojo, más oscuro o más blando).
  - **Nivel igualado**: el tramo de 10 ms más fuerte de cada golpe nuevo se lleva al nivel de
    los de antes de su tipo (medido), sin pasar de 0,9 de pico.
  - **Medido** (150 universos, todas las variantes y capas): los sonidos de antes, idénticos
    muestra a muestra; 0 NaN, 0 clics con el detector de RENDIMIENTO.md §7 (los granos y el
    glitch están hechos de clics a propósito); largos parecidos a los del metal de cada tipo.
- **FOLEY: el motor de gestos** (2026-11-10, motor `foley`). Tres capas, como en los modelos
  físicos de foley:
  - **Actividad**: la curva del gesto. Estrujar = 2–4 empujones que suben (crescendo), se
    aguantan y caen, con el objeto casi suelto entre uno y otro; frotar = 1–3 pasadas casi
    seguidas; rebotar = golpes cada vez más seguidos y más flojos; derramar = subida lenta,
    tramo que se aguanta y caída; soltar = un golpe y lo que queda.
  - **Microeventos**: salen al azar, más cuanta más actividad. Su energía sigue una **ley de
    potencia** (muchos flojos, pocos fuertes), como el sonido medido del papel arrugado. Cada
    uno golpea el **cuerpo** del objeto (sus resonadores) por un sitio distinto: chasquidos
    (papel, plástico, aluminio, madera, metal, vidrio), granos (tela, arena) o burbujas que
    suben de altura (agua).
  - **Roce**: ruido continuo que sigue a la actividad, más brillante cuanto más fuerte.
  - Todo con números continuos sacados de la semilla de cada objeto: dos papeles de dos
    universos no suenan igual. Tres realizaciones por objeto (cada golpe, otra). El color los
    hace más brillantes u oscuros y estira o encoge el gesto.
  - **De dónde sale** (investigación 2026-11-10): Houle y Sethna, *Acoustic emission from
    crumpling paper* (pulsos con energía en ley de potencia, exponente 1,3–1,6; cada uno una
    oscilación de ~1 kHz que se apaga en ~1 ms; ruido de roce entre pulsos); Kramer y Lobkovsky
    (la ley de potencia es universal entre materiales); Cirio et al., *Crumpling sound
    synthesis* (SIGGRAPH Asia 2016: eventos según la actividad del arrugado, energías por
    muestreo inverso de la ley de potencia, cada uno excita los modos del objeto); An, James y
    Marschner (tela = roce + arrugado); Gaver (rebotar, romper, frotar como patrones de golpes
    simples en el tiempo); van den Doel (burbujas: seno cuya altura sube ~10 % mientras cae).
  - **Medido** (60 colores y semillas por material, todas sus acciones): 0 NaN; los gestos de
    varios empujones vuelven a subir tras caer en el 60–100 % de las realizaciones; largos de
    ~0,4 s (soltar) a 1,6 s (estrujar, derramar); grabar cada uno, 25–60 ms de mediana en el
    Worker (hasta ~150 ms); ~300–750 KB por objeto. En la app (DJ, FOLEY al máximo en los dos,
    8 universos nuevos): 0 golpes perdidos, 0 CORTES, 0 TARDE; el canal, recalibrado a 0 dBFS
    (pico medido −13,7 dB con la ganancia de partida). ⚠ La memoria del banco llega a su tope
    (47 de 48 MB) y se recorta sola; en móvil (16 MB) está sin medir.
- **Prioridad del banco**: lo que va a sonar y aún no existe (una ranura nueva, un carril que
  cambió de sonido, el universo que viene) pasa delante de los retoques de color.
- **Memoria**: 48 MB en ordenador y 16 MB en móvil; por encima, se olvida lo que hace más que
  no suena.

## Complejidad

Cuatro faders por universo, uno por grupo, y la barra GLOBAL de la cabecera que los escala
a todos en proporción (lo que suena = fader × global; el número y la línea fina de cada
fader muestran ese resultado). Así puedes tener, por ejemplo, un kick simple a negras, un
bajo con movimiento pero de solo 2–3 notas, unos percs juguetones y los instrumentos a
medias, y bajar o subir todo el universo con el GLOBAL sin perder ese carácter.

| Grupo | SIMPLE | COMPLEJO |
|---|---|---|
| **KICK** | negras rectas | kicks fantasma (al máximo, dos). La caída del último tiempo al final de frase ya no es complejidad: es un AUTO-ARREGLO |
| **PERCS** (hat, open hat, clap, perc, foley) | hats y percusión en corcheas (el hat en contratiempo), sin redobles, clap recto, motivos que casi no cambian | semicorcheas, redobles de hat, percusión y clap al final de frase (al máximo, redoble largo de semicorcheas), clap con fantasmas y desplazado, un open hat a contrapié, motivos que mutan más |
| **BASS** | corcheas en contratiempo con tónica y octava, siempre el mismo motivo | semicorcheas, todas las notas, variación cada 4 compases |
| **INSTR.** (acordes, pad) | un solo acorde de 2 notas, stabs muy espaciados, el pad cambia cada 4–8 compases | progresión, 4 notas, stabs seguidos, el pad cada 2–4 |

Cada grupo también decide cuánto cambian sus motivos con el tiempo (poco = hipnótico).

En PERCS, la complejidad decide **cómo** se tocan hats y percusión, no **cuántos golpes** ni
**cuántos sonidos**: eso son las perillas CANT y VAR (ver "Cantidad y variedad").

Con el GLOBAL, dos reglas para que no compita todo a la vez:

- **Protagonismo**: hay un presupuesto de instrumentos "a tope" (≈2 con el GLOBAL al
  mínimo, todos al máximo). Si en la estructura entran más, ceden densidad por orden:
  primero percusión, acordes y open hat; luego clap y hat; el bajo casi nada. El kick y el
  pad no ceden.
- **Turnos** (GLOBAL por debajo de 0,6): los acordes esquivan al bajo (se mueven una
  corchea, como respuesta) y la percusión deja libres los golpes de acordes y clap.

### Cantidad y variedad (hats, percs y foley)

Bajo **HAT**, **PERC** y **FOLEY**, en la tira de instrumentos, dos perillas con el centro arriba.
Son independientes de la complejidad: se puede tener mucha variedad de hats que suenan poco,
un solo hat que suena mucho, muchos hats y pocas percs, etc.

| | izquierda | centro | derecha |
|---|---|---|---|
| **CANT** (cantidad: golpes de cada sonido) | casi nada: un golpe suelto | lo de siempre | casi todos los pasos |
| **VAR** (variedad: sonidos distintos) | 1 | 3 | 5 |

- **HATS**: el 1º es el hat del universo (el cerrado y su abierto, el mismo plato). Los
  otros cuatro salen de cada universo con su propio timbre, y en un orden que también cambia
  (el 2º siempre es cerrado):
  - **FINO** — brillante, casi ruido, en semicorcheas (el "shaker").
  - **OSCURO** — más grave y algo más largo, en negras y corcheas (el "chick" del pedal).
  - **TICK** — un clic metálico cortísimo justo antes del tiempo.
  - **MEDIO** — medio abierto, a contrapié; suena por el canal OPEN (solo donde hay open hat).
  Todos siguen el color del universo. Las colas: el cerrado del hat del universo corta a su
  abierto, y el MEDIO se corta a sí mismo; los demás platos no se cortan entre ellos.
  En un mismo paso suena un solo hat cerrado (y un solo abierto): el que lo tiene más
  seguro. Por eso, con mucha CANTIDAD, los otros hats no desaparecen bajo el principal.
- **PERCS**: VAR = cuántos carriles de percusión polimétrica (cada uno con su sonido y su
  longitud: 16, 12, 7, 5...). El 1º es la **percusión principal**, la única con VAR 1: siempre
  con tono (tonal o FM, nunca ruido estrecho), al menos un golpe por cada cuatro pasos de su
  ciclo y sus golpes base en corcheas, para que nunca salga casi muda. CANT = cuántos golpes da cada carril: en el centro, su patrón
  euclídeo de siempre; al subir, entran los huecos más alejados de lo que ya suena; al bajar,
  se van en orden inverso. Subir y bajar es reversible.
- **FOLEY**: VAR = cuántos objetos (1 a 5, cada uno de un material distinto y en su carril).
  Los carriles son largos (de 7 a 32 pasos, hasta dos compases) y con pocos golpes: cada
  objeto aparece de vez en cuando, no lleva el pulso. CANT = cuántos golpes, como en PERC.
  Con CANT y VAR en el centro, unos 3–4 gestos por compás con la parte a tope. Convive con la
  percusión: donde ya suena una perc, el foley calla salvo en sus golpes más fuertes. Al mutar,
  un carril puede cambiar a un objeto nuevo (de un material que no esté en ningún otro).
- El que está entrando con VAR lo hace poco a poco: primero sus golpes más fuertes.
- La densidad de la parte (estructura) sigue mandando por encima: con una parte floja
  ("hats lejanos") suenan menos golpes, y en un viaje los carriles entran poco a poco.

### Osciladores

Cada grupo puede ir y venir entre su fader (**A**, el punto de partida) y una marca (**B**,
el punto final), por encima o por debajo: con B por encima el gesto abre, con B por debajo
cierra (el "al revés"). Sin marca, no oscila. No se programa: se elige un **gesto** y se
**guía** en el tiempo.

**Gestos** (qué hace el grupo en la frase de 8 compases):

| Gesto | Qué hace |
|---|---|
| **—** | quieto |
| **REMATE** | se abre al final |
| **RESPIRA** | lento: un rato cerrado, un rato abierto |
| **PREGUNTA** | va y viene: cerrado, abierto, cerrado, abierto |
| **BAILA** | se mueve por pulsos, solo en un tramo de la frase |
| **CRECE** | sube poco a poco y vuelve |
| **OLA** | sube y baja |

Cada gesto tiene 2 o 3 **variantes** (más lenta, más rápida, en otro tramo) y cada universo
elige cuál toca en cada grupo: al elegir un gesto, sale su variante de este universo.

**Guía de tiempos**, sobre la línea de la frase (32 pulsos; el alto de cada uno = cuánto se
acerca a B, y el que suena se ilumina). Dos ejes, a saltos, con un cartel que dice dónde estás:

- **Arriba / abajo = velocidad**: cada cuánto se mueve. 2 COMP. · COMPÁS · ½ COMP. · PULSO.
- **De lado = tramo**: en qué parte de la frase actúa. TODA LA FRASE · 2ª MITAD · FINAL (los
  dos últimos compases).
- Rueda = velocidad. Doble clic = vuelve a la variante del gesto.

Así se combinan tiempos sin dibujar: PREGUNTA a PULSO en el FINAL = seis compases quietos y en
los dos últimos el grupo va y viene por pulsos.

**Editor de casillas** (mantener la línea sin mover): para afinar a mano. Por dentro, gesto y
guía son dos niveles de 4 casillas que se multiplican: el 1 es la forma a esa velocidad y el 2
el tramo (decide cuánto del 1 suena). Cada nivel tiene sus flechas de patrón, su encendido, su
unidad y ↺. Pintar: **clic** llena o vacía, **de lado** pinta, **arriba / abajo** da un nivel
intermedio (las casillas crecen para verlo) y la **rueda** también. Lo retocado se marca con un
asterisco (BAILA\*); **↺ VOLVER AL GESTO** lo borra, y mover la guía o el gesto también. Se
cierra con ✕ o Esc.

- Encendido: el cuadradito junto al nombre del grupo (apagado, se ve atenuado y no suena), y
  **OSC** en la cabecera para silenciar todos los del universo. En silencio, la franja del fader
  y el pulso de la línea se ven en discontinuo: se prepara por debajo.
- La franja del fader marca el recorrido A–B; la línea fina y el número, lo que suena en cada
  momento (× GLOBAL).
- Con velocidad de pulso o medio compás, el compás se genera en varias versiones con el mismo
  "dado" y se cose pulso a pulso: un golpe fantasma o un redoble que sale en una versión sale en
  la otra, y lo que cambia es cuánto suena. El bajo y los acordes recortan sus notas para no
  pisarse al cambiar de pulso.
- No oscilan: la **mutación** de los motivos (sigue al fader), la progresión de acordes y el
  **pad** (una nota larga por compás). Los acordes sí oscilan en ritmo y en número de notas.
- NUEVO UNIVERSO sortea también los osciladores: cuáles se encienden (el kick menos a menudo),
  hacia dónde va B (arriba o abajo del fader nuevo), el gesto y la variante de cada gesto. Solo
  se queda como estaba OSC: si el universo tenía los osciladores en silencio, el nuevo también.
  El primer universo al abrir sale con todos apagados. Todavía no se guardan.
- Pad pequeño (móvil): sin flechas junto al gesto; clic en la palabra = el siguiente.

## Espacio: delay, reverb y fondo

(2026-11-10) Los primeros **efectos creativos**. Cada universo **nace con su espacio**, como nace
con su color: de su semilla y de su ESTILO. El intérprete no toca parámetros de sonido; lo suyo es
el volumen de cada retorno en el MIXER (DELAY, REVERB y FONDO, con MUTE y SOLO). Generación en
`src/music/space.js`, audio en `src/audio/spaceFx.js`.

- **DELAY, parte del ritmo**: ecos en la rejilla, a lo dub. Cada universo decide la **división**
  (corchea, corchea con puntillo, negra, negra con puntillo o tresillo de corchea), si va en
  **PING-PONG** (un eco a cada lado) o centrado, **cuánto se repite**, cómo se **oscurece y
  adelgaza** cada repetición (filtros en la realimentación, como un eco de cinta: el primer eco
  sale entero), un poco de **cinta** (saturación que redondea sin subir el nivel, y un vaivén lento
  del tiempo) y cuánto de los ecos pasa a la sala. Sigue al BPM (deslizándose, como una cinta).
- **A quién**: un instrumento **PROTAGONISTA** del eco (los stabs de CHORD, la PERC, los HATS o el
  FOLEY) y los demás con poco o nada. El **CLAP, casi seco** (2026-11-11: nunca protagonista, un
  poco de sala y casi nada de eco; antes era lo más mojado de la batería). **Kick y bajo, siempre secos** (los graves del
  club, limpios). Algunos universos (~15 % en NORMAL) nacen sin delay.
- **THROWS**, el gesto dub: en el último compás de algunas frases (cada 8 o 16 compases, con una
  probabilidad de cada universo), el envío del protagonista se abre para su último golpe y los
  ecos caen sobre el 1 de la frase siguiente.
- **REVERB, la sala**: una sala **sintetizada para cada universo** (largo de la cola, predelay,
  cuánto se apagan los agudos al final, reflexiones tempranas, anchura y un paso alto en el
  retorno). Cuánto manda cada instrumento (hats y clap casi secos; percusión, foley, acordes y pad
  más) y también los **efectos de transición** (platos, golpes, risers).
- **FONDO, el colchón** (2026-11-11): una **segunda reverb**, de fondo, que no es una sala: cola
  **larga** (3,5–6,5 s en NORMAL; 5–9 s en ROMINIMAL), **oscura** (se apaga primero por arriba y
  lleva paso bajo en el retorno) y **bastante comprimida** (unos 8 dB de reducción de media y 14 en
  los picos, medido): lo fuerte se aplasta y lo flojo sube, así la cola queda pareja, sin picos. Le
  mandan sobre todo el **FOLEY**, los **efectos de transición** y el **PAD**; algo los hats, la
  percusión, el open y los acordes; el **clap, nunca**. Cada universo nace con el suyo (largo,
  oscuridad, predelay, cuánto comprime y cuánto manda cada uno); ~15 % de los NORMAL, sin fondo.
  Es una **reverb algorítmica** (8 líneas de retardo realimentadas, con un difusor corto delante
  para que los clics no suenen metálicos), no una convolución como la sala: medido, una cola de
  convolución de 4–9 s por universo daba cortes en DJ (ver RENDIMIENTO.md). Así casi no gasta y,
  al cambiar de universo, la cola que sonaba cambia de largo y color sin cortes.
- **Los envíos salen tras el fader** de cada instrumento (y tras su MUTE y su presencia en la
  estructura): un instrumento que se va deja sus ecos y su cola sonando, como en una mesa de
  verdad. Los retornos entran en el universo **antes** de su saturación y de los filtros de tensión
  de las transiciones (un build también filtra los ecos; el hueco antes del kick también los calla).
- **Al cambiar de universo**, su espacio entra en el 1 del compás: la sala nueva recibe desde ahí y
  la vieja se apaga con su propia cola (dos salas que se relevan, sin cortes). Los ecos que ya
  sonaban se deslizan al tiempo nuevo, como una cinta.
- **MIXER**: tres columnas, **DELAY**, **REVERB** y **FONDO**, como un instrumento más (A y B,
  vinculados, medidor, MUTE, SOLO). A 0 dB suenan como el universo los generó; los presets los
  dejan a 0 dB. El estilo no toca su MUTE.
- **ROMINIMAL** (ver [ROMINIMAL.md](ROMINIMAL.md) §6): delay de corchea o corchea con puntillo,
  más ping-pong, repeticiones largas, oscuras y finas, protagonistas los stabs y la percusión,
  hats casi secos, más throws; salas **cortas** (0,3–0,9 s), cálidas y con carácter de habitación,
  con la percusión y el foley dentro (el clap, casi seco). Cada arquetipo lo mueve (DUB: el eco manda;
  ESQUELETO: casi seco; BOSQUE: el foley en su habitación; ORGÁNICO: sala algo mayor con pad y
  teclas; CLICS: ecos cortos de clics y sala mínima; RODANTE: el eco en la percusión).
- Al pasar el ratón por el fader de ESTILO se ve el espacio del universo que suena
  («espacio: DELAY 1/8 con puntillo, ping-pong, 45 % de repetición, protagonista CHORD · REVERB 0,6 s · FONDO 7,2 s»).
- **Coste** (render offline, dos universos): sala ~4,5–7 %, delay ~3 % (ver RENDIMIENTO.md §5).
  En CALIDAD LIGERA las salas duran como mucho 1,2 s.
- **Falta escucharlo** (el oído decide los rangos y el nivel de los retornos).

## Color de cada universo

Ya no hay pad de EMOCIÓN. Cada universo sale con su propio color de sonido (más oscuro o
más brillante, golpes más blandos o más duros, notas más largas o más cortas, más o menos
swing), que cambia con NUEVO UNIVERSO, con un fundido de unos 2 s. El kick siempre suena en
la tónica y el swing no pasa del 58 % (con ESTILO, cada instrumento swinguea a su manera por
encima: ver ROMINIMAL.md §6 «Groove»). El color del universo en pantalla lo refleja.

## Estilo: NORMAL ↔ ROMINIMAL

(2026-11-10) Un fader por universo, junto a NUEVO UNIVERSO, que decide con qué **género** nace el
próximo universo. Investigación, fuentes, rasgos por dimensión y qué falta: **[ROMINIMAL.md](ROMINIMAL.md)**.

- **NORMAL** (a la izquierda) es lo de siempre, **idéntico**: con la misma semilla sale el mismo
  universo, tirada por tirada (comprobado: 300 universos, 60 000 comprobaciones, 0 diferencias), y
  NUEVO UNIVERSO no toca el MIXER.
- **ROMINIMAL** (a la derecha) cambia **de qué** se sortea, no solo cuánto: el timbre de cada
  instrumento (kick corto y seco, hats con grano, percusión de madera, rim y clics, bajo subgrave de
  una o dos notas, stabs dub, pad oscuro que sube despacio, swing alto), los ritmos (el «salto» del
  kick, el bajo en los huecos del kick, polimetría impar, casi siempre un solo acorde), la
  complejidad y sus osciladores (más encendidos, cortos y lentos), CANT · VAR, la mutación, las
  transiciones (sobrias) y la **mezcla** con la que nace: los faders de sus instrumentos y de FX y
  sus **MUTE** en el MIXER.
- **Arquetipos**: cada universo ROMINIMAL sale de una de las combinaciones del género: **RODANTE**
  (la percusión manda), **ESQUELETO** (lo mínimo), **BOSQUE** (foley y un poco de hats), **DUB**
  (acordes dub y bajo redondo), **ORGÁNICO** (pad que sube, teclas, madera) o **CLICS** (escuela
  Villalobos / Perlon). Y su modo de bajo (pluck, sub, redondo, ácido) y de acordes (dub, teclas,
  órgano). Al pasar el ratón por el fader se ve cuál suena.
- **En medio**: rangos y pesos se interpolan; cada MUTE sale con su probabilidad × el fader (con
  más fader, los mismos y alguno más); la mezcla va del preset del MIXER a la del estilo.
- **MIXER**: el universo con estilo nace con su mezcla en el 1 del compás en que entra (sale
  RETOCADA y los MUTE encendidos; todo se puede cambiar). La mezcla que había antes se guarda: si
  luego nace un universo NORMAL, la recupera (no hereda los MUTE del estilo). Elegir un preset del
  MIXER la olvida: la mezcla vuelve a ser tuya.
- El color viaja como siempre (~2 s): un universo nuevo llega a la vez a su color y a su estilo.
- **Antes del primer GENERAR**, el universo que espera ya sigue al fader: al soltarlo se vuelve a
  sortear con ese estilo (mezcla y MUTE incluidos) y con su color puesto, así el primero suena como
  marca el fader sin pulsar NUEVO UNIVERSO. (2026-11-11; antes el primero salía siempre NORMAL.)
- **La mezcla y los envíos de ROMINIMAL** (2026-11-11): los que dejó el usuario **a oído**, con un
  universo ROMINIMAL a tope. La mezcla es la del preset ROMINIMAL del MIXER (ver "Mezcla por
  defecto"): el pad a −54,7, solo colchón; la percusión por detrás (−23,4); el open a −10,1. Los
  **envíos** son un recorte sobre lo que sortea cada universo (`sendTrim` en styles.js): al DELAY,
  la PERC −2,8 dB, el CHORD −14,6 y el OPEN nada; a la REVERB, PERC −6,5 y CHORD −5,5; al FONDO,
  FOLEY −4,4 y casi nada de hats, percusión, open y acordes (−22 a −27 dB): el fondo es del foley,
  las transiciones y el pad. Con el fader a medias, a medias; en NORMAL, nada. Cada arquetipo
  retoca la mezcla unos dB. El colchón lo
  hace sobre todo el **FONDO** (ver "Espacio: delay, reverb y fondo").
- No toca lo que es del intérprete ni lo global: estructura, transición, GLOBAL, BPM, tónica
  y modo (en ROMINIMAL.md §9, cómo tocarlo). No se guarda: cada sesión empieza en NORMAL.

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
    golpe** viniendo de una escena sin kick (DE GOLPE, INSTANTÁNEO o un CORTE), el universo entero (con sus FX de transición) calla un instante justo antes del
    primer golpe del kick. Da más pegada a la entrada. Si el kick entra poco a poco
    (PROGRESIVA), no hay entrada que marcar y no se hace. Rampas de 4 ms al bajar y 2 ms al
    volver, entero justo en el ataque del kick: medido sin clics.
  - **CAÍDA DEL KICK AL FINAL DE FRASE** (encendido, **último tiempo · cada 16 compases**): en
    el último compás de cada tramo de 16 (dos frases de 8) el kick calla su último tiempo.
    Siempre en el mismo sitio, sea cual sea la complejidad (antes salía a veces, y más con la
    complejidad del KICK alta). Si hay un kick fantasma después, se queda.
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
  - **ALTA** — sin atajos: filtros recalculados muestra a muestra. La que más gasta.
  - **NORMAL** (por defecto en ordenador) — el filtro lento del pad se recalcula cada ~3 ms.
    Suena igual.
  - **LIGERA** (por defecto en móvil) — además, saturación sin sobremuestreo y voces más
    sencillas.
  - Hats y percs no dependen de la calidad: en las tres salen del banco de sonidos (ver
    "Taller de percusión"). Antes, ALTA los sintetizaba al momento y NORMAL grababa solo los hats.
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

Bajo cada fader, **M** (MUTE) y **S** (SOLO). MUTE silencia ese canal sin mover el fader. SOLO
"en su sitio": si hay alguno en SOLO, se oyen solo esos, de los dos universos (los demás se ven
medio apagados). Vinculados, A y B se encienden juntos (los FX, nunca). Rampa corta al entrar y
salir: sin clics. **RESTABLECER** los quita todos. No se guardan. En la fila de instrumentos del
universo, lo que no se oye (en MUTE, o callado por el SOLO de otro) sale en gris, no en blanco.

**ENVÍOS** (2026-11-11): arriba de cada canal, tres filas de perillas, **DLY**, **REV** y **FONDO**:
cuánto manda ese elemento al delay, a la sala y a la reverb de fondo, **el valor real** del
universo en dB (misma escala que los faders: 0 dB a tres cuartos, abajo −∞). Están en **todos**
los elementos y las transiciones, aunque estén a −∞ (kick y bajo nacen secos, el clap sin fondo,
las transiciones sin delay: se pueden subir). Cada universo nace con los suyos y las perillas
los siguen, como los faders con la mezcla del estilo; tocarlas cambia el universo que suena (el
siguiente trae los suyos). En DJ, una para A y otra para B, **vinculadas** como los faders (las
transiciones, nunca). La cifra en blanco = ya no está como nació; doble clic = como nació.

**0 dB = el pico máximo del instrumento en 0 dBFS.** Cada instrumento (y los FX) sale de su
canal con su pico más alto en 0 dB, y la mezcla es **solo la posición de los faders**. Arriba,
**MEZCLA** elige el **preset**: **ROMINIMAL** (por defecto) o **PLANO** (todo a 0 dB). Elegir uno
mueve los faders de instrumentos y FX de los dos universos (el máster no). Si luego tocas alguno,
sale **RETOCADA** y el dB de ese fader se enciende. Ver "Mezcla por defecto".
Los medidores de instrumentos y FX van en la **misma escala que el fader** (0 dB a tres cuartos,
+6 arriba, −70 abajo, como en Ableton: un canal muy bajo, como el pad de ROMINIMAL a −40, sigue
viéndose): como cada canal tiene su pico en 0 dB antes del fader, el medidor de un
instrumento llega como mucho a la altura de su fader (según el universo, puede pasarse unas
décimas). El del máster sigue en dBFS (de −60 a 0, arriba del todo).

Arriba +6 dB, abajo hasta −70 dB y silencio (hasta 2026-11-11, −48). **Imán** a 0 dB y al valor del preset: mientras lo mueves va libre; si lo sueltas a menos de 0,75 dB de uno de los dos, se va ahí (el sonido al instante; el mando se desliza unas milésimas). En DJ, cada instrumento va en su caja (A y B juntos). Doble clic = el valor del preset. RESTABLECER = el preset entero (y el máster a 0 dB).
La música sigue sonando mientras está abierto. (Todavía no se guarda: vendrá con las cuentas.)

**MASTER** (a la derecha, aparte): la **ganancia del máster** va **antes del limitador**: subirla
empuja la mezcla contra él (más nivel, más limitación). 0 dB = como sonaba siempre; arriba +12 dB,
abajo −70 dB y silencio; mismo imán y doble clic = 0 dB, y nunca va vinculado. Al lado, el
**medidor del máster** (pico de L y R de lo que sale, tras el techo) y el de **LIM**, en naranja,
bajando desde arriba: lo que está quitando el limitador (0–12 dB). Abajo, las cifras: el pico en
dBFS y lo que quita, retenidos 1,5 s para que dé tiempo a leerlos. En **DJ**, la mesa enseña
siempre el máster **entre los dos faders**: L y R y LIM en vertical, del mismo tamaño que los
medidores de canal, y debajo las mismas cifras; la ganancia se toca en el MIXER.
Solo el máster tiene limitador: A, B y los canales llevan medidor de nivel, no de limitación.
(Provisional: con la sesión de mezcla y máster, con cadenas de clippers y limitadores, se
replantea qué mide LIM; ver [HOJA_DE_RUTA.md](HOJA_DE_RUTA.md).)

## Mezcla por defecto

Es el mismo género en todos los universos, así que hay un solo perfil. (Un universo que nace con
**ESTILO** trae además su propia mezcla y sus MUTE: ver "Estilo: NORMAL ↔ ROMINIMAL".)

**Nivel de cada instrumento** (`LEVEL` en `src/audio/dsp.js`): todos salen de su canal con el
**pico máximo en 0 dBFS**, antes del fader. Se midió el pico más alto de cada canal en 8
universos al azar con todo sonando a tope, y la ganancia lo lleva a 0 dB. Según el color del
universo, el pico real queda entre +0,6 y unos −4 dB (comprobado en 3 universos más). Los
**FX de transición**, igual (`FX_LEVEL` en `transitionFx.js`: medidos en 9 viajes con FX).

**Presets** (`src/audio/mix.js`), solo la posición de los faders:

| Fader | ROMINIMAL | PLANO | (antes, MINIMAL) |
|---|---|---|---|
| Kick | −4,4 | 0 | −4 |
| Bass | −9,2 | 0 | −9 |
| Hat | −13,9 | 0 | −13 |
| Perc | −23,4 | 0 | −10 |
| Clap | −14 | 0 | −12 |
| Open | −10,1 | 0 | −15 |
| Foley | −14,1 | 0 | −12 |
| Chord | −22,2 | 0 | −14 |
| Pad | −54,7 | 0 | −16 |
| Delay · Reverb | 0 | 0 | 0 |
| Fondo | −6,4 | 0 | — |
| FX | −11,8 | 0 | −7 |

- **ROMINIMAL** (2026-11-11; antes se llamaba MINIMAL y tenía otros valores) es la mezcla que dejó
  el usuario **a oído**, con un universo ROMINIMAL a tope: kick y bajo mandan, la percusión por
  detrás, acordes y pad muy al fondo (el pad, solo colchón) y el FONDO como colchón. Es también la
  mezcla de serie del estilo ROMINIMAL (cada universo ROMINIMAL nace con ella, más lo que retoque su
  arquetipo y ±1 dB). Con ella el usuario dejó también sus **envíos** (ver "Estilo: NORMAL ↔
  ROMINIMAL").
- (MINIMAL partía de la mezcla de antes y la retocaba: percusión +1,6 dB; clap, acordes y pad algo
  más atrás; FX −3 dB. Medido: picos de cada canal a ±1,5 dB de su fader y el universo entero con
  picos ≈ −4 dBFS.)
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

- UN UNIVERSO: N nuevo universo (también W)
- DJ: W nuevo universo A · O nuevo universo B

## Cómo está hecho

Todo es síntesis en tiempo real con Web Audio, sin samples ni dependencias.

- `src/audio/engine.js` — reloj común (Worker + lookahead), BPM, tónica y modo globales, master (ganancia → glue + limitador → techo; medidor L/R y lo que quita el limitador).
- `src/ui/meters.js` — escala de los medidores y el máster (se lee una vez por fotograma; lo pintan la mesa DJ y el MIXER).
- `src/audio/deck.js` — un universo: sus canales, secuenciador y su ESPACIO (envíos, retornos y throws).
- `src/audio/spaceFx.js` — el delay (eco de cinta, ping-pong) y la reverb (sala sintetizada, dos convolvers que se relevan) de un universo.
- `src/music/space.js` — el ESPACIO de cada universo (de su semilla y su estilo): división, repeticiones, protagonista del eco, throws, sala y envíos.
- `src/audio/strip.js` — canal de mezcla: EQ 3 bandas (crossover Linkwitz-Riley, ISOLATOR o EQ; curvas de EASY EQ), filtro DJ, fader, medidor.
- `src/audio/lowRoles.js` — EASY EQ · GRAVES: reparte los papeles KICK y BAJO entre los dos universos (dueño según el giro, cambio en el tiempo, sidechain cruzado; con la EQ normal, cruzado cuando un bajo suena sin kick propio).
- `src/audio/dsp.js` — canal de instrumento (drive → HP → LP → fade → duck), saturación.
- `src/audio/voices.js` — kick, clap, bajo, acordes dub y pad (sintetizados al momento).
- `src/audio/drumsynth.js` — el taller: hats y percs en JavaScript puro (metal tipo 808, tono, FM, ruido y etapas comunes).
- `src/audio/soundBank.js` + `bankWorker.js` — el banco de sonidos: graba las recetas en un Worker y las guarda para los dos universos.
- `src/audio/drumSlots.js` — las ranuras de hats y percs de un universo: qué suena, sus colas y el tope de voces.
- `src/music/sounds.js` — las recetas de hats y percs con el color del universo.
- `src/music/emotion.js` — el color de cada universo → timbre, golpe, duraciones y swing; las escalas.
- `src/music/generators.js` — motivos estables con mutación lenta, percusión polimétrica, bajo y armonía en grados de escala.
- `src/music/arrangement.js` — las 8 escenas (presencia por instrumento), umbrales, viajes.
- `src/music/complexity.js` — la complejidad por grupos y el global: reglas por instrumento, presupuesto de protagonismo y los OSCILADORES (patrones, unidades, valor en cada paso).
- `src/music/kit.js` — CANTIDAD y VARIEDAD de hats y percs: las curvas de las perillas y los tipos de hat (FINO, OSCURO, TICK, MEDIO).
- `src/music/styles.js` — los ESTILOS (de momento ROMINIMAL) como datos: rangos, pesos, arquetipos, modos, timbre y mezcla; las tiradas con estilo (con NORMAL, las de siempre) y el color llevado a los rangos del género. Investigación: ROMINIMAL.md.
- `src/ui/` — sliders, knobs y la vista de universo (se instancia dos veces).
- `herramientas/` — scripts de Node para medir lo que genera el motor (densidad, repetición del loop, foley, groove) y comprobar que NORMAL sale idéntico tras un cambio. Cómo usarlos: herramientas/LEEME.md.
