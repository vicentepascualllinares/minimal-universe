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
7. **Sonidos nuevos**: que no suene todo igual.
   **En marcha (2026-11-10), hats y percs**, en tres fases:
   - **Fase 1 (hecha)**: la base. Recetas (`sounds.js`), taller en JS puro (`drumsynth.js`),
     banco de sonidos en un Worker (`soundBank.js`) y ranuras con colas y tope de voces
     (`drumSlots.js`). Los sonidos de antes, idénticos (medido). Etapas comunes listas en neutro:
     palo, envolvente de filtro, puerta, saturación, bits/muestreo, capa floja, variación.
   - **Fase 2**: motores nuevos. Hats: METAL con otros juegos de proporciones, FM (2
     osciladores), RUIDO tipo 909/707 con resonancia, RESONADORES (plato "real") y GRANOS
     (shaker, cabasa). Percs: RESONADOR (rim, clave, conga, cowbell), MODAL (madera, barra,
     tubo), GLITCH (clics y ráfagas de 1–5 ms) y GRANOS. FINO, OSCURO, TICK y MEDIO sortean su
     motor. Al ser JS puro ya no hay límite de Web Audio: Karplus-Strong (madera aguda) se
     puede hacer en el taller.
   - **Fase 3**: tabla de estilos (rominimal, house, microhouse, experimental) con qué motores
     y qué rangos sortea cada uno, lista para la sesión 15 (universos según intención).
   - **Lo que dijo la investigación** (2026-11-10), para las fases 2 y 3:
     - Metal = muchas parciales inarmónicas: 6 cuadradas (808) o 2 osciladores en FM
       (Machinedrum, Noise Engineering) y un paso alto fuerte; las frecuencias exactas importan
       poco. Menos "sintético": golpe en dos capas (ping con paso banda + cola con paso alto,
       Synth Secrets), filtro que se cierra en la caída, velocidad → brillo y largo, azar por
       golpe, resonadores repartidos en escala exponencial (300 Hz–20 kHz, mcld).
     - Shaker: granos de ruido al azar con un resonador (PhISEM, Perry Cook / STK Shakers).
       Rim, clave, conga: impulso a un resonador estrecho (puente en T de la 808). Cowbell 808:
       2 ondas a 587 y 845 Hz con paso banda. Madera y metal afinados: modos 1 : 2,76 : 5,40 :
       8,93 (Elements, Plonk). Karplus-Strong con poca realimentación = tic de madera.
     - Rominimal / minimal: secos y cortos, transitorio muy rápido, hats a contratiempo sutiles,
       shakers ligeros, notas fantasma, swing 55–60 %, saturación leve. House: abierto 909/707
       a contratiempo cortado por el cerrado, semicorcheas flojas con acentos, rimshot 707,
       6 bits del 909. Microhouse: clics, estática y ráfagas cortísimas en vez de hats.
       Modular: modulación cruzada, ring mod, "lowpass gate" (filtro y volumen juntos).
     - Fuentes: Sound On Sound · Synth Secrets (metallic percussion, cymbals, cowbells &
       claves); Noise Engineering · Creating FM hats; mcld.co.uk/cymbalsynthesis; STK Shakers;
       syntherjack (808 rimshot/clave); Mutable Rings/Elements, Intellijel Plonk; Attack
       Magazine · Beat Dissected (minimal house, Spastik); TR-909 (Wikipedia).
   Lo demás sigue pendiente: hoy, por ejemplo, todos los kicks son el mismo kick. Más variedad
   por universo.
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
   dos versiones, siempre la 1 con menos elementos y la 2 con más, y dos botones: AHORA (la parte
   que suena) y LUEGO (el destino), ver README. Hoy solo cambia qué suena. Más adelante puede
   pesar en la mezcla, los arreglos y las transiciones (BUILD 1 → DROP 2 no es lo mismo que
   BUILD 2 → DROP 1), y en las partes que evolucionan solas (sesión 10). Pendiente también:
   probar si hace falta el fader continuo entre las dos versiones (se probó primero como botón),
   un atajo de teclado y el MIDI (toggleNow / toggleNext, como las partes).
12. **MUTACIÓN como mando propio** (apuntado 2026-11-10, para más adelante): hoy la mutación
   (cada cuánto el motivo de cada instrumento cambia un poco: hats, bajo, percs, clap, armonía)
   va atada a la COMPLEJIDAD de su grupo (`complexity.js`, `gen.mutation`). La idea es separarla
   y darle su propio valor, por grupo y quizá global, aunque luego se combine con la complejidad:
   - **Mutación alta**: un universo más experimental o pasivo, que se va transformando solo y
     se deja escuchar.
   - **Mutación baja**: un universo "decidido desde la generación", que se queda en lo que salió
     y repite con intención.
   Regla ya decidida: los OSCILADORES de complejidad no mueven la mutación. La mutación sigue el
   valor de partida del fader, no el que marca el oscilador en cada momento; si no, los motivos
   envejecerían más rápido en los tramos altos. Por decidir: qué cosas muta exactamente cada
   grupo, a qué ritmo, y si la mutación también puede oscilar o evolucionar con la parte
   (sesión 10).
13. **AUTO-PLAY: que el programa toque un TEMA** (apuntado 2026-11-10, tras un primer intento
   que se probó y se borró). La idea es que el programa toque solo un universo, con intención.
   - ⚠ **Enfoque de tema, no de sesión DJ.** El primer intento pensaba como un DJ: saltos de
     arriba abajo (CONTRASTES), NUEVO UNIVERSO como "cambio de disco", vuelta a empezar... El
     auto-play tiene que ser **un tema**: un solo universo con principio, desarrollo, clímax y
     final, que cuente algo y se acabe. Combinar universos es cosa del auto-DJ (sesión 14).
   - Seguramente va unida a las **partes que evolucionan solas** (sesión 10) y a las
     **transiciones según el viaje** (sesión 9): cuanto más sepa cada parte y cada viaje de
     música, menos tiene que "inventar" el auto-play.
   - Lo que sirvió del primer intento y conviene conservar:
     - **Tocar con "manos"**: eventos de puntero sintéticos sobre los botones y faders reales
       (cada dedo con su `pointerId`). La interfaz se ve moverse sola, pasa por el mismo camino
       que una persona (CLIC, CORTE, versiones, LOOP) y permite mantener varias partes a la vez
       mientras se mueve un fader. Si la persona toca algo, el auto-play se aparta unos compases.
     - **Cuándo pulsar** para que cada cosa caiga en su sitio (en pasos de semicorchea, 16 por
       compás, midiendo la posición en la rejilla del motor:
       `step − (nextGrid − (currentTime + lookahead)) / stepDur`). Para que pase en el paso N:
       viaje de *b* compases que llega en la frase X → pulsar en X − 16·b − 8; CLIC INSTANTÁNEO →
       N − 2; CORTE → bajar el dedo en N − 1 − 150 ms, soltarlo en el paso anterior al final;
       AHORA, faders, GLOBAL, NUEVO UNIVERSO y LOOP → N − 6.
     - Una **escala de energía** de las 16 partes (BREAK 1 la más baja, DROP 2 la más alta) y las
       reglas de oficio: cambios en límite de frase, un cambio cada vez, quitar pesa más que
       poner, tensión (BUILD, KICK-OUT) que pide que vuelva el kick, un arco grande con subidas
       y bajadas pequeñas dentro, y faders que se mueven alrededor del carácter con el que salió
       el universo, no hacia valores fijos.
   - Por decidir: cuánto dura un tema, si la forma la elige el auto-play o el usuario (o el
     universo al generarse), qué hace al terminar (parar, esperar, pasar la mano al auto-DJ) y
     si se puede tocar "a medias" (el auto-play lleva la estructura y la persona la complejidad,
     o al revés).
14. **AUTO-DJ: combinar universos** (apuntado 2026-11-10, después de la sesión 13). Dos niveles:
   - un **auto-play en cada universo** (sesión 13: cada uno toca su tema);
   - un **auto-DJ** por encima que los combina en el modo DJ: cuándo entra el otro universo, en
     qué parte de cada tema, la mezcla (EASY EQ, crossfader, relevo de kick y bajo) y el arco de
     la sesión entera (aquí sí tienen sentido los contrastes y el "cambio de disco").
   - Por decidir: cómo se hablan los dos niveles (el auto-DJ pide a cada auto-play "llega a un
     BREAK en 32 compases", "alarga el DROP"...) y qué hace la persona cuando toca encima.
15. **Generar universos según una INTENCIÓN** (apuntado 2026-11-10, tras CANTIDAD y VARIEDAD de
   hats y percs). Hoy NUEVO UNIVERSO sortea todo dentro de un mismo estilo (rominimal). La idea:
   pedir un universo **con una intención** (algo experimental, un rominimal, un house típico...)
   y que esa intención cambie *de qué* se sortea, no solo *cuánto*:
   - **Timbres**: no son los mismos hats ni la misma percusión en cada estilo (qué tipos de hat
     existen, metal o ruido, colas largas o secas; percusión tonal, FM o de ruido).
   - **Armonía**: cuánta disonancia, qué modos, voicings, cuánto se mueve la progresión.
   - **Ritmo de cada elemento**: rapidez de las notas, kicks (rectos, rotos), claps (estilos,
     dónde caen), dónde vive cada hat, longitudes de la polimetría.
   - Y los rangos de partida de COMPLEJIDAD, CANTIDAD y VARIEDAD.
   - Por decidir: si la intención es una lista cerrada de estilos, unos ejes continuos
     (experimental ↔ funcional, oscuro ↔ luminoso...) o las dos cosas; cómo se mezcla con el
     color (emoción) del universo; y cómo encaja con el ADN de los sonidos (sesión 3) y con
     "Sonidos nuevos" (sesión 7), que van muy de la mano.

## Auto-arreglos (OPCIONES → AUTO-ARREGLOS)

Trucos que en producción se hacen a mano y que el programa hace solo, en vivo. Cada uno con
su interruptor en OPCIONES. Se van añadiendo poco a poco.

- **Hueco antes del kick** (hecho, 2026-11-10; encendido por defecto): 30 ms de silencio del
  universo justo antes del primer golpe cuando el kick entra de golpe desde una escena sin kick.
  Pendiente: probar de oído si 30 ms es lo justo y si hace falta un mando para la duración.
  Cuando se haga la sesión 9 (transiciones según origen y destino), decidir si su largo depende
  del viaje (p. ej., más largo de BREAK a DROP).
- **Caída del kick al final de frase** (2026-11-10; encendido por defecto): antes era parte de
  la complejidad del KICK (al azar, más probable cuanto más compleja). Ahora, el último tiempo
  del último compás de cada 16. Pendiente: probar de oído si 16 es lo justo (o 8, o 32) y si
  conviene que la estructura lo pida (más antes de un viaje, nunca en un BREAK sin kick).
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
