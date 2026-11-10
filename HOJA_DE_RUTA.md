# HOJA DE RUTA

Sesiones de trabajo que quedan por delante, cada una centrada en un tema. No están en orden
cerrado, y ninguna se empieza hasta decidirlo. Antes de las que tocan samples, capas o ADN, hay
que releer [RENDIMIENTO.md](RENDIMIENTO.md) §4: hay decisiones que tomar primero (sampler,
tope de voces, AudioWorklet).

## Sesiones pendientes

1. **Texturas**: capas de fondo, ruido con vida y movimiento lento. Que el silencio entre
   golpes también suene a algo.
2. **Capas para crear cada sonido**: cada instrumento hecho de varias capas (cuerpo, golpe,
   aire...), en vez de una sola voz.
3. **ADN de los sonidos**: que cada sonido tenga una descripción propia que se pueda
   **guardar**, **mezclar** entre dos, **heredar** (hijos de un sonido) y recuperar. Va unida a
   las capas y a las cuentas, para guardar.
4. **Mezcla y máster**: un sonido profesional, cohesivo y con nivel. Cadenas de mezcla por
   canal, por universo y en el máster, seguramente con cadenas de **clippers y limitadores**.
   - ⚠ Al llegar aquí hay que **replantear el medidor del limitador** (LIM, en la mesa DJ y en el
     MASTER del MIXER). Hoy mide solo `limiter.reduction` del máster (un DynamicsCompressor);
     no ve el glue ni el techo (`ceiling` en dsp.js), y con varias etapas habrá que decidir
     qué se enseña: la suma, cada etapa o la del último limitador.
   - Hoy A, B y los canales no tienen limitador: solo medidor de nivel.
5. **Efectos creativos**: reverb, delay y compañía. Hoy todo es seco a propósito: se quitaron
   hasta esta sesión. Los risers y los platos de las transiciones son los que más lo piden.
   - **Transiciones, nivel 3** (pendiente; los niveles 1 y 2 ya están, 2026-11-08): gestos sobre
     la **música real** del universo. Grabar el último compás que sonó y manipularlo: reverse de
     verdad, stutter o beat repeat que acelera, tape stop, gate rítmico. Único cada vez. Necesita
     captura en el hilo de audio (AudioWorklet, como GRABAR): decidirlo antes con
     RENDIMIENTO.md §4.
6. **Samples (del usuario o de serie)**:
   - para crear **texturas** con efectos encima: choppeos, granular, efectos varios
   - como **samples** directos: loops, kicks, snares...
   - como **capas** dentro de los instrumentos
7. **Sonidos nuevos**: que no suene todo igual. Hoy, por ejemplo, todos los kicks son el mismo
   kick. Más variedad por universo.
8. **Síntesis modular procedimental**: un sistema interno de módulos (o algo en esa línea)
   para acercarse a una herramienta útil y experimental de verdad, que valore quien crea con
   módulos en hardware.
9. **Transiciones según el viaje (de dónde sale y a dónde va)**: apuntado 2026-11-08, sin
   empezar. Hoy la transición se elige con cinco casos gruesos (entra el kick, entra la música
   sobre el kick, se va el kick, se va la música, sin kick: ver README, "Transiciones"). Pero
   no es lo mismo cualquier viaje que cae en el mismo caso. Por ejemplo:
   (Desde 2026-11-10 las escenas son **partes de la estructura**: INTRO, GROOVE, MAIN, DROP,
   BREAK, DRIFT, BUILD y KICK-OUT. Eso ayuda aquí: el viaje ya tiene sentido musical,
   p. ej. BUILD → DROP es "la subida que llega", DROP → BREAK es "cae todo".)
   - **INTRO → KICK-OUT** (antes SOLO DRUMS → SIN KICK): se va el kick, pero a la vez entran
     el bajo y la música. Es un relevo completo, no solo un kick-out.
   - **BREAK → DROP** (antes BREAK → TODO): de casi nada a todo. El salto de energía más
     grande: el build más largo y el drop más fuerte.
   - **DROP → DRIFT** (antes TODO → SIN DRUMS): se va toda la batería y se quedan el bajo y la
     música. Es un breakdown, no un simple "se va el kick".
   - No es lo mismo BREAK → DROP que DROP → BREAK, ni GROOVE → DROP que DROP → GROOVE: la
     dirección cuenta tanto como las partes.
   - Lo que hay que plantear: mirar el viaje como **par origen → destino** (8 × 7 = 56) a
     partir de qué capas **K B T M** entran, salen o se quedan, y de **cuánta energía** sube o
     baja. De ahí sale qué gesto toca, con qué intensidad y en qué orden (p. ej., en ESCALONADA,
     qué sale primero si a la vez entran y salen cosas).
   - Por decidir: si basta con una tabla de "pesos" por capa o hace falta tratar a mano
     algunos viajes especiales (los de los ejemplos), y cómo se combina con la paleta del
     universo y con que cada transición sea distinta (que no se vuelva previsible).
10. **Partes que evolucionan solas** (apuntado 2026-11-10, abierto a propósito): hoy cada parte
   es una foto fija (qué suena y cuánto). La idea es que una parte pueda ser también un
   **proceso**, como una envolvente o un LFO lento en un modular: algo que cambia mientras estás
   en ella, sin tocar nada. Unas partes serían **estados** y otras **gestos**. Ejemplos, sin
   cerrar nada:
   - BUILD se va llenando sola (más densidad, más hats, filtros que abren) hasta pedir el drop.
   - DRIFT se va vaciando y soltando (menos rejilla, colas más largas).
   - GROOVE cambia un elemento cada 16 compases, como un directo con aparatos (meter uno, quitar
     dos, rotar percusiones).
   - DROP se mantiene, pero con variaciones pequeñas para no cansar (la "meseta" del techno).
   Por decidir: qué partes evolucionan y cómo, si se puede apagar, cuánto tarda, cómo encaja
   con la COMPLEJIDAD, con el LOOP y con las transiciones según el viaje (sesión 9), y si el
   intérprete puede elegir la velocidad o la dirección del proceso.
11. **VERSIÓN como variable de todo lo demás** (apuntado 2026-11-10): desde hoy cada parte tiene
   dos versiones (VER 1 · 2, ver README). Hoy solo cambia qué suena. Más adelante puede pesar en
   la mezcla, los arreglos y las transiciones (BUILD 1 → DROP 2 no es lo mismo que BUILD 2 →
   DROP 1), y en las partes que evolucionan solas (sesión 10). Pendiente también: probar si hace
   falta el fader continuo entre las dos versiones (se probó primero como botón), un atajo de
   teclado y el MIDI (versionDown / versionUp, como las partes).

## Auto-arreglos (OPCIONES → AUTO-ARREGLOS)

Trucos que en producción se hacen a mano y que el programa hace solo, en vivo. Cada uno con
su interruptor en OPCIONES. Se van añadiendo poco a poco.

- **Hueco antes del kick** (hecho, 2026-11-10; encendido por defecto): 30 ms de silencio del
  universo justo antes del primer golpe cuando el kick entra de golpe desde una escena sin kick.
  Pendiente: probar de oído si 30 ms es lo justo y si hace falta un mando para la duración.
  Cuando se haga la sesión 9 (transiciones según origen y destino), decidir si su largo depende
  del viaje (p. ej., más largo de BREAK a DROP).
- **Bajo fuera antes del drop**, **graves que bajan antes del drop** (−6 dB, último compás) y
  **menos volumen sin kick** (−1,5 dB) (hechos, 2026-11-10; encendidos por defecto). Los dos
  primeros solo en drops DE GOLPE, que son los que se saben por adelantado. Pendiente: probar de
  oído las cantidades y decidir si hacen falta en los viajes INSTANTÁNEOS (habría que retrasar
  la entrada para que diera tiempo) o en los ESCALONADOS (el kick entra el último).
- Ideas para después: cortar las colas (pad, acordes) antes del drop, el primer kick tras la
  entrada más fuerte, el último kick con cola en un kick-out, la última nota del bajo que cae al
  irse, acordes y pad sin graves cuando hay bajo (EQ por contexto), hats y ancho estéreo según
  la escena, remate de frase cada 8 o 16 compases, un compás de descanso de un instrumento de vez
  en cuando, igualar el nivel de A y B en DJ. Con la sesión de efectos: cortar la reverb antes
  del drop, reverb throw al final de frase, delay que repite el último golpe al salir.
- Todavía no se guardan: vendrán con las cuentas, como el resto de OPCIONES.

## Ya apuntado en otros sitios

- Rendimiento, AudioWorklet y lo que hay que decidir antes de samples y MIDI: [RENDIMIENTO.md](RENDIMIENTO.md).
- Cuentas, para guardar la mezcla, los ajustes y los sonidos; control MIDI; más instrumentos.
