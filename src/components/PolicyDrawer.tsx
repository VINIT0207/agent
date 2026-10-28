import React from 'react';
import { ShieldCheck, Leaf, Sparkles, Award, Check, X } from 'lucide-react';

interface PolicyDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PolicyDrawer: React.FC<PolicyDrawerProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const policies = [
    {
      title: '100% Certified Organic Extraction',
      description: 'Zero chemical solvents, zero parabens, zero synthetic fragrance. Certified COSMOS Organic standard.',
      icon: Leaf,
    },
    {
      title: 'Zero Thermal Oxidation Cold-Pressing',
      description: 'Extracted at sub-room temperatures under nitrogen blanket to preserve 99.4% active antioxidant potency.',
      icon: Sparkles,
    },
    {
      title: 'Clinical Efficacy & EWG Verified',
      description: 'Each formulation undergoes triple-blind barrier restoration clinical testing and strict EWG health validation.',
      icon: Award,
    },
    {
      title: 'Carbon-Negative Shipping & Packaging',
      description: '100% infinitely recyclable ultraviolet glass containers with mycelium bio-protective shipping.',
      icon: ShieldCheck,
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AURA Brand Policy & Standards"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none"
    >
      <div className="relative w-full max-w-lg bg-[#0b1416] border border-emerald-500/30 rounded-2xl p-6 shadow-[0_16px_48px_rgba(0,0,0,0.8),0_0_30px_rgba(16,185,129,0.15)] text-zinc-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-400/20 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white tracking-wide">
                  Brand Policy & Purity Standard
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Verified
                </span>
              </div>
              <p className="text-xs text-emerald-200/60 font-light">
                COSMOS Organic & Clinical Clean Certification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Policy list */}
        <div className="my-5 space-y-3">
          {policies.map((p, idx) => {
            const Icon = p.icon;
            return (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-[#060c0e] border border-white/5 flex items-start gap-3"
              >
                <div className="p-1.5 rounded-lg bg-emerald-950/40 text-emerald-400 mt-0.5">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-white tracking-wide">
                      {p.title}
                    </p>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <p className="text-[11px] text-zinc-400 font-light mt-1 leading-relaxed">
                    {p.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between pt-3 border-t border-white/10">
          <span className="text-[11px] text-zinc-500 font-mono">
            Cert ID: AUR-2026-BIO-VERIFIED
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium tracking-wide shadow-[0_0_12px_rgba(16,185,129,0.4)] transition-all cursor-pointer"
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
};
