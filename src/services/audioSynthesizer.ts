class LuxuryAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;

  // Real Microphone Capture & Analysis
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private micDataArray: Uint8Array | null = null;
  private smoothedMicAmplitude: number = 0;
  private isListeningActive: boolean = false;

  // Real 16kHz PCM Audio Capture for Groq Whisper
  private pcmChunks: Float32Array[] = [];
  private pcmProcessor: ScriptProcessorNode | null = null;
  private isPcmBuffering: boolean = false;

  // Speaking State & Luminescence Envelope (Zero oscillator noise to speakers)
  private isSpeechActive: boolean = false;
  private speechStartTime: number = 0;
  private smoothedSpeechAmplitude: number = 0;

  public initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  /* -------------------------------------------------------------
   * Real Microphone Input Analysis (for Listening Mode)
   * ------------------------------------------------------------- */
  public async startMicrophoneCapture(): Promise<boolean> {
    if (typeof window === 'undefined' || !navigator?.mediaDevices?.getUserMedia) {
      return false;
    }

    try {
      this.initCtx();
      if (!this.ctx) return false;

      // Clean up any existing stream
      this.stopMicrophoneCapture();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.micStream = stream;
      this.micSource = this.ctx.createMediaStreamSource(stream);
      this.micAnalyser = this.ctx.createAnalyser();
      this.micAnalyser.fftSize = 256;
      this.micAnalyser.smoothingTimeConstant = 0.35;
      this.micDataArray = new Uint8Array(this.micAnalyser.frequencyBinCount);

      // Connect source to analyser ONLY (NEVER to destination to prevent feedback)
      this.micSource.connect(this.micAnalyser);

      // Connect ScriptProcessor for pristine 16kHz PCM audio capture
      try {
        const processor = this.ctx.createScriptProcessor(4096, 1, 1);
        this.pcmProcessor = processor;
        this.pcmChunks = [];
        this.isPcmBuffering = true;

        processor.onaudioprocess = (e) => {
          if (!this.isPcmBuffering) return;
          const input = e.inputBuffer.getChannelData(0);
          const chunk = new Float32Array(input.length);
          chunk.set(input);
          this.pcmChunks.push(chunk);

          // Keep a rolling buffer of max ~15 seconds to avoid memory bloat
          if (this.pcmChunks.length > 160) {
            this.pcmChunks.shift();
          }
        };

        this.micSource.connect(processor);
        // Connect processor to a zero-gain node so the audio pipeline stays active without speaker feedback
        const silentGain = this.ctx.createGain();
        silentGain.gain.value = 0;
        processor.connect(silentGain);
        silentGain.connect(this.ctx.destination);
      } catch (err) {
        console.warn('ScriptProcessor init notice:', err);
      }

      this.isListeningActive = true;
      return true;
    } catch {
      this.isListeningActive = false;
      return false;
    }
  }

  public clearPcmBuffer() {
    this.pcmChunks = [];
  }

  public exportWavBlob(): Blob | null {
    if (!this.ctx || this.pcmChunks.length === 0) {
      return null;
    }

    try {
      const inputRate = this.ctx.sampleRate;
      const targetRate = 16000;

      // 1. Merge all Float32Array chunks
      let totalLength = 0;
      for (const chunk of this.pcmChunks) {
        totalLength += chunk.length;
      }
      if (totalLength === 0) return null;

      const merged = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of this.pcmChunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      this.pcmChunks = [];

      // 2. Downsample to 16,000 Hz
      let downsampled: Float32Array;
      if (inputRate === targetRate) {
        downsampled = merged;
      } else {
        const ratio = inputRate / targetRate;
        const newLen = Math.round(merged.length / ratio);
        downsampled = new Float32Array(newLen);
        let offsetResult = 0;
        let offsetBuffer = 0;
        while (offsetResult < downsampled.length) {
          const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
          let accum = 0, count = 0;
          for (let i = offsetBuffer; i < nextOffsetBuffer && i < merged.length; i++) {
            accum += merged[i];
            count++;
          }
          downsampled[offsetResult] = count > 0 ? accum / count : 0;
          offsetResult++;
          offsetBuffer = nextOffsetBuffer;
        }
      }

      // 3. Encode to standard 16-bit Mono WAV (44-byte standard RIFF header)
      const wavBuffer = new ArrayBuffer(44 + downsampled.length * 2);
      const view = new DataView(wavBuffer);

      function writeString(off: number, str: string) {
        for (let i = 0; i < str.length; i++) {
          view.setUint8(off + i, str.charCodeAt(i));
        }
      }

      writeString(0, 'RIFF');
      view.setUint32(4, 36 + downsampled.length * 2, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); // PCM format
      view.setUint16(22, 1, true); // Mono channel
      view.setUint32(24, targetRate, true); // 16000
      view.setUint32(28, targetRate * 2, true); // byte rate (16000 * 1 * 16/8 = 32000)
      view.setUint16(32, 2, true); // block align (1 * 16/8 = 2)
      view.setUint16(34, 16, true); // 16 bits per sample
      writeString(36, 'data');
      view.setUint32(40, downsampled.length * 2, true);

      let wavOffset = 44;
      for (let i = 0; i < downsampled.length; i++, wavOffset += 2) {
        const s = Math.max(-1, Math.min(1, downsampled[i]));
        view.setInt16(wavOffset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      }

      return new Blob([wavBuffer], { type: 'audio/wav' });
    } catch (e) {
      console.warn('WAV export error:', e);
      return null;
    }
  }

  public stopMicrophoneCapture() {
    this.isListeningActive = false;
    this.isPcmBuffering = false;
    if (this.pcmProcessor) {
      try {
        this.pcmProcessor.disconnect();
      } catch {}
      this.pcmProcessor = null;
    }
    this.pcmChunks = [];

    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch {}
      this.micSource = null;
    }
    this.micAnalyser = null;
    this.micDataArray = null;
    this.smoothedMicAmplitude = 0;
  }

  public getMicrophoneStream(): MediaStream | null {
    return this.micStream;
  }

  public getRawMicrophoneEnergy(): number {
    if (!this.isListeningActive || !this.micAnalyser || !this.micDataArray) {
      return 0;
    }
    try {
      (this.micAnalyser.getByteFrequencyData as any)(this.micDataArray);
      let sum = 0;
      const binCount = Math.min(this.micDataArray.length, 64);
      for (let i = 1; i < binCount; i++) {
        sum += this.micDataArray[i];
      }
      return sum / (binCount * 255);
    } catch {
      return 0;
    }
  }

  public getMicrophoneAmplitude(): number {
    if (!this.isListeningActive || !this.micAnalyser || !this.micDataArray) {
      return 0;
    }

    try {
      const rawAmp = this.getRawMicrophoneEnergy();
      // Sensitive noise gate tuned for natural conversational speech across all mic types
      const noiseGate = 0.008;
      const targetAmp = rawAmp > noiseGate ? Math.min((rawAmp - noiseGate) / 0.18, 1.0) : 0;

      const attack = 0.55;
      const release = 0.15;
      if (targetAmp > this.smoothedMicAmplitude) {
        this.smoothedMicAmplitude += (targetAmp - this.smoothedMicAmplitude) * attack;
      } else {
        this.smoothedMicAmplitude += (targetAmp - this.smoothedMicAmplitude) * release;
      }

      return this.smoothedMicAmplitude;
    } catch {
      return 0;
    }
  }

  /* -------------------------------------------------------------
   * Assistant Speech Luminescence Envelope
   * (Drives the 3D Orb's dynamic glow synchronously without drone noise)
   * ------------------------------------------------------------- */
  public startSpeechAnalysis() {
    this.isSpeechActive = true;
    this.speechStartTime = performance.now();
  }

  public stopSpeaking() {
    this.isSpeechActive = false;
    this.smoothedSpeechAmplitude = 0;
  }

  public getSpeechAmplitude(): number {
    if (!this.isSpeechActive) {
      this.smoothedSpeechAmplitude *= 0.85;
      return this.smoothedSpeechAmplitude < 0.01 ? 0 : this.smoothedSpeechAmplitude;
    }

    const elapsed = (performance.now() - this.speechStartTime) * 0.001;
    // Human speech rhythm simulation (syllable rate ~4-5Hz with cadence variations)
    const baseSyllable = Math.sin(elapsed * 28.0) * 0.25;
    const wordStress = Math.sin(elapsed * 9.0) * 0.35;
    const phraseArc = Math.sin(elapsed * 2.2) * 0.15;
    const targetAmp = Math.max(0.15, Math.min(0.85, 0.45 + baseSyllable + wordStress + phraseArc));

    this.smoothedSpeechAmplitude += (targetAmp - this.smoothedSpeechAmplitude) * 0.35;
    return this.smoothedSpeechAmplitude;
  }

  /* -------------------------------------------------------------
   * Genuine Phone Call Audio Effects
   * ------------------------------------------------------------- */
  // Authentic telephone ringback tone (440Hz + 480Hz dual tone)
  public playPhoneRingTone(): () => void {
    if (!this.soundEnabled) return () => {};
    this.initCtx();
    if (!this.ctx) return () => {};

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(440, now); // 440 Hz
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(480, now); // 480 Hz

    // Pulse envelope for a realistic telephone ring (0.8s on, fade out)
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.04, now + 0.05);
    gain.gain.setValueAtTime(0.04, now + 0.85);
    gain.gain.linearRampToValueAtTime(0.0001, now + 0.95);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 1.0);
    osc2.stop(now + 1.0);

    return () => {
      try {
        osc1.stop();
        osc2.stop();
        gain.disconnect();
      } catch {}
    };
  }

  public playConnectChime() {
    if (!this.soundEnabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.25); // A5

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.3); // D6

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.03);
    osc1.stop(now + 0.6);
    osc2.stop(now + 0.6);
  }

  public playToggleClick(isOn: boolean) {
    if (!this.soundEnabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const targetFreq = isOn ? 740 : 490;
    osc.frequency.setValueAtTime(isOn ? 520 : 660, now);
    osc.frequency.exponentialRampToValueAtTime(targetFreq, now + 0.06);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playInterruptionChirp() {
    if (!this.soundEnabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.07);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playEndCallChime() {
    if (!this.soundEnabled) return;
    this.stopSpeaking();
    this.stopMicrophoneCapture();
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(330, now + 0.35);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.45);
  }
}

export const luxuryAudio = new LuxuryAudioSynthesizer();
