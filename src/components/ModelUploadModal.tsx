import React, { useRef } from 'react';
import { ModelAssetStatus } from '../types/assistant';
import { Box, Upload, CheckCircle2, AlertCircle, FileCode2, X } from 'lucide-react';

interface ModelUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: ModelAssetStatus;
  onFileSelect: (file: File) => void;
  onResetToDefault: () => void;
}

export const ModelUploadModal: React.FC<ModelUploadModalProps> = ({
  isOpen,
  onClose,
  status,
  onFileSelect,
  onResetToDefault,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.glb') || file.name.endsWith('.gltf')) {
        onFileSelect(file);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="3D Model Asset Integration"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none"
    >
      <div className="relative w-full max-w-lg bg-[#0b1416] border border-cyan-500/30 rounded-2xl p-6 shadow-[0_16px_48px_rgba(0,0,0,0.8),0_0_30px_rgba(6,182,212,0.15)] text-zinc-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-400/20 text-cyan-400">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-wide">
                Blender 3D Model Integration
              </h2>
              <p className="text-xs text-cyan-200/60 font-light">
                AURA Particle Sphere Asset Configuration
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

        {/* Current Status Indicator */}
        <div className="my-5 p-4 rounded-xl bg-[#060c0e] border border-white/5 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Integration Status:</span>
            {status.loaded ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Custom Blender Asset Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-cyan-300 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                Procedural Preview Active (Ready for Upload)
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Active Source:</span>
            <span className="font-mono text-zinc-200 text-[11px]">
              {status.source === 'external-file'
                ? '/public/models/aura_sphere.glb'
                : status.source === 'local-upload'
                ? `Uploaded file: ${status.fileName}`
                : 'Luminous Orbital Stand-in'}
            </span>
          </div>

          {status.vertexCount !== undefined && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">Vertex / Particle Count:</span>
              <span className="font-mono text-cyan-300">{status.vertexCount.toLocaleString()} points</span>
            </div>
          )}

          {status.hasAnimations !== undefined && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">Blender Animation Clips:</span>
              <span className="font-mono text-emerald-300">
                {status.hasAnimations ? `${status.animationCount} animation(s) playing` : 'None embedded (idle drift active)'}
              </span>
            </div>
          )}

          {status.error && (
            <div className="p-2.5 rounded bg-red-950/40 border border-red-500/30 text-red-300 text-xs">
              {status.error}
            </div>
          )}
        </div>

        {/* Drag & Drop Upload Zone */}
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-cyan-500/30 hover:border-cyan-400/60 bg-cyan-950/10 hover:bg-cyan-950/20 rounded-xl p-6 text-center transition-all cursor-pointer group"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".glb,.gltf"
            className="hidden"
            onChange={handleFileInputChange}
          />
          <Upload className="w-8 h-8 text-cyan-400 mx-auto mb-2 transition-transform group-hover:-translate-y-1" />
          <p className="text-sm font-medium text-white">
            Drop your exported Blender model here
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            Supports <span className="text-cyan-300 font-mono">.glb</span> and{' '}
            <span className="text-cyan-300 font-mono">.gltf</span> formats
          </p>
          <span className="inline-block mt-3 px-3 py-1 text-[11px] font-medium bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 rounded-full">
            Browse File
          </span>
        </div>

        {/* Persistent Workspace Instructions */}
        <div className="mt-4 p-3 rounded-lg bg-zinc-900/60 border border-white/5 text-[11px] text-zinc-400 space-y-1">
          <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
            <FileCode2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Workspace Permanent Asset Location:</span>
          </div>
          <p className="font-mono text-cyan-300/90 pl-5 text-[10px] break-all">
            /public/models/sphere.glb
          </p>
          <p className="pl-5 text-zinc-400 text-[10px]">
            Any <code className="text-zinc-300">.glb</code> file placed there is automatically loaded when the application launches.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="mt-5 flex items-center justify-between pt-3 border-t border-white/10">
          {status.source === 'local-upload' && (
            <button
              onClick={onResetToDefault}
              className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              Reset to default
            </button>
          )}
          <button
            onClick={onClose}
            className="ml-auto px-4 py-2 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium tracking-wide shadow-[0_0_12px_rgba(6,182,212,0.4)] transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
