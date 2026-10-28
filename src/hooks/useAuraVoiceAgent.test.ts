import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOCK_ORDERS_DB,
  lookupLocalOrder,
  calculateAverageAmplitude,
  downsampleFloat32To16kPCM,
  int16ArrayToBase64,
  base64ToFloat32Array24k,
  SILENCE_RMS_THRESHOLD,
} from './useAuraVoiceAgent';

/* ----------------------------------------------------------------------------
 * 1. MOCK DATABASE & TOOL CALLING TESTS
 * ---------------------------------------------------------------------------- */

test('Tool Calling: retrieves ORD-101 correctly with BlueDart tracking', () => {
  const ord101 = lookupLocalOrder('ORD-101') as any;
  assert.equal(ord101.order_id, 'ORD-101');
  assert.equal(ord101.customer, 'Priya Sharma');
  assert.equal(ord101.product, 'Vitamin C Serum (30ml)');
  assert.equal(ord101.status, 'Out for Delivery');
  assert.equal(ord101.carrier, 'BlueDart');
  assert.equal(ord101.tracking_id, 'BD-982103');
  assert.equal(ord101.cancellable, false);
});

test('Tool Calling: retrieves ORD-102 with non-returnable 14-day policy enforcement', () => {
  const ord102 = lookupLocalOrder('ORD-102') as any;
  assert.equal(ord102.order_id, 'ORD-102');
  assert.equal(ord102.customer, 'Rahul Verma');
  assert.equal(ord102.status, 'Delivered');
  assert.equal(ord102.carrier, 'Delhivery');
  assert.equal(ord102.return_eligible, false);
  assert.match(ord102.notes, /exceeds the 7-day unopened return policy/i);
});

test('Tool Calling: retrieves ORD-103 with eligible cancellation status', () => {
  const ord103 = lookupLocalOrder('ORD-103') as any;
  assert.equal(ord103.order_id, 'ORD-103');
  assert.equal(ord103.customer, 'Ananya Patel');
  assert.equal(ord103.status, 'Processing');
  assert.equal(ord103.cancellable, true);
  assert.match(ord103.notes, /eligible for immediate cancellation/i);
});

test('Tool Calling: normalizes variations ("101", "ord 102", "ORD-103")', () => {
  const numOnly = lookupLocalOrder('101') as any;
  assert.equal(numOnly.order_id, 'ORD-101');

  const spaced = lookupLocalOrder('ord 102') as any;
  assert.equal(spaced.order_id, 'ORD-102');

  const lower = lookupLocalOrder('ord-103') as any;
  assert.equal(lower.order_id, 'ORD-103');

  const notFound = lookupLocalOrder('ORD-999');
  assert.ok('error' in notFound);
});

/* ----------------------------------------------------------------------------
 * 2. AUDIO DATA INTEGRITY RULE 2: PRECISE 16KHZ LINEAR PCM DOWNSAMPLING
 * ---------------------------------------------------------------------------- */

test('Downsampling: 48000Hz native audio resamples to exactly 16000Hz (3:1 ratio)', () => {
  // 48000Hz buffer of 2400 samples (50ms)
  const input48k = new Float32Array(2400);
  for (let i = 0; i < input48k.length; i++) {
    // 440Hz sine wave tone at amplitude 0.5
    input48k[i] = Math.sin((2 * Math.PI * 440 * i) / 48000) * 0.5;
  }

  const pcm16 = downsampleFloat32To16kPCM(input48k, 48000, false);
  // Expected length = 2400 / (48000/16000) = 800 samples (50ms at 16kHz)
  assert.equal(pcm16.length, 800);
  assert.ok(pcm16 instanceof Int16Array);

  // Check that values are within valid Int16 bounds [-32768, 32767]
  let hasNonZero = false;
  for (let i = 0; i < pcm16.length; i++) {
    assert.ok(pcm16[i] >= -32768 && pcm16[i] <= 32767);
    if (pcm16[i] !== 0) hasNonZero = true;
  }
  assert.ok(hasNonZero, 'Downsampled audio should contain reconstructed wave samples');
});

test('Downsampling: 44100Hz audio downsamples accurately to 16000Hz', () => {
  // 44100Hz buffer of 2205 samples (50ms)
  const input44k = new Float32Array(2205);
  for (let i = 0; i < input44k.length; i++) {
    input44k[i] = Math.sin((2 * Math.PI * 1000 * i) / 44100) * 0.6;
  }

  const pcm16 = downsampleFloat32To16kPCM(input44k, 44100, false);
  // 2205 / (44100/16000) = 800 samples
  assert.equal(pcm16.length, 800);
  assert.ok(pcm16 instanceof Int16Array);
});

test('Downsampling: 16000Hz native audio converts 1:1 without length deviation', () => {
  const input16k = new Float32Array(800);
  input16k[0] = 0.5;
  input16k[1] = -0.5;

  const pcm16 = downsampleFloat32To16kPCM(input16k, 16000, false);
  assert.equal(pcm16.length, 800);
  assert.equal(pcm16[0], Math.floor(0.5 * 32767));
  assert.equal(pcm16[1], Math.floor(-0.5 * 32768));
});

test('Downsampling: Hard clipping guards against audio overflow > 1.0 or < -1.0', () => {
  const clippedInput = new Float32Array([2.5, -3.8]);
  const pcm16 = downsampleFloat32To16kPCM(clippedInput, 16000, false);
  assert.equal(pcm16[0], 32767);
  assert.equal(pcm16[1], -32768);
});

/* ----------------------------------------------------------------------------
 * 3. AUDIO DATA INTEGRITY RULE 3: SILENCE CLIPPING (NO ROOM HUM)
 * ---------------------------------------------------------------------------- */

test('Silence Clipping: Detects low-energy room hum and suppresses to flat zeros', () => {
  // Simulate ambient fan hum / room noise (amplitude ~ 0.003, well below 0.012 threshold)
  const roomHum = new Float32Array(2400);
  for (let i = 0; i < roomHum.length; i++) {
    roomHum[i] = (Math.random() - 0.5) * 0.006; // max abs ~ 0.003
  }

  const avgAmp = calculateAverageAmplitude(roomHum);
  assert.ok(avgAmp < SILENCE_RMS_THRESHOLD, `Room hum (${avgAmp}) should be below threshold (${SILENCE_RMS_THRESHOLD})`);

  const pcm16 = downsampleFloat32To16kPCM(roomHum, 48000, true);
  assert.equal(pcm16.length, 800);

  // Every single sample must be exactly zero (flat silent array)
  const allZeros = pcm16.every((val) => val === 0);
  assert.equal(allZeros, true, 'Suppressed silence buffer must contain strictly zeros');
});

test('Silence Clipping: Human speech amplitude passes unmuted', () => {
  // Simulate normal conversational human speech (amplitude ~ 0.15)
  const speech = new Float32Array(2400);
  for (let i = 0; i < speech.length; i++) {
    speech[i] = Math.sin((2 * Math.PI * 300 * i) / 48000) * 0.25;
  }

  const avgAmp = calculateAverageAmplitude(speech);
  assert.ok(avgAmp > SILENCE_RMS_THRESHOLD, `Speech amplitude (${avgAmp}) must be above threshold`);

  const pcm16 = downsampleFloat32To16kPCM(speech, 48000, false);
  const isAllZero = pcm16.every((val) => val === 0);
  assert.equal(isAllZero, false, 'Speech audio must not be zeroed out');
});

/* ----------------------------------------------------------------------------
 * 4. BASE64 ENCODING & 24KHZ PLAYBACK ROUNDTRIP
 * ---------------------------------------------------------------------------- */

test('Base64 Conversion: encodes Int16 PCM array into standard base64 string', () => {
  const pcm16 = new Int16Array([0, 1000, -1000, 32767, -32768]);
  const b64 = int16ArrayToBase64(pcm16);
  assert.equal(typeof b64, 'string');
  assert.ok(b64.length > 0);

  // Decode back and verify
  const binary = Buffer.from(b64, 'base64');
  assert.equal(binary.length, pcm16.byteLength);
  const roundtrip = new Int16Array(binary.buffer, binary.byteOffset, pcm16.length);
  assert.deepEqual(Array.from(roundtrip), Array.from(pcm16));
});

test('Base64 Conversion: base64ToFloat32Array24k decodes 24kHz audio chunks for playback', () => {
  const original = new Int16Array([16384, -16384, 0]);
  const b64 = int16ArrayToBase64(original);

  const float32 = base64ToFloat32Array24k(b64);
  assert.equal(float32.length, 3);
  assert.ok(Math.abs(float32[0] - 0.5) < 0.001);
  assert.ok(Math.abs(float32[1] - -0.5) < 0.001);
  assert.equal(float32[2], 0);
});
