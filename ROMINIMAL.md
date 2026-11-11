# ROMINIMAL

El primer **estilo** de MINIMAL UNIVERSE: un fader por universo, junto a NUEVO UNIVERSO, que va de
**NORMAL** (lo de siempre, idéntico) a **ROMINIMAL** puro, con todos los valores intermedios. Solo
cuenta al generar: cada NUEVO UNIVERSO nace con el estilo que marca el fader en ese momento.

Este documento es la investigación que hay detrás (2026-11-10): qué hace que algo suene a
rominimal, elemento por elemento y en conjunto, cómo se ha llevado al motor, qué no se puede hacer
todavía (y dónde va) y qué conviene cambiar en el motor para hacer lo mismo con otros géneros. Los
números exactos están en `src/music/styles.js` (el perfil `ROMINIMAL`); las abreviaturas entre
corchetes son las de las [fuentes](#fuentes).

## Índice

1. [Qué es y de dónde viene](#1-qué-es-y-de-dónde-viene)
2. [Figuras: origen, ahora y escena underground](#2-figuras-origen-ahora-y-escena-underground)
3. [Rasgos por dimensión](#3-rasgos-por-dimensión)
4. [Cómo se relacionan las dimensiones](#4-cómo-se-relacionan-las-dimensiones)
5. [Los límites y las combinaciones: arquetipos](#5-los-límites-y-las-combinaciones-arquetipos)
6. [Cómo se ha llevado al motor](#6-cómo-se-ha-llevado-al-motor)
7. [Lo que no se puede todavía (y dónde va)](#7-lo-que-no-se-puede-todavía-y-dónde-va)
8. [Mejoras del motor para otros géneros](#8-mejoras-del-motor-para-otros-géneros)
9. [Cómo tocarlo](#9-cómo-tocarlo)
10. [Cómo se ha comprobado](#10-cómo-se-ha-comprobado)
11. [Fuentes](#fuentes)

---

## 1. Qué es y de dónde viene

**Rominimal** (ro-minimal, «el sonido rumano») es una rama del minimal house / techno nacida en
Bucarest a mediados de los 2000. Grooves largos e hipnóticos, muy pocos elementos («de ahí el
nombre» [G&A]) y **micro-variaciones** que se despliegan durante mucho tiempo [MD]: «subtle and
ethereal, laced with delicate intricacies over a minimalist baseline» [XLR8R].

- **Raíces**: el minimal techno de Detroit (Robert Hood, *Minimal Nation*, 1994: «only what is
  essential to make people move» [Wiki minimal]) y Berlín (Basic Channel, dub techno); el
  **microhouse** de finales de los 90 (Perlon, Kompakt, Playhouse; Villalobos, Akufen, Isolée:
  la casa reducida a «rhythm, soul and silence», Sherburne 2001 [Wiki micro]).
- **Ibiza**: Rhadoo y Petre Inspirescu pasaban los veranos en Ibiza (DC10, la tienda Vinyl Club):
  allí el minimal tenía «a low tempo and steady groove» y cada octubre volvían a Bucarest con discos
  [G&A, XLR8R deep].
- **Villalobos** es el catalizador internacional: sus sesiones se graban y luego se editan [RBMA],
  la percusión sudamericana de su infancia («la percusión y la voz bastan para una noche entera»
  [RBMA]) y la duración extrema (*Fizheuer Zieheuer*, 2006: 37 minutos sobre un sample de metales
  de una banda gitana serbia [Wiki FZ]). El b2b de Raresh con Villalobos en 2006 abrió el sonido
  al mundo [Beatportal].
- **Bucarest**: aislamiento tras el comunismo (sin tiendas de discos; P2P desde 2004), Sunrise
  (Catalin Ghinea, 1999), el sello **[a:rpia:r]** (Rhadoo, Petre Inspirescu, Raresh; 2006–2007),
  el festival **Sunwaves** (Mamaia, desde 2007, dos veces al año), clubes como Kristal, Eden,
  Guesthouse (~2010, «el crisol» [RMC]), Control. Fiestas de más de 48 horas: sets de 5–14 horas
  que piden música que se construye despacio [G&A, XLR8R]. Vinilo solo, tiradas de 300–500, sin
  promoción; distribución OurOwn (Cezar y Rhadoo, 2009–2017) [Mixmag Cezar, RMC].
- **Herencia culta**: Cezar enlaza el «minimalismo repetitivo» con la música rumana de vanguardia
  (Iancu Dumitrescu, Horațiu Rădulescu, Aurel Stroe…) y con instrumentos de orquesta, jazz y
  tradicionales [Mixmag Cezar]. Petre Inspirescu viene del piano clásico (Borodin, jazz) [fabric].

## 2. Figuras: origen, ahora y escena underground

- **Pioneros**: Rhadoo, Petre Inspirescu (Pedro), Raresh ([a:rpia:r] / RPR Soundsystem); Cezar,
  Kozo y Praslea (sello Understand); Barac [G&A, XLR8R deep, Mixmag Cezar].
- **Segunda ola**: Priku (Adrian Niculae; Motif, Atipic), Arapu (Liniar), Sublee, Vlad Caia y
  Cristi Cons (SIT, Amorf con Mischa Blanos; sello Amphia), Dan Andrei, Nu Zau, Sepp, Melodie,
  Dubtil, VincentIulian, Mihai Popoviciu, Cosmjn, Crihan, Mihigh, Livio & Roby, Lizz, Dragosh
  [EB, XLR8R deep, RMC].
- **Nueva generación**: Mihai Pol, Pirvu, NTFO, Floog [RMC]; Bianca Oance, Teodor Ghita, Dragan
  [Gray Area]; más anónimos, más abiertos a breaks y acid [Ransom Note, Beatportal].
- **Sellos**: [a:rpia:r], Amphia, Metereze (Raresh), Understand, Moment (Barac), Atipic, Motif,
  UVAR, Curtea Veche, Rawax (Alemania), Eastenderz, Kurbits, Be Chosen, LORI, Deruta (Cezar, 2025)
  [XLR8R deep, RMC, Mixmag Cezar].
- **Fuera de Rumanía** [Beatportal, Ibiza Spotlight, RMC]: Francia (Traumer, «un giro francés del
  rominimal»; Nicolas Lutz; RA+RE en París), Reino Unido (FUSE London: Enzo Siragusa, Seb Zito,
  Rossko, Archie Hamilton; Harry Wills, Toi Toi; fabric con Craig Richards), Berlín (Slow Life,
  Perlon, Club der Visionaere, Hoppetosse), Uruguay (Phonoteque, Montevideo), Kiev (Closer),
  Barcelona (TC80), Italia (Ivan Iacobucci, Domenico Rosa, Giammarco Orsini), Vietnam (Epizode),
  Tel Aviv (The Block, Yaron Trax, cerrado en 2022), Tokio (Super Dommune), Ibiza (Pyramid,
  Eastenderz, Do Not Sleep en Amnesia).

## 3. Rasgos por dimensión

| Dimensión | Qué dice la investigación |
|---|---|
| **Tempo** | 123–128 BPM; 124–127 lo más común; lo más hondo (Petre) más lento [MD, RMC, Loopmasters, XLR8R deep]. |
| **Ritmo (kick)** | 4/4 quieto: «static rhythmic construction you can dance to» [RBMA]. Kick **corto, seco, «low and dry — not punchy»**, «woody, sometimes dusty»; un seno con overdrive o foldback, poca compresión, sin subgrave por debajo de 40 Hz [RMC]; «tight kick» [MD]; más corto que en house y techno [ST]. Chasquido hacia 1 kHz y nada de sobre-limitar [GS]. **La 1ª mitad del compás pesa más**: «a swinging or skipping momentum» [EB 2017, Vid]; un golpe «en medio de dos compases de un loop de 4» [XLR8R deep]. Los breaks eran casi un tabú [Ransom Note]. |
| **Groove** | El **swing** es «the most recognisable quality» [RMC]: la percusión ligeramente fuera de la rejilla, hats unos milisegundos antes o después (Barac), cuantizar al 70–80 % [RMC]; «skippy drums» [RA fabric 72]; «a screwface-inducing degree of shuffle» [RA Semantics]; MPC 16 swing al 60 % en minimal [Attack]. Empuje-tirón «de batería de jazz», no funk programado [RMC]. |
| **Percusión** | La protagonista (el groove hace de melodía). «Clicky drums» [EB], «dubby, rolling percussion» [RA Melodie], «percussive beads… micro-tribal motion» [EB], «squelch and click» [EB], granular, «contaminated chemistry lab» [RA Semantics]; rims, claves, congas, toms, madera [fabric, RMC, Attack]; **polimetría** y longitudes distintas por elemento [Attack]. |
| **Hats** | Llevan casi toda la información rítmica; ciclan **4 o 5 sonidos** con pequeñas diferencias para que el oído nunca se asiente [RMC]; «crackle with vinyl grain» [RMC]; sutiles, a contratiempo, shakers ligeros [MD]. |
| **Clap** | Discreto o ausente: mandan rims y clics [RMC]; cuando hay, el clásico, sin protagonismo [RA Mihigh]. |
| **Foley / objetos** | «Found sounds» [RMC], «faint room ambiences, foley, whispered textures» [MD], pájaros enterrados en la mezcla (Petre, «Evar») [fabric], «a little rainforest» de crujidos, clics y gotas (Barac) [EB]. |
| **Bajo** | **Una o dos alturas** que evolucionan por articulación y filtro; elástico, subgrave, mono, con un sidechain suave «sin bombeo» [MD]; «rarely a sub-bass wall… presses rather than announces» [RMC]. Variantes: «plucky, randomly pitched» (Rhadoo), «bulbous, monotone sub-bass» (Mihigh), «zooming, retracting, snaking» (Vid), «rolling» (Arapu), acid 303 (Melodie, SIT), «dubby» ([a:rpia:r]) [RA Semantics, RA Mihigh, EB, Trommel Arapu, Reidht]. |
| **Armonía** | Escasa, «often bereft of melody» [G&A]: stabs cortos, Rhodes o pads apagados, fragmentos modales en tonalidades menores o neutras [MD]; «dubby» y «simmering atmospherics» [EB]; «subtle, emotive pads that eventually rise from the low end» [EB 2017]; órgano melancólico y piano frágil [RA Mihigh]; teclas con niebla [Reidht]. |
| **Melodía** | Micro-melodías hipnóticas [EB]; un bleep o un sample raro «liberally looped and manipulated» (Metereze) [RA Melodie]; «chirps, beeps» [Reidht]. Casi siempre sale de la percusión afinada. |
| **Disonancia** | Viene del **timbre** más que de la armonía: inarmónicos, clics, granos, bits, samples raros; armonía consonante/modal [Ibiza Spotlight, RA Semantics, RA Melodie]. |
| **Timbre y color** | Cálido, orgánico, humano [RMC]; seco y nítido arriba (transitorios rápidos), redondo abajo; «smoky, smooth and understated» [RA fabric 72]; «dark and trippy, floaty» [Caia]; algo de grano (reducción de bits o de muestreo para pegar fuentes distintas) [Caia]. |
| **Dinámica y mezcla** | Másters de vinilo: rango dinámico, sin limitar a tope; mono por debajo de 200 Hz; sibilancia de hats controlada [RMC]. Picos y valles «barely perceptible» [RA Mihigh]. La percusión delante; kick «sin dominar» [RMC]. |
| **Complejidad** | Baja en lo grande (pocos elementos) y alta en lo pequeño (detalle, micro-variación): «sound design goldsmithery» [Meoko]; «90 % de esto es elegir los sonidos justos» [mnml.nl]. |
| **Evolución** | «Horizontal, not vertical»: los elementos entran, se mueven y salen **de uno en uno** [RMC, MD]; nada de drops ni subidas largas; el silencio es una herramienta (quitar algo dos compases) [RMC]. |
| **Aleatoriedad** | Jams grabadas y editadas, con los «happy accidents» [RMC, RBMA, Caia]; loops que nunca se repiten igual. |
| **Estructura y duración** | 7–15 minutos por tema, intros y salidas largas para mezclar [G&A, XLR8R, MD, ST]; «an infinite groove for an infinite party» (Vlad Caia) [XLR8R]; sin breakdowns grandes, «it's not about moments or big drops» (Livio & Roby) [XLR8R]. |
| **Voz** | Fragmentos que asoman «como una conversación que se oye de fondo» [RMC], voces susurradas, habladas o distorsionadas [MD, RA Mihigh, Trommel Arapu], una soprano (Petre, «Anima») [fabric]. |

## 4. Cómo se relacionan las dimensiones

1. **Ritmo ↔ armonía: los papeles se invierten.** La percusión afinada lleva la melodía
   (micro-melodías en polimetría) y la armonía se queda quieta (un acorde). Por eso, en el motor:
   percusión con altura y protagonista, armonía con poca complejidad y casi siempre un solo acorde.
2. **Densidad ↔ timbre: lo pequeño se oye grande.** Con pocos elementos cada sonido queda expuesto:
   si todo es corto y seco, se oyen los clics, el foley, los granos. Decays cortos + foley arriba +
   graves limpios.
3. **Repetición ↔ variación: hipnosis con micro-cambios.** La estructura no se mueve; lo que se mueve
   es muy pequeño y constante (polimetría, golpes que a veces no salen, carriles que giran, densidad
   que respira poco). Osciladores encendidos pero de recorrido corto y lento; mutación que gira y
   quita/pone golpes en vez de cambiar sonidos.
4. **Swing ↔ kick y bajo: empuje y tirón.** El kick queda cuadrado (con la 1ª mitad más fuerte y algún
   golpe que «salta»), el swing vive en hats y percusión, y el bajo se mete en los huecos del kick
   (semicorcheas, contratiempos): de ahí el «skipping momentum».
5. **Graves ↔ espacio.** Kick corto + bajo sub mono + sidechain suave = un suelo claro que deja
   el medio y el agudo a la percusión. Sin «muro de subgrave».
6. **Dinámica ↔ estructura.** Sin drops: la dinámica es micro (acentos, un elemento que entra) y no
   macro (risers, explosiones). Transiciones sobrias, FX bajos, la mezcla y los MUTE como arreglo.
7. **Disonancia ↔ textura.** La armonía es consonante y modal; la tensión la ponen los timbres
   (metal inarmónico, FM, clics, bits) y los samples raros.
8. **Duración ↔ complejidad.** Temas de 10 minutos y sets de 8 horas solo funcionan con poca
   complejidad grande y evolución lenta: complejidad media-baja, cambios a lo largo de frases.
9. **Aleatoriedad ↔ intención.** Procesos que nunca repiten (probabilidad, polimetría, jams) dentro de
   un marco muy estricto (4/4, tempo, tonalidad): azar en lo pequeño, rigor en lo grande.
10. **Color ↔ origen.** Lo orgánico (madera, piano, voz, objetos) convive con lo micro-digital (clics,
    bits): percusión de madera y clic, foley de objetos, grano en los hats.

## 5. Los límites y las combinaciones: arquetipos

No hay una regla que se cumpla al 100 %: hay rominimal con más percs que hats, otros con solo foley
y un poco de hats, otros sin acordes o sin pad. El género está en cómo se combinan los límites. Cada
universo ROMINIMAL sortea uno de estos **arquetipos** (probabilidad entre paréntesis) y, dentro de él,
sus MUTE, su mezcla, su CANT · VAR y su complejidad:

| Arquetipo | Qué es | MUTE probables (con el fader a tope) | Lo que sube |
|---|---|---|---|
| **RODANTE** (28 %) | el «roller» clásico: la percusión rueda y manda ([a:rpia:r], Raresh, Arapu) | clap 35 %, open 45 %, acordes 50 %, pad 50 % | percs: VAR 3–4, CANT media, +1 dB; rim, conga, tono y madera |
| **ESQUELETO** (20 %) | kick, bajo, hats y una o dos percusiones (Dan Andrei, «stripped-back») | clap 55 %, open 60 %, acordes 80 %, pad 75 %, foley 40 % | hats; bajo sub |
| **BOSQUE** (14 %) | foley y un poco de hats: crujidos, golpecitos, gotas (Barac) | **percs 70 %**, clap 70 %, open 70 %, acordes 50 %, pad 35 % | foley: VAR 3–4, CANT media-alta, +3 dB; madera, agua, arena |
| **DUB** (13 %) | acordes dub y bajo redondo, más hondo (Sublee, Priku) | clap 35 %, open 50 %, pad 40 %, foley 30 % | acordes +2,5 dB (stab dub); bajo sub o redondo |
| **ORGÁNICO** (13 %) | pad que sube despacio, acordes como teclas u órgano, madera y objetos (Petre Inspirescu, Amorf) | clap 50 %, open 50 %, acordes 40 % | pad +2,5 dB; foley; percusión modal y Karplus |
| **CLICS** (14 %) | clics, granos y chasquidos sobre un bajo seco (Villalobos, Perlon, Rhadoo) | clap 45 %, open 50 %, acordes 65 %, pad 75 % | glitch, granos, hats de ruido con bits; bajo pluck o ácido |

Además, cada universo sortea el **modo del bajo** (pluck 31 %, redondo 32 %, sub 27 %, ácido 11 %)
y el **de los acordes** (stab dub 57 %, teclas 25 %, órgano 18 %). El kick y el bajo nunca nacen en
MUTE, y siempre queda percusión o foley.

## 6. Cómo se ha llevado al motor

Todo en `src/music/styles.js` (el perfil, como datos) y en las tiradas que ya existían. **Con el
fader en NORMAL las tiradas son exactamente las de siempre** (comprobado, ver §10). En medio, cada
rango, peso y probabilidad se interpola; los MUTE salen con su probabilidad × el fader (con más
fader, los mismos y alguno más).

### Por elemento

| Elemento | Qué cambia con ROMINIMAL |
|---|---|
| **KICK** | Timbre: punch 2,4–4,2 (menos caída de altura), decay 0,15–0,27 s, chasquido 1,1–2,8 kHz, saturación 0,25–0,5, sidechain al bajo 0,18–0,32. Ritmo: los cuatro tiempos con peso 1 · 0,97 · 0,88 · 0,92; fantasmas sobre todo en el paso 7; el **salto** (un golpe flojo en los pasos 3, 6 o 7, 10–35 % de compases según el universo) y el golpe al final del 2º compás de cada 4. Complejidad 0,05–0,45. |
| **BASS** | Pesa más en contratiempos y semicorcheas, menos en los tiempos (deja sitio al kick). Alturas: tónica y octava, algo de 5ª grave y 2ª menor. Con la complejidad, **solo tónica hasta 0,42 y pocas notas hasta 0,8** (antes 0,3 y 0,55): rueda en semicorcheas con una o dos alturas. Cuatro modos de timbre (pluck, sub, redondo, ácido). Complejidad 0,3–0,7. |
| **HAT** | VAR alta (los 4–5 tipos ciclando), CANT media-alta. Motores: FINO shaker de granos 61 %, ruido con 6 u 8 bits más probable (el «grano de vinilo»), menos plato. Timbre corto (decay 16–42 ms), brillante y con acentos más marcados. Mezcla −14 dB. |
| **OPEN** | Más corto (0,12–0,28 s); en MUTE la mitad de las veces; −17 dB. |
| **CLAP** | Más «solo en el 4» y «atrasado», menos «2 y 4»; corto (70–160 ms), algo más agudo; en MUTE casi la mitad de las veces; −14,5 dB. |
| **PERC** | Tipos: rim/clave/conga, madera modal y Karplus-Strong, clics y granos; casi nada de cowbell. La principal, de madera o rim. **Loops que se repiten** (2026-11-11, ver §6 «Repetición»): carriles de compás y **frases de dos compases** (la principal, el 60 %: el gancho), alguna polimetría (12, 6, 3) que **cierra** cada 2 o 4 compases; los golpes fuertes salen siempre y solo los fantasmas a veces no. **Jerarquía**: la principal delante y las demás de −4 a −8 dB detrás (RODANTE y CLICS, −3 a −6). Golpes cortos y abiertos en el panorama, con más diferencia entre ellos. Alturas con 2ª, 4ª y 6ª (micro-melodías modales). Al mutar, gira y quita/pone golpes; casi nunca cambia de sonido. Pocos golpes: VAR 2–4, CANT baja. −11 dB, por el bus de percusión (ver «Mezcla de la percusión»). |
| **FOLEY** | **Ear candy, no ritmo** (2026-11-11): ya no es un carril del loop; un objeto **aparece** de vez en cuando (≈15 % de los compases, más al final de frase, en un sitio débil del compás, a veces con una respuesta) y no vuelve en el mismo sitio. Gestos más cortos, dentro de la sala y del eco (envíos más altos), −17 dB. Primero madera, arena, agua y papel (según arquetipo). En BOSQUE aparece casi un compás de cada dos (+3 dB); en ORGÁNICO, algo más. |
| **CHORD** | Casi siempre **un solo acorde** (73 %), voicing abierto dub (5ª, 7ª, 9ª sin 3ª) o hueco; 2–3 notas; stabs cortos y oscuros (modo dub) o teclas u órgano. Muta poco. En MUTE la mitad de las veces. −15 dB (órgano −2,5 y teclas −1 más: suenan más llenos, medido). |
| **PAD** | Oscuro (corte 320–1200 Hz), ataque lento (1,2–3 s, «sube desde abajo»), más aire; respira cada 4–8 compases. En MUTE la mitad de las veces. −17 dB. |

### Por parte del programa

| Parte | Qué hace el estilo |
|---|---|
| **Color (timbre)** | El color del universo (valencia −0,6…0,45, activación −0,55…0,3: de oscuro a algo cálido, de quieto a medio) y, encima, cada parámetro llevado a su rango del género **conservando dónde caía el universo** (uno oscuro sigue siendo el oscuro). Viaja con la misma inercia que el color (~2 s). |
| **Groove** | Swing 55–58 % (arriba, sin pasar del tope de siempre), clap atrasado 8–18 ms, empuje-tirón 2–4,5 ms. |
| **Complejidad** | KICK 0,05–0,45 · PERCS 0,45–0,85 · BASS 0,3–0,7 · INSTR. 0,1–0,45 (cada arquetipo los mueve). El GLOBAL no se toca. |
| **Osciladores** | Más encendidos (percs 76 %) pero de recorrido corto (B a 0,08–0,25 del fader) y lentos: RESPIRA, OLA y CRECE por delante; variantes de 2 compases o de compás. |
| **CANT · VAR** | Las del arquetipo (ver §5), más bajas desde 2026-11-11 en percs y foley. |
| **Mutación** | Percs y foley: girar y quitar/poner golpes; casi nunca otro sonido. Armonía: casi solo ritmo. Desde 2026-11-11, **solo al empezar frase** (cada 8 compases, no cada 4) y menos (×0,7 percs, ×0,5 foley, ×0,6 hats); la fuerte de cada 32 compases, la mitad de las veces. |
| **Mezcla de la percusión** (2026-11-11) | Al escucharlo: percs y foley con demasiado protagonismo; no bastaba con bajar faders. Como en un estudio [Attack bus, MusicRadar mix]: **BUS** de hats, open, percs y foley (el **clap y el kick fuera**: el clap cae con el kick y con el sidechain desaparecería) con **compresión suave** (−26 dB, 3:1, rodilla 8, ataque 3 ms, salida 120 ms: pega y doma los golpes puntiagudos; sin la subida automática del compresor del navegador, que daba +8,9 dB) y **SIDECHAIN del kick** (percs y foley ≈ −3…−5 dB con cada kick, hats algo menos): el kick asoma y la percusión se sienta entre golpe y golpe. El compresor retrasa 6 ms: los golpes del bus se programan antes y llegan a tiempo. Medido en la app (GROOVE 2, 4 universos): el grupo queda 18–25 dB por debajo del kick en media (filtro K) y 11–15 dB en pico; un NORMAL, 12 y 4. Compresión media 1,6–3,6 dB, picos 5–7,6. |
| **Repetición** (2026-11-11) | Al escucharlo, frente a temas reales: **exceso de percusión y foley** y nada se asentaba. Medido (300 universos, GROOVE 2): 13 golpes de percusión por compás (3–4 carriles), 16 de hats, y **el 0,1 % de los compases igual al de 4 antes** (carriles 7, 5, 3 girando sin fin, un 3–32 % de golpes que no salían al azar, mutación cada ~10 compases). El disco real repite el loop 16–64 compases y lo que se mueve es pequeño. Ahora: la **polimetría cierra** (los carriles vuelven a empezar cada 2 o 4 compases, como el «master length» de una caja de ritmos: lo sortea cada universo), **frases de dos compases** (pregunta y respuesta), golpes fuertes siempre, menos mutación, menos CANT · VAR y COMPLEJIDAD de PERCS (0,35–0,7). Resultado: 9,8 golpes de percusión y 13 de hats por compás, **69 % de compases iguales al de 4 antes** (lo demás: fantasmas, redobles de final de frase, alguna mutación), energía de la percusión −3,3 dB y del foley −5,2 dB (con la mezcla nueva). |
| **MIXER** | Nace con su mezcla (faders de sus instrumentos y de FX) y sus MUTE, en el 1 del compás en que entra. La mezcla de antes se guarda: un universo **NORMAL** después la recupera (no hereda los MUTE). Elegir un preset del MIXER la olvida (la mezcla vuelve a ser tuya). |
| **Espacio** (2026-11-10) | Delay **parte del ritmo** [MusicRadar, Attack]: corchea o corchea con puntillo (a veces negra con puntillo), ping-pong 70 %, realimentación 0,35–0,6 que se oscurece (paso bajo 1,1–3,2 kHz) y adelgaza (paso alto 300–750 Hz), cinta (saturación y vaivén: «a bit of movement» [Caia]); protagonista del eco: los stabs o la percusión; hats casi secos; **el clap casi seco** (2026-11-11, al escucharlo: nunca protagonista del eco, envío al delay 0–0,03 y a la sala 0,03–0,1; antes 0–0,12 y 0,14–0,3, lo más mojado de la batería); **throws** al final de frase más probables (30–65 %): mejor un eco que un riser. Reverb **corta y deliberada** [RMC, MD]: salas de 0,3–0,9 s, cálidas (agudos que se apagan a 2,2–5,5 kHz), con reflexiones tempranas (carácter de habitación); percusión y foley «en la misma habitación» («faint room ambiences, foley» [MD]); transiciones poco. Por arquetipo: DUB (el eco manda: más repetición, más oscuro, más throws), ESQUELETO (casi seco), BOSQUE (el foley en su sala), ORGÁNICO (sala algo mayor con pad y teclas), CLICS (ecos cortos de clics, sala mínima), RODANTE (eco en la percusión). |
| **Transiciones** | Paleta sobria: intensidad 0,25–0,55, riser de ruido más que de tono, silencio antes del drop 12 % (antes 46 %), platos más cortos, filtros de tensión más suaves; redobles de rim y «fantasma» más que «acelera»; FX −11 dB. |
| **Estructura** | No se toca: es del intérprete (ver §9). |
| **Globales** | BPM, tónica y modo no se tocan (son de los dos universos). |

## 7. Lo que no se puede todavía (y dónde va)

Para que no se pierda. Cada punto dice qué pide el género y en qué sesión de la
[HOJA_DE_RUTA](HOJA_DE_RUTA.md) entra.

- **Efectos creativos (sesión 5)**:
  - ~~**Delay como ritmo**~~ y ~~**reverb corta y deliberada**~~: **hechos (2026-11-10)**, ver §6
    («Espacio»). Falta escucharlos.
  - **Filtros lentos y LFO al corte**: «slow filter modulation» [MD]; un LFO rápido al corte y
    distorsión foldback como ingredientes (un productor en un foro [GS]); el bajo que evoluciona
    «por articulación y filtro» [MD].
  - **Grano**: reducción de muestreo o de bits en buses o en el máster para «pegar» fuentes
    distintas [Caia]; saturación de mesa en la batería [Loopmasters].
  - **Paneo con LFO aleatorio** y movimiento sutil en todo («a bit of movement here and there» [Caia]).
  - Realimentación, blur, stutter, cinta (wow, tape stop); y en las transiciones de rominimal: tirar
    de reverb/delay al final de frase en vez de risers.
- **Texturas y ambiente (sesión 1)**: crujido de vinilo y pops («three-dimensional quality»
  [EB 2017]), ruido de sala, field recordings (pájaros, lluvia, ciudad), drones («drone-like»
  [Caia]), susurros. Hoy el aire del pad es lo único parecido.
- **Voz y efectos de voz (sesiones 5 y 6)**: fragmentos hablados que asoman de fondo [RMC], voces
  susurradas, vocoder, voces distorsionadas [Trommel Arapu], procesado tipo cinta (Make Noise
  Phonogene [RMC]), una soprano o un coro (Petre) [fabric]. Nunca protagonista.
- **Samples e instrumentos acústicos (sesión 6)**: piano (notas largas, preludios), Rhodes, órgano,
  clarinete, cuerdas, contrabajo; metales balcánicos y discos rumanos de folk, jazz y librería
  «troceados, transpuestos, irreconocibles» [RMC, fabric, Wiki FZ]; micro-sampling [Nu Zau, ST].
- **Sonidos nuevos (sesión 7)**:
  - **Kick**: hoy todos los kicks son el mismo modelo. Falta el kick rominimal de verdad: seno con
    foldback, «woody, dusty», capas (cuerpo, golpe, aire) y el corte de subgrave [RMC, GS].
  - **Rim / snap** en vez de clap (hoy el clap solo se acorta).
  - **Teclas reales** (Rhodes, piano, órgano): hoy los modos «teclas» y «órgano» son el mismo stab
    de sierra y cuadrada con otra envolvente.
  - **Una voz de bleeps / micro-melodía** y un **acid** de verdad (303: deslizamientos, acentos).
  - Sub-bajo de seno puro con su propio canal o capa.
- **Groove (sesión propia, pendiente)**: swing por instrumento (hats adelantados o atrasados unos ms,
  percusión con su propio swing), cuantización al 70–80 %, curvas de swing tipo MPC por encima del
  58 %, empuje-tirón «de batería de jazz» [RMC]. Hoy el estilo solo usa lo que existe (swing del
  universo, clap atrasado, empuje-tirón leve).
- **Partes que evolucionan solas (sesión 10)**: el rominimal es un **proceso** («horizontal»): un
  elemento entra o sale cada 8–16 compases, uno a uno; GROOVE que rota percusiones; silencio de dos
  compases como recurso. Es la manera natural de que un universo rominimal «viva» sin tocarlo.
- **Mutación propia (sesión 12)**: en rominimal la mutación es lenta pero constante (giros y golpes),
  separada de la complejidad.
- **Auto-play (sesión 13)**: un tema rominimal dura 7–15 minutos, sin drops, con GROOVE como casa.
- **Mezcla y máster (sesión 4)**: máster de vinilo (sin limitar a tope), mono por debajo de ~200 Hz
  (hoy 120 Hz), control de sibilancia de hats, el kick con paso alto y realce hacia 1 kHz [RMC, GS].

## 8. Mejoras del motor para otros géneros

Lo que este primer estilo ha enseñado (y lo que haría falta para HOUSE, MICROHOUSE, DEEP,
EXPERIMENTAL…):

1. **Un estilo = datos** (`STYLES` en `styles.js`): añadir un género es escribir otro objeto como
   `ROMINIMAL` con sus rangos, pesos, arquetipos, modos y mezcla. Las tiradas ya saben leerlos.
2. **Elegir el género**: hoy el fader va de NORMAL a ROMINIMAL. Con más estilos: un selector junto
   al fader (NORMAL ↔ el género elegido), o mezclar dos géneros (el fader entre dos estilos), o ejes
   continuos (sesión 15, «intención»).
3. **Separar lo que hoy va junto en la complejidad**: en el bajo, cuántas alturas y lo rápido que
   va (ya separado por umbrales del estilo); lo mismo haría falta en acordes (notas ↔ ritmo) y en la
   percusión (redobles ↔ semicorcheas).
4. **La mutación como dato del estilo** (sesión 12): qué muta y cuánto, aparte de la complejidad.
5. **Presencia por parte y por estilo**: hoy la tabla de partes es la misma para todos los
   géneros; un estilo podría ajustarla (p. ej. MAIN sin clap en rominimal, BUILD más largo en
   house) sin tocar el principio de «lo que no se nombra no suena».
6. **Voces por estilo**: kick, clap, bajo, acordes y pad tienen un solo modelo cada uno (`voices.js`).
   Para cambiar de género de verdad hace falta elegir modelo por estilo (sesión 7) además de rangos.
7. **Groove por estilo**: swing y micro-timing por instrumento (sesión de groove).
8. **Globales sugeridos**: el estilo podría *sugerir* BPM y modo (no imponerlos: son de los dos
   universos), p. ej. con un aviso o resaltando los valores típicos.
9. **El estilo en el universo guardado**: cuando lleguen las cuentas, el estilo y el arquetipo van
   con el universo (y un universo podría regenerarse con otro estilo y la misma semilla: el estilo
   está hecho para que se parezca al que habría salido sin él).

## 9. Cómo tocarlo

El estilo pone el universo; el resto es del intérprete. Lo que el rominimal pide de los mandos que
el estilo no toca:

- **Fader**: a la derecha del todo para ROMINIMAL puro; a medias para un universo «con acento»
  rumano; a la izquierda (o doble clic) para volver a NORMAL en el siguiente NUEVO UNIVERSO.
  Pulsa NUEVO UNIVERSO varias veces: cada uno sale con otro arquetipo (pasa el ratón por el fader o
  la perilla para ver cuál suena).
- **BPM** 124–127 (lo hondo, 122–124). **Modo** dórico, eólico o frigio (mixolidio, poco).
- **Estructura**: GROOVE como casa (el «roller», donde el tema vive más tiempo); INTRO (sus dos
  versiones) para entrar y salir; KICK-OUT y DRIFT para la tensión sin drop; DROP sin prisa. Viajes **PROGRESIVA ·
  ESCALONADA** de 8 a 32 compases (un elemento cada vez); DE GOLPE, poco.
- **Complejidad**: GLOBAL medio (0,6–0,8); los osciladores del estilo ya respiran solos.
- **AUTO-ARREGLOS**: la caída del kick al final de frase va bien («el silencio es una herramienta»);
  los de drop (graves que bajan, hueco antes del kick) pesan poco en un género sin drops.
- **DJ**: mezclas largas; EASY EQ con LOW reparte kick y bajo (en el cruce, la percusión se solapa y
  solo un bajo se queda con la sala [Adam Bogdan]): ya es la manera rominimal de mezclar.

## 10. Cómo se ha comprobado

- **NORMAL idéntico a antes**: 300 semillas comparadas con el código anterior (el commit 813cbd5):
  generadores (estado y 96 compases con mutaciones), carácter (color, complejidad, osciladores,
  CANT · VAR) y paleta de transiciones. **60 000 comprobaciones, 0 diferencias.**
- **Qué genera ROMINIMAL** (1000 universos, fader a 0, 0,5 y 1): perc principal de madera / rim
  72 % (antes 50 %); cowbell 6 % → 1 %; bajo con 1–2 alturas por compás 84 % (antes 60 %); un solo
  acorde 73 % (antes 41 %); salto del kick en el 24 % de los compases (antes 3 %); silencio antes
  del drop 12 % (antes 46 %). 0 valores de color fuera de su rango, 0 valores no finitos.
- **Niveles** (render sin conexión): picos del bajo en sus cuatro modos dentro de lo normal (el sub,
  +0,4 dB sobre el máximo normal); acordes: el órgano, RMS hasta +2,5 dB → su fader −2,5 dB.
- **Chasquidos** (detector de saltos de agudos en 1 ms fuera de los ataques, como RENDIMIENTO.md
  §7): kick y clap 0; en acordes y bajo los rangos ROMINIMAL dan **menos** marcas que los colores
  de siempre (son los transitorios propios de los filtros resonantes).
- **Repetición y densidad** (2026-11-11): NORMAL otra vez idéntico (300 semillas, generadores con
  96 compases y mutaciones, color, complejidad, osciladores, CANT · VAR, paleta y espacio: 30 600
  comprobaciones, 0 diferencias); los números de ROMINIMAL antes y después, en §6 «Repetición»; en la
  app, universos ROMINIMAL seguidos sin errores, AUDIO OK y el MIXER con PERC ≈ −11 y FOLEY ≈ −14.
  **Falta: escucharlo.**
- **Mezcla de la percusión y foley como ear candy** (2026-11-11): NORMAL idéntico otra vez (las
  mismas 30 600 comprobaciones; en el audio, NORMAL va por el camino directo: los mismos nodos ×1);
  el foley pasa de sonar en el 77 % de los compases (1 s de cada 1,92) al 19 % (0,11 s); la subida
  automática del compresor, calculada con la fórmula del navegador y comprobada contra el nodo
  (8,92 · 8,12 · 5,84 · 0 dB, igual que medido); su retraso, medido (264 muestras a 44,1 kHz, 288 a
  48 kHz); el cambio entre el camino directo y el del compresor, sin clic (misma 2ª derivada máxima
  con y sin cambio); en la app, universos ROMINIMAL seguidos: 0 TARDE, 0 CORTES, sin errores.
  **Falta: escucharlo.**
- **En la app** (UN UNIVERSO y DJ): 8 universos seguidos con el fader en 1, 0,5, 0,3 y 0: MIXER y
  MUTE correctos, NORMAL recupera la mezcla de antes, el otro universo intacto; AUDIO OK, 0 CORTES,
  0 TARDE, sin incidencias. **Falta: escucharlo** (el oído decide los rangos).

## Fuentes

Leídas para esta investigación (2026-11-10). Las abreviaturas son las de `styles.js`.

- **[EB]** Electronic Beats, *A 10-Track Beginner's Guide To Rominimal, The Underground Tech-House
  Sound Of Romania* — https://www.electronicbeats.net/guide-to-rominimal-underground-tech-house
- **[EB 2017]** Electronic Beats, la versión de 2017 de la misma guía (la cita del kick de Vid) —
  https://www.electronicbeats.net/guide-to-rominimal-2017
- **[G&A]** William Ralston, *Sunrise in Bucharest* (Google Arts & Culture; un extracto salió en
  Resident Advisor) — https://artsandculture.google.com/story/awUhhI-kfZOMZQ
- **[XLR8R deep]** XLR8R, *A Deep Dive Into the Present and History of Romanian House and Techno*
  (incluye el equipo de Vlad Caia y Amorf) — https://xlr8r.com/?p=129419
- **[XLR8R]** XLR8R, *Romania: Exquisitely Elusive* — https://xlr8r.com/features/romania-exquisitely-elusive/
- **[XLR8R Cons]** XLR8R, *Cristi Cons: A Man of Two Worlds* — https://xlr8r.com/features/cristi-cons-a-man-of-two-worlds/
- **[fabric]** fabric London, *In profile: a potted history of Petre Inspirescu* —
  https://fabriclondon.com/posts/in-profile-a-potted-history-of-petre-inspirescu
- **[Mixmag Cezar]** Mixmag, entrevista a Cezar (2024) —
  https://mixmag.net/feature/cezar-dj-romania-minimal-techno-rominimal-untold-festival-interview
- **[Gray Area]** *City Beats: Bucharest* — https://grayarea.co/academy/city-beats-bucharest
- **[Meoko]** *How Romania helped change the face of house music* —
  https://meoko.net/news/how-romania-help-change-the-face-of-house-music
- **[Meoko 2]** *Romania, the fertile ground for underground scene* —
  https://meoko.net/news/romania-the-fertile-ground-for-underground-scene
- **[Nu Zau]** Meoko, entrevista a Nu Zau —
  https://www.meoko.net/interviews/nu-zau-growing-up-in-bucharest-music-production-and-2014-exclusive-music
- **[RBMA]** Red Bull Music Academy, entrevista a Ricardo Villalobos (2012) —
  https://daily.redbullmusicacademy.com/2012/11/ricardo-villalobos-interview
- **[Caia]** Bitwig, entrevista a Vlad Caia — https://www.bitwig.com/artists/vlad-caia-86/
- **[RMC]** rominimal.club, *Rominimal Production — How the Sound Gets Made* y *What is Rominimal?* —
  https://rominimal.club/post/rominimal-production-guide/ · https://rominimal.club/post/what-is-rominimal/
- **[MD]** Melodigging, *Rominimal* — https://www.melodigging.com/genre/rominimal
- **[ST]** SkyTracks, *Understanding Dance Music Part II: Minimal and Micro House* —
  https://skytracks.io/blog/understanding-dance-music-part-ii-minimal-and-micro-house/
- **[RA Semantics]** Resident Advisor, reseña de Rhadoo — *Semantics* — https://ra.co/reviews/23479
- **[RA fabric 72]** Resident Advisor, reseña de Rhadoo — *fabric 72* — https://ra.co/reviews/14059
- **[RA Mihigh]** Resident Advisor, reseña de Mihigh — *Roll Over* (con remix de Rhadoo) — https://ra.co/reviews/22319
- **[RA Melodie]** Resident Advisor, reseña de Melodie — *Echo Rhythm EP* (Metereze) — https://de.ra.co/reviews/16963
- **[Trommel Arapu]** Trommel, reseña de Arapu — *Anthology EP* (Metereze) —
  https://trommelmusic.com/music/review-arapu-anthology-ep-mrtz-011/
- **[Trommel Sepp]** Trommel, reseña de Sepp — *Ritm Timpan* (Rawax) — https://trommelmusic.com/music/review-sepp-ritm-timpan-ep-rawax
- **[Ransom Note]** The Ransom Note, *Cosmin TRG: A Return To Booming Bucharest* —
  https://www.theransomnote.com/music/news/cosmin-trg-a-return-to-booming-bucharest
- **[Beatportal]** Beatportal, *The New Rise of Minimal* —
  https://www.beatportal.com/features/minimal-techno-romanian-berlin-bar25-paris/
- **[Beatportal Kahn]** Beatportal, *Mambo Kahn on Jazz, Classical Training & Why Minimal Club Tracks
  Are Harder to Get Right* — https://www.beatportal.com/articles/1555254-mambo-kahn-on-jazz-classical-training-why-minimal-club-tracks-are-harder-to-get-right-faux-poly-interviews
- **[Ibiza Spotlight]** *Ibiza Insiders' Guide: Minimal music* (2025) —
  https://www.ibiza-spotlight.com/magazine/2025/03/ibiza-virgins-guide-minimal-music
- **[Adam Bogdan]** *How I Build a Minimal & Deep Tech DJ Set* — https://adambogdan.com/how-to-build-minimal-deep-tech-dj-set.html
- **[Attack]** Attack Magazine, Beat Dissected *Truncate-style melodic percussion* —
  https://www.attackmagazine.com/technique/beat-dissected/truncate-style-melodic-percussion/
- **[Attack bus]** Attack Magazine, *Advanced parallel buss processing* (en house y techno, la
  percusión agrupada sin el kick, comprimida y con sidechain juntas) —
  https://www.attackmagazine.com/technique/tutorials/advanced-parallel-buss-processing/
- **[MusicRadar mix]** MusicRadar, *9 ways to create better drum mixes* y *10 tricks that pros use to
  add punch and power* (bus de batería sin el kick con sidechain del kick; percusión «enough to give
  the impression of ambience, but not so much that they bury your core drum sounds») —
  https://www.musicradar.com/how-to/9-ways-to-create-better-drum-mixes ·
  https://www.musicradar.com/how-to/10-tricks-that-pros-use-to-add-punch-and-power-to-their-mixes
- **[Audient]** Audient, *Ear candy production tips* (el ear candy como algo aparte del ritmo
  principal, filtrado para tener su sitio) — https://audient.com/tutorial/ear-candy-production-tips/
- **[KVR]** foro KVR, hilo sobre ear candy y FX en techno (sonidos sueltos dejados caer en una reverb
  grande y oscura o en un delay) — https://www.kvraudio.com/forum/viewtopic.php?p=8924370
- **[Loopmasters]** UNDRGRND Sounds, *Romanian Minimal House* (descripción del pack) —
  https://www.loopmasters.com/genres/52-Minimal-Techno/products/11398-Romanian-Minimal-House
- **[Roland]** Roland Cloud, *Rominimal* (descripción del pack) — https://www.roland.com/UK/products/rc_rominimal/
- **[Reidht]** *Genre of the Day — Rominimal* (SIT, *Invisibility*) — https://reidht.substack.com/p/every-genre-project-september-28
- **[Wiki micro]** Wikipedia, *Microhouse* — https://en.wikipedia.org/wiki/Microhouse
- **[Wiki minimal]** Wikipedia, *Minimal techno* — https://en.wikipedia.org/wiki/Minimal_techno
- **[Wiki FZ]** Wikipedia, *Fizheuer Zieheuer* — https://en.wikipedia.org/wiki/Fizheuer_Zieheuer
- **[mnml.nl]** foro mnml.nl, hilo sobre un tutorial de micro house / estilo rumano —
  https://www.mnml.nl/phpBB3/viewtopic.php?t=94739
- Hilo del foro de Ableton *Micro House/Romanian Minimal — production tips* (poco útil) —
  https://forum.ableton.com/viewtopic.php?t=217543
- **Solo a través de citas** (no se pudieron abrir):
  - **[GS]** Gearspace, *Romanian house/minimal producers kicks* (el foro pide una verificación
    anti-bots; lo citado viene del resumen del buscador y de [RMC]) —
    https://gearspace.com/threads/romanian-house-minimal-producers-kicks.956561/
  - **[PML]** Production Music Live, *How to make a groove in 4 levels* (el bajo en las semicorcheas
    a contratiempo; resumen del buscador) — https://www.productionmusiclive.com/blogs/news/how-to-make-a-groove-in-4-levels
  - **[MusicRadar]** MusicRadar, *Less is more: the beginner's guide to minimal dance music* (el delay
    como parte del ritmo, swing y golpes fuera de rejilla; la página no dejó leer el cuerpo, resumen
    del buscador) — https://musicradar.com/how-to/less-is-more-the-beginners-guide-to-minimal-dance-music
  - Cezar lanzó Deruta Records en 2025 (Trommel, *Cezar: DJing as storytelling*, resumen del
    buscador) — https://trommelmusic.com/featured/cezar-djing-as-storytelling/
  - Herbály, D., *The history of Rominimal*, Me.dok 21 (2026), solo el resumen —
    https://reference-global.com/article/10.2478/medok-2026-0005 ; y el proyecto doctoral de
    Alexandra Onofrei (Exeter) sobre comunidad e identidad en el rominimal —
    https://www.swdtp.ac.uk/?p=5035
