# Herramientas de medición

Scripts de Node (sin dependencias) para medir lo que genera el motor sin abrir el navegador. Importan
`src` de la carpeta que se les pase, así sirven para comparar el código de ahora con el de un commit
anterior. Salieron de las sesiones de ROMINIMAL del 2026-11-11 (ver ROMINIMAL.md §6 y §10).

Se ejecutan desde esta carpeta (`herramientas/`, que lleva su `package.json` de módulos).

## NORMAL idéntico (`ident.mjs`)

Regla del proyecto: con el fader de ESTILO en NORMAL todo tiene que salir **exactamente** igual que
antes. Después de tocar generadores, complejidad, kit, transiciones, estilos o espacio:

```bash
git archive HEAD src | tar -x -C /ruta/temporal/head
```

```bash
echo '{"type":"module"}' > /ruta/temporal/head/package.json
```

```bash
node ident.mjs /ruta/temporal/head/src 300
```

```bash
node ident.mjs ../src 300
```

Los dos tienen que dar el mismo número de comprobaciones y el **mismo hash**. Compara, en 300 semillas:
los generadores (estado y 96 compases con mutaciones), complejidad, osciladores, CANT · VAR, paleta de
transiciones y espacio. Con `NOSPACE=1` deja fuera el espacio (cuando se cambia a propósito, como los
envíos del clap). Lo que vive en el audio (deck.js) no lo ve: ahí, todo lo nuevo va detrás de
`this.sty.t` (sin estilo, el camino de siempre).

## Huella de un motor (`huella.mjs`)

Corre el motor de verdad (el `audio/engine.js` de la carpeta que se le pase, con sus dos universos en
DJ) con un audio de mentira que apunta **todo** lo que se le pide: cada nodo, conexión, valor y rampa
(con su tiempo), cada golpe y cada búfer (con su contenido). El azar va sembrado y el reloj es
simulado, así que el mismo código da siempre el mismo hash. Toca los universos fijos de
`referencias/universos/` y unas semillas (NORMAL y ROMINIMAL), con cambios de parte, un NUEVO y un
PARECIDO por medio (96 s cada caso, ~1 min en total).

```bash
node huella.mjs ../src --comprobar referencias/huella-alpha.json
```

El motor ALPHA (el único desde 2026-11-12): tiene que decir «IDÉNTICO» después de cualquier cambio que
no deba tocar lo que ya suena (ver `src/motores/LEEME.md`). Otras opciones: `--guardar <archivo>`
(guardar una referencia), `SEG=20` (más corto), `ROOT=39` (otra tónica, MIDI 28–39; avisa de valores NaN), `SOLO=genesis` (un caso), `VER=1` (qué se apunta y
cuánto), `SINFX=1` (los viajes sin efectos de transición: solo música y sonido), `MEZCLA=<motor>`
(cuando haya más de uno: además, cambios de motor mientras suena; no es referencia, comprueba que no
falla nada). También sirve para reorganizar código que no debe cambiar el sonido: huella antes y después.

## Densidad y repetición (`measure.mjs`)

```bash
node measure.mjs ../src 1 groove:1 300
```

Argumentos: carpeta `src`, fader del estilo (0 = NORMAL, 1 = ROMINIMAL), parte y versión
(`groove:1` = GROOVE 2, `main:0` = MAIN 1…) y número de universos. Da golpes por compás de percusión,
foley y hats, carriles de percusión sonando, una «energía» aproximada (golpes × mezcla, no es
volumen percibido), mutaciones y **el % de compases iguales al de 4 antes** (si el loop se asienta).
Variables: `ONLY=perc` o `ONLY=foley` (repetición de uno solo), `LAG=8` (comparar con 8 antes),
`P1=1` (sin golpes al azar), `NOFX=1` (sin mutación).
Ojo: copia a mano la mutación de `Deck.prepareBar` (deck.js); si cambia allí, hay que cambiarla aquí.

## Foley (`foley.mjs`)

```bash
node foley.mjs ../src 1
```

Cuántos compases tienen foley, cuántos segundos suena por compás y cuánto dura cada gesto.

## Groove (`groove.mjs`)

```bash
node groove.mjs ../src
```

En 2000 universos ROMINIMAL: el swing de cada instrumento (%), el retraso de la semicorchea (ms), su
entero adelantado o atrasado y lo que se mueve su dibujo.

## Bajo (`bass.mjs`)

```bash
node bass.mjs ../src 1 400
```

Por modo del bajo (pluck, sub, redondo, ácido; con t = 0, «normal»): notas por compás, cuánto del
compás suena, % de notas ligadas, deslizamientos y notas largas por compás, alturas distintas, % de
compases de **respuesta** (distinto del anterior e igual al de 2 antes), % igual al de 4 antes y
cuántas octavas recorre el filtro lento en 64 compases. Debajo, por nivel de alturas de la complejidad
(root = baja, few = media, all = alta), el % de saltos entre notas seguidas que no son de octava y
los saltos más usados (en grados del modo: 7 = octava, 4 = quinta, 3 = cuarta…). Al final, «TODOS»: la
frecuencia de las notas (Hz, con el registro del estilo; 125 BPM, tónica E1–A1, eólico), su duración (ms),
el pico del filtro de cada nota (con el paso bajo fijo detrás) y cuántas pasan de 150 Hz, 600 ms y 1 kHz. Sirve también con un `src` anterior (el de
antes del bajo nuevo da 0 en lo que no existía) para comparar.

## Universo parecido (`similar.mjs`)

```bash
node similar.mjs ../src 150
```

Para varios pares (mantener SONIDO / MÚSICA): % de notas del bajo y golpes de percusión iguales al
original (32 compases), % de timbres de percusión y de sonidos de hat iguales y distancia de color.
100/100 tiene que salir **idéntico** en todos. `CURVA=1` recorre MÚSICA de 0 a 100 % (para calibrar).

## En el navegador

Lo que depende del audio (niveles, compresión, tiempos reales) se midió en la app con la consola
(`window.MU` es el motor): analizadores con filtro K en `deck.ch[k].out`, `deck.pbComp.reduction`, y
los tiempos de los golpes en `deck.events`. Cuidado: al quitar un medidor, desconectar solo ese nodo
(`node.disconnect(medidor)`); un `disconnect()` sin destino corta el sonido del canal.
