export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.ambient = null;
    this.drone = null;
    this.enabled = true;
  }

  start() {
    if (this.ctx || !this.enabled) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.24;
    this.master.connect(this.ctx.destination);
    this.createAmbient();
  }

  createAmbient() {
    const hum = this.ctx.createOscillator();
    const humGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    hum.type = 'sawtooth';
    hum.frequency.value = 42;
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    humGain.gain.value = 0.08;
    hum.connect(filter).connect(humGain).connect(this.master);
    hum.start();
    this.ambient = hum;
  }

  click(freq = 120, duration = 0.05, volume = 0.08) {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain).connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  footstep(speed) {
    this.click(70 + speed * 12, 0.035, 0.045);
  }

  glitch(intensity = 1) {
    if (!this.ctx || !this.enabled) return;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.18, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const noise = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900 + Math.random() * 1800;
    gain.gain.value = 0.08 * intensity;
    noise.buffer = buffer;
    noise.connect(filter).connect(gain).connect(this.master);
    noise.start();
  }

  alarm() {
    this.click(440, 0.16, 0.16);
    setTimeout(() => this.click(220, 0.18, 0.14), 190);
  }

  setVolume(value) {
    if (this.master) this.master.gain.value = value;
  }
}
