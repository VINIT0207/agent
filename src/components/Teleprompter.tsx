import React from 'react';
import { DialogueItem, AssistantState } from '../types/assistant';
import { ChevronRight, Sparkles, User, Bot } from 'lucide-react';

interface TeleprompterProps {
  currentTurn: DialogueItem;
  assistantState: AssistantState;
  callActive: boolean;
  onNextTurn: () => void;
  onRestart: () => void;
  turnIndex: number;
  totalTurns: number;
}

export const Teleprompter: React.FC<TeleprompterProps> = ({
  currentTurn,
  assistantState,
  callActive,
  onNextTurn,
  onRestart,
  turnIndex,
  totalTurns,
}) => {
  return (
    <div className="relative z-20 w-full max-w-2xl mx-auto px-4 text-center mt-3 select-none">
      {callActive ? (
        <div className="space-y-3">
          {/* Subtle Speaker tag */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-[0.25em] text-cyan-300/70">
            {currentTurn.speaker === 'aria' ? (
              <>
                <Bot className="w-3 h-3 text-cyan-400" />
                <span>Aria • Formulation Specialist</span>
              </>
            ) : (
              <>
                <User className="w-3 h-3 text-emerald-400" />
                <span>Elena • Verified Client</span>
              </>
            )}
          </div>

          {/* Subtitle Transcript Text */}
          <div className="min-h-[58px] sm:min-h-[72px] flex items-center justify-center">
            <p className="text-base sm:text-lg lg:text-[19px] font-light text-white/95 leading-relaxed tracking-wide transition-all duration-300 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] font-sans">
              "{currentTurn.text}"
            </p>
          </div>

          {/* Turn advance & prompt hints */}
          <div className="flex items-center justify-center gap-3 pt-1">
            <button
              onClick={onNextTurn}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 hover:border-cyan-500/30 text-[11px] text-zinc-300 transition-colors cursor-pointer"
              title="Step to next dialogue turn"
              aria-label="Next dialogue turn"
            >
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Continue Consultation ({turnIndex + 1}/{totalTurns})</span>
              <ChevronRight className="w-3 h-3 text-zinc-400" />
            </button>
          </div>
        </div>
      ) : (
        /* Ended Call State Card */
        <div className="p-5 rounded-2xl bg-[#091214]/80 backdrop-blur-md border border-cyan-500/20 max-w-lg mx-auto shadow-[0_8px_32px_rgba(0,0,0,0.7)] animate-fadeIn">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-400/80 font-medium">
            Session Concluded
          </p>
          <p className="text-sm text-zinc-300 font-light mt-1.5 leading-relaxed">
            Your consultation regarding <span className="text-white font-medium">Order ORD-101</span> and morning application ritual has been saved to your client journal.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={onRestart}
              className="px-4 py-2 rounded-full bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white text-xs font-medium tracking-wide shadow-[0_0_16px_rgba(6,182,212,0.4)] transition-all cursor-pointer"
              aria-label="Reconnect with Aria"
            >
              Start New Session with Aria
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
