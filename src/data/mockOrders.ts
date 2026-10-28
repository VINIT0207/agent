export interface MockOrder {
  orderId: string;
  customerName: string;
  product: string;
  value: string;
  status: 'Out for Delivery' | 'Delivered' | 'Processing' | 'Cancelled';
  notes: string;
  orderDate: string;
  deliveryDate?: string;
  courier?: string;
  trackingNumber?: string;
  eligibleForCancellation: boolean;
  eligibleForReturn: boolean;
}

export const MOCK_ORDERS_DB: Record<string, MockOrder> = {
  'ORD-101': {
    orderId: 'ORD-101',
    customerName: 'Priya Sharma',
    product: 'Vitamin C Serum (30ml)',
    value: '₹699',
    status: 'Out for Delivery',
    notes: 'BlueDart — BD-982103. Expected by 6 PM today',
    orderDate: '2 days ago',
    courier: 'BlueDart',
    trackingNumber: 'BD-982103',
    eligibleForCancellation: false,
    eligibleForReturn: false, // Not delivered yet
  },
  'ORD-102': {
    orderId: 'ORD-102',
    customerName: 'Rahul Verma',
    product: 'Hydrating Sunscreen SPF 50',
    value: '₹499',
    status: 'Delivered',
    notes: 'Delhivery — DL-441029. Delivered 14 days ago',
    orderDate: '17 days ago',
    deliveryDate: '14 days ago',
    courier: 'Delhivery',
    trackingNumber: 'DL-441029',
    eligibleForCancellation: false,
    eligibleForReturn: false, // Past 7-day return policy
  },
  'ORD-103': {
    orderId: 'ORD-103',
    customerName: 'Ananya Patel',
    product: 'Green Tea Face Wash + Toner',
    value: '₹850',
    status: 'Processing',
    notes: 'Ordered 3 hours ago. Eligible for cancellation',
    orderDate: '3 hours ago',
    eligibleForCancellation: true,
    eligibleForReturn: false,
  },
};

export const AURA_BRAND_POLICIES = {
  brandName: 'Aura Skincare',
  tagline: 'Simple, effective organic skincare made with thoughtfully selected ingredients',
  shippingPolicy: {
    freeShippingThreshold: 499,
    shippingFeeBelowThreshold: 50,
    deliveryWindow: '3–5 business days across India',
  },
  returnAndRefundPolicy: {
    returnWindowDays: 7,
    conditions: 'Returns accepted within 7 days of delivery only for unopened, unused products in original packaging.',
    damagedOrDefective: 'Damaged or defective products must be reported within 48 hours of delivery along with unboxing photos for an immediate free replacement.',
  },
  cancellationPolicy: {
    rule: 'Orders can only be cancelled while their status is Processing. Once an order is Shipped or Out for Delivery, it cannot be cancelled in the system, but customers may refuse delivery at the doorstep.',
  },
  cashOnDeliveryPolicy: {
    maxAmount: 2500,
    paymentModes: 'Cash or UPI (Google Pay, PhonePe, Paytm) at doorstep',
  },
};

export function lookupOrderDetails(orderId: string): { found: boolean; data?: MockOrder; error?: string } {
  const normalizedId = orderId.trim().toUpperCase();
  const order = MOCK_ORDERS_DB[normalizedId];
  if (!order) {
    return {
      found: false,
      error: `Order with ID "${orderId}" was not found in our database.`,
    };
  }
  return {
    found: true,
    data: order,
  };
}

export function cancelOrderById(orderId: string): { success: boolean; message: string; order?: MockOrder } {
  const normalizedId = orderId.trim().toUpperCase();
  const order = MOCK_ORDERS_DB[normalizedId];
  if (!order) {
    return {
      success: false,
      message: `I couldn't locate order "${orderId}" to cancel. Please verify the order ID.`,
    };
  }

  if (order.status !== 'Processing') {
    return {
      success: false,
      message: `Order ${normalizedId} cannot be cancelled because its current status is "${order.status}". Under Aura Skincare policy, orders can only be cancelled while Processing. If you do not wish to keep the order, you may politely refuse delivery at your doorstep.`,
      order,
    };
  }

  order.status = 'Cancelled';
  order.notes = 'Cancelled by customer via Aria Voice Support';
  order.eligibleForCancellation = false;

  return {
    success: true,
    message: `Order ${normalizedId} for ${order.product} (${order.value}) has been successfully cancelled. A confirmation SMS and email have been sent to ${order.customerName}.`,
    order,
  };
}
