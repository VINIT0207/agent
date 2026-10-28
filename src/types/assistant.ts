export type AssistantState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'ended';

export type CallStatus = 'connected' | 'ended' | 'reconnecting';

export interface TranscriptItem {
  id?: string;
  speaker: 'customer' | 'aria';
  text: string;
  timestamp: string;
  toolCall?: {
    name: string;
    args: any;
    result: any;
  };
}

export interface PostCallSummary {
  customer_intent: 'ORDER_TRACKING' | 'RETURN_OR_REFUND' | 'ORDER_CANCELLATION' | 'PRODUCT_INQUIRY' | 'POLICY_QUESTION' | 'OUT_OF_SCOPE' | 'GENERAL_INQUIRY';
  order_id: string | null;
  resolution_status: 'RESOLVED' | 'POLICY_EXPLAINED' | 'NEEDS_FOLLOW_UP' | 'OUT_OF_SCOPE';
  call_summary: string;
  transcript?: TranscriptItem[];
}

export interface DialogueItem {
  id: string;
  speaker: 'aria' | 'user' | 'customer';
  text: string;
  orderId?: string;
  productName?: string;
  timestamp: string;
}

export interface OrderDetails {
  id: string;
  customer: string;
  product?: string;
  volume?: string;
  status: string;
  carrier?: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
  botanicalBatch?: string;
  ingredients?: string[];
  items?: Array<{ name: string; quantity: number; price: number }>;
  totalAmount?: number;
  deliveryDate?: string;
  isOpened?: boolean;
  canCancel?: boolean;
  reason?: string;
  [key: string]: any;
}

export interface ModelAssetStatus {
  loaded: boolean;
  source: 'external-file' | 'local-upload' | 'standin-procedural';
  fileName?: string;
  vertexCount?: number;
  hasAnimations?: boolean;
  animationCount?: number;
  error?: string | null;
}

