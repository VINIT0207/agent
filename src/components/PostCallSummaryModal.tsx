import React, { useState } from 'react';
import { X, Copy, Check, FileText, Code2, Download, PhoneOff, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { PostCallSummary, TranscriptItem } from '../types/assistant';

interface PostCallSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: PostCallSummary | null;
  transcript: TranscriptItem[];
  onRestartCall: () => void;
}

export const PostCallSummaryModal: React.FC<PostCallSummaryModalProps> = ({
  isOpen,
  onClose,
  summary,
  transcript,
  onRestartCall,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'json' | 'transcript'>('overview');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const jsonSummary = summary
    ? {
        customer_intent: summary.customer_intent,
        order_id: summary.order_id,
        resolution_status: summary.resolution_status,
        call_summary: summary.call_summary,
      }
    : null;

  const jsonString = JSON.stringify(jsonSummary, null, 2);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTranscript = () => {
    const lines = transcript.map(
      (t) => `[${t.timestamp}] ${t.speaker === 'customer' ? 'Customer' : 'Aria (Aura Skincare)'}: ${t.text}`
    );
    const blob = new Blob([lines.join('\n\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Aura_Skincare_Call_Transcript_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-2xl bg-neutral-950 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-neutral-800/80 flex items-center justify-between bg-neutral-900/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400">
              <PhoneOff className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-wide">
                Post-Call Summary & Evaluation Log
              </h2>
              <p className="text-xs text-neutral-400">
                Aura Skincare CX Call Concluded • {transcript.length} turns recorded
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-neutral-800 px-6 bg-neutral-900/20">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-3 text-xs font-medium border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'overview'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Structured Outcome</span>
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`px-4 py-3 text-xs font-medium border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'json'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>JSON Output</span>
          </button>
          <button
            onClick={() => setActiveTab('transcript')}
            className={`px-4 py-3 text-xs font-medium border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'transcript'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Full Transcript ({transcript.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'overview' && summary && (
            <div className="space-y-4">
              {/* Structured Key-Value Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800">
                  <div className="text-[10px] uppercase font-mono tracking-wider text-neutral-500 mb-1">
                    Customer Intent
                  </div>
                  <div className="text-sm font-semibold text-cyan-300 font-mono">
                    {summary.customer_intent}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800">
                  <div className="text-[10px] uppercase font-mono tracking-wider text-neutral-500 mb-1">
                    Order ID Reference
                  </div>
                  <div className="text-sm font-semibold text-white font-mono">
                    {summary.order_id || 'None / General'}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800 col-span-2">
                  <div className="text-[10px] uppercase font-mono tracking-wider text-neutral-500 mb-1">
                    Resolution Status
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium font-mono ${
                        summary.resolution_status === 'RESOLVED'
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                          : summary.resolution_status === 'POLICY_EXPLAINED'
                          ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/80'
                          : 'bg-amber-950/80 text-amber-300 border border-amber-800/80'
                      }`}
                    >
                      {summary.resolution_status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Call Summary Narrative */}
              <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-1.5">
                <div className="text-[10px] uppercase font-mono tracking-wider text-neutral-500">
                  Call Summary
                </div>
                <p className="text-sm text-neutral-200 leading-relaxed">
                  "{summary.call_summary}"
                </p>
              </div>
            </div>
          )}

          {activeTab === 'json' && (
            <div className="relative">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs text-neutral-400 font-mono">Structured JSON Outcome:</span>
                <button
                  onClick={handleCopyJson}
                  className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 flex items-center space-x-1.5 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>
              <pre className="p-4 rounded-2xl bg-black/80 border border-neutral-800 text-cyan-300 font-mono text-xs overflow-x-auto leading-relaxed">
                {jsonString}
              </pre>
            </div>
          )}

          {activeTab === 'transcript' && (
            <div className="space-y-3">
              <div className="flex justify-end pb-1">
                <button
                  onClick={handleDownloadTranscript}
                  className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 flex items-center space-x-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .txt</span>
                </button>
              </div>

              {transcript.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-500">
                  No dialogue turns recorded in this session.
                </div>
              ) : (
                <div className="space-y-3">
                  {transcript.map((item) => {
                    const isCustomer = item.speaker === 'customer';
                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-2xl border text-xs space-y-1 ${
                          isCustomer
                            ? 'bg-neutral-900/60 border-neutral-800 text-left'
                            : 'bg-cyan-950/30 border-cyan-900/50 text-left'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono">
                          <span className={isCustomer ? 'text-amber-400 font-medium' : 'text-cyan-400 font-medium'}>
                            {isCustomer ? '👤 Customer' : '✨ Aria (Aura Skincare)'}
                          </span>
                          <span>{item.timestamp}</span>
                        </div>
                        <p className="text-neutral-200 text-xs leading-relaxed">{item.text}</p>
                        {item.toolCall && (
                          <div className="mt-2 p-2 rounded-xl bg-black/60 border border-neutral-800 font-mono text-[10px] text-cyan-300">
                            <span className="text-neutral-500">Tool executed:</span> {item.toolCall.name}(
                            {JSON.stringify(item.toolCall.args)})
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-neutral-800/80 bg-neutral-900/50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition-colors"
          >
            Close Summary
          </button>
          <button
            onClick={() => {
              onClose();
              onRestartCall();
            }}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-black text-xs font-semibold shadow-lg shadow-cyan-500/20 flex items-center space-x-1.5 transition-all"
          >
            <span>Start New Call</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
