# RENDIMIENTO — qué vigilar y qué hacer cuando toque

Criterio del proyecto: **se construye la música primero y se mide siempre**. Se optimiza
cuando salta una de las señales de abajo, o **antes** de construir algo que encarece el
cambio (samples, capas, MIDI). Este documento dice cuándo y cómo, para no tener que
redescubrirlo.

Objetivo final: sin cortes ni chasquidos, sin notas fuera de tiempo, que no pete en una
sesión larga, que funcione en ordenadores flojos y en móvil, y latencia baja cuando haya
gestos al instante (MIDI, CORTE en YA).

---

## 1. Cómo medir (ya montado)

### El medidor de la cabecera

Se ve en todos los perfiles (ordenador y móvil). Clic = poner a cero. En **OPCIONES →
RENDIMIENTO** se enciende o apaga cada medidor (CORTES, TARDE); apagados siguen midiendo, y
sin ninguno el medidor desaparece de la cabecera. Aún no se guarda: al recargar vuelven los dos.

| Muestra | Qué significa | Causa típica |
|---|---|---|
| **AUDIO OK** | nada raro desde el último cero | — |
| **CORTES n** | el audio se quedó sin datos n veces: se oye un hueco o un chasquido | el hilo de audio no da abasto: demasiados nodos o DSP pesado a la vez |
| **TARDE n** | n pasos de la rejilla se programaron cuando ya debían sonar: notas desplazadas | el hilo principal se atascó: interfaz, recolector de basura, pestaña en segundo plano, CPU saturada |

Cómo se detecta (en `src/audio/engine.js`):
- **CORTES** (`watchGlitches`): compara el reloj del audio con el reloj real
  (`getOutputTimestamp`). Si el audio se queda sin datos, su reloj se queda atrás para
  siempre; se mira el mínimo de cada ventana de ~0,5 s para no confundirlo con el temblor
  normal. Umbral: 20 ms.
- **TARDE** (`tick`): si al programar un paso su hora ya ha pasado.

Un **chasquido sin que suba ningún contador** no es de rendimiento: es una envolvente que
empieza o acaba de golpe, o un parámetro que salta sin rampa (ver §3).

### Perfiles por la dirección

- `?pc` / `?movil`: forzar el perfil (ver `src/core/profile.js`).
- `?estable`: búfer MÁXIMO (sin tocar lo guardado en OPCIONES).

### Búfer de audio (OPCIONES → RENDIMIENTO)

AUTO (por defecto) · BAJO · ESTABLE · MÁXIMO; se guarda en ese navegador. El navegador fija
el búfer al crear el contexto de audio, así que cambiarlo **rehace el audio** sin recargar
(`engine.rebuildAudio`): se cierra el contexto, se crea otro y cada universo vuelve a montar
sus canales (`deck.initAudio`); la música (escenas, viajes, mezcla, loop) sigue y vuelve al
empezar el siguiente compás. AUTO sube un escalón (~50 → ~100 → ~170 ms) con 3 CORTES en 60 s,
con 10 s de gracia tras cada cambio; nunca baja solo. El detector de CORTES ignora los 2 s
siguientes a arrancar o rehacer el audio (si no, el propio cambio contaba como corte).

Lo que pide cada modo (`latencyHint`) y lo que dio el PC de desarrollo (Chrome, Windows):
BAJO `'interactive'` ≈ 11 ms · ESTABLE `0.05` ≈ 53 ms · `0.1` ≈ 107 ms · MÁXIMO `0.2` ≈ 171 ms
(el tope: 0,3 y 0,5 dan lo mismo). Ojo: `'playback'` daba solo ≈ 21 ms en Windows, por eso
MÁXIMO se pide en número.

### Prueba de estrés (hacerla tras cada funcionalidad gorda)

1. Modo **DJ** (dos universos, el peor caso), los dos en **DROP** (antes TODO), COMPLEJIDAD GLOBAL a tope.
2. Poner el medidor a cero y dejarlo **5 minutos**. Hacer algunos viajes con FX.
3. Repetir en el **móvil** (con INICIAR (movil).bat) y, si se puede, en un **portátil viejo**.
4. Apuntar el resultado en la tabla de §5.

### Medir nodos por segundo y coste del reloj (consola del navegador)

Pegar **en la pantalla de entrada, antes de elegir modo** (cuenta los `create…` del
contexto de audio):

```js
const P = BaseAudioContext.prototype; window.__n = 0;
for (const k of Object.getOwnPropertyNames(P)) if (k.startsWith('create') && typeof P[k] === 'function') {
  const f = P[k]; P[k] = function (...a) { window.__n++; return f.apply(this, a); };
}
```

Elegir DJ, poner los dos universos en DROP y luego:

```js
const orig = MU.tick.bind(MU), times = [];
MU.tick = () => { const t = performance.now(); orig(); times.push(performance.now() - t); };
const n0 = __n; await new Promise((r) => setTimeout(r, 8000));
times.sort((a, b) => a - b);
({ nodosPorSeg: Math.round((__n - n0) / 8), tickMediana: times[times.length >> 1], tickP99: times[Math.floor(times.length * 0.99)],
   latBase: MU.ctx.baseLatency, latSalida: MU.ctx.outputLatency, margen: MU.lookahead })
```

Ojo: cada universo es aleatorio (densidades distintas). Para comparar dos versiones,
usar el mismo universo (misma semilla) o promediar varias tomas.

---

## 2. Cómo funciona hoy (dónde está el coste)

```
Worker (reloj 20 ms PC / 25 ms móvil)
  └─> engine.tick()            hilo principal
        ├─ deck.update()       ~50 Hz: estructura, transiciones, timbre
        └─ deck.scheduleStep() programa los pasos que caen en los próximos `lookahead` s
              ├─ voices.*      kick, clap, bajo, acordes, pad: cada golpe CREA nodos nuevos
              │                (osciladores, filtros, ganancias) que se tiran al acabar
              └─ drumSlots     hats y percs: cada golpe = BufferSource + ganancia (2 nodos)
                               con la grabación del banco
Banco de sonidos (soundBank.js) ── Worker (bankWorker.js + drumsynth.js): graba las recetas
Canal fijo por instrumento (Channel) -> suma del universo -> mesa DJ -> master
```

- **Coste principal**: nodos creados por segundo (cada golpe de kick, bajo, acorde…) y lo que
  suenan a la vez. Los canales, la mesa y el master son fijos. Hats y percs (los que más
  golpes dan) cuestan 2 nodos por golpe sea cual sea su motor.
- **CALIDAD** (`src/audio/quality.js`, OPCIONES → RENDIMIENTO): ALTA = todo al momento;
  NORMAL (PC) = el filtro del pad por bloques (`automationRate = 'k-rate'`; SOLO ese, ver §7);
  LIGERA (móvil) = además sin sobremuestreo, un oscilador por nota en acordes y pad, bajo sin
  cuadrada inaudible. Medido en §5 (con la versión de entonces: hats grabados solo en NORMAL y
  LIGERA; desde 2026-11-10 hats y percs salen del banco en las tres).
- **Banco de sonidos** (2026-11-10): la decisión de §4.1 ya tomada para hats y percs. Caché
  compartida por los dos universos, se graba fuera del golpe (en un Worker, y al pulsar NUEVO
  UNIVERSO, antes de que entre), presupuesto de memoria (48 MB PC / 16 MB móvil) y tope de
  voces por sonido (8). Medido en DJ con los dos universos: 0 golpes perdidos; ~3 grabaciones
  por segundo con todo quieto (la deriva lenta del color) y ~11 por segundo durante los 10 s
  tras un universo nuevo; cada una ~7 ms de media en el Worker (el hat abierto largo ~40 ms).
  Con los motores de la fase 2 (2026-11-10, DJ, VAR al máximo en los dos): quieto, 2,6
  grabaciones/s de ~7 ms; NUEVO UNIVERSO cada 4 s alternando (lo peor), ~32/s, mediana 6 ms,
  p90 34 ms, máximo 77 ms (plato de resonadores y FM abierto, los más caros), cola máxima 16.
  0 CORTES, 0 TARDE, 0 errores; 1 golpe perdido en ~46 universos nuevos (0 en los últimos 36,
  tras dar prioridad a lo urgente en el banco). Memoria: llega al presupuesto (45 de 48 MB) y
  se recorta sola. ⚠ Sin medir en móvil: grabar allí cuesta varias veces más y el presupuesto
  es 16 MB; si se pierden golpes, primero bajar las variantes o las capas en LIGERA.
- **Latencia de un gesto** = margen de programación + búfer + salida. Hoy en PC:
  120 ms + 11 ms + ~48 ms ≈ **180 ms** como mucho. No se nota porque casi todo se cuantiza
  a la negra, el compás o la frase. Importará con MIDI y con CORTE en YA.
- **La parte musical no toca el audio**: `src/music/` solo importa `src/core/rng.js` (nada
  de Web Audio, DOM ni `window`). **Mantenerlo así**: es lo que permite moverla a otro hilo
  (§4.3) sin reescribirla.

---

## 3. Señales y qué hacer (de lo barato a lo caro)

| Señal | Primero probar | Si no basta |
|---|---|---|
| **CORTES** en ordenador normal | Bajar CALIDAD (OPCIONES). Después: tope de voces por instrumento (robar la más vieja). Cortar antes las colas inaudibles (decays largos, pad). Quitar nodos que no suman (como ya hace el perfil móvil). | Reutilizar nodos fijos en vez de crear por golpe (como el banco de sonidos de hats y percs). Después, **AudioWorklet** (§4.3). |
| **CORTES** solo en ordenadores flojos | CALIDAD LIGERA y búfer (AUTO ya sube solo; MÁXIMO a mano). Idea pendiente: que AUTO proponga LIGERA si hay CORTES el primer minuto. | Bajar polifonía en LIGERA. |
| **TARDE** | MARGEN en AUTO (ya sube solo) o LARGO (OPCIONES). Revisar qué hace la interfaz por fotograma (escribir en el DOM solo si cambia; menos canvas). No crear objetos en el bucle de cada paso si se puede evitar. | Generar los compases (`prepareBar`) fuera del hilo principal: en un Worker o en el AudioWorklet (§4.3). |
| **Chasquido sin contadores** | Toda voz con ataque y release de al menos 2–5 ms; nunca saltos de parámetro sin rampa (`setTargetAtTime` / rampas, no `value =` mientras suena); al cortar un sonido, bajar ganancia antes de `stop()`. | Revisar el limitador y la saturación del master. |
| **Se cuelga o va a peor con el tiempo** (sesión larga) | Mirar memoria en el administrador de tareas del navegador (Shift+Esc en Chrome): si sube sin parar, algo no se suelta (nodos sin `stop()` ni `disconnect()`, listas que crecen como `events` o `history`). | Perfil de memoria de DevTools. |
| **Se nota la latencia** | MARGEN CORTO y búfer BAJO (OPCIONES) si el medidor lo permite: con CALIDAD NORMAL, el búfer BAJO ya no dio cortes en el PC de desarrollo. | AudioWorklet con el reloj dentro del audio (§4.3). |

---

## 4. Momentos planeados: qué decidir ANTES de construirlos

### 4.1 Samples, capas y "ADN"

Pueden multiplicar lo que suena a la vez: es el momento de diseñar el motor de voces, no
después.
**Hecho para hats y percs (2026-11-10): el banco de sonidos** (`soundBank.js`, ver §2). Los
samples del usuario y las capas entrarán por el mismo sitio: un sample decodificado es otra
entrada del banco, y una capa, otra ranura que suena a la vez. Lo de abajo sigue valiendo para
cuando lleguen.
- **Decodificar una vez** (`decodeAudioData`) y guardar los `AudioBuffer` en una caché
  compartida por los dos universos. Cada golpe = `BufferSource` + ganancia (2 nodos):
  barato, como el banco de sonidos de hats y percs (`soundBank.js`).
- **Precargar al cambiar de universo**, nunca en el tiempo del golpe.
- **Presupuesto de memoria**: el audio decodificado ocupa ~23 MB por minuto (48 kHz, estéreo,
  32 bits). En móvil, poner un tope y preferir samples cortos y mono.
- **Formato**: comprobar que Safari/iPhone lo decodifica (AAC/MP4 y WAV van en todos; Opus en
  Safari es irregular). Probarlo antes de elegir.
- **Tope de voces** desde el principio (robo de voz), no como parche.
- Si en ese momento ya hay CORTES, hacer antes el AudioWorklet (§4.3): un sampler en el
  worklet es más sencillo que mover uno ya hecho.

### 4.2 MIDI (controlador de pads)

- **Ya preparado**: el gesto de los pads está en el universo, no en la pantalla:
  `deck.down(escena)` al apoyar y `deck.up(escena)` al soltar (`src/audio/deck.js`). El
  temporizador de CORTE (`HOLD_MS`) va dentro. MIDI = llamar a `down` en note-on y a `up` en
  note-off. Pantalla, teclado y MIDI se comportan igual.
- Rejilla: 8 pads por universo en el orden de `GRID` (`src/music/arrangement.js`): fila de
  arriba sin kick, de abajo con kick. En DJ, 16 pads (A y B).
- **Web MIDI** funciona en Chrome y Edge; **no en Safari/iPhone**. Necesita contexto seguro
  (HTTPS o `localhost`): **por la wifi (`http://192.168.x.x`) no funcionará** sin HTTPS.
- Con MIDI, el CORTE en YA es el gesto más sensible a la latencia: medir y, si hace falta,
  bajar el margen (§3) o pasar al AudioWorklet.
- LEDs del controlador: el estado ya existe (escena elegida, destino que parpadea, cortes
  mantenidos, pendiente en LOOP); solo hay que enviarlo por MIDI.

### 4.3 Motor en el hilo de audio (AudioWorklet)

**Cuándo hacerlo** (cualquiera de estas):
- Sigue habiendo CORTES en las máquinas objetivo después de las soluciones baratas de §3.
- Hace falta latencia de gesto por debajo de ~20–30 ms (MIDI en directo, cortes al instante).
- Con samples y capas, los nodos por segundo pasan de ~1000 (hoy ~200 en DJ con los dos en
  TODO, ver §5).
- Aparecen tirones por el recolector de basura (TARDE a rachas sin motivo visible).

**Qué es**: código que corre dentro del hilo de audio. No depende de la pantalla ni del
hilo principal: si la interfaz se atasca, el audio sigue.

**Plan por fases** (cada fase se puede parar ahí si ya basta):
1. **Medir** con §1 y apuntar la línea base.
2. **Voces más frecuentes al worklet**: hats y percusión (los que más golpes dan). Un
   procesador "batería" que recibe por mensaje `{hora, instrumento, parámetros}` y lo
   sintetiza. El resto sigue igual. Gana mucho con poco riesgo.
3. **Secuenciador dentro del worklet**: el reloj pasa a ser el propio audio (exacto a la
   muestra, sin margen de programación). Los generadores de `src/music/` se ejecutan allí
   (por eso deben seguir sin tocar el audio, ver §2). El hilo principal solo envía el
   estado: escena, complejidad, viaje, loop. Es el cambio grande.
4. **Solo si hace falta**: DSP en WebAssembly (Rust/C++) dentro del worklet.

**Restricciones a tener en cuenta**:
- `audioWorklet.addModule` exige **contexto seguro**: `localhost` y HTTPS sí; el móvil por la
  wifi (`http://192.168.x.x`) **no**. Antes de dar el paso: servir HTTPS en local (certificado
  propio en `serve.mjs`) o usar la versión publicada con HTTPS.
- Comunicación por `MessagePort` (mensajes). Evitar `SharedArrayBuffer`: exige cabeceras
  COOP/COEP, que no se pueden poner si se publica en GitHub Pages.
- Dentro del worklet no hay DOM ni `fetch`; los samples se decodifican fuera y se pasan.
- Soporte: Chrome, Edge, Firefox y Safari (iOS ≥ 14.5).

---

## 5. Línea base (apuntar aquí cada prueba de estrés)

| Fecha | Versión / cambio | Máquina | Modo | Nodos/s | Reloj mediana / p99 | Latencia (margen + búfer + salida) | CORTES / TARDE en 5 min |
|---|---|---|---|---|---|---|---|
| 2026-11-08 | 8 escenas (e3d9a09) | PC de desarrollo, Chrome, `?pc` | DJ, los dos en TODO | ~200 | 0,1 ms / 2,2 ms (máx 2,6) | 120 + 11 + 48 ms | 0 / 0 (8 s, prueba corta) |
| 2026-11-08 | 8 escenas (e3d9a09) | PC de desarrollo, Chrome, `?movil` | DJ, los dos en TODO | ~180 | — | 150 + 53 + 88 ms | 0 / 0 (8 s, prueba corta) |

**Búfer en PC (2026-11-08)**, DJ con los dos universos en TODO, 30 s cada toma, en el PC de
desarrollo (navegador del panel de Claude):

| `latencyHint` | Búfer real | CORTES en 30 s |
|---|---|---|
| `'interactive'` (lo que había) | ~11 ms | 11–17 |
| `0.025` | ~32 ms | 1 |
| `0.05` (**el nuevo valor por defecto**) | ~53 ms | 0 (con COMPLEJIDAD a tope: ~1 cada 30–40 s) |

Con ~53 ms aún sale algún CORTE suelto, también con poca carga (BREAK) y a rachas: encaja
con picos del propio ordenador (otras aplicaciones), no con el programa. Si en otras máquinas
siguen saliendo con la carga normal, AUTO sube el búfer solo; si ni con MÁXIMO basta, es el
momento de §3 (bajar coste del DSP). La latencia de un gesto en PC pasa a ser ~120 + 53 + 88 ms ≈ 260 ms
como mucho: no se nota con las acciones cuantizadas, pero sí importará con MIDI (§4.2).

También: la compensación de volumen de las saturaciones (`setDrive`) ya va con rampa de
10 ms; antes saltaba en seco al cambiar de curva (al cambiar de universo), un posible
chasquido pequeño.

**Coste del motor medido con render offline (2026-11-08).** Método: un `OfflineAudioContext`
con los dos universos, programando las notas sobre la marcha con `suspend()`/`resume()` cada
~40 ms (como en directo; si se programan todas antes, el navegador arrastra miles de nodos
pendientes y la cifra sale inflada), y se cronometra el render. Coste = tiempo de render /
duración del audio (1 = el 100 % del tiempo disponible). Sin la mesa DJ ni el master (son
fijos y baratos: en silencio todo el motor gasta ~4 %).

Por instrumento (DJ, los dos en TODO, COMPLEJIDAD a tope, CALIDAD ALTA; total ~50 %):
hats cerrado + abierto **~18 %**, bajo ~6 %, pad ~6 %, percusión ~6 %, kick ~4 %, acordes ~4 %,
clap ~3 %. Filtros por bloques: −17 %. Sin sobremuestreo: −15 %. COMPLEJIDAD a 0,5: 28 %.

Por CALIDAD, con los mismos universos (semillas fijas; con universos al azar la cifra baila
mucho):

| CALIDAD | Coste | |
|---|---|---|
| ALTA (lo de antes) | ~42 % | |
| **NORMAL** (PC por defecto) | **~27 %** | −37 % |
| LIGERA (móvil por defecto) | ~19 % | −55 % |

Después (§7) los filtros por bloques quedaron solo en el pad, y la medida pasó a incluir la
mesa, el master y el techo: **ALTA ~46 %, NORMAL ~32 %, LIGERA ~25 %**. En directo con NORMAL
y búfer de ~53 ms, DJ en TODO a complejidad máxima: 0 CORTES y 0 TARDE en ~40 s.

En directo con NORMAL, DJ en TODO y COMPLEJIDAD a tope: **0 CORTES en ~40 s con búfer de
~53 ms y también con el BAJO (~11 ms)**, que antes daba 11–17 cada 30 s. Los cortes y
chasquidos eran sobre todo el motor sin margen, no el búfer.

(Resuelto: el README decía que el perfil móvil creaba "la mitad de nodos por segundo"; contar
nodos engaña, porque no todos cuestan lo mismo. La medida buena es el coste de render de arriba:
LIGERA gasta ~55 % menos que ALTA.)

---

## 6. Reglas desde ya (no cuestan nada)

- `src/music/` sin Web Audio, DOM ni `window` (§2).
- **Número de canales fijo** (`fixChannels` en `dsp.js`) en todo lo que alimente una saturación o
  un filtro: si cambia (estéreo ↔ mono), Chrome reinicia esos nodos y el WaveShaper con
  sobremuestreo tira el sonido que tiene dentro (§8).
- **Nunca** cambiar la curva de un WaveShaper con sonido pasando: para saturar, `Saturator`
  (`dsp.js`), que mueve la cantidad con ganancias con rampa.
- Nada debe llegar a la saturación por encima de lo que aguanta: `Saturator` aguanta hasta
  ±4,3 veces suave; un WaveShaper a pelo recorta en seco a partir de ±1.
- Cancelar una rampa en curso con `cancelAndHoldAtTime` (o calculando dónde iba), nunca con
  `cancelScheduledValues` a secas: el valor salta.
- Si algo se programa por adelantado (hasta el MARGEN), cancelarlo debe borrar también lo
  pendiente (`cancelScheduledValues(desde)`), no solo poner el valor "bueno".
- Filtros rápidos o resonantes, muestra a muestra (no `k-rate`): por bloques hacen cremallera.
- Toda voz se para ya en silencio (≥ 7 constantes de tiempo de su release).
- Cada voz nueva: ataque y release con rampa, `stop()` con hora de fin, nada que quede
  sonando o conectado para siempre.
- En la interfaz, escribir en el DOM solo cuando el valor cambia (el patrón que ya se usa).
- Cualquier mando nuevo de estructura entra por `deck.down` / `deck.up`, no por la vista.
- Tras cada funcionalidad gorda: prueba de estrés (§1) y una fila en §5.

---

## 7. Chasquidos (2026-11-08): qué eran y cómo se midieron

Con CALIDAD LIGERA y búfer MÁXIMO **seguía habiendo chasquidos**: no eran cortes (carga),
eran del propio sonido. Se buscaron con render offline (como §5) y "micrófonos" en cada punto
de la cadena (un `ChannelMerger` de 32 canales con una toma por punto).

**Detector de clics**: por instrumento, la salida del canal pasada por un paso alto de 10 kHz
(36 dB/oct); se mide la energía en ventanas de 1 ms y se marca un clic cuando una ventana
sube **más de 12 dB** sobre las dos anteriores, por encima de −60 dB del pico del
instrumento y **fuera de los 20 ms siguientes a un ataque de nota** (60 ms en el clap, que
son varios golpes). Las colas y las notas sostenidas no saltan así; un clic sí.

| Causa | Medido | Arreglo |
|---|---|---|
| **Recorte en seco en la saturación**: la curva solo cubría ±1 y lo que pasaba se cortaba | pad con picos de 1,3–1,5 (hasta 3 490 muestras recortadas en 12 s), kick 1,04 en casi cada golpe | `Saturator` (`dsp.js`): una curva tanh fija que cubre ±48 y el drive con dos ganancias (`pre = k/48`, `post = comp/tanh(k)`). Idéntico hasta ±1; por encima satura suave hasta ×4,3 |
| **Cambio de curva de golpe** al cambiar el carácter (NUEVO UNIVERSO, deriva) | 5 clics de −43 a −48 dB en kick, bajo y percusión en 12 s con cambios de universo | el mismo `Saturator`: la curva no cambia nunca; el drive se mueve con rampa de 50 ms → 0 clics |
| **Filtros por bloques (`k-rate`) en envolventes rápidas y resonantes** (bajo, acordes) | +8 dB de agudos espurios en el bajo, +4,5 dB en acordes; clics a −58 dB | bloques solo en el filtro del pad (LFO lento) |
| **Silencio antes del drop que no se quitaba**: cancelar la transición entre programar el silencio y que sonara dejaba "volver a 1" antes que "bajar a 0" | el universo se quedaba en 0 más de 6 s ("se rompe, silencio y sigue") | `TransitionFx.kill` borra lo pendiente (`cancelScheduledValues`) antes de restaurar |
| **Plato al revés cancelado a medias**: `cancelScheduledValues` borraba la rampa y el volumen saltaba | (por código) | `cancelAndHoldAtTime` (y cálculo de dónde iba la rampa en Firefox) |
| **Caída de ruido parada al 1 %** | (por código) | se para a ~9 constantes de tiempo |
| **Panorama por carril** (LIGERA) que saltaba y se desconectaba con golpes sonando | (por código) | rampa de 4 ms y desconexión 4 s después |
| **Salida sin techo**: el limitador no es de muro y la salida llegaba a 0,97–0,98 | sin margen: con EQ a +6 dB se recortaría en la tarjeta | `ceiling` (`dsp.js`) tras el limitador: transparente hasta ±0,95, nunca pasa de ±1 |

Resultado con el detector, NORMAL y ALTA, varios universos (estable, cambios de escena,
transiciones con FX, NUEVO UNIVERSO cada 4 s, después del sidechain): **0 clics**. En LIGERA,
los acordes (una sola sierra por nota, sin desafinar) dan picos periódicos de agudos dentro de
cada nota (−42 a −54 dB): es la textura de sierras en fase, no un salto de la señal (forma de
onda revisada: sin saltos ni recortes); desafinar no lo cambia.

---

## 8. El chasquido de verdad: huecos de 4 ms (2026-11-08)

Tras todo lo de §7 seguía habiendo chasquidos. La **grabación** del propio programa lo
destapó (el grabador captura dentro del motor, así que lo que se oye en el WAV no puede ser un
corte de la tarjeta): **huecos de exactamente 4,0 ms** en los que la salida caía a cero de
golpe, dos por compás, siempre en las mismas posiciones, justo antes de un golpe.

- Render offline con tomas en cada punto: el hueco nace **dentro del WaveShaper de la
  saturación del universo** (entrada sin hueco, salida con hueco). Pasaba igual con la curva
  antigua (estaba desde el principio). Sin sobremuestreo, 0 huecos; con 2x duran 2,7 ms y con
  4x 4,0 ms: lo que retiene dentro el sobremuestreo.
- Las muestras: en el inicio exacto de un bloque de 128 la salida se pone a 0 y vuelve a crecer
  desde 1e-13: el sobremuestreo se **reinicia**.
- Causa: la suma del universo tenía `channelCountMode = 'max'`. La percusión es la única voz
  estéreo (paneo por golpe); cuando acababa su último golpe, la suma pasaba de 2 a 1 canales y
  Chrome **reinicializa** el WaveShaper (y los filtros) de detrás al cambiar el número de
  canales.
- Arreglo: `fixChannels` — suma del universo y entrada de la mesa siempre en estéreo; la
  entrada de cada canal fija (percusión estéreo, el resto mono). Sin ningún cambio de sonido.
- Comprobado: render de la cadena completa, 4 universos en un universo y DJ (NORMAL y LIGERA):
  0 huecos (antes 3–7 cada 5 s). Grabación en directo de 22 s en DJ: 0 huecos (el WAV del
  usuario tenía 9 en 7,8 s) y todos los picos de agudos restantes caen en la rejilla de
  semicorcheas (ataques de nota).

Cómo buscar esto en un WAV: tramos de ≥ 1 ms por debajo de 0,003 con nivel > 0,1 justo antes
(huecos), y picos de la 3.ª diferencia (agudos) más de 1000 veces sobre la mediana local que
**no** caigan en la rejilla de semicorcheas.

---

## 9. Auditoría: ¿los arreglos cambiaron el sonido? (2026-11-08)

Método: la versión anterior a los arreglos (commit 97dbc9a) y la actual, renderizadas offline
con el mismo universo, el mismo azar (`Math.random` con semilla) y tomas en la salida de cada
instrumento y del universo. Una versión contra sí misma difiere < −80 dB (render determinista).

- **Generación**: `src/music/` sin cambios; las 112 notas de 8 s idénticas (instrumento,
  tiempo y velocidad).
- **Niveles**: iguales (±0,2 dB) en los 8 instrumentos.
- **Forma de onda** (ALTA, con la saturación redondeada como antes): bajo −72 dB, clap −97,
  hat −84, open −86, acordes −67, kick y percusión −83/−81 tras el primer segundo: idénticos.
  Diferencias reales solo donde el antiguo fallaba: pad −54 dB (antes recortaba en seco por
  encima de 1) y el universo, cuyo 91 % de diferencia está en los 15 huecos de 4 ms que tenía
  la versión vieja en 8 s.
- La saturación usa ahora el valor exacto que pide el universo en vez de redondearlo a pasos
  de 0,05: diferencia −33 a −45 dB, más fiel al diseño.
- **NORMAL vs ALTA**: mismas notas; nivel ±0,1 dB y brillo −10…+6 %, dentro de lo que ALTA varía
  contra sí misma con otro azar (±0,5 dB, hasta −16 %). Suena igual.
- **LIGERA** tenía los acordes 6,1 dB y el pad 2,4 dB más bajos (la mitad de osciladores sin
  compensar; venía del perfil móvil). Compensado: ahora −0,4…−0,7 dB y −0,1…0 dB. Su timbre
  sigue siendo más simple (por diseño).
- Arreglo menor: el primer valor de saturación tras crear o rehacer el audio entra al momento
  (antes subía con una rampa de 50 ms).

---

## 10. Sonido roto y luego silencio (2026-11-08): el NaN atrapado

**Síntoma** (prueba del usuario, modo DJ): unos segundos de sonido roto y, de golpe, silencio
total, con la pantalla funcionando.

**Lo que se descartó**: los medidores del máster (solo leen: analizadores tras el techo, no
tocan la señal) y la ganancia del máster (a 0 dB es idéntica a antes; a +12 dB satura más,
pero no silencia).

**El mecanismo, medido**: basta **una muestra NaN** (un valor no numérico) en cualquier canal
para que el máster se quede **mudo para siempre**. Los nodos con memoria que reciben sonido sin
parar (filtros de transición del universo, crossover de la mesa, glue, limitador, el
sobremuestreo de las saturaciones) guardan el NaN en su estado y ya no lo sueltan. Los canales
de instrumento se recuperan solos en un silencio entre notas (el navegador vacía los filtros sin
entrada), pero lo de detrás no. Un WaveShaper no frena un NaN (sí frena un Infinity). Con
sobremuestreo, además, se queda atascado. Y desde JavaScript no se puede vaciar un nodo: solo
rehacerlo.

**De dónde pudo venir el NaN**: sin reproducir. Una prueba de estrés de varios minutos con gestos
al azar (escenas, cortes, complejidad, NUEVO, loop, EQ, filtro, EASY EQ, ganancias, BPM, modo)
no lo provocó. Candidatos: un filtro que se vuelve inestable al moverse deprisa (sonaría «roto»
mientras crece hasta Infinity y luego NaN), o un error de programa a mitad de paso. Otros que
dan el mismo síntoma: el sistema suspende el audio (cambio de salida o Bluetooth) o se cuelga al
rehacer el audio (AUTO por cortes).

**La protección** (`watchAudio` en engine.js, en cada tic del reloj):
- **NaN en la salida**: se busca dónde está atrapado (sondas de un instante en cada canal, en la
  saturación, en la transición, en la mesa, en la suma, en el glue y en el limitador), se apunta
  y se **rehace el audio**. Comprobado inyectando un NaN en el bajo de A: vuelve a sonar en
  menos de 0,3 s.
- **Contexto suspendido** mientras suena: se reanuda; si en 3 s no vuelve, se rehace.
- **Reloj del audio parado** (con la pestaña visible): se rehace.
- **Errores de programa en el reloj**: cada universo va protegido. Un error se apunta y la
  rejilla sigue (antes una excepción podía dejar el paso sin avanzar).
- **Rehacer el audio**: cerrar el contexto viejo espera como mucho 1 s y, si montar el nuevo
  falla, se reintenta una vez.
- No se rehace en bucle: como mucho una vez cada 5 s.
- Los medidores tratan un NaN como silencio (antes se quedaban clavados en el último valor y
  parecía que todo sonaba).

**REGISTRO DE INCIDENCIAS** (OPCIONES → RENDIMIENTO → INCIDENCIAS; en consola, `MU.incidents`):
cada fallo con la hora, qué pasó, dónde se atascó y, al pasar el ratón, lo que sonaba (escenas,
búfer, calidad, ganancia del máster, cortes y tarde). También los errores del programa y las
subidas de búfer de AUTO. Se guardan las últimas 30 en el navegador. La cabecera avisa
**AUDIO RECUPERADO** unos segundos.

**Si vuelve a pasar**: mirar INCIDENCIAS. El primer punto de la lista «atascado en» dice por
dónde entró (p. ej., «A transición» = vino del universo A, antes de la mesa). Con eso se busca
la fuente y se corta en origen.
