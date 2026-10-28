import React, { useState } from 'react';
import { Package, Truck, CheckCircle2, AlertCircle, Sparkles, ChevronRight, ChevronDown, Copy, Check } from 'lucide-react';
import { MOCK_ORDERS_DB } from '../data/mockOrders';

interface TestOrdersHelperProps {
  onSelectQuery: (queryText: string) => void;
  callActive: boolean;
}

export const TestOrdersHelper: React.FC<TestOrdersHelperProps> = ({ onSelectQuery, callActive }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const orders = Object.values(MOCK_ORDERS_DB);

  const sampleQueries = [
    { label: 'Track Order', query: 'Where is my order ORD-101?' },
    { label: 'Return Policy Test', query: 'I received ORD-102 two weeks ago. Can I return it?' },
    { label: 'Cancel Order', query: 'Please cancel my order ORD-103.' },
    { label: 'Shipping Rules', query: 'What are your delivery charges and shipping times?' },
    { label: 'COD Check', query: 'Can I pay cash on delivery?' },
    { label: 'Out of Scope', query: 'Can you book me a flight to Goa?' },
  ];

  const handleCopy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="w-full max-w-xl mx-auto z-20 transition-all duration-300">
      <div className="bg-neutral-900/80 backdrop-blur-md border border-neutral-800 hover:border-cyan-500/40 rounded-2xl overflow-hidden shadow-2xl transition-all">
        {/* Header Toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-neutral-800/40 transition-colors"
        >
          <div className="flex items-center space-x-2.5">
            <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <Package className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold tracking-wider uppercase text-neutral-300">
              Evaluator Test Orders Helper
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 font-mono">
              3 Sample Orders Available
            </span>
          </div>
          <div className="flex items-center space-x-2 text-xs text-neutral-400">
            <span>{isExpanded ? 'Collapse' : 'View Sample Orders & Prompts'}</span>
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </button>

        {/* Expanded Panel */}
        {isExpanded && (
          <div className="p-4 pt-1 border-t border-neutral-800/80 space-y-4">
            {/* Orders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {orders.map((order) => {
                const isOutForDelivery = order.status === 'Out for Delivery';
                const isDelivered = order.status === 'Delivered';
                const isProcessing = order.status === 'Processing';

                return (
                  <div
                    key={order.orderId}
                    className="p-3 rounded-xl bg-black/60 border border-neutral-800/90 hover:border-neutral-700 space-y-1.5 transition-all text-left"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-cyan-300 flex items-center space-x-1">
                        <span>{order.orderId}</span>
                        <button
                          onClick={(e) => handleCopy(order.orderId, e)}
                          title="Copy ID"
                          className="text-neutral-500 hover:text-white p-0.5"
                        >
                          {copiedId === order.orderId ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </span>
                      <span
                        className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full flex items-center space-x-1 ${
                          isOutForDelivery
                            ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                            : isDelivered
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                            : 'bg-blue-950/80 text-blue-300 border border-blue-800/60'
                        }`}
                      >
                        {isOutForDelivery && <Truck className="w-2.5 h-2.5 mr-0.5" />}
                        {isDelivered && <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />}
                        {isProcessing && <AlertCircle className="w-2.5 h-2.5 mr-0.5" />}
                        <span>{order.status}</span>
                      </span>
                    </div>

                    <div className="text-[11px] font-medium text-white truncate">{order.product}</div>
                    <div className="text-[10px] text-neutral-400 flex items-center justify-between">
                      <span>{order.customerName}</span>
                      <span className="font-mono text-neutral-300">{order.value}</span>
                    </div>

                    <div className="text-[9px] text-neutral-400 border-t border-neutral-800/60 pt-1 line-clamp-2">
                      {order.notes}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Test Queries */}
            <div>
              <div className="text-[11px] font-semibold text-neutral-400 mb-2 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Quick Test Queries (Click to speak or simulate):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sampleQueries.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSelectQuery(item.query)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-neutral-800/70 hover:bg-cyan-950/60 border border-neutral-700/60 hover:border-cyan-500/50 text-neutral-200 hover:text-cyan-200 transition-all"
                  >
                    <span className="text-cyan-400 font-medium mr-1.5">{item.label}:</span>
                    <span>"{item.query}"</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
