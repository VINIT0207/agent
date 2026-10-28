import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialSession,
  advanceDialogue,
  handleUserInterruption,
  endCallSession,
  restartCallSession,
  formatCallDuration,
  getStatusText,
  DEMO_DIALOGUE,
} from './dialogueFlow';
import { lookupOrderDetails, cancelOrderById } from '../data/mockOrders';
import { processAuraCustomerQuery, generateCallOutcomeSummary } from '../services/auraAgentEngine';

test('createInitialSession initializes active call with speaking state', () => {
  const session = createInitialSession();
  assert.equal(session.callActive, true);
  assert.equal(session.assistantState, 'speaking');
  assert.equal(session.interruptionEnabled, true);
  assert.equal(session.currentTurnIndex, 0);
});

test('advanceDialogue iterates turns correctly', () => {
  let session = createInitialSession();
  assert.equal(session.currentTurnIndex, 0);

  session = advanceDialogue(session);
  assert.equal(session.currentTurnIndex, 1);
  assert.equal(session.assistantState, 'listening');

  session = advanceDialogue(session);
  assert.equal(session.currentTurnIndex, 2);
  assert.equal(session.assistantState, 'speaking');
});

test('handleUserInterruption shifts to listening if enabled', () => {
  const session = createInitialSession();
  assert.equal(session.interruptionEnabled, true);

  const interrupted = handleUserInterruption(session);
  assert.equal(interrupted.assistantState, 'listening');

  const disabledSession = { ...session, interruptionEnabled: false };
  const blockedInterruption = handleUserInterruption(disabledSession);
  assert.equal(blockedInterruption.assistantState, 'speaking');
});

test('endCallSession sets callActive false and state ended', () => {
  const session = createInitialSession();
  const ended = endCallSession(session);
  assert.equal(ended.callActive, false);
  assert.equal(ended.assistantState, 'ended');

  const advanced = advanceDialogue(ended);
  assert.equal(advanced.currentTurnIndex, 0);
  assert.equal(advanced.callActive, false);
});

test('formatCallDuration formats seconds to MM:SS correctly', () => {
  assert.equal(formatCallDuration(0), '00:00');
  assert.equal(formatCallDuration(59), '00:59');
  assert.equal(formatCallDuration(65), '01:05');
  assert.equal(formatCallDuration(732), '12:12');
});

test('getStatusText maps assistant states to exact labels', () => {
  assert.equal(getStatusText('idle'), 'Aria is Ready');
  assert.equal(getStatusText('listening'), 'Aria is Listening...');
  assert.equal(getStatusText('thinking'), 'Aria is Thinking...');
  assert.equal(getStatusText('speaking'), 'Aria is Speaking...');
  assert.equal(getStatusText('ended'), 'Call Ended');
});

/* -------------------------------------------------------------
 * Aura Skincare D2C Assessment Requirement Tests
 * ------------------------------------------------------------- */

test('Tool Calling: lookupOrderDetails correctly retrieves mock orders', () => {
  const ord101 = lookupOrderDetails('ORD-101');
  assert.equal(ord101.found, true);
  assert.equal(ord101.data?.customerName, 'Priya Sharma');
  assert.equal(ord101.data?.status, 'Out for Delivery');

  const ord102 = lookupOrderDetails('ORD-102');
  assert.equal(ord102.found, true);
  assert.equal(ord102.data?.customerName, 'Rahul Verma');
  assert.equal(ord102.data?.status, 'Delivered');

  const ord103 = lookupOrderDetails('ORD-103');
  assert.equal(ord103.found, true);
  assert.equal(ord103.data?.customerName, 'Ananya Patel');
  assert.equal(ord103.data?.status, 'Processing');

  const invalid = lookupOrderDetails('ORD-999');
  assert.equal(invalid.found, false);
});

test('Tool Calling & Policy: cancellation rules are strictly enforced', () => {
  // ORD-103 is Processing -> eligible for cancellation
  const cancel103 = cancelOrderById('ORD-103');
  assert.equal(cancel103.success, true);
  assert.match(cancel103.message, /successfully cancelled/i);

  // ORD-101 is Out for Delivery -> cannot be cancelled
  const cancel101 = cancelOrderById('ORD-101');
  assert.equal(cancel101.success, false);
  assert.match(cancel101.message, /cannot be cancelled/i);
  assert.match(cancel101.message, /doorstep/i);
});

test('Guardrails: Out-of-scope queries are politely redirected', () => {
  const flightQuery = processAuraCustomerQuery('Can you book me a flight to Goa?', []);
  assert.equal(flightQuery.intent, 'OUT_OF_SCOPE');
  assert.match(flightQuery.reply, /Aura Skincare/);
  assert.match(flightQuery.reply, /only assist with/);
});

test('Policy Enforcement: Returns outside 7 days or opened products are rejected', () => {
  const returnQuery = processAuraCustomerQuery('I bought this 20 days ago and have opened it. Can I return it?', []);
  assert.equal(returnQuery.intent, 'RETURN_OR_REFUND');
  assert.match(returnQuery.reply, /7 days/);
  assert.match(returnQuery.reply, /cannot offer a return or refund/);
});

test('Post-Call Summary: Generates structured JSON outcome matching Section 2D', () => {
  const sampleTranscript = [
    { speaker: 'customer' as const, text: 'Can you tell me where my order ORD-101 is?', timestamp: '00:05' },
    { speaker: 'aria' as const, text: 'Your order ORD-101 is out for delivery and expected by 6 PM today.', timestamp: '00:10' },
  ];

  const summary = generateCallOutcomeSummary(sampleTranscript);
  assert.equal(summary.customer_intent, 'ORDER_TRACKING');
  assert.equal(summary.order_id, 'ORD-101');
  assert.equal(summary.resolution_status, 'RESOLVED');
  assert.ok(summary.call_summary.length > 10);
});
