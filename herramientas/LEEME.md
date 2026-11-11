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

## En el navegador

Lo que depende del audio (niveles, compresión, tiempos reales) se midió en la app con la consola
(`window.MU` es el motor): analizadores con filtro K en `deck.ch[k].out`, `deck.pbComp.reduction`, y
los tiempos de los golpes en `deck.events`. Cuidado: al quitar un medidor, desconectar solo ese nodo
(`node.disconnect(medidor)`); un `disconnect()` sin destino corta el sonido del canal.
