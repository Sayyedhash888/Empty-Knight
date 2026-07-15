export class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.bgmInterval = null;
    
    // Nodes for ambient wind
    this.windNoise = null;
    this.windFilter = null;
    this.windGain = null;

    // Melodic notes sequence (D-minor, A-minor, G-minor chord tones)
    // Ambient piano notes: [Frequency, DurationScale, VolumeScale]
    this.notes = [
      146.83, 220.00, 261.63, 293.66, 329.63, 392.00, 440.00, // D3, A3, C4, D4, E4, G4, A4
      587.33, 659.25, 783.99, 880.00                           // D5, E5, G5, A5
    ];
    this.chords = [
      [146.83, 220.00, 293.66, 349.23], // D minor (Dm)
      [110.00, 220.00, 277.18, 329.63], // A major / A7 (A)
      [130.81, 196.00, 261.63, 329.63], // C major (C)
      [116.54, 174.61, 233.08, 293.66]  // Bb major (Bb)
    ];
    this.currentChordIndex = 0;
    this.lastNoteTime = 0;
    this.bgmActive = false;
  }

  init() {
    if (this.ctx) return;
    
    // Create AudioContext (must be triggered by user interaction)
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    // Start wind background noise
    this.startWind();
    
    // Start ambient sequencer
    this.bgmActive = true;
    this.tickBGM();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) {
      if (this.muted) {
        this.ctx.suspend();
      } else {
        this.ctx.resume();
        if (this.ctx.state === 'suspended') {
          // Re-trigger context start just in case
          this.init();
        }
      }
    }
    return this.muted;
  }

  createNoiseBuffer() {
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  startWind() {
    if (this.muted) return;
    try {
      const buffer = this.createNoiseBuffer();
      this.windNoise = this.ctx.createBufferSource();
      this.windNoise.buffer = buffer;
      this.windNoise.loop = true;

      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'lowpass';
      this.windFilter.frequency.setValueAtTime(300, this.ctx.currentTime);
      this.windFilter.Q.setValueAtTime(5, this.ctx.currentTime);

      this.windGain = this.ctx.createGain();
      this.windGain.gain.setValueAtTime(0.04, this.ctx.currentTime); // Soft wind hum

      // Connect
      this.windNoise.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.ctx.destination);

      this.windNoise.start();

      // Automate wind filtering to simulate gusting
      this.modulateWind();
    } catch (e) {
      console.warn("Failed to start procedural wind:", e);
    }
  }

  modulateWind() {
    if (!this.ctx || this.muted || !this.windFilter) return;
    
    const now = this.ctx.currentTime;
    const nextChange = Math.random() * 3 + 2; // Every 2-5 seconds
    const freq = Math.random() * 400 + 150;    // Freq range: 150hz - 550hz
    const gain = Math.random() * 0.05 + 0.02;  // Soft volume fluctuations

    this.windFilter.frequency.exponentialRampToValueAtTime(freq, now + nextChange);
    this.windGain.gain.linearRampToValueAtTime(gain, now + nextChange);

    setTimeout(() => this.modulateWind(), nextChange * 1000);
  }

  tickBGM() {
    if (!this.bgmActive) return;
    
    if (this.ctx && !this.muted && this.ctx.state === 'running') {
      const now = this.ctx.currentTime;
      
      // Every 3 seconds, play some ambient tones
      if (now - this.lastNoteTime > 2.8) {
        this.playAmbientMelody();
        this.lastNoteTime = now;
      }
    }
    
    setTimeout(() => this.tickBGM(), 200);
  }

  playAmbientMelody() {
    const now = this.ctx.currentTime;
    
    // 60% chance to play chord bass drone + high arpeggios
    if (Math.random() < 0.7) {
      const chord = this.chords[this.currentChordIndex];
      
      // Play low bass drone
      this.playSynthNote(chord[0] / 2, 0.05, 4.0, 'sine'); // Sub-bass
      
      // Arpeggiate chord notes over next 1.5 seconds
      chord.forEach((freq, idx) => {
        const delay = idx * (Math.random() * 0.3 + 0.15);
        this.playSynthNote(freq, 0.02, 2.5, 'triangle', now + delay);
        
        // Add random high embellishments
        if (Math.random() < 0.3) {
          const highFreq = freq * 2;
          this.playSynthNote(highFreq, 0.008, 1.8, 'sine', now + delay + 0.1);
        }
      });
      
      // Progress chord index occasionally
      if (Math.random() < 0.4) {
        this.currentChordIndex = (this.currentChordIndex + 1) % this.chords.length;
      }
    } else {
      // Just play a single high bell-like ambient note
      const randomNote = this.notes[Math.floor(Math.random() * this.notes.length)];
      this.playSynthNote(randomNote, 0.025, 3.5, 'sine');
    }
  }

  playSynthNote(freq, vol, duration, type = 'sine', startTime = null) {
    if (this.muted || !this.ctx) return;

    const start = startTime || this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 1.5, start);
    filter.Q.setValueAtTime(1, start);

    // Fade-in (Attack) & Fade-out (Decay/Release)
    gainNode.gain.setValueAtTime(0, start);
    gainNode.gain.linearRampToValueAtTime(vol, start + 0.08); // 80ms attack
    gainNode.gain.setValueAtTime(vol, start + 0.2);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration); // Slow decay

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start(start);
    osc.stop(start + duration);
  }

  /* --- Game Sound Effects --- */

  playJump() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Triangle wave sweep upward
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.15);
    
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(now + 0.2);

    // Soft jump whoosh (white noise)
    try {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer();
      const nGain = this.ctx.createGain();
      const nFilter = this.ctx.createBiquadFilter();
      
      nFilter.type = 'bandpass';
      nFilter.frequency.setValueAtTime(1200, now);
      nFilter.frequency.exponentialRampToValueAtTime(2000, now + 0.12);
      
      nGain.gain.setValueAtTime(0.02, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      
      noise.connect(nFilter);
      nFilter.connect(nGain);
      nGain.connect(this.ctx.destination);
      noise.start();
      noise.stop(now + 0.12);
    } catch(e){}
  }

  playDash() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Quick, high-volume white noise burst with sweep
    try {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer();
      
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1500, now);
      filter.frequency.exponentialRampToValueAtTime(300, now + 0.25);
      
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      
      noise.start();
      noise.stop(now + 0.3);
    } catch(e){}
  }

  playSlash() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Whoosh + high ring
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
    
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(now + 0.2);

    // Noise component for texture
    try {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer();
      const nGain = this.ctx.createGain();
      const nFilter = this.ctx.createBiquadFilter();
      
      nFilter.type = 'highpass';
      nFilter.frequency.setValueAtTime(2000, now);
      nFilter.frequency.exponentialRampToValueAtTime(800, now + 0.12);
      
      nGain.gain.setValueAtTime(0.06, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      
      noise.connect(nFilter);
      nFilter.connect(nGain);
      nGain.connect(this.ctx.destination);
      
      noise.start();
      noise.stop(now + 0.15);
    } catch(e){}
  }

  playHit() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Strong metallic clank + deep impact
    const osc1 = this.ctx.createOscillator(); // Deep body
    const gain1 = this.ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(90, now);
    osc1.frequency.linearRampToValueAtTime(40, now + 0.1);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    
    const filter1 = this.ctx.createBiquadFilter();
    filter1.type = 'lowpass';
    filter1.frequency.setValueAtTime(150, now);
    
    osc1.connect(filter1);
    filter1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start();
    osc1.stop(now + 0.15);

    // High metal ping
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1200, now);
    osc2.frequency.setValueAtTime(1050, now + 0.02);
    gain2.gain.setValueAtTime(0.08, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start();
    osc2.stop(now + 0.3);

    // Noise blast for crunch
    try {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer();
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.12, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      noise.connect(nGain);
      nGain.connect(this.ctx.destination);
      noise.start();
      noise.stop(now + 0.08);
    } catch(e){}
  }

  playSoulCollection() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Ascending pure tone sine chords with high feedback/chime effect
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggio
    
    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);
      
      gain.gain.setValueAtTime(0, now + idx * 0.04);
      gain.gain.linearRampToValueAtTime(0.04, now + idx * 0.04 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.3);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.3);
    });
  }

  playFocusCharge(oscillatorStore = null) {
    if (this.muted || !this.ctx) return null;
    const now = this.ctx.currentTime;
    
    // Low rumbling focus hum that rises in frequency
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(65, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 1.2); // Rise in pitch

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(100, now);
    filter.frequency.exponentialRampToValueAtTime(400, now + 1.2); // Brighten up
    filter.Q.setValueAtTime(8, now);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 1.0);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    
    return { osc, gain, filter };
  }

  playHeal() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Warm chord release, shiny major arpeggio
    const freqs = [329.63, 392.00, 523.25, 659.25, 1046.50]; // E4, G4, C5, E5, C6
    
    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      
      gain.gain.setValueAtTime(0, now + idx * 0.06);
      gain.gain.linearRampToValueAtTime(0.07, now + idx * 0.06 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.6);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.6);
    });
  }

  playHurt() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Heavy shock/glitch hit
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(30, now + 0.25);
    
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(now + 0.25);

    try {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer();
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.18, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      
      noise.connect(nGain);
      nGain.connect(this.ctx.destination);
      noise.start();
      noise.stop(now + 0.2);
    } catch(e){}
  }

  playBenchSit() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    
    // High soft celestial chime
    const chord = [293.66, 369.99, 440.00, 587.33]; // D major chord
    chord.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);
      gain.gain.setValueAtTime(0, now + idx * 0.1);
      gain.gain.linearRampToValueAtTime(0.05, now + idx * 0.1 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 1.2);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 1.2);
    });
  }

  playSpell(type) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (type === 'vengefulSpirit') {
      // High-pitched arcane whoosh + ghost screech
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.3);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now); osc.stop(now + 0.35);

      // Sine harmonic shimmer
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1760, now);
      osc2.frequency.linearRampToValueAtTime(440, now + 0.25);
      gain2.gain.setValueAtTime(0.06, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(now); osc2.stop(now + 0.25);

    } else if (type === 'desolateDive') {
      // Deep reverberant slam
      try {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer();
        const nGain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, now);
        nGain.gain.setValueAtTime(0.35, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        noise.connect(filter);
        filter.connect(nGain);
        nGain.connect(this.ctx.destination);
        noise.start(); noise.stop(now + 0.4);
      } catch(e) {}
      // Low boom
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(90, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.5);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now); osc.stop(now + 0.5);

    } else if (type === 'howlingWraiths') {
      // Ascending banshee screech
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(1800, now + 0.4);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now); osc.stop(now + 0.45);
    }
  }
}
export default SoundManager;
