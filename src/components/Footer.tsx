import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="relative z-20 w-full max-w-7xl mx-auto px-6 sm:px-8 pb-5 pt-3 flex items-center justify-between text-[10px] tracking-[0.25em] text-zinc-500 font-light uppercase select-none pointer-events-none">
      {/* Bottom left */}
      <div className="flex flex-col text-left">
        <span className="text-zinc-400 font-normal">Aura Skincare</span>
        <span className="text-zinc-500 text-[9px] tracking-[0.3em]">AI Assistant</span>
      </div>

      {/* Bottom right */}
      <div className="text-right tracking-[0.35em] text-zinc-400/80">
        Organic / Pure / You
      </div>
    </footer>
  );
};
