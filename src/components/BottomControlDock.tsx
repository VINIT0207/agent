import React from 'react';
import { PhoneOff, PhoneCall, Mic, MicOff, Activity, Box, RotateCcw } from 'lucide-react';

interface BottomControlDockProps {
  interruptionEnabled: boolean;
  onToggleInterruption: () => void;
  callActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenTestOrders: () => void;
  onEndCall: () => void;
  onRestartCall: () => void;
  onManualSpeak: () => void;
}

export const BottomControlDock: React.FC<BottomControlDockProps> = ({
  interruptionEnabled,
  onToggleInterruption,
  callActive,
  isMuted,
  onToggleMute,
  onOpenTestOrders,
  onEndCall,
  onRestartCall,
  onManualSpeak,
}) => {
  return (
    <nav
      aria-label="Call controls"
      className="relative z-30 flex items-center justify-center px-4 select-none"
    >
      <div className="relative flex items-center gap-2 sm:gap-4 bg-[#081215]/90 backdrop-blur-xl border border-cyan-500/25 rounded-full px-3 sm:px-6 py-2 sm:py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.8),0_0_24px_rgba(6,182,212,0.14)]">
        {/* Subtle glass reflection highlight on top rim */}
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent pointer-events-none" />

        {callActive ? (
          <>
            {/* 1. MUTE / UNMUTE BUTTON */}
            <button
              onClick={onToggleMute}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all cursor-pointer group ${
                isMuted
                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
                  : 'bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10'
              }`}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? (
                <MicOff className="w-4 h-4 text-rose-400" />
              ) : (
                <Mic className="w-4 h-4 text-emerald-400 group-hover:text-emerald-300" />
              )}
              <span className="text-xs font-medium hidden sm:inline">
                {isMuted ? 'Muted' : 'Mic On'}
              </span>
            </button>

            {/* 2. VOICE INTERRUPTION (BARGE-IN) */}
            <div className="flex items-center gap-2 pl-1 pr-2">
              <button
                onClick={onManualSpeak}
                className="flex items-center gap-2 group cursor-pointer text-left"
                title="Tap to speak or barge in"
                aria-label="Tap to speak"
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                    interruptionEnabled
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-400/30 group-hover:border-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                      : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                  }`}
                >
                  <Activity
                    className={`w-3.5 h-3.5 ${
                      interruptionEnabled ? 'animate-pulse' : ''
                    }`}
                  />
                </div>
                <div className="flex flex-col hidden sm:flex">
                  <span className="text-xs font-medium text-white tracking-wide group-hover:text-cyan-200 transition-colors">
                    Barge-in
                  </span>
                  <span className="text-[9px] text-cyan-200/60 font-light">
                    {interruptionEnabled ? 'Active' : 'Off'}
                  </span>
                </div>
              </button>

              <button
                type="button"
                role="switch"
                aria-checked={interruptionEnabled}
                aria-label="Toggle voice interruption feature"
                onClick={onToggleInterruption}
                className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  interruptionEnabled ? 'bg-cyan-500' : 'bg-zinc-800'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    interruptionEnabled ? 'translate-x-3' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 3. TEST ORDERS QUICK BUTTON (Moved out of center UI) */}
            <button
              onClick={onOpenTestOrders}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-500/30 text-cyan-300 text-xs font-medium transition-colors cursor-pointer group"
              title="Open Mock Database Orders & Test Scenarios"
            >
              <Box className="w-3.5 h-3.5 text-cyan-400 group-hover:rotate-12 transition-transform" />
              <span>Test Orders</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-200 font-mono">
                3
              </span>
            </button>

            {/* VERTICAL DIVIDER */}
            <div className="h-6 w-px bg-white/15" />

            {/* 4. RED PHONE END CALL BUTTON */}
            <button
              onClick={onEndCall}
              className="flex items-center gap-2 bg-[#dc2626] hover:bg-[#ef4444] active:bg-[#b91c1c] text-white px-4 sm:px-5 py-2 rounded-full font-medium text-xs sm:text-sm tracking-wide shadow-[0_4px_16px_rgba(220,38,38,0.5)] transition-all cursor-pointer group hover:scale-[1.03] active:scale-[0.98]"
              aria-label="End active voice call"
            >
              <PhoneOff className="w-4 h-4 transition-transform group-hover:rotate-12" />
              <span>End Call</span>
            </button>
          </>
        ) : (
          /* Call Not Active / Reconnect */
          <div className="flex items-center gap-3 py-1">
            <button
              onClick={onOpenTestOrders}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
            >
              <Box className="w-3.5 h-3.5 text-cyan-400" />
              <span>Test Orders</span>
            </button>
            <button
              onClick={onRestartCall}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black px-5 py-2 rounded-full font-semibold text-xs sm:text-sm tracking-wide shadow-[0_4px_20px_rgba(16,185,129,0.35)] transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              aria-label="Start call with Aria"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Call Aria (Aura Skincare)</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};
