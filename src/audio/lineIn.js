// ENTRADA: sonido de fuera que entra en el programa (para el streaming: lo que suena en el
// ordenador, otra app, una pestaña…). De momento solo entra, en general (no va a ningún
// universo): se suma al máster antes del glue y el limitador, así que GRABAR también lo coge.
// Más adelante: efectos para hacer ambientes y texturas.
//
// Dos caminos:
//  · PESTAÑA (getDisplayMedia): solo el audio de una pestaña del mismo navegador (p. ej. un
//    YouTube); la pestaña se queda en silencio y suena solo aquí. No se ofrece la pantalla
//    entera ni el sonido del sistema.
//  · DISPOSITIVO (getUserMedia): una entrada de audio de Windows. Con un cable virtual
//    (VB-CABLE, Voicemeeter…) se manda ahí la salida de las apps que se quieran (Configuración →
//    Sonido → Mezclador de volumen → salida de cada app): no suenan por los altavoces, solo aquí.
//
// Sin procesado del navegador (nada de cancelar eco, quitar ruido ni ganancia automática):
// el sonido entra tal cual.

const RAW = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };

export class LineIn {
  constructor() {
    this.stream = null;
    this.kind = '';      // 'pestaña' | 'dispositivo'
    this.label = '';
    this.deviceId = '';
    this.gainDb = 0;
    this.note = '';      // aviso para OPCIONES (p. ej. si no se pudo dejar fuera el audio propio)
    this.ctx = null;
    this.src = null;
    this.gain = null;
    this.meter = null;
    this.buf = null;
    this.onChange = null; // la vista se entera si la entrada se corta desde fuera
  }

  get on() { return !!this.stream; }

  // se llama en cada init() del motor (al rehacer el audio el contexto es otro)
  attach(ctx, dest) {
    this.ctx = ctx;
    this.dest = dest;
    this.gain = ctx.createGain();
    this.gain.gain.value = this.lin();
    this.meter = ctx.createAnalyser();
    this.meter.fftSize = 1024;
    this.buf = new Float32Array(1024);
    this.gain.connect(dest);
    this.gain.connect(this.meter);
    this.src = null;
    if (this.stream) this.plug();
  }

  lin() { return this.gainDb <= -40 ? 0 : 10 ** (this.gainDb / 20); }

  setGainDb(db) {
    this.gainDb = db;
    if (this.gain) this.gain.gain.setTargetAtTime(this.lin(), this.ctx.currentTime, 0.02);
  }

  plug() {
    try { this.src?.disconnect(); } catch {}
    this.src = this.ctx.createMediaStreamSource(this.stream);
    this.src.connect(this.gain);
  }

  async use(stream, kind, label) {
    this.stop();
    const a = stream.getAudioTracks()[0];
    if (!a) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error('sin audio');
    }
    // la imagen no hace falta: solo el sonido
    stream.getVideoTracks().forEach((t) => { t.stop(); stream.removeTrack(t); });
    a.addEventListener('ended', () => { if (this.stream === stream) { this.stop(); this.onChange?.(); } });
    this.stream = stream;
    this.kind = kind;
    this.label = label || a.label || kind;
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => {});
      this.plug();
    }
  }

  // SOLO UNA PESTAÑA: su audio y nada más (ni micro ni sonido del sistema). La pestaña se queda
  // en silencio (suppressLocalAudioPlayback) y se oye solo a través del programa.
  // Tiene que estar en el MISMO navegador que el programa (Chrome con Chrome).
  async fromTab() {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'browser' }, // el navegador no deja pedir solo audio; la imagen se tira enseguida
      audio: { ...RAW, suppressLocalAudioPlayback: true },
      preferCurrentTab: false,
      selfBrowserSurface: 'exclude',  // esta misma pestaña no sale en la lista
      systemAudio: 'exclude',         // nada del sonido del sistema
      monitorTypeSurfaces: 'exclude', // ni la pantalla entera
      surfaceSwitching: 'include',    // «compartir esta pestaña en su lugar» para cambiar de vídeo
    });
    const surf = stream.getVideoTracks()[0]?.getSettings?.().displaySurface;
    if (surf && surf !== 'browser') {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error('no es pestaña');
    }
    await this.use(stream, 'pestaña', 'PESTAÑA');
    this.note = 'la pestaña queda en silencio: solo se oye aquí · para cambiar de pestaña, «compartir esta pestaña en su lugar» en la barra de Chrome';
  }

  async fromDevice(deviceId) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { ...RAW, deviceId: deviceId ? { exact: deviceId } : undefined, channelCount: 2 },
    });
    this.deviceId = deviceId;
    this.note = '';
    await this.use(stream, 'dispositivo');
  }

  stop() {
    try { this.src?.disconnect(); } catch {}
    this.src = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.kind = '';
    this.label = '';
    this.note = '';
  }

  // pico de lo que entra (tras el nivel), en dBFS
  peakDb() {
    if (!this.meter || !this.stream) return -Infinity;
    this.meter.getFloatTimeDomainData(this.buf);
    let p = 0;
    for (let i = 0; i < this.buf.length; i++) { const x = Math.abs(this.buf[i]); if (x > p) p = x; }
    return p > 0 ? 20 * Math.log10(p) : -Infinity;
  }
}
