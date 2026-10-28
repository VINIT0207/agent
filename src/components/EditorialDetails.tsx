import React from 'react';
import { Leaf, FlaskConical, Heart } from 'lucide-react';

export const EditorialDetails: React.FC = () => {
  return (
    <>
      {/* LEFT EDITORIAL DETAILS (Subtle text around the orb on wide screens) */}
      <aside
        aria-label="Brand Philosophy"
        className="hidden md:flex flex-col items-start absolute left-6 lg:left-14 top-1/2 -translate-y-1/2 z-20 pointer-events-none select-none max-w-[180px]"
      >
        <div className="w-8 h-px bg-gradient-to-r from-cyan-400/40 to-transparent mb-4" />
        <p className="text-[10px] tracking-[0.3em] font-light text-cyan-200/50 uppercase leading-relaxed font-sans">
          Natural Care
        </p>
        <p className="text-[10px] tracking-[0.3em] font-light text-cyan-200/50 uppercase leading-relaxed font-sans">
          For Your
        </p>
        <p className="text-[11px] tracking-[0.35em] font-medium text-white/90 uppercase leading-relaxed font-sans mt-0.5">
          Radiant Self
        </p>
        <div className="w-12 h-px bg-gradient-to-r from-white/20 to-transparent mt-4" />
        <span className="text-[9px] font-mono tracking-widest text-zinc-500 mt-2">EST. 2024</span>
      </aside>

      {/* RIGHT EDITORIAL DETAILS (Three vertically arranged icon-and-text groups) */}
      <aside
        aria-label="Core Pillars"
        className="hidden md:flex flex-col items-end gap-6 absolute right-6 lg:right-14 top-1/2 -translate-y-1/2 z-20 pointer-events-none select-none"
      >
        {/* Leaf — ORGANIC INGREDIENTS */}
        <div className="flex items-center gap-3 text-right">
          <div className="flex flex-col">
            <span className="text-[10px] tracking-[0.25em] font-medium text-white/90 uppercase">
              Organic Ingredients
            </span>
            <span className="text-[9px] tracking-wider text-cyan-300/40 uppercase font-light">
              100% Certified
            </span>
          </div>
          <div className="w-7 h-7 rounded-full border border-cyan-500/20 bg-[#091316]/60 backdrop-blur-sm flex items-center justify-center text-cyan-400">
            <Leaf className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Flask — SCIENCE BACKED */}
        <div className="flex items-center gap-3 text-right">
          <div className="flex flex-col">
            <span className="text-[10px] tracking-[0.25em] font-medium text-white/90 uppercase">
              Science Backed
            </span>
            <span className="text-[9px] tracking-wider text-cyan-300/40 uppercase font-light">
              Clinical Bio-Actives
            </span>
          </div>
          <div className="w-7 h-7 rounded-full border border-cyan-500/20 bg-[#091316]/60 backdrop-blur-sm flex items-center justify-center text-cyan-400">
            <FlaskConical className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Heart — HEALTHY SKIN */}
        <div className="flex items-center gap-3 text-right">
          <div className="flex flex-col">
            <span className="text-[10px] tracking-[0.25em] font-medium text-white/90 uppercase">
              Healthy Skin
            </span>
            <span className="text-[9px] tracking-wider text-cyan-300/40 uppercase font-light">
              Barrier Restoration
            </span>
          </div>
          <div className="w-7 h-7 rounded-full border border-cyan-500/20 bg-[#091316]/60 backdrop-blur-sm flex items-center justify-center text-cyan-400">
            <Heart className="w-3.5 h-3.5" />
          </div>
        </div>
      </aside>
    </>
  );
};
