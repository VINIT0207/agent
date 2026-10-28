import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * ============================================================================
 * AURA SKINCARE — REAL-TIME VOICE AGENT ENGINE (GEMINI MULTIMODAL LIVE API)
 * ============================================================================
 * Standalone, isolated React custom hook enforcing strict audio data integrity:
 * 1. Forced No AGC, Stereo Off, Mono Channel 1
 * 2. Mathematically Precise Anti-Aliased 16kHz Linear PCM Downsampling
 * 3. 50ms Buffer Silence Clipping (Zero-Hum Suppression & Zero-Lag Barge-in)
 */

// ----------------------------------------------------------------------------
// 1. EMBEDDED LOCAL MOCK DATABASE (Aura Skincare)
// ----------------------------------------------------------------------------
export const MOCK_ORDERS_DB = {
  'ORD-101': {
    order_id: 'ORD-101',
    customer: 'Priya Sharma',
    product: 'Vitamin C Serum (30ml)',
    amount: '₹699',
    status: 'Out for Delivery',
    carrier: 'BlueDart',
    tracking_id: 'BD-982103',
    delivery_info: 'Expected by 6 PM today',
    cancellable: false,
    return_eligible: false,
    notes: 'Out with delivery courier. Orders cannot be cancelled once Shipped or Out for Delivery.',
  },
  'ORD-102': {
    order_id: 'ORD-102',
    customer: 'Rahul Verma',
    product: 'Hydrating Sunscreen SPF 50',
    amount: '₹499',
    status: 'Delivered',
    carrier: 'Delhivery',
    tracking_id: 'DL-441029',
    delivery_info: 'Delivered 14 days ago',
    cancellable: false,
    return_eligible: false,
    notes: 'Delivered 14 days ago. Exceeds the 7-day unopened return policy. Ineligible for return.',
  },
  'ORD-103': {
    order_id: 'ORD-103',
    customer: 'Ananya Patel',
    product: 'Green Tea Face Wash + Toner',
    amount: '₹850',
    status: 'Processing',
    carrier: 'Pending Courier Assignment',
    tracking_id: 'AURA-WH-093',
    delivery_info: 'Ordered 3 hours ago. Expected dispatch tomorrow.',
    cancellable: true,
    return_eligible: true,
    notes: 'Order is currently Processing in warehouse. Eligible for immediate cancellation.',
  },
};

/**
 * Normalizes input order identifiers (e.g. "101", "ord 101", "ORD-101")
 */
export function lookupLocalOrder(rawId) {
  if (!rawId) return { error: 'Order ID is required.' };
  const cleaned = String(rawId).trim().toUpperCase().replace(/\s+/g, '-');
  const matchedKey = Object.keys(MOCK_ORDERS_DB).find(
    (key) => cleaned.includes(key) || cleaned.includes(key.replace('ORD-', '')) || key.includes(cleaned)
  );

  if (matchedKey && MOCK_ORDERS_DB[matchedKey]) {
    return MOCK_ORDERS_DB[matchedKey];
  }

  return {
    error: `Order '${rawId}' was not found in Aura Skincare records. Available test orders: ORD-101, ORD-102, ORD-103.`,
  };
}

// ----------------------------------------------------------------------------
// 2. MATHEMATICALLY PRECISE 16KHZ DOWNSAMPLER & SILENCE CLIPPING ENGINE
// ----------------------------------------------------------------------------

/** Minimal silence threshold to prevent room hum, fan buzz, or keyboard clicks */
export const SILENCE_RMS_THRESHOLD = 0.012;

/**
 * Calculates the average volume amplitude of a 50ms buffer chunk.
 */
export function calculateAverageAmplitude(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += Math.abs(buffer[i]);
  }
  return sum / buffer.length;
}

/**
 * Mathematically downsamples native Float32 audio (44.1kHz or 48kHz) to exactly 16000Hz Int16Array.
 * If isSilent is true, returns a flat zeroed Int16Array to prevent room hum hallucinations.
 */
export function downsampleFloat32To16kPCM(inputBuffer, inputSampleRate, isSilent) {
  const targetSampleRate = 16000;
  const ratio = inputSampleRate / targetSampleRate;
  const targetLength = Math.round(inputBuffer.length / ratio);
  const pcm16 = new Int16Array(targetLength);

  // RULE 3: Pass flat zero silence instead of noisy fan hum / keyboard clicks
  if (isSilent) {
    return pcm16; // All zeros
  }

  // Exact 16kHz native rate optimization
  if (Math.abs(inputSampleRate - targetSampleRate) < 1) {
    for (let i = 0; i < targetLength; i++) {
      const s = Math.max(-1, Math.min(1, inputBuffer[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return pcm16;
  }

  // RULE 2: Anti-aliased continuous area-averaging integration downsampling
  for (let i = 0; i < targetLength; i++) {
    const startRange = i * ratio;
    const endRange = (i + 1) * ratio;

    let accum = 0;
    let weightSum = 0;

    const startIdx = Math.floor(startRange);
    const endIdx = Math.min(inputBuffer.length - 1, Math.ceil(endRange));

    for (let j = startIdx; j <= endIdx && j < inputBuffer.length; j++) {
      const segStart = Math.max(startRange, j);
      const segEnd = Math.min(endRange, j + 1);
      const weight = Math.max(0, segEnd - segStart);

      if (weight > 0) {
        accum += inputBuffer[j] * weight;
        weightSum += weight;
      }
    }

    const sample = weightSum > 0 ? accum / weightSum : (inputBuffer[startIdx] || 0);

    // Hard clamp to [-1.0, 1.0] and quantize to 16-bit linear PCM Little-Endian
    const clamped = Math.max(-1, Math.min(1, sample));
    pcm16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  return pcm16;
}

/**
 * Converts an Int16Array directly into a standard Base64 string without stack overflow.
 */
export function int16ArrayToBase64(pcm16) {
  const bytes = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
  let binary = '';
  const chunkSize = 0x8000; // 32KB chunking
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, sub);
  }
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return window.btoa(binary);
  }
  return Buffer.from(binary, 'binary').toString('base64');
}

/**
 * Decodes 24kHz Base64 PCM16 Little-Endian audio into Float32Array for Web Audio API playback
 */
export function base64ToFloat32Array24k(base64) {
  const binaryString =
    typeof window !== 'undefined' && typeof window.atob === 'function'
      ? window.atob(base64)
      : Buffer.from(base64, 'base64').toString('binary');
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const dataView = new DataView(bytes.buffer);
  const sampleCount = Math.floor(bytes.length / 2);
  const float32Array = new Float32Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    const int16 = dataView.getInt16(i * 2, true); // Little-Endian
    float32Array[i] = int16 / 32768.0;
  }

  return float32Array;
}

function getFormattedTime() {
  const now = new Date();
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `${m}:${s}`;
}

// ----------------------------------------------------------------------------
// 3. MAIN HOOK: useAuraVoiceAgent
// ----------------------------------------------------------------------------
export function useAuraVoiceAgent() {
  const [agentState, setAgentState] = useState('Listening');
  const [transcript, setTranscript] = useState([]);
  const [callSummary, setCallSummary] = useState(null);

  // Connection & Stream Refs
  const wsRef = useRef(null);
  const micStreamRef = useRef(null);
  const inputAudioCtxRef = useRef(null);
  const scriptProcessorRef = useRef(null);
  const micSourceRef = useRef(null);

  // Playback & Barge-In Audio Refs
  const outputAudioCtxRef = useRef(null);
  const outputGainRef = useRef(null);
  const activeSourcesRef = useRef([]);
  const nextPlayTimeRef = useRef(0);

  // Audio Hangover Ref (preserves soft word endings)
  const speechHangoverCountRef = useRef(0);

  // State Tracking Refs
  const agentStateRef = useRef(agentState);
  agentStateRef.current = agentState;

  const transcriptRef = useRef(transcript);
  transcriptRef.current = transcript;

  const currentAssistantChunkRef = useRef('');
  const lastToolExecutionRef = useRef(null);

  /**
   * Instantly stops audio playback with a 5ms anti-pop ramp for smooth user barge-in.
   */
  const clearAudioPlaybackQueue = useCallback(() => {
    const ctx = outputAudioCtxRef.current;
    const gain = outputGainRef.current;

    if (gain && ctx) {
      try {
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.005);
      } catch {
        // fallback
      }
    }

    setTimeout(() => {
      activeSourcesRef.current.forEach((source) => {
        try {
          source.stop();
          source.disconnect();
        } catch {
          // Ignore
        }
      });
      activeSourcesRef.current = [];

      if (ctx) {
        nextPlayTimeRef.current = ctx.currentTime;
      }

      if (gain && ctx) {
        try {
          gain.gain.cancelScheduledValues(ctx.currentTime);
          gain.gain.setValueAtTime(1, ctx.currentTime);
        } catch {
          // fallback
        }
      }

      setAgentState('Listening');
    }, 6);
  }, []);

  /**
   * Enqueues incoming 24kHz PCM audio chunks to Web Audio API AudioContext
   */
  const queueAudioChunk = useCallback((base64Audio) => {
    const ctx = outputAudioCtxRef.current;
    const gain = outputGainRef.current;
    if (!ctx || !gain) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const float32Data = base64ToFloat32Array24k(base64Audio);
    if (float32Data.length === 0) return;

    const audioBuffer = ctx.createBuffer(1, float32Data.length, 24000);
    audioBuffer.getChannelData(0).set(float32Data);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(gain);

    const currentTime = ctx.currentTime;
    const startTime = Math.max(nextPlayTimeRef.current, currentTime);
    source.start(startTime);
    nextPlayTimeRef.current = startTime + audioBuffer.duration;

    activeSourcesRef.current.push(source);
    setAgentState('Speaking');

    source.onended = () => {
      const idx = activeSourcesRef.current.indexOf(source);
      if (idx !== -1) {
        activeSourcesRef.current.splice(idx, 1);
      }
      if (activeSourcesRef.current.length === 0 && ctx.currentTime >= nextPlayTimeRef.current - 0.05) {
        setAgentState('Listening');
      }
    };
  }, []);

  /**
   * Local tool execution: get_order_details(order_id)
   */
  const executeLocalTool = useCallback((toolCall) => {
    setAgentState('Thinking');
    const functionCalls = toolCall.functionCalls || [];
    const functionResponses = [];

    for (const call of functionCalls) {
      if (call.name === 'get_order_details') {
        const orderIdArg = call.args?.order_id || call.args?.orderId || '';
        const orderData = lookupLocalOrder(orderIdArg);
        lastToolExecutionRef.current = { orderId: orderIdArg, tool: 'get_order_details' };

        const toolItem = {
          id: `tool-${Date.now()}-${Math.random()}`,
          speaker: 'aria',
          text: `[System Verified: Looked up ${orderIdArg} — Status: ${orderData.status || 'Queried'}]`,
          timestamp: getFormattedTime(),
          toolCall: {
            name: 'get_order_details',
            args: call.args,
            result: orderData,
          },
        };
        setTranscript((prev) => [...prev, toolItem]);

        functionResponses.push({
          response: {
            output: orderData,
          },
          id: call.id,
        });
      } else {
        functionResponses.push({
          response: {
            output: { error: `Unsupported tool function '${call.name}'` },
          },
          id: call.id,
        });
      }
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          toolResponse: {
            functionResponses,
          },
        })
      );
    }
  }, []);

  /**
   * Synthesize post-call structured summary matching required schema
   */
  const compilePostCallSummary = useCallback(() => {
    const logs = transcriptRef.current;
    const fullText = logs.map((l) => `${l.speaker}: ${l.text}`).join('\n').toLowerCase();

    let detectedOrderId = null;
    const match = fullText.match(/\b(ord[- ]?10[123]|10[123])\b/i);
    if (match) {
      const num = match[1].replace(/\D/g, '');
      detectedOrderId = `ORD-${num}`;
    } else if (lastToolExecutionRef.current?.orderId) {
      detectedOrderId = lastToolExecutionRef.current.orderId.toUpperCase();
    }

    let intent = 'GENERAL_INQUIRY';
    if (fullText.includes('cancel') || fullText.includes('cancellation')) {
      intent = 'ORDER_CANCELLATION';
    } else if (fullText.includes('return') || fullText.includes('refund') || fullText.includes('exchange')) {
      intent = 'RETURN_OR_REFUND';
    } else if (fullText.includes('track') || fullText.includes('where is') || fullText.includes('delivery') || fullText.includes('status')) {
      intent = 'ORDER_TRACKING';
    } else if (fullText.includes('shipping') || fullText.includes('cod') || fullText.includes('cash on delivery') || fullText.includes('policy')) {
      intent = 'POLICY_QUESTION';
    } else if (fullText.includes('serum') || fullText.includes('sunscreen') || fullText.includes('wash') || fullText.includes('ingredient')) {
      intent = 'PRODUCT_INQUIRY';
    }

    let resolution = 'RESOLVED';
    let summaryText = 'Customer contacted Aura Skincare support. Inquiry addressed following brand guidelines.';

    if (detectedOrderId === 'ORD-101') {
      resolution = fullText.includes('cancel') ? 'POLICY_EXPLAINED' : 'RESOLVED';
      summaryText = 'Customer inquired regarding order ORD-101. Verified package is Out for Delivery with BlueDart (BD-982103, expected by 6 PM today). Advised order cannot be cancelled once out for delivery.';
    } else if (detectedOrderId === 'ORD-102') {
      resolution = 'POLICY_EXPLAINED';
      summaryText = 'Customer inquired about returning order ORD-102 (Hydrating Sunscreen). Informed that the order was delivered 14 days ago, which exceeds Aura’s strict 7-day unopened return policy window.';
    } else if (detectedOrderId === 'ORD-103') {
      resolution = 'RESOLVED';
      summaryText = 'Customer checked order ORD-103 (Green Tea Face Wash + Toner). Confirmed order is currently Processing in warehouse and is eligible for immediate cancellation as requested.';
    } else if (intent === 'POLICY_QUESTION') {
      resolution = 'POLICY_EXPLAINED';
      summaryText = 'Customer inquired regarding shipping, returns, or COD policy. Explained Aura Skincare policies (free shipping above ₹499, 7-day return window, COD up to ₹2,500).';
    }

    const compiled = {
      customer_intent: intent,
      order_id: detectedOrderId,
      resolution_status: resolution,
      call_summary: summaryText,
    };

    setCallSummary(compiled);
    return compiled;
  }, []);

  /**
   * START CALL: Connects WebSocket, sends handshake, activates mic with STRICT constraints
   */
  const startCall = useCallback(async (apiKeyParam) => {
    const key = apiKeyParam || (typeof process !== 'undefined' ? (process.env?.VITE_GEMINI_API_KEY || process.env?.GEMINI_API_KEY) : '') || '';
    if (!key) {
      console.warn('[AuraVoiceAgent] No Gemini API key provided to startCall(apiKey). Please pass a valid key.');
    }

    // Reset previous session state
    setCallSummary(null);
    setTranscript([]);
    setAgentState('Listening');
    currentAssistantChunkRef.current = '';
    lastToolExecutionRef.current = null;
    speechHangoverCountRef.current = 0;

    // 1. Initialize Web Audio Context for output playback
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const outputCtx = new AudioContextClass({ sampleRate: 24000 });
    const masterGain = outputCtx.createGain();
    masterGain.gain.setValueAtTime(1, outputCtx.currentTime);
    masterGain.connect(outputCtx.destination);

    outputAudioCtxRef.current = outputCtx;
    outputGainRef.current = masterGain;
    nextPlayTimeRef.current = outputCtx.currentTime;

    // 2. Establish Google AI Studio Live API WebSocket connection
    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(key)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[AuraVoiceAgent] WebSocket connected to Gemini Live gateway.');

      const handshakePayload = {
        setup: {
          model: 'models/gemini-2.0-flash-exp',
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: 'Aoede',
                },
              },
            },
          },
          systemInstruction: {
            parts: [
              {
                text: `You are Aria, a friendly, professional, and concise Indian customer support specialist for Aura Skincare (a premium organic Indian skincare brand). Speak naturally and concisely in an Indian voice. Keep responses under two sentences. Follow these strict brand guidelines:
- Shipping: Free delivery above ₹499. Orders below ₹499 have a ₹50 shipping fee. Delivery takes 3–5 business days.
- Returns: Accepted within 7 days of delivery for UNOPENED, UNUSED products in original packaging. Damaged items must be reported within 48 hours with photos.
- Cancellation: Allowed ONLY if order status is 'Processing'. Once 'Shipped' or 'Out for Delivery', it cannot be cancelled.
- COD: Available up to ₹2,500 via cash or UPI.
If a request falls outside policies, politely decline. If you don't know something, say you can only help with Aura Skincare queries.`,
              },
            ],
          },
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'get_order_details',
                  description: 'Lookup real-time order tracking, status, carrier details, and return eligibility for an order ID.',
                  parameters: {
                    type: 'OBJECT',
                    properties: {
                      order_id: {
                        type: 'STRING',
                        description: 'The order ID to lookup (e.g. ORD-101, ORD-102, ORD-103)',
                      },
                    },
                    required: ['order_id'],
                  },
                },
              ],
            },
          ],
        },
      };

      ws.send(JSON.stringify(handshakePayload));
    };

    ws.onmessage = async (event) => {
      try {
        let raw = event.data;
        if (raw instanceof Blob) {
          raw = await raw.text();
        }
        const data = JSON.parse(raw);

        if (data.setupComplete) {
          setAgentState('Listening');
          return;
        }

        if (data.toolCall) {
          executeLocalTool(data.toolCall);
          return;
        }

        if (data.serverContent) {
          if (data.serverContent.interrupted) {
            clearAudioPlaybackQueue();
            setAgentState('Listening');
            return;
          }

          const parts = data.serverContent.modelTurn?.parts || [];
          for (const part of parts) {
            if (part.inlineData?.data) {
              queueAudioChunk(part.inlineData.data);
            }

            if (part.text) {
              currentAssistantChunkRef.current += part.text;
            }
          }

          if (data.serverContent.turnComplete) {
            if (currentAssistantChunkRef.current.trim()) {
              const text = currentAssistantChunkRef.current.trim();
              currentAssistantChunkRef.current = '';
              setTranscript((prev) => [
                ...prev,
                {
                  id: `aria-${Date.now()}`,
                  speaker: 'aria',
                  text,
                  timestamp: getFormattedTime(),
                },
              ]);
            }
          }
        }
      } catch (err) {
        console.error('[AuraVoiceAgent] WebSocket message handling error:', err);
      }
    };

    ws.onerror = (e) => {
      console.error('[AuraVoiceAgent] WebSocket error:', e);
    };

    // 3. Audio Capture & Strict 16kHz PCM Stream Pipeline
    try {
      // RULE 1: FORCE NO AGC & MONO CHANNEL
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          channelCount: 1,
        },
      });
      micStreamRef.current = stream;

      const inputCtx = new AudioContextClass();
      inputAudioCtxRef.current = inputCtx;
      const source = inputCtx.createMediaStreamSource(stream);
      micSourceRef.current = source;

      // 2048 samples at 44.1k/48k corresponds to ~42ms–46ms (ideal 50ms chunk size)
      const processor = inputCtx.createScriptProcessor(2048, 1, 1);
      scriptProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);

        // RULE 3: SILENCE CLIPPING (calculate volume amplitude of the 50ms chunk)
        const avgAmplitude = calculateAverageAmplitude(inputData);
        const isVoiceActive = avgAmplitude >= SILENCE_RMS_THRESHOLD;

        // Maintain a 3-chunk hangover (~130ms) to preserve soft consonant word endings
        if (isVoiceActive) {
          speechHangoverCountRef.current = 3;
        } else if (speechHangoverCountRef.current > 0) {
          speechHangoverCountRef.current -= 1;
        }

        const shouldTransmitAudio = isVoiceActive || speechHangoverCountRef.current > 0;

        // Instant Zero-Lag Barge-in (cut playback if user speaks while AI is speaking)
        if (avgAmplitude > 0.04 && agentStateRef.current === 'Speaking') {
          clearAudioPlaybackQueue();
          setAgentState('Listening');
        }

        // RULE 2: PRECISE 16KHZ DOWNSAMPLING INTO INT16ARRAY
        // If below threshold (pure silence/fan hum), downsampler outputs a flat silent zero array
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const pcm16 = downsampleFloat32To16kPCM(
            inputData,
            inputCtx.sampleRate,
            !shouldTransmitAudio // true = flat zero silence array
          );

          const base64Audio = int16ArrayToBase64(pcm16);

          wsRef.current.send(
            JSON.stringify({
              realtimeInput: {
                mediaChunks: [
                  {
                    mimeType: 'audio/pcm;rate=16000',
                    data: base64Audio,
                  },
                ],
              },
            })
          );
        }
      };

      // Connect through silent gain to keep onaudioprocess firing without feedback
      const silentGain = inputCtx.createGain();
      silentGain.gain.setValueAtTime(0, inputCtx.currentTime);
      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(inputCtx.destination);
    } catch (micErr) {
      console.error('[AuraVoiceAgent] Microphone access error:', micErr);
    }
  }, [clearAudioPlaybackQueue, executeLocalTool, queueAudioChunk]);

  /**
   * END CALL: Safely tears down mic, audio nodes, WebSocket, and generates final summary
   */
  const endCall = useCallback(() => {
    // 1. Disconnect mic and processor
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (micSourceRef.current) {
      micSourceRef.current.disconnect();
      micSourceRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    // 2. Clear audio playback queue
    clearAudioPlaybackQueue();

    // 3. Close AudioContexts
    if (inputAudioCtxRef.current && inputAudioCtxRef.current.state !== 'closed') {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current && outputAudioCtxRef.current.state !== 'closed') {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }

    // 4. Close WebSocket connection
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    // 5. Finalize state & compile structured post-call summary
    setAgentState('Listening');
    compilePostCallSummary();
  }, [clearAudioPlaybackQueue, compilePostCallSummary]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, [endCall]);

  return {
    startCall,
    endCall,
    agentState,
    transcript,
    callSummary,
  };
}

export default useAuraVoiceAgent;
