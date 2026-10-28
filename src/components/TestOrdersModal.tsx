import React, { useState } from 'react';
import { Package, Truck, CheckCircle2, AlertCircle, X, Copy, Check, Sparkles, ArrowRight, ShieldAlert, Clock, RefreshCw } from 'lucide-react';
import { MOCK_ORDERS_DB } from '../data/mockOrders';

interface TestOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectQuery: (queryText: string) => void;
  callActive: boolean;
}

export const TestOrdersModal: React.FC<TestOrdersModalProps> = ({
  isOpen,
  onClose,
  onSelectQuery,
  callActive,
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'prompts'>('orders');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const orders = Object.values(MOCK_ORDERS_DB);

  const sampleQueries = [
    {
      category: 'Tool Calling: Live Order Tracking',
      query: 'Where is my order ORD-101?',
      badge: 'get_order_details',
      desc: 'Retrieves live BlueDart tracking and delivery time for ORD-101.',
    },
    {
      category: 'Policy Guardrail: 7-Day Return Rule',
      query: 'I received ORD-102 two weeks ago. Can I return it?',
      badge: 'Brand Guardrail',
      desc: 'Enforces 7-day return policy on ORD-102 (delivered 14 days ago) and politely refuses.',
    },
    {
      category: 'Tool Calling: Order Cancellation',
      query: 'Please cancel my order ORD-103.',
      badge: 'cancel_order',
      desc: 'Cancels ORD-103 because it is still in Processing status.',
    },
    {
      category: 'Shipping Policy Check',
      query: 'What are your delivery charges and shipping times?',
      badge: 'Shipping Policy',
      desc: 'Free above ₹499, ₹50 below ₹499, standard 3–5 business days.',
    },
    {
      category: 'COD Policy Check',
      query: 'Can I pay cash on delivery?',
      badge: 'COD Policy',
      desc: 'COD available up to ₹2,500; cash or UPI at delivery courier.',
    },
    {
      category: 'Guardrail: Out of Scope Redirection',
      query: 'Can you book me a flight to Goa?',
      badge: 'Out of Scope',
      desc: 'Aria politely explains she can only assist with Aura Skincare orders and products.',
    },
  ];

  const handleCopy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleRunQuery = (query: string) => {
    onSelectQuery(query);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Aura Skincare Test Orders and Evaluation Hub"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none"
    >
      <div className="relative w-full max-w-2xl bg-[#0b1416] border border-cyan-500/30 rounded-2xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_35px_rgba(6,182,212,0.18)] text-zinc-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-400/20 text-cyan-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white tracking-wide">
                  Test Orders & Evaluation Hub
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-700/50">
                  3 Mock Orders
                </span>
              </div>
              <p className="text-xs text-cyan-200/60 font-light mt-0.5">
                Inspect mock database records and test voice agent tool calling & policies
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 pt-4 pb-3 border-b border-white/5 shrink-0">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'orders'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                : 'bg-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-white/10 border border-transparent'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Mock Database Orders ({orders.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('prompts')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'prompts'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                : 'bg-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-white/10 border border-transparent'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Quick Test Scenarios (6)</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-1">
          {activeTab === 'orders' ? (
            <div className="space-y-3">
              {orders.map((o) => (
                <div
                  key={o.orderId}
                  className="p-4 rounded-xl bg-[#070e10] border border-white/10 hover:border-cyan-500/30 transition-all space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-cyan-400">{o.orderId}</span>
                      <button
                        onClick={(e) => handleCopy(o.orderId, e)}
                        className="text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 flex items-center gap-1 cursor-pointer transition-colors"
                        title="Copy Order ID"
                      >
                        {copiedId === o.orderId ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                        <span>{copiedId === o.orderId ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    <span
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium border ${
                        o.status === 'Processing'
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          : o.status === 'Out for Delivery'
                          ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                          : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {o.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-zinc-400">Customer:</p>
                      <p className="font-medium text-white">{o.customerName}</p>
                    </div>
                    <div>
                      <p className="text-zinc-400">Value:</p>
                      <p className="font-medium text-white">{o.value}</p>
                    </div>
                    <div>
                      <p className="text-zinc-400">Product:</p>
                      <p className="font-medium text-white">{o.product}</p>
                    </div>
                    <div>
                      <p className="text-zinc-400">Tracking / Courier:</p>
                      <p className="font-medium text-cyan-300 font-mono text-[11px]">
                        {o.courier ? `${o.courier} (${o.trackingNumber || 'N/A'})` : 'Processing at warehouse'}
                      </p>
                    </div>
                  </div>

                  {/* Policy Notes */}
                  <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                      {o.status === 'Processing' ? (
                        <>
                          <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Eligible for cancellation (<span className="text-amber-300">Processing</span>)</span>
                        </>
                      ) : o.status === 'Delivered' ? (
                        <>
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>Delivered 14 days ago (<span className="text-rose-300">Exceeds 7-day return policy</span>)</span>
                        </>
                      ) : (
                        <>
                          <Truck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>Out for delivery today (<span className="text-cyan-300">Expected by 6 PM</span>)</span>
                        </>
                      )}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRunQuery(`Where is my order ${o.orderId}?`)}
                        className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-[11px] font-medium border border-cyan-500/30 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>Ask Status</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                      {o.status === 'Processing' && (
                        <button
                          onClick={() => handleRunQuery(`Please cancel my order ${o.orderId}`)}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-[11px] font-medium border border-rose-500/30 flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <span>Test Cancel</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                      {o.status === 'Delivered' && (
                        <button
                          onClick={() => handleRunQuery(`I received ${o.orderId} two weeks ago. Can I return it?`)}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[11px] font-medium border border-amber-500/30 flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <span>Test Return</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-xs text-zinc-400 mb-2">
                Click any scenario prompt below to immediately feed it into the active call session with Aria:
              </p>
              {sampleQueries.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleRunQuery(item.query)}
                  className="w-full p-3.5 rounded-xl bg-[#070e10] border border-white/10 hover:border-cyan-500/40 hover:bg-cyan-950/20 transition-all text-left group cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[11px] font-semibold tracking-wide text-zinc-300 group-hover:text-cyan-300 transition-colors">
                      {item.category}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/50">
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-white group-hover:text-cyan-200 transition-colors">
                    "{item.query}"
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-1 font-light">
                    {item.desc}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-zinc-500 shrink-0">
          <span>Aura Skincare CX Assignment Evaluation</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
