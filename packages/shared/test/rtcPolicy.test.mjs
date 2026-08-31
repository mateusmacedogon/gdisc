import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getRtcNegotiationRetryDelay,
  matchesRtcConnection,
  shouldInitiateRtcConnection,
} from '../dist/rtcPolicy.js';

test('elects exactly one RTC offerer for every peer pair', () => {
  const first = '0a000000-0000-0000-0000-000000000000';
  const second = 'f0000000-0000-0000-0000-000000000000';
  assert.equal(shouldInitiateRtcConnection(first, second), true);
  assert.equal(shouldInitiateRtcConnection(second, first), false);
});

test('rejects delayed signals from an older connection generation', () => {
  assert.equal(matchesRtcConnection('current', 'current'), true);
  assert.equal(matchesRtcConnection('current', 'old'), false);
  assert.equal(matchesRtcConnection('current', undefined), true);
});

test('backs signaling retries off and caps them at eight seconds', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7].map(getRtcNegotiationRetryDelay),
    [400, 800, 1_600, 3_200, 6_400, 8_000, 8_000],
  );
});
