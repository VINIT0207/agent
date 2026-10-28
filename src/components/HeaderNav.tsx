import React from 'react';
import { Box, ShieldCheck, Leaf } from 'lucide-react';

interface HeaderNavProps {
  onOpenOrderModal: () => void;
  onOpenPolicyModal: () => void;
  onOpenModelModal: () => void;
  isCustomModelLoaded: boolean;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  onOpenOrderModal,
  onOpenPolicyModal,
  onOpenModelModal,
  isCustomModelLoaded,
}) => {
  return (
    <header className="relative z-30 w-full max-w-7xl mx-auto pt-6 px-4 sm:px-8 flex flex-col md:flex-row items-center justify-between gap-4 select-none">
      {/* TOP LEFT: STATUS NAVIGATION */}
      <div className="flex items-center">
        <div className="flex items-center gap-2 sm:gap-3 bg-[#0c1214]/75 backdrop-blur-md border border-cyan-500/20 rounded-full px-4 py-2 text-xs shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
            </span>
            <span className="text-white font-medium tracking-wide">Live Assistant</span>
            <span className="text-emerald-400/90 font-mono text-[11px] font-medium">Online</span>
          </div>

          <div className="h-3 w-px bg-white/15" />

          {/* Test Orders Button */}
          <button
            onClick={onOpenOrderModal}
            className="flex items-center gap-1.5 text-zinc-300 hover:text-white transition-colors cursor-pointer group"
            title="Inspect mock database test orders and evaluation scenarios"
            aria-label="View test orders and prompts"
          >
            <Box className="w-3.5 h-3.5 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
            <span className="font-normal tracking-wide group-hover:underline underline-offset-4 decoration-cyan-500/40">
              Test Orders
            </span>
            <span className="inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
            <span className="text-emerald-400/90 font-mono text-[10px]">3 Available</span>
          </button>
        </div>
      </div>

      {/* TOP CENTER: BRAND */}
      <div className="text-center order-first md:order-none">
        <h1 className="text-xl sm:text-2xl font-light tracking-[0.4em] text-white font-serif uppercase">
          AURA
        </h1>
        <p className="text-[10px] tracking-[0.55em] text-cyan-200/60 font-light uppercase mt-0.5">
          SKINCARE
        </p>
      </div>

      {/* TOP RIGHT: BRAND POLICY */}
      <div className="flex items-center">
        <div className="flex items-center gap-2 sm:gap-3 bg-[#0c1214]/75 backdrop-blur-md border border-cyan-500/20 rounded-full px-4 py-2 text-xs shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
          {/* Brand Policy */}
          <button
            onClick={onOpenPolicyModal}
            className="flex items-center gap-1.5 text-zinc-300 hover:text-white transition-colors cursor-pointer group"
            title="Inspect Brand Organic & Purity Policies"
            aria-label="View Brand Policy specifications"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400/90 group-hover:text-emerald-300" />
            <span className="font-medium tracking-wide group-hover:underline underline-offset-4 decoration-emerald-500/40">
              Brand Policy
            </span>
            <span className="inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
            <span className="text-emerald-400/90 text-[10px]">Verified</span>
          </button>

          <div className="h-3 w-px bg-white/15" />

          {/* Pure Ingredients */}
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Leaf className="w-3.5 h-3.5 text-cyan-400/80" />
            <span className="font-light tracking-wide text-[11px] text-zinc-300">Pure Ingredients</span>
            <span className="hidden sm:inline text-white/20">•</span>
            <span className="hidden sm:inline text-zinc-400 text-[11px]">Real Results</span>
          </div>

          <div className="h-3 w-px bg-white/15" />

          {/* 3D Asset Config link */}
          <button
            onClick={onOpenModelModal}
            className="flex items-center gap-1 text-[11px] text-cyan-300/80 hover:text-cyan-200 transition-colors cursor-pointer"
            title="Inspect 3D Blender Model Integration"
            aria-label="Inspect 3D Model Asset configuration"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isCustomModelLoaded ? 'bg-cyan-400 shadow-[0_0_6px_#22d3ee]' : 'bg-amber-400/90'
              }`}
            />
            <span className="font-mono text-[10px]">3D</span>
          </button>
        </div>
      </div>
    </header>
  );
};
