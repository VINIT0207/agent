import React from 'react';
import { AssistantState } from '../types/assistant';
import { getStatusText } from '../utils/dialogueFlow';

interface VoiceStatusPillProps {
  assistantState: AssistantState;
  callActive: boolean;
  callDuration: number;
  isMuted?: boolean;
  onPillClick?: () => void;
}

export const VoiceStatusPill: React.FC<VoiceStatusPillProps> = ({
  assistantState,
  callActive,
  callDuration,
  isMuted = false,
  onPillClick,
}) => {
  const statusText = getStatusText(assistantState);

  const isSpeaking = assistantState === 'speaking';
  const isListening = assistantState === 'listening';
  const isThinking = assistantState === 'thinking';
  const isEnded = assistantState === 'ended' || !callActive;

  // Format call duration MM:SS
  const mins = Math.floor(callDuration / 60);
  const secs = callDuration % 60;
  const formattedDuration = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <div className="relative flex items-center justify-center select-none z-20 h-11 shrink-0">
      <button
        onClick={onPillClick}
        disabled={isEnded}
        type="button"
        aria-live="polite"
        aria-label={`Assistant status: ${statusText}`}
        className={`group relative flex items-center gap-3 px-5 h-11 rounded-full transition-colors duration-200 shrink-0 ${
          isEnded
            ? 'bg-[#121617]/80 border border-zinc-700/40 text-zinc-400 cursor-default'
            : 'bg-[#081518]/90 backdrop-blur-md border border-cyan-400/40 hover:border-cyan-300 text-white shadow-[0_0_24px_rgba(6,182,212,0.22)] cursor-pointer'
        }`}
      >
        {/* Outer subtle glow */}
        {!isEnded && (
          <span className="absolute -inset-0.5 rounded-full bg-cyan-400/15 blur-sm pointer-events-none transition-opacity group-hover:opacity-100" />
        )}

        {/* Rock-solid, fixed-dimension audio visualizer (Zero DOM resize / zero vibration) */}
        <div className="relative flex items-center justify-center gap-[3px] h-4 w-6 overflow-hidden shrink-0" aria-hidden="true">
          {isListening && !isMuted ? (
            <>
              <span className="w-[2.5px] rounded-full bg-emerald-400 h-2.5 animate-[pulse_0.8s_ease-in-out_infinite]" />
              <span className="w-[2.5px] rounded-full bg-emerald-300 h-3.5 animate-[pulse_0.5s_ease-in-out_infinite] shadow-[0_0_6px_#10b981]" />
              <span className="w-[2.5px] rounded-full bg-emerald-400 h-2 animate-[pulse_0.7s_ease-in-out_infinite]" />
              <span className="w-[2.5px] rounded-full bg-emerald-500 h-3 animate-[pulse_0.9s_ease-in-out_infinite]" />
            </>
          ) : isSpeaking ? (
            <>
              <span className="w-[2.5px] rounded-full bg-cyan-300 h-3 animate-[pulse_0.6s_ease-in-out_infinite]" />
              <span className="w-[2.5px] rounded-full bg-cyan-200 h-4 animate-[pulse_0.45s_ease-in-out_infinite] shadow-[0_0_6px_#22d3ee]" />
              <span className="w-[2.5px] rounded-full bg-cyan-400 h-2.5 animate-[pulse_0.75s_ease-in-out_infinite]" />
              <span className="w-[2.5px] rounded-full bg-cyan-300 h-3.5 animate-[pulse_0.5s_ease-in-out_infinite]" />
            </>
          ) : isThinking ? (
            <>
              <span className="w-[2.5px] rounded-full bg-indigo-300 h-2 animate-[pulse_0.9s_ease-in-out_infinite]" />
              <span className="w-[2.5px] rounded-full bg-indigo-400 h-3.5 animate-[pulse_0.7s_ease-in-out_infinite]" />
              <span className="w-[2.5px] rounded-full bg-indigo-300 h-2 animate-[pulse_1.1s_ease-in-out_infinite]" />
            </>
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
          )}
        </div>

        {/* Status text with fixed typography */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs sm:text-sm font-medium tracking-wide text-zinc-100 whitespace-nowrap">
            {isMuted ? 'Microphone Muted' : statusText}
          </span>
          {callActive && !isEnded && (
            <span className="text-[11px] font-mono text-cyan-300/90 bg-cyan-950/70 px-2 py-0.5 rounded-full border border-cyan-500/25 whitespace-nowrap">
              {formattedDuration}
            </span>
          )}
        </div>

        {/* Live indicator dot */}
        <span
          className={`h-2 w-2 rounded-full shrink-0 ${
            isEnded
              ? 'bg-zinc-600'
              : isSpeaking
              ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse'
              : isListening
              ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
              : 'bg-indigo-400'
          }`}
        />
      </button>
    </div>
  );
};
