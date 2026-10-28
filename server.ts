import 'dotenv/config';
import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import Groq, { toFile } from 'groq-sdk';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { MOCK_ORDERS_DB, lookupOrderDetails, cancelOrderById, AURA_BRAND_POLICIES } from './src/data/mockOrders.js';
import { ARIA_SYSTEM_PROMPT, processAuraCustomerQuery, generateCallOutcomeSummary } from './src/services/auraAgentEngine.js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize Gemini SDK if API key is present
const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Initialize Groq SDK if API key is present
const groqApiKey = process.env.GROQ_API_KEY || '';
const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

// Tool Declarations for Gemini Function Calling
const getOrderDetailsDeclaration = {
  name: 'get_order_details',
  description: 'Retrieve current status, customer details, product, delivery info, and notes for an Aura Skincare order ID (e.g., ORD-101, ORD-102, ORD-103).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      order_id: {
        type: Type.STRING,
        description: 'The order identifier, for example "ORD-101", "ORD-102", or "ORD-103".',
      },
    },
    required: ['order_id'],
  },
};

const cancelOrderDeclaration = {
  name: 'cancel_order',
  description: 'Cancel an order if its status is Processing. Rejects cancellation if already Shipped or Out for Delivery.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      order_id: {
        type: Type.STRING,
        description: 'The order identifier to cancel (e.g. ORD-103).',
      },
    },
    required: ['order_id'],
  },
};

// API: Get Mock Orders
app.get('/api/orders', (_req: Request, res: Response) => {
  res.json({
    orders: Object.values(MOCK_ORDERS_DB),
    policies: AURA_BRAND_POLICIES,
  });
});

// API: Conversational Voice Turn via Gemini with Tool Calling + Fallback
app.post('/api/chat', async (req: Request, res: Response) => {
  const { message, history = [] } = req.body;
  const userText = (message || '').trim();

  if (!userText) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Attempt server-side Gemini call if configured
  if (ai) {
    try {
      // Build conversation contents for Gemini with full multi-turn memory
      const formattedContents: any[] = [];
      if (Array.isArray(history) && history.length > 0) {
        const recent = history.slice(-8);
        for (const item of recent) {
          if (!item.content || typeof item.content !== 'string') continue;
          const role = item.role === 'assistant' || item.role === 'model' ? 'model' : 'user';
          if (formattedContents.length === 0 && role !== 'user') continue;
          const last = formattedContents[formattedContents.length - 1];
          if (last && last.role === role) {
            last.parts[0].text += `\n${item.content}`;
          } else {
            formattedContents.push({
              role,
              parts: [{ text: item.content }],
            });
          }
        }
      }

      // Append current userText
      const last = formattedContents[formattedContents.length - 1];
      if (last && last.role === 'user') {
        last.parts[0].text = userText;
      } else {
        formattedContents.push({
          role: 'user',
          parts: [{ text: userText }],
        });
      }

      const primaryModel = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
      const fallbackModel = 'gemini-3.1-flash-lite';
      let response: any;
      let usedModel = primaryModel;
      try {
        response = await ai.models.generateContent({
          model: primaryModel,
          contents: formattedContents,
          config: {
            systemInstruction: ARIA_SYSTEM_PROMPT,
            tools: [{ functionDeclarations: [getOrderDetailsDeclaration, cancelOrderDeclaration] }],
            temperature: 0.6,
            topP: 0.95,
          },
        });
      } catch (err: any) {
        console.warn(`Primary model ${primaryModel} failed, trying ${fallbackModel}:`, err?.message || err);
        usedModel = fallbackModel;
        response = await ai.models.generateContent({
          model: fallbackModel,
          contents: formattedContents,
          config: {
            systemInstruction: ARIA_SYSTEM_PROMPT,
            tools: [{ functionDeclarations: [getOrderDetailsDeclaration, cancelOrderDeclaration] }],
            temperature: 0.6,
            topP: 0.95,
          },
        });
      }

      const functionCalls = response.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        let toolResult: any = null;

        const rawArgId = String((call.args as any)?.order_id || '').trim();
        const numMatch = rawArgId.match(/(\d{3})/);
        const orderId = numMatch
          ? `ORD-${numMatch[1]}`
          : (rawArgId.toUpperCase().startsWith('ORD-') ? rawArgId.toUpperCase() : rawArgId);

        if (call.name === 'get_order_details') {
          toolResult = lookupOrderDetails(orderId);
        } else if (call.name === 'cancel_order') {
          toolResult = cancelOrderById(orderId);
        }

        // Send tool result back to Gemini preserving candidate thought_signature
        const candidateContent = response.candidates?.[0]?.content || {
          role: 'model',
          parts: [{ functionCall: call }],
        };

        const followUp = await ai.models.generateContent({
          model: usedModel,
          contents: [
            ...formattedContents,
            candidateContent,
            {
              role: 'user',
              parts: [
                {
                  functionResponse: {
                    name: call.name,
                    id: (call as any).id,
                    response: { result: toolResult },
                  },
                },
              ],
            },
          ],
          config: {
            systemInstruction: ARIA_SYSTEM_PROMPT,
            temperature: 0.5,
          },
        });

        const reply = followUp.text || `I retrieved the details for order ${orderId}.`;
        return res.json({
          reply,
          toolCall: {
            name: call.name,
            args: call.args,
            result: toolResult,
          },
          provider: usedModel,
        });
      }

      if (response.text) {
        return res.json({
          reply: response.text,
          provider: usedModel,
        });
      }
    } catch (geminiErr: any) {
      console.error('Gemini Error:', geminiErr?.message || geminiErr);
      // If Gemini rate-limits or fails, seamlessly fall through to deterministic CX engine
    }
  }

  // Deterministic Aura CX Engine Fallback (Zero downtime, zero token cost, instant response)
  const result = processAuraCustomerQuery(userText, history);
  return res.json({
    reply: result.reply,
    toolCall: result.toolCall,
    detectedOrderId: result.detectedOrderId,
    intent: result.intent,
    provider: 'aura-cx-engine',
  });
});

// Helper: Clean speech string to eliminate robotic reading of markdown symbols
function cleanTextForSpeechSynthesis(text: string): string {
  return text
    .replace(/[*_#`~]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/₹\s*(\d+)/g, '$1 rupees')
    .replace(/\bORD[- ]?(\d+)\b/gi, 'Order $1')
    .replace(/\bCOD\b/g, 'Cash on Delivery')
    .replace(/\bUPI\b/g, 'U P I')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
}

// API: Stream High-Fidelity Studio Neural Voice (100% Free, Unlimited)
app.post('/api/tts', async (req: Request, res: Response) => {
  const { text } = req.body;
  const rawText = (text || '').trim();
  if (!rawText) {
    return res.status(400).json({ error: 'Text is required' });
  }

  const cleanText = cleanTextForSpeechSynthesis(rawText);

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata('en-IN-NeerjaNeural', OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(cleanText);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    audioStream.pipe(res);
  } catch (err: any) {
    console.error('Edge TTS error:', err?.message || err);
    res.status(500).json({ error: 'TTS synthesis error' });
  }
});

// Filter common Whisper phantom/silence hallucinations
function isWhisperHallucination(text: string): boolean {
  const clean = text.trim().toLowerCase().replace(/[.,!?;:"]/g, '');
  const hallucinations = new Set([
    'thank you',
    'thanks',
    'thanks for watching',
    'thank you for watching',
    'thank you very much',
    'you',
    'bye',
    'goodbye',
    'subtitles by',
    'subtitle by',
    'subtitles by the amara.org community',
    'please subscribe',
    'see you next time',
    'blank_audio',
    'music',
    'applause',
    'silence',
    '',
  ]);
  return hallucinations.has(clean) || clean.startsWith('subtitle') || clean.startsWith('thank you for');
}

// API: WhisperFlow Neural Voice-to-Text Dictation (Groq Whisper + Gemini Flash Lite Hybrid)
app.post('/api/transcribe', async (req: Request, res: Response) => {
  const { audioData, mimeType = 'audio/webm' } = req.body;
  if (!audioData) {
    return res.status(400).json({ error: 'Audio data is required' });
  }

  const cleanMimeType = (mimeType || 'audio/webm').split(';')[0];

  // 1. Primary Engine: Ultra-Fast Groq Whisper (if GROQ_API_KEY is configured)
  if (groq) {
    try {
      const ext = cleanMimeType.includes('wav') ? 'wav' : cleanMimeType.includes('mp4') ? 'mp4' : 'webm';
      const audioBuffer = Buffer.from(audioData, 'base64');
      const file = await toFile(audioBuffer, `speech.${ext}`, { type: cleanMimeType });

      const transcription = await groq.audio.transcriptions.create({
        file,
        model: 'whisper-large-v3-turbo',
        language: 'en',
        prompt: 'Aura Skincare customer support assistant Aria. Orders: ORD-101, ORD-102, ORD-103. Policies: COD Cash on Delivery, UPI, returns, refunds, cancellations, SPF, Vitamin C serum.',
        temperature: 0,
        response_format: 'json',
      });

      const rawTranscript = (transcription.text || '').trim();
      if (rawTranscript && !isWhisperHallucination(rawTranscript)) {
        console.log(`[Groq Whisper] Transcribed: "${rawTranscript}"`);
        return res.json({ transcript: rawTranscript, engine: 'groq-whisper-turbo' });
      }
    } catch (groqErr: any) {
      console.warn('Groq Whisper transcription fallback to Gemini:', groqErr?.message || groqErr);
    }
  }

  // 2. Secondary Engine: Gemini Flash Lite Neural Transcription
  if (!ai) {
    return res.json({ transcript: '' });
  }

  try {
    const primaryModel = 'gemini-flash-lite-latest';
    const fallbackModel = 'gemini-3.1-flash-lite';

    const promptText = `You are WhisperFlow — an ultra-accurate neural speech-to-text dictation engine for customer support at Aura Skincare.
Transcribe this user speech audio with 100% human accuracy:
1. Intelligent Flow Cleanup: Automatically remove filler words (um, uh, ah, like, you know) and stutters.
2. Self-Corrections: If the speaker self-corrects (e.g., "order 101, no wait, 102"), output the corrected intent ("order 102").
3. Customer Support Accuracy:
   - Accurately identify order IDs as ORD-101, ORD-102, or ORD-103 (e.g. "order 102", "order 1 0 2", "one zero two" -> "order ORD-102").
   - Transcribe brand terminology correctly (Aura Skincare, SPF, COD, UPI).
4. Output ONLY the clean transcribed sentence without quotation marks, markdown, or conversational preambles. If there is only silence, noise, tone, or background static, return EMPTY.`;

    let response: any;
    try {
      response = await ai.models.generateContent({
        model: primaryModel,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: cleanMimeType,
                  data: audioData,
                },
              },
              { text: promptText },
            ],
          },
        ],
      });
    } catch {
      response = await ai.models.generateContent({
        model: fallbackModel,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: cleanMimeType,
                  data: audioData,
                },
              },
              { text: promptText },
            ],
          },
        ],
      });
    }

    let rawTranscript = (response.text || '').trim().replace(/^["']|["']$/g, '');
    if (
      rawTranscript.toUpperCase() === 'EMPTY' ||
      rawTranscript.toLowerCase() === 'empty.' ||
      isWhisperHallucination(rawTranscript)
    ) {
      rawTranscript = '';
    }
    return res.json({ transcript: rawTranscript, engine: 'gemini-whisperflow' });
  } catch (err: any) {
    console.warn('WhisperFlow Transcribe warning:', err?.message || err);
    return res.json({ transcript: '' });
  }
});

// API: Generate Post-Call Structured Outcome Summary
app.post('/api/summary', async (req: Request, res: Response) => {
  const { transcript = [] } = req.body;

  if (ai && transcript.length > 0) {
    try {
      const transcriptText = transcript
        .map((t: any) => `${t.speaker === 'customer' ? 'Customer' : 'Aria (Aura Skincare)'}: ${t.text}`)
        .join('\n');

      const prompt = `Analyze this customer support call transcript for Aura Skincare and produce a structured JSON summary matching this schema:
{
  "customer_intent": "ORDER_TRACKING" | "RETURN_OR_REFUND" | "ORDER_CANCELLATION" | "PRODUCT_INQUIRY" | "POLICY_QUESTION" | "OUT_OF_SCOPE" | "GENERAL_INQUIRY",
  "order_id": "ORD-101" or null,
  "resolution_status": "RESOLVED" | "POLICY_EXPLAINED" | "NEEDS_FOLLOW_UP" | "OUT_OF_SCOPE",
  "call_summary": "1-2 sentence description of customer request and outcome."
}

Transcript:
${transcriptText}`;

      let response: any;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-flash-lite-latest',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });
      } catch {
        response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });
      }

      if (response.text) {
        const parsed = JSON.parse(response.text.trim());
        return res.json({
          ...parsed,
          transcript,
        });
      }
    } catch {}
  }

  // Deterministic summary fallback
  const summary = generateCallOutcomeSummary(transcript);
  return res.json(summary);
});

// Mount Vite or static server
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`);
    if (groq) {
      console.log('Groq Whisper Engine: ACTIVE (Ultra-Fast Whisper-Large-v3-Turbo)');
    } else {
      console.log('Groq Whisper Engine: Waiting for GROQ_API_KEY in .env (Gemini WhisperFlow active)');
    }
    if (ai) {
      console.log('Gemini AI Engine: ACTIVE (Connected with Google Gemini API)');
    } else {
      console.log('Gemini AI Engine: Fallback CX Engine active (Add GEMINI_API_KEY in .env for live Gemini)');
    }
  });
}

startServer();
