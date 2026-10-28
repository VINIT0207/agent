import React, { useState } from 'react';
import { Mic, MicOff, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

interface MicrophonePermissionPromptProps {
  permissionState: 'prompt' | 'granted' | 'denied';
  onRequestPermission: () => Promise<boolean>;
}

export const MicrophonePermissionPrompt: React.FC<MicrophonePermissionPromptProps> = ({
  permissionState,
  onRequestPermission,
}) => {
  const [isRequesting, setIsRequesting] = useState(false);

  if (permissionState === 'granted') {
    return null;
  }

  const handleGrant = async () => {
    setIsRequesting(true);
    try {
      await onRequestPermission();
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto my-1.5 px-3 z-30 transition-all duration-200">
      <div
        className={`p-3 rounded-2xl backdrop-blur-md border shadow-xl flex items-center justify-between gap-3 ${
          permissionState === 'denied'
            ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
            : 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`p-2 rounded-xl shrink-0 ${
              permissionState === 'denied'
                ? 'bg-rose-500/20 text-rose-400'
                : 'bg-cyan-500/20 text-cyan-400'
            }`}
          >
            {permissionState === 'denied' ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4 animate-pulse" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">
              {permissionState === 'denied'
                ? 'Microphone Access Denied'
                : 'Enable Voice Conversation'}
            </p>
            <p className="text-[11px] text-zinc-300 font-light leading-tight">
              {permissionState === 'denied'
                ? 'Allow mic in your browser address bar, then tap Retry.'
                : 'Allow microphone to speak directly with Aria.'}
            </p>
          </div>
        </div>

        <button
          onClick={handleGrant}
          disabled={isRequesting}
          type="button"
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 cursor-pointer transition-all shadow-md active:scale-95 flex items-center gap-1.5 ${
            permissionState === 'denied'
              ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/25'
              : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-cyan-500/25'
          }`}
        >
          {isRequesting ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : permissionState === 'denied' ? (
            <RefreshCw className="w-3.5 h-3.5" />
          ) : (
            <Mic className="w-3.5 h-3.5" />
          )}
          <span>{permissionState === 'denied' ? 'Retry Access' : 'Allow Mic'}</span>
        </button>
      </div>
    </div>
  );
};
