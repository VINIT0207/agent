import React from 'react';
import { OrderDetails } from '../types/assistant';
import { Package, Truck, CheckCircle2, Droplets, Calendar, X } from 'lucide-react';

interface OrderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderDetails;
}

export const OrderDrawer: React.FC<OrderDrawerProps> = ({ isOpen, onClose, order }) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Active Client Order ORD-101"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none"
    >
      <div className="relative w-full max-w-lg bg-[#0b1416] border border-cyan-500/30 rounded-2xl p-6 shadow-[0_16px_48px_rgba(0,0,0,0.8),0_0_30px_rgba(6,182,212,0.15)] text-zinc-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-400/20 text-emerald-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white tracking-wide">
                  Order {order.id}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {order.status}
                </span>
              </div>
              <p className="text-xs text-cyan-200/60 font-light">Client: {order.customer}</p>
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

        {/* Product Details */}
        <div className="my-5 p-4 rounded-xl bg-[#060c0e] border border-white/5 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-white">{order.product}</p>
              <p className="text-xs text-zinc-400">{order.volume}</p>
            </div>
            <span className="font-mono text-xs text-cyan-300 bg-cyan-950/40 px-2 py-1 rounded border border-cyan-500/20">
              {order.botanicalBatch}
            </span>
          </div>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400">
            <div className="flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-cyan-400" />
              <span>{order.carrier}</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Calendar className="w-3.5 h-3.5" />
              <span>{order.estimatedDelivery}</span>
            </div>
          </div>
        </div>

        {/* Cold-pressed Formulations Ingredients */}
        <div>
          <div className="flex items-center gap-1.5 mb-2.5 text-xs text-cyan-300 font-medium">
            <Droplets className="w-3.5 h-3.5" />
            <span>Active Botanical Ingredients (Cold-Pressed Purity):</span>
          </div>
          <ul className="space-y-1.5 text-xs text-zinc-300 bg-zinc-900/40 p-3 rounded-lg border border-white/5">
            {(order.ingredients || []).map((ing: string, i: number) => (
              <li key={i} className="flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3 text-cyan-400 shrink-0" />
                <span className="font-light">{ing}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between pt-3 border-t border-white/10">
          <span className="text-[11px] text-zinc-500 font-mono">
            Tracking: {order.trackingNumber}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium tracking-wide shadow-[0_0_12px_rgba(6,182,212,0.4)] transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
