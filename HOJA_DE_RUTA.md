# HOJA DE RUTA

Sesiones de trabajo que quedan por delante, cada una centrada en un tema. No están en orden
cerrado, y ninguna se empieza hasta decidirlo. Antes de las que tocan samples, capas o ADN, hay
que releer [RENDIMIENTO.md](RENDIMIENTO.md) §4: hay decisiones que tomar primero (sampler,
tope de voces, AudioWorklet).

**Lo siguiente acordado (2026-11-11):** el BAJO de ROMINIMAL ya está hecho (deslizamientos, notas
largas, filtro lento de muchos compases, frase de pregunta y respuesta y celdas de alturas) y la
perilla **PUREZA** (cuánto respeta su estilo un universo, para cualquier estilo) **y falta escucharlos**;
después, el resto del plan: movimiento lento (automatización), sonido, arreglo y mezcla. Orden, estado y detalle en
[ROMINIMAL.md](ROMINIMAL.md) §7 «Plan acordado al escucharlo»; herramientas para medir y comprobar
que NORMAL no cambia, en [herramientas/LEEME.md](herramientas/LEEME.md).

## Sesiones pendientes

1. **Texturas**: capas de fondo, ruido con vida y movimiento lento. Que el silencio entre
   golpes también suene a algo.
   - **ROMINIMAL lo pide** (ROMINIMAL.md §7, 2026-11-10): crujido de vinilo y pops («three-dimensional
     quality»), ruido de sala, field recordings (pájaros, lluvia, ciudad), drones, susurros. Cuando
     existan, entran en el perfil ROMINIMAL de `styles.js` (cuánto, en qué arquetipo: BOSQUE y
     ORGÁNICO los primeros).
2. **Capas para crear cada sonido**: cada instrumento hecho de varias capas (cuerpo, golpe,
   aire...), en vez de una sola voz.
3. **ADN de los sonidos**: que cada sonido tenga una descripción propia que se pueda
   **guardar**, **mezclar** entre dos, **heredar** (hijos de un sonido) y recuperar. Va unida a
   las capas y a las cuentas, para guardar.
4. **Mezcla y máster**: un sonido profesional, cohesivo y con nivel. Cadenas de mezcla por
   canal, por universo y en el máster, seguramente con cadenas de **clippers y limitadores**.
   - ROMINIMAL (ROMINIMAL.md §7): máster «de vinilo» (rango dinámico, sin limitar a tope), mono por
     debajo de ~200 Hz (hoy 120), sibilancia de hats controlada, kick con paso alto y realce hacia
     1 kHz. Quizá cadenas por estilo.
   - ⚠ Al llegar aquí hay que **replantear el medidor del limitador** (LIM, en la mesa DJ y en el
     MASTER del MIXER). Hoy mide solo `limiter.reduction` del máster (un DynamicsCompressor);
     no ve el glue ni el techo (`ceiling` en dsp.js), y con varias etapas habrá que decidir
     qué se enseña: la suma, cada etapa o la del último limitador.
   - Hoy A, B y los canales no tienen limitador: solo medidor de nivel.
   - **Ya hecho (2026-11-11, solo con ESTILO)**: BUS DE PERCUSIÓN por universo (hats, open, percs y
     foley; nunca clap ni kick) con compresión suave y SIDECHAIN del kick (deck.js, `setBus`). El
     compresor del navegador sube la salida solo (`compMakeup` en dsp.js la anula) y retrasa 6 ms
     (los golpes del bus se programan antes). Pendiente aquí: que NORMAL lo use también (cambia el
     sonido de siempre: decidirlo), sus envíos al ESPACIO salen 6 ms antes que su sonido seco
     (inaudible, pero apuntado), y calibrar los canales por VOLUMEN PERCIBIDO (K, LUFS) además de por
     pico: medido, la percusión con el mismo pico se oye más que el kick.
5. **Efectos creativos**: reverb, delay y compañía. Los risers y los platos de las transiciones
   son los que más lo piden.
   - **EMPEZADA (2026-11-10)**: **ESPACIO** de cada universo (README → "Espacio: delay y
     reverb"): un **delay** dub en la rejilla (división, ping-pong, realimentación que se oscurece,
     cinta, protagonista del eco, **throws** al final de frase) y una **reverb** de sala sintetizada
     por universo, con envíos por instrumento (kick y bajo secos) y desde las transiciones;
     retornos DELAY y REVERB en el MIXER. Primero en NORMAL y luego el perfil ROMINIMAL (`dly.*`,
     `rev.*` en styles.js, por arquetipo). **Falta escucharlo.**
   - Lo que queda de la lista de ROMINIMAL (abajo): filtros lentos y LFO al corte, grano (bits /
     muestreo en buses o máster), paneo con LFO aleatorio, realimentación, blur, stutter, cinta
     (tape stop), y en las transiciones de un universo rominimal, **reverb throw** y delay al final
     de frase **en vez de** risers (hoy los throws del delay van aparte de las transiciones).
   - Ideas que salieron al montarlo: que el espacio cambie con la PARTE (más sala en BREAK y DRIFT;
     sesión 10), cortar la cola de la sala antes del drop (auto-arreglo), throws de reverb, que la
     COMPLEJIDAD de INSTR. mueva cuánto eco hay, el retorno del delay con sidechain del kick.
   - **ROMINIMAL lo pide** (ROMINIMAL.md §7): el **delay como parte del ritmo** (ecos dub de corchea
     en stabs y percusión, ping-pong), reverbs **cortas y deliberadas** (salas, nada de colas
     lavadas), **filtros lentos** y LFO al corte, **grano** (reducción de bits o de muestreo en buses
     o en el máster para «pegar» fuentes), paneo con LFO aleatorio, realimentación, cinta. En las
     transiciones de un universo rominimal, tirar de reverb o delay al final de frase en vez de
     risers. Cada efecto, con su peso en el perfil del estilo.
   - **Transiciones, nivel 3** (pendiente; los niveles 1 y 2 ya están, 2026-11-08): gestos sobre
     la **música real** del universo. Grabar el último compás que sonó y manipularlo: reverse de
     verdad, stutter o beat repeat que acelera, tape stop, gate rítmico. Único cada vez. Necesita
     captura en el hilo de audio (AudioWorklet, como GRABAR): decidirlo antes con
     RENDIMIENTO.md §4.
6. **Samples (del usuario o de serie)**:
   - para crear **texturas** con efectos encima: choppeos, granular, efectos varios
   - como **samples** directos: loops, kicks, snares...
   - como **capas** dentro de los instrumentos
   - como **objetos de FOLEY**: el canal ya existe (2026-11-10) y pasa por el banco de sonidos;
     un objeto podrá ser una receta del taller o una grabación, sin cambiar nada más
   - **ROMINIMAL lo pide** (ROMINIMAL.md §7): **VOZ** (fragmentos hablados que asoman de fondo,
     susurros, voces distorsionadas, vocoder, procesado tipo cinta; nunca protagonista; una soprano o
     un coro en lo orgánico), **instrumentos acústicos** (piano, Rhodes, órgano, clarinete, cuerdas,
     contrabajo), metales balcánicos y discos rumanos de folk, jazz y librería troceados hasta no
     reconocerlos, y micro-sampling. Hará falta un canal de VOZ (o de samples) en el MIXER.
7. **Sonidos nuevos**: que no suene todo igual.
   **En marcha (2026-11-10), hats y percs**, en tres fases:
   - **Fase 1 (hecha)**: la base. Recetas (`sounds.js`), taller en JS puro (`drumsynth.js`),
     banco de sonidos en un Worker (`soundBank.js`) y ranuras con colas y tope de voces
     (`drumSlots.js`). Los sonidos de antes, idénticos (medido). Etapas comunes listas en neutro:
     palo, envolvente de filtro, puerta, saturación, bits/muestreo, capa floja, variación.
   - **Fase 2 (hecha, 2026-11-10)**: motores nuevos. Hats: METAL con otros juegos de
     proporciones, FM (2 osciladores), RUIDO tipo 909/707 con resonancia, RESONADORES (plato
     "real") y GRANOS (shaker, cabasa). Percs: RESONADOR (rim, clave, conga), COWBELL, MODAL
     (madera, barra, tubo), KARPLUS-STRONG, GLITCH (clics y ráfagas de 1–5 ms) y GRANOS. FINO,
     OSCURO, TICK y MEDIO sortean su motor; el hat del universo sigue en metal 808. Ver README
     → "Taller de percusión". Pendiente: **probarlo de oído** (hay un muestrario WAV de cada
     motor) y quitar del sorteo o retocar lo que no convenza; medir en móvil.
     Fuera a propósito (otra sesión): humanización, groove, swing, notas fantasma.
     Veredicto del usuario: le gustan, sobre todo los hats. Las percs se juzgarán en contexto:
     en estos géneros mucha "percusión" es foley, atmósferas o ritmos sacados con efectos.
   - **FOLEY (empezado 2026-11-10)**: canal propio en el MIXER, en la complejidad de PERCS, con
     sus perillas CANT · VAR, carriles largos y escasos, seco. Segunda versión el mismo día, a
     petición del usuario ("falta el toque que lo hace foley de verdad"): **gestos** que suben,
     se sueltan y vuelven a subir, más largos, y **objetos nuevos en cada universo** (material ×
     acción con números continuos), sacado de la investigación (README → "Taller de
     percusión"). Pendiente: probarlo de oído; más materiales y acciones (cremallera, cajón,
     vinilo, relés, romper, rodar...); que la actividad pueda seguir a la parte o al compás;
     samples por el mismo canal (sesión 6); los ritmos sacados con efectos (sesiones 5 y 6).
     Las **atmósferas** son otro elemento (camas continuas): van con las texturas (sesión 1).
   - **Fase 3**: tabla de estilos (rominimal, house, microhouse, experimental) con qué motores
     y qué rangos sortea cada uno, lista para la sesión 15 (universos según intención).
     **Empezada con ROMINIMAL (2026-11-10)**: `styles.js` ya dice qué motores de hat y qué tipos de
     percusión sortea el estilo (y cada arquetipo). Faltan los otros géneros.
   - **ROMINIMAL pide sonidos que no hay** (ROMINIMAL.md §7): el **kick** rominimal de verdad (seno
     con foldback, «woody, dusty», en capas; hoy todos los kicks son el mismo modelo y el estilo solo
     mueve sus números), **rim / snap** en vez de clap, **teclas reales** (Rhodes, piano, órgano: hoy
     los modos «teclas» y «órgano» son el mismo stab con otra envolvente), una voz de **bleeps /
     micro-melodía**, un **acid** de verdad (303: deslizamientos y acentos) y un sub de seno puro.
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
   - ROMINIMAL (ROMINIMAL.md §7) es exactamente esto: arquitectura «horizontal», un elemento entra
     o sale cada 8–16 compases, de uno en uno; GROOVE que rota percusiones; dos compases de
     silencio de algo como recurso; nada de drops. Un universo con estilo podría traer su forma
     de evolucionar.
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
   - Con ESTILO (2026-11-10) ya cambia **qué** muta (en ROMINIMAL, percs y foley giran y
     quitan/ponen golpes y casi nunca cambian de sonido; la armonía casi solo cambia de ritmo),
     pero no **cuánto**: eso sigue atado a la complejidad. El rominimal pide mutación lenta y
     constante.
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
   - Un tema ROMINIMAL (ROMINIMAL.md §9): 7–15 minutos, GROOVE como casa, sin drops, viajes
     PROGRESIVA · ESCALONADA largos, un elemento cada vez. El estilo del universo debería decirle
     al auto-play cómo tocarlo.
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
   - Y los rangos de partida de COMPLEJIDAD, CANTIDAD y VARIEDAD (también los de FOLEY, que
     tiene sus propias perillas: un rominimal quizá con más CANT y VAR de foley que de percs).
   - **Mutear elementos es parte de la intención** (apuntado 2026-11-10, a petición del
     usuario; de momento no se hace): cada estilo puede nacer con ciertos canales callados. Por
     ejemplo, un rominimal con las percusiones muteadas y foley en su lugar; un minimal más
     igualado entre percs y foley; un house quizá solo con percusiones.
   - Por decidir: si la intención es una lista cerrada de estilos, unos ejes continuos
     (experimental ↔ funcional, oscuro ↔ luminoso...) o las dos cosas; cómo se mezcla con el
     color (emoción) del universo; y cómo encaja con el ADN de los sonidos (sesión 3) y con
     "Sonidos nuevos" (sesión 7), que van muy de la mano.
   - **EMPEZADA (2026-11-10) con ROMINIMAL**: un fader por universo junto a NUEVO UNIVERSO, de
     NORMAL (idéntico a lo de siempre) a ROMINIMAL puro. El estilo es un perfil de datos
     (`src/music/styles.js`): rangos, pesos y probabilidades que sustituyen a los de siempre en las
     mismas tiradas, **arquetipos** (RODANTE, ESQUELETO, BOSQUE, DUB, ORGÁNICO, CLICS: las
     combinaciones del género), modos de bajo y de acordes, rangos de timbre y la **mezcla y los
     MUTE** con los que nace (lo apuntado arriba sobre mutear elementos ya se hace). Investigación,
     fuentes y todo lo que falta: **[ROMINIMAL.md](ROMINIMAL.md)**.
   - Lo que queda (ROMINIMAL.md §8): **más géneros** (house, microhouse, deep, experimental) como
     otros objetos del mismo tipo; **elegir el género** (selector junto al fader, o el fader entre
     dos estilos, o ejes); separar más cosas que hoy van juntas en la complejidad (acordes: notas ↔
     ritmo; percusión: redobles ↔ semicorcheas); presencia de cada instrumento por parte y por
     estilo; **voces por estilo** (sesión 7); groove por estilo; que el estilo *sugiera* BPM y
     modo (no los imponga: son de los dos universos); guardar el estilo con el universo (cuentas).

16. **GROOVE: swing, micro-timing y humanización** (apuntado antes de palabra, por escrito el
   2026-11-10). **Hecho para ROMINIMAL (2026-11-11)**: swing por instrumento y un dibujo fijo por
   paso (entero, empuje-tirón y huella) en `groove` de styles.js y `grooveTime` en deck.js (ver
   ROMINIMAL.md §6). Pendiente: NORMAL y los otros géneros, acentos de velocidad. Lo de antes: una sesión propia, separada del diseño de sonido. Hoy hay un swing por universo
   (tope 58 %), el clap atrasado y un empuje-tirón leve al azar. El ROMINIMAL (ROMINIMAL.md §3 y §7)
   pide más: el swing es «lo más reconocible» del género; **swing por instrumento** (hats unos ms
   antes o después, percusión con su propio swing), cuantización al 70–80 %, curvas tipo MPC por
   encima del 58 %, un empuje-tirón «de batería de jazz» (no funk programado). Cada estilo con su
   groove.
17. **FAMILIAS DE UNIVERSOS: tocarlas, fusionarlas, exportarlas** (apuntado 2026-11-11, al crear las
   CARPETAS de GUARDADOS). El uso que pide el usuario: partir de una semilla, iterar con PARECIDO y
   guardar las versiones que gustan juntas, en una carpeta. Lo que quiere después (solo comentado, sin
   decidir):
   - **Soltarlas una detrás de otra**: la carpeta como lista; un SIGUIENTE (a mano) o un relevo cada
     N compases, que entra como NUEVO UNIVERSO. Lo más directo: ya existe traer un universo en el 1
     del compás.
   - **Fusionarlas** (funciones que aún no existen): el PARECIDO ya mezcla DOS universos pieza a pieza
     (similar.js, sonido y música aparte); fusionar N de una carpeta sería generalizarlo (la música
     de uno con el sonido de otro, o pieza a pieza entre todos). Cada archivo guarda ya cada pieza por
     separado, y de qué universo salió (`similar.of`): se podrá enseñar el árbol de versiones.
   - **Exportar por STEMS** (lo quiere seguro): cada instrumento ya tiene su canal; grabar cada canal
     aparte, mejor en un render sin conexión (más rápido que el tiempo real y sin cortes). La carpeta
     sería la unidad de exportación («los stems de toda la familia»). Encaja con la sesión 4 (mezcla y
     máster) y con GRABAR.

## Arreglos pendientes

- **Móvil en vertical (375 px), UN UNIVERSO** (visto el 2026-11-10, ya pasaba antes del ESTILO): el
  universo se sale de la pantalla porque la tira de instrumentos (9 desde FOLEY, con las perillas
  CANT · VAR) mide ~400 px y la fila de la cabecera (BPM, tónica, modo, GENERAR, GRABAR, MIXER,
  OPCIONES, AUDIO OK) ~543 px, y no se parten en dos líneas. Por arreglar en la próxima sesión de
  interfaz.

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
- Ideas para después (con el ESPACIO ya montado, 2026-11-10, los throws de delay al final de frase
  ya existen como parte del universo): cortar las colas (pad, acordes) antes del drop, el primer kick tras la
  entrada más fuerte, el último kick con cola en un kick-out, la última nota del bajo que cae al
  irse, acordes y pad sin graves cuando hay bajo (EQ por contexto), hats y ancho estéreo según
  la escena, remate de frase cada 8 o 16 compases, un compás de descanso de un instrumento de vez
  en cuando, igualar el nivel de A y B en DJ. Con la sesión de efectos: cortar la reverb antes
  del drop, reverb throw al final de frase, delay que repite el último golpe al salir.
- Todavía no se guardan: vendrán con las cuentas, como el resto de OPCIONES.

## Ya apuntado en otros sitios

- Rendimiento, AudioWorklet y lo que hay que decidir antes de samples y MIDI: [RENDIMIENTO.md](RENDIMIENTO.md).
- Cuentas, para guardar la mezcla, los ajustes y los sonidos; control MIDI; más instrumentos.
