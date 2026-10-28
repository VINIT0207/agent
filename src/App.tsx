/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HeaderNav } from './components/HeaderNav';
import { EditorialDetails } from './components/EditorialDetails';
import { AuraOrbCanvas } from './components/AuraOrbCanvas';
import { VoiceStatusPill } from './components/VoiceStatusPill';
import { BottomControlDock } from './components/BottomControlDock';
import { Footer } from './components/Footer';
import { ModelUploadModal } from './components/ModelUploadModal';
import { PolicyDrawer } from './components/PolicyDrawer';
import { TestOrdersModal } from './components/TestOrdersModal';
import { PostCallSummaryModal } from './components/PostCallSummaryModal';
import { MicrophonePermissionPrompt } from './components/MicrophonePermissionPrompt';

import { AssistantState, ModelAssetStatus, TranscriptItem, PostCallSummary } from './types/assistant';
import { luxuryAudio } from './services/audioSynthesizer';
import { voiceAssistant } from './services/voiceAssistantService';
import { processAuraCustomerQuery, generateCallOutcomeSummary } from './services/auraAgentEngine';
import { Sparkles, FileText, PhoneCall, Send, Mic } from 'lucide-react';

export default function App() {
  const [callActive, setCallActive] = useState<boolean>(true);
  const [assistantState, setAssistantState] = useState<AssistantState>('speaking');
  const [interruptionEnabled, setInterruptionEnabled] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [callDuration, setCallDuration] = useState<number>(1);
  const [micPermissionState, setMicPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt');

  // Transcript & Dialogue State
  const [transcript, setTranscript] = useState<TranscriptItem[]>([
    {
      id: 'init-1',
      speaker: 'aria',
      text: "Namaste! Welcome to Aura Skincare. I'm Aria, your customer support specialist. How can I assist you with your order, shipping, or returns today?",
      timestamp: '00:01',
    },
  ]);

  const [currentSubtitle, setCurrentSubtitle] = useState<{
    speaker: 'customer' | 'aria';
    text: string;
  }>({
    speaker: 'aria',
    text: "Namaste! Welcome to Aura Skincare. I'm Aria, your customer support specialist. How can I assist you with your order, shipping, or returns today?",
  });

  const [interimUserSpeech, setInterimUserSpeech] = useState<string>('');
  const [typedInput, setTypedInput] = useState<string>('');
  const [lastToolExecution, setLastToolExecution] = useState<{
    name: string;
    args: any;
    result: any;
  } | null>(null);

  // Summary & Modals
  const [postCallSummary, setPostCallSummary] = useState<PostCallSummary | null>(null);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [isTestOrdersModalOpen, setIsTestOrdersModalOpen] = useState(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);

  const [modelStatus, setModelStatus] = useState<ModelAssetStatus>({
    loaded: false,
    source: 'standin-procedural',
  });
  const [externalGlbFile, setExternalGlbFile] = useState<File | null>(null);

  const transcriptRef = useRef<TranscriptItem[]>(transcript);
  transcriptRef.current = transcript;

  const isQueryProcessingRef = useRef<boolean>(false);
  const lastProcessedQueryRef = useRef<{ text: string; time: number }>({ text: '', time: 0 });

  // Query browser permissions on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator?.permissions?.query) {
      navigator.permissions
        .query({ name: 'microphone' as any })
        .then((permissionStatus) => {
          setMicPermissionState(permissionStatus.state as 'prompt' | 'granted' | 'denied');
          permissionStatus.onchange = () => {
            setMicPermissionState(permissionStatus.state as 'prompt' | 'granted' | 'denied');
          };
        })
        .catch(() => {});
    }
  }, []);

  // Call duration timer
  useEffect(() => {
    if (!callActive) return;
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [callActive]);

  // Request explicit microphone permission from user
  const handleRequestMicrophone = useCallback(async (): Promise<boolean> => {
    try {
      luxuryAudio.initCtx();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (stream) {
        setMicPermissionState('granted');
        startListeningLoop();
        return true;
      }
      return false;
    } catch {
      setMicPermissionState('denied');
      return false;
    }
  }, []);

  // Dispatch customer query to backend / Gemini / fallback CX engine
  const handleCustomerQuery = useCallback(async (queryText: string) => {
    const raw = queryText.trim();
    if (!raw) return;
    const text = voiceAssistant.normalizeSpokenText(raw);

    const now = Date.now();
    // Guard 1: Deduplicate identical query fired within 2200ms
    if (
      lastProcessedQueryRef.current.text.toLowerCase() === text.toLowerCase() &&
      now - lastProcessedQueryRef.current.time < 2200
    ) {
      return;
    }

    // Guard 2: Prevent concurrent overlapping queries
    if (isQueryProcessingRef.current) {
      return;
    }
    isQueryProcessingRef.current = true;
    lastProcessedQueryRef.current = { text, time: now };

    // Add user turn to transcript
    const userTimestamp = new Date().toLocaleTimeString([], { minute: '2-digit', second: '2-digit' });
    const userItem: TranscriptItem = {
      id: `user-${Date.now()}`,
      speaker: 'customer',
      text,
      timestamp: userTimestamp,
    };

    const currentHistory = [...transcriptRef.current, userItem];
    setTranscript(currentHistory);
    setCurrentSubtitle({ speaker: 'customer', text });
    setInterimUserSpeech('');
    setTypedInput('');
    setAssistantState('thinking');

    try {
      // Send to server-side endpoint (Gemini Flash + tool calling) with conversation history
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: currentHistory.map((t) => ({
            role: t.speaker === 'customer' ? 'user' : 'assistant',
            content: t.text,
          })),
        }),
      });

      if (!res.ok) throw new Error('API request failed');
      const data = await res.json();

      handleAriaReply(data.reply, data.toolCall);
    } catch {
      // Reliable deterministic CX engine fallback
      const localResult = processAuraCustomerQuery(text, currentHistory.map((t) => ({
        role: t.speaker === 'customer' ? 'user' : 'assistant',
        content: t.text,
      })));
      handleAriaReply(localResult.reply, localResult.toolCall);
    } finally {
      isQueryProcessingRef.current = false;
    }
  }, []);

  // Start continuous listening loop
  const startListeningLoop = useCallback(async () => {
    if (isMuted) return;
    const ok = await voiceAssistant.startListening({
      onTranscriptInterim: (interim) => {
        setInterimUserSpeech(interim);
      },
      onTranscriptFinal: (final) => {
        setInterimUserSpeech('');
        handleCustomerQuery(final);
      },
      onSpeechStarted: () => {
        if (interruptionEnabled) {
          setAssistantState('listening');
        }
      },
      onAssistantSpeechEnd: () => {
        setAssistantState('listening');
      },
      onError: (err) => {
        console.warn('Voice recognition notice:', err);
        if (err.includes('denied') || err.includes('not-allowed')) {
          setMicPermissionState('denied');
        }
      },
    });
    if (ok) {
      setMicPermissionState('granted');
    }
  }, [handleCustomerQuery, interruptionEnabled, isMuted]);

  // Ensure speech recognition is running whenever call is active and assistant is ready to listen
  useEffect(() => {
    if (callActive && assistantState === 'listening' && !isMuted) {
      startListeningLoop();
    }
  }, [callActive, assistantState, isMuted, startListeningLoop]);

  const handleAriaReply = useCallback((replyText: string, toolCall?: any) => {
    const ariaTimestamp = new Date().toLocaleTimeString([], { minute: '2-digit', second: '2-digit' });
    const ariaItem: TranscriptItem = {
      id: `aria-${Date.now()}`,
      speaker: 'aria',
      text: replyText,
      timestamp: ariaTimestamp,
      toolCall,
    };

    if (toolCall) {
      setLastToolExecution(toolCall);
    }

    setTranscript((prev) => [...prev, ariaItem]);
    setCurrentSubtitle({ speaker: 'aria', text: replyText });
    setAssistantState('speaking');

    // Speak using Indian English voice preference
    voiceAssistant.speak(replyText, () => {
      setAssistantState('listening');
      startListeningLoop();
    });
  }, [startListeningLoop]);

  // Initial call startup on user first interaction or call trigger
  const handleStartCall = useCallback(async () => {
    luxuryAudio.initCtx();
    // Proactively request mic stream on user click gesture if not already granted
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        setMicPermissionState('granted');
      }
    } catch {}

    const stopRing = luxuryAudio.playPhoneRingTone();
    setCallActive(true);
    setCallDuration(0);
    setAssistantState('speaking');

    const greeting =
      "Namaste! Welcome to Aura Skincare. I'm Aria, your customer support specialist. How can I assist you with your order, shipping, or returns today?";
    const initialItem: TranscriptItem = {
      id: `aria-${Date.now()}`,
      speaker: 'aria',
      text: greeting,
      timestamp: '00:01',
    };

    setTranscript([initialItem]);
    setCurrentSubtitle({ speaker: 'aria', text: greeting });
    setLastToolExecution(null);
    setPostCallSummary(null);

    // After 900ms ringback, Aria answers
    setTimeout(() => {
      stopRing();
      luxuryAudio.playConnectChime();
      voiceAssistant.speak(greeting, () => {
        setAssistantState('listening');
        startListeningLoop();
      });
    }, 950);
  }, [startListeningLoop]);

  // End Call & Generate Summary
  const handleEndCall = useCallback(async () => {
    voiceAssistant.stopSpeaking();
    voiceAssistant.stopListening();
    luxuryAudio.playEndCallChime();
    setCallActive(false);
    setAssistantState('ended');

    // Request structured post-call summary
    try {
      const res = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: transcriptRef.current }),
      });
      if (res.ok) {
        const data = await res.json();
        setPostCallSummary(data);
      } else {
        setPostCallSummary(generateCallOutcomeSummary(transcriptRef.current));
      }
    } catch {
      setPostCallSummary(generateCallOutcomeSummary(transcriptRef.current));
    }

    setIsSummaryModalOpen(true);
  }, []);

  // Toggle Microphone Mute
  const handleToggleMute = () => {
    if (micPermissionState !== 'granted') {
      handleRequestMicrophone();
      return;
    }
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    luxuryAudio.playToggleClick(!nextMuted);
    if (nextMuted) {
      voiceAssistant.stopListening();
    } else {
      startListeningLoop();
    }
  };

  // Toggle Voice Interruption
  const handleToggleInterruption = () => {
    const nextVal = !interruptionEnabled;
    luxuryAudio.playToggleClick(nextVal);
    setInterruptionEnabled(nextVal);
  };

  // Manual speak click / tap-to-talk
  const handleManualSpeak = () => {
    if (!callActive) {
      handleStartCall();
      return;
    }
    if (micPermissionState !== 'granted') {
      handleRequestMicrophone();
      return;
    }
    luxuryAudio.playInterruptionChirp();
    if (assistantState === 'speaking') {
      voiceAssistant.stopSpeaking();
      setAssistantState('listening');
      startListeningLoop();
    } else {
      startListeningLoop();
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#030607] text-zinc-100 flex flex-col justify-between overflow-x-hidden font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* LUXURY RADIAL AMBIENT BACKGROUND */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 38%, rgba(6, 182, 212, 0.08) 0%, rgba(15, 23, 42, 0.45) 45%, #030607 85%)',
        }}
      />

      {/* HEADER NAVIGATION */}
      <HeaderNav
        onOpenOrderModal={() => setIsTestOrdersModalOpen(true)}
        onOpenPolicyModal={() => setIsPolicyModalOpen(true)}
        onOpenModelModal={() => setIsModelModalOpen(true)}
        isCustomModelLoaded={modelStatus.loaded}
      />

      {/* MAIN VIEWPORT: EDITORIAL CONTENT & 3D PARTICLE ORB */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-between w-full max-w-7xl mx-auto px-4 sm:px-8 py-1">
        <EditorialDetails />

        {/* 3D PARTICLE SPHERE VISUALIZER (Positioned so header aligns just above the orb) */}
        <div className="relative w-full max-w-2xl h-[320px] sm:h-[360px] flex items-center justify-center shrink-0 mt-3 sm:mt-4 mb-1">
          <AuraOrbCanvas
            assistantState={assistantState}
            onModelStatusChange={setModelStatus}
            externalGlbFile={externalGlbFile}
          />
        </div>

        {/* VOICE CALL STATUS & WAVEFORM PILL (Fixed height) */}
        <div className="flex flex-col items-center gap-1 z-20 shrink-0">
          <VoiceStatusPill
            assistantState={assistantState}
            callActive={callActive}
            callDuration={callDuration}
            isMuted={isMuted}
            onPillClick={handleManualSpeak}
          />
        </div>

        {/* LIVE SPOKEN SUBTITLES / TRANSCRIPT BUBBLE */}
        <div className="text-center max-w-2xl px-4 z-20 min-h-[52px] flex flex-col items-center justify-center shrink-0">
          {callActive ? (
            <div className="space-y-1">
              {/* Speaker Indicator */}
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/5 border border-white/10 text-[11px] text-zinc-400">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="font-medium text-zinc-300">
                  {currentSubtitle.speaker === 'aria' ? 'Aria • Aura Skincare Specialist' : 'You (Customer)'}
                </span>
              </div>

              {/* Spoken text */}
              <div className="min-h-[38px] flex items-center justify-center">
                <p className="text-sm sm:text-base font-light text-white/95 leading-relaxed tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
                  {interimUserSpeech ? (
                    <span className="text-amber-300 animate-pulse italic">
                      "{interimUserSpeech}..."
                    </span>
                  ) : (
                    `"${currentSubtitle.text}"`
                  )}
                </p>
              </div>

              {/* Tool Execution Badge */}
              {lastToolExecution && (
                <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-800/60 text-[10px] font-mono text-cyan-300">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span>Tool executed: {lastToolExecution.name}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-[#091214]/85 backdrop-blur-md border border-cyan-500/20 max-w-md mx-auto shadow-2xl">
              <p className="text-[11px] uppercase tracking-[0.25em] text-cyan-400 font-medium">
                Call Concluded
              </p>
              <p className="text-xs text-neutral-300 mt-1">
                Your consultation transcript and structured outcome have been recorded.
              </p>
              <div className="mt-2.5 flex items-center justify-center gap-2">
                <button
                  onClick={() => setIsSummaryModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  <span>View Post-Call Summary</span>
                </button>
                <button
                  onClick={handleStartCall}
                  className="px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black text-xs font-semibold shadow-lg shadow-emerald-500/20 flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Start New Call</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* MICROPHONE PERMISSION REQUEST PROMPT (Explicit user gesture) */}
        {callActive && micPermissionState !== 'granted' && (
          <MicrophonePermissionPrompt
            permissionState={micPermissionState}
            onRequestPermission={handleRequestMicrophone}
          />
        )}

        {/* SLEEK TEXT INPUT BAR */}
        <div className="w-full max-w-lg mx-auto mt-2 px-2 z-20 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCustomerQuery(typedInput);
            }}
            className="flex items-center gap-2 bg-[#091316]/75 backdrop-blur-md border border-white/10 hover:border-cyan-500/40 focus-within:border-cyan-500/60 rounded-full px-3 py-1.5 transition-all shadow-lg"
          >
            <Mic className="w-4 h-4 text-cyan-400/80 ml-1 shrink-0" />
            <input
              type="text"
              value={typedInput}
              onChange={(e) => setTypedInput(e.target.value)}
              placeholder="Or type a question (e.g., Where is ORD-101?)..."
              className="flex-1 bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!typedInput.trim()}
              className="p-1.5 rounded-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 text-black transition-all cursor-pointer shrink-0"
              title="Send query"
            >
              <Send className="w-3 h-3" />
            </button>
          </form>
        </div>
      </main>

      {/* BOTTOM PHONE CONTROLS & FOOTER */}
      <div className="flex flex-col gap-1 pt-1 pb-2 shrink-0">
        <BottomControlDock
          interruptionEnabled={interruptionEnabled}
          onToggleInterruption={handleToggleInterruption}
          callActive={callActive}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onOpenTestOrders={() => setIsTestOrdersModalOpen(true)}
          onEndCall={handleEndCall}
          onRestartCall={handleStartCall}
          onManualSpeak={handleManualSpeak}
        />
        <Footer />
      </div>

      {/* TEST ORDERS & EVALUATION MODAL */}
      <TestOrdersModal
        isOpen={isTestOrdersModalOpen}
        onClose={() => setIsTestOrdersModalOpen(false)}
        onSelectQuery={(q) => handleCustomerQuery(q)}
        callActive={callActive}
      />

      {/* POST-CALL SUMMARY MODAL */}
      <PostCallSummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        summary={postCallSummary}
        transcript={transcript}
        onRestartCall={handleStartCall}
      />

      {/* 3D ASSET & POLICY MODALS */}
      <ModelUploadModal
        isOpen={isModelModalOpen}
        onClose={() => setIsModelModalOpen(false)}
        status={modelStatus}
        onFileSelect={(file) => {
          setExternalGlbFile(file);
          luxuryAudio.playConnectChime();
        }}
        onResetToDefault={() => setExternalGlbFile(null)}
      />

      <PolicyDrawer
        isOpen={isPolicyModalOpen}
        onClose={() => setIsPolicyModalOpen(false)}
      />
    </div>
  );
}
