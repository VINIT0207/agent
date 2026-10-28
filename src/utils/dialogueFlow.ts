import { AssistantState, DialogueItem, OrderDetails } from '../types/assistant';

export const INITIAL_ORDER: OrderDetails = {
  id: 'ORD-101',
  customer: 'Elena Vance',
  product: 'Botanical Vitamin C Radiance Serum',
  volume: '50ml / 1.7 fl oz',
  status: 'In Transit',
  carrier: 'EcoExpress Carbon-Neutral',
  trackingNumber: 'AURA-ECO-889210-XC',
  estimatedDelivery: 'Tomorrow, by 2:00 PM',
  botanicalBatch: 'Batch #BV-2026-OCT',
  ingredients: [
    'Cold-pressed Kakadu Plum (15% Active Vitamin C)',
    'Wild-harvested Cloudberry Seed Oil',
    'Plant-derived Squalane from Sugarcane',
    'Bio-fermented Hyaluronic Complex',
    'French Sea Fennel Botanical Extract',
  ],
};

export const DEMO_DIALOGUE: DialogueItem[] = [
  {
    id: 'turn-1',
    speaker: 'aria',
    text: 'I checked your order ORD-101 for the Vitamin C Serum. It is freshly compounded and scheduled to arrive tomorrow afternoon.',
    orderId: 'ORD-101',
    productName: 'Botanical Vitamin C Radiance Serum',
    timestamp: '00:03',
  },
  {
    id: 'turn-2',
    speaker: 'user',
    text: 'Wonderful, thank you Aria. Should I apply it in the morning or at night with my retinol?',
    timestamp: '00:09',
  },
  {
    id: 'turn-3',
    speaker: 'aria',
    text: 'For optimal barrier luminosity, apply 3 to 4 drops every morning onto damp skin before sunscreen. Avoid combining it directly in the same evening ritual with your retinol.',
    timestamp: '00:15',
  },
  {
    id: 'turn-4',
    speaker: 'user',
    text: 'Are all the active extracts cold-pressed and organic certified?',
    timestamp: '00:23',
  },
  {
    id: 'turn-5',
    speaker: 'aria',
    text: 'Every batch is 100% cold-pressed under zero thermal oxidation and certified by COSMOS Organic. Batch BV-2026-OCT passed purity verification this morning.',
    timestamp: '00:29',
  },
  {
    id: 'turn-6',
    speaker: 'user',
    text: 'Can I add the Ceramide Barrier Balm to my subscription for next month?',
    timestamp: '00:37',
  },
  {
    id: 'turn-7',
    speaker: 'aria',
    text: 'I have queued the Ceramide Barrier Balm for your November replenishment with your exclusive member 15% VIP privilege applied.',
    timestamp: '00:43',
  },
];

export interface CallSessionState {
  currentTurnIndex: number;
  assistantState: AssistantState;
  interruptionEnabled: boolean;
  isMuted: boolean;
  callActive: boolean;
  elapsedSeconds: number;
}

export function createInitialSession(): CallSessionState {
  return {
    currentTurnIndex: 0,
    assistantState: 'speaking',
    interruptionEnabled: true,
    isMuted: false,
    callActive: true,
    elapsedSeconds: 0,
  };
}

export function advanceDialogue(session: CallSessionState, totalTurns: number = DEMO_DIALOGUE.length): CallSessionState {
  if (!session.callActive) {
    return session;
  }
  const nextIndex = (session.currentTurnIndex + 1) % totalTurns;
  const nextSpeaker = DEMO_DIALOGUE[nextIndex]?.speaker ?? 'aria';
  const nextState: AssistantState = nextSpeaker === 'aria' ? 'speaking' : 'listening';

  return {
    ...session,
    currentTurnIndex: nextIndex,
    assistantState: nextState,
  };
}

export function handleUserInterruption(session: CallSessionState): CallSessionState {
  if (!session.callActive || !session.interruptionEnabled) {
    return session;
  }
  return {
    ...session,
    assistantState: 'listening',
  };
}

export function endCallSession(session: CallSessionState): CallSessionState {
  return {
    ...session,
    callActive: false,
    assistantState: 'ended',
  };
}

export function restartCallSession(): CallSessionState {
  return createInitialSession();
}

export function formatCallDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function getStatusText(state: AssistantState): string {
  switch (state) {
    case 'idle':
      return 'Aria is Ready';
    case 'listening':
      return 'Aria is Listening...';
    case 'thinking':
      return 'Aria is Thinking...';
    case 'speaking':
      return 'Aria is Speaking...';
    case 'ended':
      return 'Call Ended';
  }
}
