// ENTRADA: sonido de fuera que entra en el programa (para el streaming: lo que suena en el
// ordenador, otra app, una pestaña…). De momento solo entra, en general (no va a ningún
// universo): se suma al máster antes del glue y el limitador, así que GRABAR también lo coge.
// Más adelante: efectos para hacer ambientes y texturas.
//
// Dos caminos:
//  · PESTAÑA / PANTALLA (getDisplayMedia): el navegador deja elegir una pestaña (solo su audio,
//    y se puede silenciar en la propia pestaña: suena solo aquí) o la pantalla entera con
//    «compartir audio del sistema» (todo el ordenador; se pide que deje fuera el de esta página).
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
    this.kind = '';      // 'pantalla' | 'dispositivo'
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

  async fromScreen() {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true, // el navegador no deja pedir solo audio; la imagen se tira enseguida
      audio: { ...RAW, suppressLocalAudioPlayback: true, restrictOwnAudio: true },
      systemAudio: 'include',
      windowAudio: 'system',
      selfBrowserSurface: 'exclude',
      surfaceSwitching: 'include',
    });
    const v = stream.getVideoTracks()[0]?.getSettings?.() || {};
    const a = stream.getAudioTracks()[0];
    const s = a?.getSettings?.() || {};
    const surf = v.displaySurface;
    await this.use(stream, 'pantalla', surf === 'browser' ? 'PESTAÑA' : surf === 'monitor' ? 'TODO EL ORDENADOR' : 'VENTANA');
    // si se coge todo el ordenador y el navegador no deja fuera el audio de esta página,
    // el programa se oiría a sí mismo (eco que crece): se avisa
    this.note = surf === 'monitor' && s.restrictOwnAudio !== true
      ? 'ojo: este navegador puede estar cogiendo también el sonido del programa (eco). Si pasa, usa una pestaña o un cable virtual'
      : surf === 'browser' ? 'la pestaña queda en silencio: solo se oye aquí' : '';
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
