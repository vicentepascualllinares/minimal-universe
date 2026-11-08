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

## Ya apuntado en otros sitios

- Rendimiento, AudioWorklet y lo que hay que decidir antes de samples y MIDI: [RENDIMIENTO.md](RENDIMIENTO.md).
- Cuentas, para guardar la mezcla, los ajustes y los sonidos; control MIDI; más instrumentos.
