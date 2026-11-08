// GRABAR — lo que sale por los altavoces (tras el techo del master), sin pérdidas:
// WAV estéreo de 24 bits a la frecuencia del audio (normalmente 48 kHz).
//
// Al pulsar GRABAR queda ARMADO: no guarda nada hasta la primera muestra con sonido,
// así se puede armar antes de GENERAR y el archivo empieza justo en el primer golpe.
// Al volver a pulsar se para y se descarga el archivo.
//
// La captura va en el hilo de audio (AudioWorklet): no pierde muestras aunque la
// pantalla se atasque. Donde no hay AudioWorklet (p. ej. el móvil por la wifi, sin
// HTTPS) usa un ScriptProcessor, que va en el hilo principal.
// Si el motor rehace el audio (cambio de búfer o calidad), la grabación sigue en el
// mismo archivo.

const SILENCE = 1e-5;   // −100 dB: por debajo de esto, todavía no ha empezado a sonar
const BLOCK = 4096;     // muestras por envío (el worklet junta bloques de 128)

const WORKLET = `
class MuRec extends AudioWorkletProcessor {
  constructor() {
    super();
    this.mode = 'idle'; // idle | armed | on
    this.L = new Float32Array(${BLOCK}); this.R = new Float32Array(${BLOCK}); this.n = 0;
    this.port.onmessage = (e) => {
      const m = e.data;
      if (m === 'arm') { this.mode = 'armed'; this.n = 0; }
      else if (m === 'on') { this.mode = 'on'; this.n = 0; }
      else if (m === 'stop') { this.flush(); this.mode = 'idle'; this.port.postMessage({ done: true }); }
    };
  }
  flush() {
    if (!this.n) return;
    this.port.postMessage({ L: this.L.slice(0, this.n), R: this.R.slice(0, this.n) });
    this.n = 0;
  }
  process(inputs) {
    const inp = inputs[0];
    if (this.mode === 'idle' || !inp || !inp.length) return true;
    const L = inp[0], R = inp[1] || inp[0];
    let i = 0;
    if (this.mode === 'armed') { // empieza en la primera muestra con sonido
      while (i < L.length && Math.abs(L[i]) <= ${SILENCE} && Math.abs(R[i]) <= ${SILENCE}) i++;
      if (i === L.length) return true;
      this.mode = 'on';
      this.port.postMessage({ started: true });
    }
    for (; i < L.length; i++) {
      this.L[this.n] = L[i]; this.R[this.n] = R[i];
      if (++this.n === ${BLOCK}) this.flush();
    }
    return true;
  }
}
registerProcessor('mu-rec', MuRec);
`;

const pad2 = (n) => String(n).padStart(2, '0');

export class Recorder {
  constructor() {
    this.state = 'idle';   // idle | armed | rec | saving
    this.chunks = [];      // trozos de audio ya en 24 bits intercalados (L R L R…)
    this.frames = 0;
    this.sampleRate = 0;
    this.node = null;
    this.onDone = null;
  }

  get seconds() { return this.sampleRate ? this.frames / this.sampleRate : 0; }
  get bytes() { return this.frames * 6; }

  // engancharse a la salida de un contexto de audio (al arrancar y cada vez que se rehace)
  async attach(ctx, source) {
    this.ctx = ctx;
    const prev = this.state;
    if ((prev === 'rec' || prev === 'armed') && this.sampleRate && ctx.sampleRate !== this.sampleRate) {
      this.finish(); // otra frecuencia: no se puede seguir en el mismo archivo
    }
    let node;
    try {
      if (!ctx.audioWorklet) throw new Error('sin AudioWorklet');
      const url = URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' }));
      await ctx.audioWorklet.addModule(url);
      node = new AudioWorkletNode(ctx, 'mu-rec', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
      node.port.onmessage = (e) => this.onMessage(e.data);
      this.send = (m) => node.port.postMessage(m);
    } catch {
      node = this.scriptFallback(ctx);
    }
    // un nodo tiene que acabar en la salida para que el navegador lo procese: va en silencio
    const mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(node);
    node.connect(mute).connect(ctx.destination);
    this.node = node;
    if (this.state === 'rec') this.send('on');        // rehacer el audio en mitad: sigue
    else if (this.state === 'armed') this.send('arm');
  }

  // misma lógica que el worklet, en el hilo principal
  scriptFallback(ctx) {
    const sp = ctx.createScriptProcessor(BLOCK, 2, 2);
    let mode = 'idle';
    this.send = (m) => {
      if (m === 'arm') mode = 'armed';
      else if (m === 'on') mode = 'on';
      else if (m === 'stop') { mode = 'idle'; this.onMessage({ done: true }); }
    };
    sp.onaudioprocess = (e) => {
      if (mode === 'idle') return;
      const L = e.inputBuffer.getChannelData(0);
      const R = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : L;
      let i = 0;
      if (mode === 'armed') {
        while (i < L.length && Math.abs(L[i]) <= SILENCE && Math.abs(R[i]) <= SILENCE) i++;
        if (i === L.length) return;
        mode = 'on';
        this.onMessage({ started: true });
      }
      this.onMessage({ L: L.slice(i), R: R.slice(i) });
    };
    return sp;
  }

  onMessage(m) {
    if (m.started) { this.state = 'rec'; return; }
    if (m.done) { this.finish(); return; }
    if (!m.L || !m.L.length) return;
    // a 24 bits intercalado: 3 bytes por muestra, L y R
    const n = m.L.length;
    const out = new Uint8Array(n * 6);
    for (let i = 0, o = 0; i < n; i++) {
      for (const x of [m.L[i], m.R[i]]) {
        const v = Math.max(-8388608, Math.min(8388607, Math.round(x * 8388607)));
        out[o++] = v & 255; out[o++] = (v >> 8) & 255; out[o++] = (v >> 16) & 255;
      }
    }
    this.chunks.push(out);
    this.frames += n;
  }

  // GRABAR: armar / parar y guardar
  toggle() {
    if (!this.node) return;
    if (this.state === 'idle') {
      this.chunks = [];
      this.frames = 0;
      this.sampleRate = this.ctx.sampleRate;
      this.state = 'armed';
      this.send('arm');
    } else if (this.state === 'armed' || this.state === 'rec') {
      this.state = 'saving';
      this.send('stop'); // el worklet entrega lo que le queda y avisa
    }
  }

  finish() {
    const hadAudio = this.frames > 0;
    if (hadAudio) this.download();
    this.chunks = [];
    this.frames = 0;
    this.state = 'idle';
    this.onDone?.(hadAudio);
  }

  download() {
    const sr = this.sampleRate;
    const dataBytes = this.frames * 6;
    const h = new DataView(new ArrayBuffer(44));
    const str = (o, s) => { for (let i = 0; i < 4; i++) h.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); h.setUint32(4, 36 + dataBytes, true); str(8, 'WAVE');
    str(12, 'fmt '); h.setUint32(16, 16, true); h.setUint16(20, 1, true); // PCM
    h.setUint16(22, 2, true); h.setUint32(24, sr, true); h.setUint32(28, sr * 6, true);
    h.setUint16(32, 6, true); h.setUint16(34, 24, true);
    str(36, 'data'); h.setUint32(40, dataBytes, true);
    const blob = new Blob([h, ...this.chunks], { type: 'audio/wav' });
    const d = new Date();
    const name = `minimal-universe-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}.wav`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    this.lastFile = { name, seconds: this.seconds, bytes: blob.size };
  }
}
