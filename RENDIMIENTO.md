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

Se ve en todos los perfiles (ordenador y móvil). Clic = poner a cero.

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
- `?estable`: móvil con el búfer más grande posible.

### Prueba de estrés (hacerla tras cada funcionalidad gorda)

1. Modo **DJ** (dos universos, el peor caso), los dos en **TODO**, COMPLEJIDAD GLOBAL a tope.
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

Elegir DJ, poner los dos universos en TODO y luego:

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
              └─ voices.*      cada golpe CREA nodos nuevos (osciladores, filtros, ganancias)
                               que se tiran al acabar
Canal fijo por instrumento (Channel) -> suma del universo -> mesa DJ -> master
```

- **Coste principal**: nodos creados por segundo (cada golpe de kick, hat, perc, bajo,
  acorde…) y lo que suenan a la vez. Los canales, la mesa y el master son fijos.
- **Móvil**: hats como sample (2 nodos por golpe en vez de 9), acordes y pad con un
  oscilador por voz en vez de dos, bajo sin cuadrada inaudible, sin sobremuestreo, margen
  adaptativo, canvas a menor resolución.
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
| **CORTES** en ordenador normal | Tope de voces por instrumento (robar la más vieja). Cortar antes las colas inaudibles (decays largos, pad). Quitar nodos que no suman (como ya hace el perfil móvil). | Reutilizar nodos fijos en vez de crear por golpe (bancos de osciladores, como el `HatSampler`). Después, **AudioWorklet** (§4.3). |
| **CORTES** solo en ordenadores flojos | Opción **CALIDAD** en OPCIONES: AUTO / ALTA / LIGERA. LIGERA = los ajustes del perfil móvil sobre PC (ya existen en `PROFILE`, solo hay que poder elegirlos). AUTO: si hay CORTES el primer minuto, proponer LIGERA. | Bajar polifonía en LIGERA. |
| **TARDE** | Activar también en PC el margen adaptativo (`adaptLookahead`, hoy solo móvil). Revisar qué hace la interfaz por fotograma (escribir en el DOM solo si cambia; menos canvas). No crear objetos en el bucle de cada paso si se puede evitar. | Generar los compases (`prepareBar`) fuera del hilo principal: en un Worker o en el AudioWorklet (§4.3). |
| **Chasquido sin contadores** | Toda voz con ataque y release de al menos 2–5 ms; nunca saltos de parámetro sin rampa (`setTargetAtTime` / rampas, no `value =` mientras suena); al cortar un sonido, bajar ganancia antes de `stop()`. | Revisar el limitador y la saturación del master. |
| **Se cuelga o va a peor con el tiempo** (sesión larga) | Mirar memoria en el administrador de tareas del navegador (Shift+Esc en Chrome): si sube sin parar, algo no se suelta (nodos sin `stop()` ni `disconnect()`, listas que crecen como `events` o `history`). | Perfil de memoria de DevTools. |
| **Se nota la latencia** | Bajar el margen en PC (de 120 ms a 60–80 ms) cuando el medidor lo permita. | AudioWorklet con el reloj dentro del audio (§4.3). |

---

## 4. Momentos planeados: qué decidir ANTES de construirlos

### 4.1 Samples, capas y "ADN"

Pueden multiplicar lo que suena a la vez: es el momento de diseñar el motor de voces, no
después.
- **Decodificar una vez** (`decodeAudioData`) y guardar los `AudioBuffer` en una caché
  compartida por los dos universos. Cada golpe = `BufferSource` + ganancia (2 nodos):
  barato, como el `HatSampler` del móvil.
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

Pendiente: el README dice que el perfil móvil crea "unos la mitad de nodos por segundo".
Esta medida (universos distintos en cada toma) da solo ~10 % menos. Repetir con la misma
semilla antes de fiarse de cualquiera de las dos cifras.

---

## 6. Reglas desde ya (no cuestan nada)

- `src/music/` sin Web Audio, DOM ni `window` (§2).
- Cada voz nueva: ataque y release con rampa, `stop()` con hora de fin, nada que quede
  sonando o conectado para siempre.
- En la interfaz, escribir en el DOM solo cuando el valor cambia (el patrón que ya se usa).
- Cualquier mando nuevo de estructura entra por `deck.down` / `deck.up`, no por la vista.
- Tras cada funcionalidad gorda: prueba de estrés (§1) y una fila en §5.
