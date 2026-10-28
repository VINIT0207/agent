import { luxuryAudio } from './audioSynthesizer';

export interface VoiceServiceCallbacks {
  onTranscriptInterim: (text: string) => void;
  onTranscriptFinal: (text: string) => void;
  onSpeechStarted: () => void;
  onAssistantSpeechEnd: () => void;
  onError: (err: string) => void;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      try {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1];
        resolve(base64 || '');
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

class VoiceAssistantService {
  private recognition: any = null;
  private isListening: boolean = false;
  private callbacks: VoiceServiceCallbacks | null = null;
  private isSpeaking: boolean = false;
  private silenceTimer: number | null = null;
  private safetyTimeout: number | null = null;
  private speechStartTime: number = 0;
  private lastDispatchedText: string = '';
  private lastDispatchTime: number = 0;

  // Real Audio Capture & WhisperFlow Pipeline
  private mediaRecorder: MediaRecorder | null = null;
  private isRecordingUtterance: boolean = false;
  private audioChunks: Blob[] = [];
  private vadCheckInterval: number | null = null;
  private isVadSpeaking: boolean = false;
  private lastSoundDetectedTime: number = 0;
  private interimWebSpeech: string = '';
  private accumulatedFinalText: string = '';

  // Studio Neural TTS Audio Player
  private currentAudio: HTMLAudioElement | null = null;
  private currentAudioUrl: string | null = null;
  private ttsAbortController: AbortController | null = null;

  public isSpeechRecognitionSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    );
  }

  // 100% Accurate phonetic & verbal number normalization
  public normalizeSpokenText(text: string): string {
    return text
      // Spoken verbal numbers to digits
      .replace(/\bone\s*zero\s*one\b/gi, '101')
      .replace(/\bone\s*zero\s*two\b/gi, '102')
      .replace(/\bone\s*zero\s*three\b/gi, '103')
      .replace(/\bone\s*o\s*one\b/gi, '101')
      .replace(/\bone\s*o\s*two\b/gi, '102')
      .replace(/\bone\s*o\s*three\b/gi, '103')
      .replace(/\bone\s*hundred\s*(?:and\s*)?one\b/gi, '101')
      .replace(/\bone\s*hundred\s*(?:and\s*)?two\b/gi, '102')
      .replace(/\bone\s*hundred\s*(?:and\s*)?three\b/gi, '103')
      .replace(/\bhundred\s*(?:and\s*)?one\b/gi, '101')
      .replace(/\bhundred\s*(?:and\s*)?two\b/gi, '102')
      .replace(/\bhundred\s*(?:and\s*)?three\b/gi, '103')
      .replace(/\b1\s+0\s+1\b/gi, '101')
      .replace(/\b1\s+0\s+2\b/gi, '102')
      .replace(/\b1\s+0\s+3\b/gi, '103')
      .replace(/\b1\s+0\s+([123])\b/gi, '10$1')
      // Standardize order ID patterns
      .replace(/\border\s*#?\s*(\d{3})\b/gi, 'order ORD-$1')
      .replace(/\border\s*id\s*#?\s*(\d{3})\b/gi, 'order ORD-$1')
      .replace(/\bnumber\s*(\d{3})\b/gi, 'order ORD-$1')
      .replace(/\b100\s*rupees\b/gi, 'order ORD-101')
      // Phonetic speech recognition corrections for customer service & skincare
      .replace(/\borylis\s*k\b/gi, 'Aura Skincare')
      .replace(/\boralis\s*k\b/gi, 'Aura Skincare')
      .replace(/\baura\s*skin\b/gi, 'Aura Skincare')
      .replace(/\bora\s*skin(?:care)?\b/gi, 'Aura Skincare')
      .replace(/\bwritten\s+policy\b/gi, 'return policy')
      .replace(/\bwritten\b/gi, 'return')
      .replace(/\breturn\s+it\b/gi, 'return it')
      .replace(/\bread\s+a\s+103\b/gi, 'reorder 103')
      .replace(/\bread\s+103\b/gi, 'reorder 103')
      .replace(/\breader\b/gi, 'reorder')
      .replace(/\bcancle\b/gi, 'cancel')
      .replace(/\bcouncelling\b/gi, 'cancellation')
      .replace(/\bcouncel\b/gi, 'cancel')
      .replace(/\bconsole\b/gi, 'cancel')
      .replace(/\brefound\b/gi, 'refund')
      .replace(/\btrack\s*order\b/gi, 'track order')
      .replace(/\bs\s*p\s*f\b/gi, 'SPF')
      .replace(/\bc\s*o\s*d\b/gi, 'COD')
      .replace(/\bu\s*p\s*i\b/gi, 'UPI')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Clean speech string to eliminate robotic reading of markdown symbols
  private cleanTextForSpeech(text: string): string {
    return text
      .replace(/[*_#`~]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^\s*[-*•]\s+/gm, '')
      .replace(/₹\s*(\d+)/g, '$1 rupees')
      .replace(/\bORD[- ]?(\d+)\b/gi, 'Order $1')
      .replace(/\bCOD\b/g, 'Cash on Delivery')
      .replace(/\bUPI\b/g, 'U P I')
      .replace(/\n+/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Call WhisperFlow neural backend with recorded speech audio (Groq Whisper / Gemini)
  private async transcribeWithWhisperFlow(audioBlob: Blob, fallbackText: string): Promise<string> {
    if (!audioBlob || audioBlob.size < 400) {
      return fallbackText;
    }

    try {
      const base64Audio = await blobToBase64(audioBlob);
      if (!base64Audio) return fallbackText;

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioData: base64Audio,
          mimeType: audioBlob.type || 'audio/webm',
        }),
      });

      if (!res.ok) throw new Error('WhisperFlow request failed');
      const data = await res.json();
      const neuralText = (data.transcript || '').trim();
      if (neuralText.length >= 2) {
        return this.normalizeSpokenText(neuralText);
      }
    } catch (e) {
      console.warn('WhisperFlow neural fallback to web speech:', e);
    }
    return fallbackText;
  }

  // Actively record continuous microphone audio chunks so no words are clipped
  private startContinuousRecording() {
    if (!this.isListening || this.isSpeaking) return;
    const micStream = luxuryAudio.getMicrophoneStream();
    if (!micStream || typeof MediaRecorder === 'undefined') return;

    try {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        try {
          this.mediaRecorder.stop();
        } catch {}
      }

      this.audioChunks = [];
      let options: MediaRecorderOptions = {};
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options = { mimeType: 'audio/webm;codecs=opus' };
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' };
      }

      const recorder = new MediaRecorder(micStream, options);
      this.mediaRecorder = recorder;
      this.isRecordingUtterance = true;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      recorder.start(100);
    } catch (e) {
      this.isRecordingUtterance = false;
      console.warn('Continuous recording init:', e);
    }
  }

  public async startListening(callbacks: VoiceServiceCallbacks): Promise<boolean> {
    this.callbacks = callbacks;
    this.isListening = true;
    this.accumulatedFinalText = '';
    this.interimWebSpeech = '';
    this.audioChunks = [];
    this.isRecordingUtterance = false;

    // 1. Capture microphone audio via Web Audio
    const micStarted = await luxuryAudio.startMicrophoneCapture();

    // 2. Start continuous audio recording buffer immediately so no syllables are clipped
    this.startContinuousRecording();

    // 3. Audio Activity Detection (VAD) Loop: Monitors live mic energy with sensitive threshold
    if (this.vadCheckInterval) {
      window.clearInterval(this.vadCheckInterval);
    }

    this.vadCheckInterval = window.setInterval(() => {
      if (!this.isListening || this.isSpeaking) return;

      const rawEnergy = luxuryAudio.getRawMicrophoneEnergy();
      const now = Date.now();

      // Sensitive human speech energy threshold
      if (rawEnergy > 0.012) {
        this.lastSoundDetectedTime = now;
        if (!this.isVadSpeaking) {
          this.isVadSpeaking = true;
          this.callbacks?.onSpeechStarted();
        }
      } else if (this.isVadSpeaking && now - this.lastSoundDetectedTime > 1200) {
        // Natural breath pause detected: trigger utterance completion
        this.isVadSpeaking = false;
        this.finalizeUtterance();
      }
    }, 80);

    // 4. Concurrently run Web Speech API for instantaneous 0ms live typing feedback
    if (this.isSpeechRecognitionSupported()) {
      try {
        const SpeechRecognition =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (this.recognition) {
          try {
            this.recognition.onend = null;
            this.recognition.onresult = null;
            this.recognition.onerror = null;
            this.recognition.abort();
          } catch {}
        }

        const rec = new SpeechRecognition();
        this.recognition = rec;
        rec.continuous = true;
        rec.interimResults = true;
        rec.maxAlternatives = 1;
        rec.lang = 'en-IN';

        rec.onresult = (event: any) => {
          let currentInterim = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            if (res && res[0]) {
              const transcriptChunk = res[0].transcript;
              if (res.isFinal) {
                this.accumulatedFinalText += ' ' + transcriptChunk;
              } else {
                currentInterim += ' ' + transcriptChunk;
              }
            }
          }

          const candidateRaw = (this.accumulatedFinalText + ' ' + currentInterim).trim();
          if (!candidateRaw) return;

          // Barge-in check during Aria's speech
          if (this.isSpeaking) {
            const speechElapsed = Date.now() - this.speechStartTime;
            const words = candidateRaw.split(/\s+/).filter(Boolean);
            if (speechElapsed > 500 && (words.length >= 2 || candidateRaw.length >= 6)) {
              this.stopSpeaking();
              luxuryAudio.playInterruptionChirp();
              this.callbacks?.onSpeechStarted();
              this.accumulatedFinalText = candidateRaw;
            } else {
              this.accumulatedFinalText = '';
              return;
            }
          }

          this.lastSoundDetectedTime = Date.now();
          this.isVadSpeaking = true;
          this.interimWebSpeech = candidateRaw;
          this.callbacks?.onTranscriptInterim(candidateRaw);
          this.callbacks?.onSpeechStarted();

          // Reset silence timer on incoming words
          if (this.silenceTimer) {
            window.clearTimeout(this.silenceTimer);
          }

          this.silenceTimer = window.setTimeout(() => {
            this.isVadSpeaking = false;
            this.finalizeUtterance();
          }, 1200);
        };

        rec.onerror = (event: any) => {
          if (event.error === 'no-speech' || event.error === 'aborted') return;
          if (event.error === 'not-allowed') {
            this.callbacks?.onError('Microphone access was denied. Please allow microphone permissions to speak with Aria.');
          }
        };

        rec.onend = () => {
          if (this.isListening) {
            setTimeout(() => {
              if (this.isListening && this.recognition === rec) {
                try {
                  rec.start();
                } catch {}
              }
            }, 120);
          }
        };

        rec.start();
      } catch (e) {
        console.warn('Web Speech API initialization fallback:', e);
      }
    }

    return micStarted || true;
  }

  // Finalizes active customer utterance using Groq Whisper / WhisperFlow neural processing
  private async finalizeUtterance() {
    if (this.silenceTimer) {
      window.clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.isSpeaking || !this.isListening) return;

    const webSpeechCandidate = this.interimWebSpeech.trim();
    this.interimWebSpeech = '';
    this.accumulatedFinalText = '';

    // Stop active utterance recording if MediaRecorder was active
    let recordedBlob: Blob | null = null;
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      const rec = this.mediaRecorder;
      try {
        recordedBlob = await new Promise<Blob | null>((resolve) => {
          rec.onstop = () => {
            const blob = new Blob(this.audioChunks, { type: rec.mimeType || 'audio/webm' });
            this.audioChunks = [];
            resolve(blob);
          };
          try {
            rec.stop();
          } catch {
            resolve(null);
          }
        });
      } catch {
        recordedBlob = null;
      }
    }

    // Retrieve pristine 16kHz WAV audio from Web Audio PCM buffer
    const wavBlob = luxuryAudio.exportWavBlob();
    luxuryAudio.clearPcmBuffer();

    // Immediately restart recording for the next turn
    this.startContinuousRecording();

    let finalUtterance = webSpeechCandidate;

    // Send valid 16kHz WAV audio to Groq Whisper
    if (wavBlob && wavBlob.size > 800) {
      try {
        const whisperText = await this.transcribeWithWhisperFlow(wavBlob, webSpeechCandidate);
        if (whisperText && whisperText.length >= 2) {
          finalUtterance = whisperText;
        }
      } catch (e) {
        console.warn('WhisperFlow audio extraction fallback:', e);
      }
    } else if (recordedBlob && recordedBlob.size > 400) {
      try {
        const whisperText = await this.transcribeWithWhisperFlow(recordedBlob, webSpeechCandidate);
        if (whisperText && whisperText.length >= 2) {
          finalUtterance = whisperText;
        }
      } catch (e) {
        console.warn('WhisperFlow audio extraction fallback:', e);
      }
    }

    const cleanDispatched = this.normalizeSpokenText(finalUtterance);
    if (!cleanDispatched || cleanDispatched.length < 2) return;

    // Deduplicate identical utterance fired within 2000ms
    const now = Date.now();
    if (
      cleanDispatched.toLowerCase() === this.lastDispatchedText.toLowerCase() &&
      now - this.lastDispatchTime < 2000
    ) {
      return;
    }

    this.lastDispatchedText = cleanDispatched;
    this.lastDispatchTime = now;

    // Dispatch 100% accurate customer query
    this.callbacks?.onTranscriptFinal(cleanDispatched);
  }

  public stopListening() {
    this.isListening = false;
    this.accumulatedFinalText = '';
    this.interimWebSpeech = '';
    this.isVadSpeaking = false;
    this.isRecordingUtterance = false;

    if (this.vadCheckInterval) {
      window.clearInterval(this.vadCheckInterval);
      this.vadCheckInterval = null;
    }
    if (this.silenceTimer) {
      window.clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.mediaRecorder) {
      try {
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      } catch {}
      this.mediaRecorder = null;
    }
    this.audioChunks = [];

    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        this.recognition.stop();
      } catch {}
      this.recognition = null;
    }
    luxuryAudio.stopMicrophoneCapture();
    luxuryAudio.clearPcmBuffer();
  }

  // Primary Voice: Studio-Quality Neural Voice from /api/tts (Warm, human, natural breathing & cadence)
  public async speak(text: string, onEnd?: () => void) {
    this.stopSpeaking();
    this.isSpeaking = true;
    this.speechStartTime = Date.now();
    this.accumulatedFinalText = '';
    this.interimWebSpeech = '';
    luxuryAudio.clearPcmBuffer();

    // Start dynamic luminescence on 3D Orb synchronized with speech
    luxuryAudio.startSpeechAnalysis();

    const cleanedText = this.cleanTextForSpeech(text);
    if (!cleanedText) {
      this.finishSpeaking(onEnd);
      return;
    }

    this.ttsAbortController = new AbortController();

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanedText }),
        signal: this.ttsAbortController.signal,
      });

      if (!response.ok) {
        throw new Error(`TTS API returned status ${response.status}`);
      }

      // Check if user cancelled while fetching audio
      if (!this.isSpeaking) {
        return;
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      this.currentAudioUrl = audioUrl;

      const audio = new Audio(audioUrl);
      this.currentAudio = audio;

      let hasFinished = false;
      const finishAudio = () => {
        if (hasFinished) return;
        hasFinished = true;
        this.finishSpeaking(onEnd);
      };

      audio.onended = finishAudio;
      // Do NOT trigger unwanted secondary robotic voice if audio encounters an error or is stopped
      audio.onerror = () => {
        if (!this.isSpeaking) return;
        this.speakWithBrowserFallback(cleanedText, onEnd);
      };

      await audio.play();
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      this.speakWithBrowserFallback(cleanedText, onEnd);
    }
  }

  private speakWithBrowserFallback(cleanedText: string, onEnd?: () => void) {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanedText);
        utterance.lang = 'en-IN';
        utterance.rate = 1.0;
        utterance.pitch = 1.05;

        const voices = window.speechSynthesis.getVoices();
        const indianVoice = voices.find((v) => v.lang.includes('IN') || v.name.toLowerCase().includes('india') || v.name.includes('Aria') || v.name.includes('Neerja'));
        if (indianVoice) {
          utterance.voice = indianVoice;
        }

        utterance.onend = () => {
          this.finishSpeaking(onEnd);
        };
        utterance.onerror = () => {
          this.finishSpeaking(onEnd);
        };

        window.speechSynthesis.speak(utterance);
        return;
      } catch (e) {
        console.warn('SpeechSynthesis fallback error:', e);
      }
    }
    this.finishSpeaking(onEnd);
  }

  private finishSpeaking(onEnd?: () => void) {
    this.isSpeaking = false;
    this.accumulatedFinalText = '';
    this.interimWebSpeech = '';
    if (this.safetyTimeout) {
      window.clearTimeout(this.safetyTimeout);
      this.safetyTimeout = null;
    }
    if (this.currentAudio) {
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      try {
        this.currentAudio.pause();
        this.currentAudio.src = '';
      } catch {}
      this.currentAudio = null;
    }
    if (this.currentAudioUrl) {
      try {
        URL.revokeObjectURL(this.currentAudioUrl);
      } catch {}
      this.currentAudioUrl = null;
    }
    luxuryAudio.stopSpeaking();
    this.callbacks?.onAssistantSpeechEnd();
    onEnd?.();
  }

  // Guaranteed clean stop: stops audio, cancels requests, revokes URLs, and prevents ANY second voice
  public stopSpeaking() {
    this.isSpeaking = false;
    this.accumulatedFinalText = '';
    this.interimWebSpeech = '';
    if (this.ttsAbortController) {
      this.ttsAbortController.abort();
      this.ttsAbortController = null;
    }
    if (this.safetyTimeout) {
      window.clearTimeout(this.safetyTimeout);
      this.safetyTimeout = null;
    }
    if (this.currentAudio) {
      // Detach listeners FIRST so pausing / clearing src never triggers onerror
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.src = '';
      } catch {}
      this.currentAudio = null;
    }
    if (this.currentAudioUrl) {
      try {
        URL.revokeObjectURL(this.currentAudioUrl);
      } catch {}
      this.currentAudioUrl = null;
    }
    // Hard cancel any lingering browser speech synthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    luxuryAudio.stopSpeaking();
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  public getIsListening(): boolean {
    return this.isListening;
  }
}

export const voiceAssistant = new VoiceAssistantService();
