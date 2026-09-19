/**
 * Limit-transparency behaviour.
 *
 * Before this, every backend refusal except the in-Lambda per-IP limiter reached the
 * browser without a CORS header, so JavaScript saw `status = 0` and classified it as a
 * retryable generic error. Three consequences: the user was told "search unavailable"
 * when the truth was "today's allowance is spent, back at 02:00"; the retry doubled
 * load exactly when the backend was shedding it; and quota exhaustion, a WAF block, DNS
 * failure and a CSP misconfiguration were indistinguishable.
 *
 * These tests drive the REAL module against a mocked fetch. A predicate-only suite is
 * not sufficient and this codebase has proven it: 29 predicate tests once passed with
 * the behaviour they described deleted from the input handler.
 */

'use strict';

const search = require('../../assets/js/semantic-search.js');

// ---------------------------------------------------------------------------
// parseErrorCode
// ---------------------------------------------------------------------------

describe('parseErrorCode', () => {
  test('reads the code from an edge rejection body', () => {
    expect(search._parseErrorCode('{"error":"quota_exceeded","scope":"daily"}'))
      .toBe('quota_exceeded');
    expect(search._parseErrorCode('{"error":"rate_limited","scope":"ip"}'))
      .toBe('rate_limited');
  });

  test('returns null for anything unusable, so classification falls back to status', () => {
    expect(search._parseErrorCode('')).toBeNull();
    expect(search._parseErrorCode('not json')).toBeNull();
    expect(search._parseErrorCode('null')).toBeNull();
    expect(search._parseErrorCode('[]')).toBeNull();
    expect(search._parseErrorCode('{"message":"Forbidden"}')).toBeNull();
    expect(search._parseErrorCode('{"error":42}')).toBeNull();
    expect(search._parseErrorCode(undefined)).toBeNull();
  });

  test('a Lambda error body is still read, and does not collide with an edge code', () => {
    // The handler's own errors are human messages, not these codes, so a Lambda body
    // never matches one of the edge branches in classifyFailure.
    const code = search._parseErrorCode('{"error":"locale must be de or en"}');
    expect(code).toBe('locale must be de or en');
    expect(['quota_exceeded', 'throttled', 'rate_limited', 'unavailable'])
      .not.toContain(code);
  });
});

// ---------------------------------------------------------------------------
// classifyFailure -- what gets retried
// ---------------------------------------------------------------------------

describe('classifyFailure', () => {
  const fresh = () => ({ timedOut: false, attempt: 1 });

  test('a spent daily quota is NOT retryable', () => {
    expect(search._classifyFailure(fresh(), 429, 'quota_exceeded'))
      .toEqual({ retryable: false, kind: 'quotaExhausted' });
  });

  test('burst throttling is NOT retryable', () => {
    expect(search._classifyFailure(fresh(), 429, 'throttled'))
      .toEqual({ retryable: false, kind: 'busy' });
  });

  test('a WAF per-IP block is NOT retryable, and reuses the rateLimited path', () => {
    expect(search._classifyFailure(fresh(), 429, 'rate_limited'))
      .toEqual({ retryable: false, kind: 'rateLimited' });
  });

  test('saturation IS retryable -- it clears in milliseconds', () => {
    expect(search._classifyFailure(fresh(), 500, 'unavailable'))
      .toEqual({ retryable: true, kind: 'busy' });
  });

  test('the code wins over the status, because 429 alone is ambiguous', () => {
    // Both of these are HTTP 429. One clears in under a second, the other in up to
    // 24 hours. Classifying on status alone cannot tell them apart.
    const quota = search._classifyFailure(fresh(), 429, 'quota_exceeded');
    const throttle = search._classifyFailure(fresh(), 429, 'throttled');
    expect(quota.kind).not.toBe(throttle.kind);
  });

  test('a genuine network failure stays retryable', () => {
    // status 0 means no response arrived at all -- network, DNS, or a CSP block. That
    // is transient and indistinguishable at this point, so it must still retry.
    expect(search._classifyFailure(fresh(), 0, null))
      .toEqual({ retryable: true, kind: 'error' });
  });

  test('a timeout is still checked first', () => {
    expect(search._classifyFailure({ timedOut: true, attempt: 1 }, 429, 'quota_exceeded'))
      .toEqual({ retryable: true, kind: 'timeout' });
  });

  test('unknown codes fall back to status classification', () => {
    expect(search._classifyFailure(fresh(), 503, 'something_new'))
      .toEqual({ retryable: true, kind: 'error' });
    expect(search._classifyFailure(fresh(), 400, 'something_new'))
      .toEqual({ retryable: false, kind: 'error' });
  });
});

// ---------------------------------------------------------------------------
// quotaResetTime
// ---------------------------------------------------------------------------

describe('quotaResetTime', () => {
  test('is the next midnight UTC, not 24 hours from now', () => {
    // The API Gateway quota period is DAY and resets at midnight UTC. A naive
    // "now + 24h" would be wrong by up to a day.
    const at = new Date('2026-08-28T15:00:00Z');
    const expected = new Date(Date.UTC(2026, 7, 29, 0, 0, 0, 0));
    expect(search._quotaResetTime(at))
      .toBe(expected.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }));
  });

  test('rolls over month and year boundaries', () => {
    expect(() => search._quotaResetTime(new Date('2026-12-31T23:59:59Z'))).not.toThrow();
    expect(() => search._quotaResetTime(new Date('2026-01-31T12:00:00Z'))).not.toThrow();
  });

  test('one minute before reset gives the same instant, not tomorrow', () => {
    const a = search._quotaResetTime(new Date('2026-08-28T23:59:00Z'));
    const b = search._quotaResetTime(new Date('2026-08-28T00:01:00Z'));
    expect(a).toBe(b);
  });

  test('works with no argument', () => {
    expect(typeof search._quotaResetTime()).toBe('string');
    expect(search._quotaResetTime().length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// failureMessage -- what the user actually reads
// ---------------------------------------------------------------------------

describe('failureMessage', () => {
  let saved;
  beforeEach(() => {
    saved = search._getStringsForTest();
    search._setStringsForTest(search.I18N_DEFAULTS);
  });
  afterEach(() => search._setStringsForTest(saved));

  test('the quota message names a wall-clock time, not a duration', () => {
    const at = new Date('2026-08-28T15:00:00Z');
    const msg = search._failureMessage(
      { retryable: false, kind: 'quotaExhausted' }, null, at
    );
    expect(msg.title).toBe(search.I18N_DEFAULTS.quotaExhausted);
    expect(msg.hint).not.toContain('{time}');
    expect(msg.hint).toContain(search._quotaResetTime(at));
  });

  test('the busy message carries NO countdown, deliberately', () => {
    const msg = search._failureMessage({ retryable: true, kind: 'busy' }, 300, new Date());
    // A number here would be theatre: the wait is milliseconds to a second.
    expect(msg.hint).not.toMatch(/\d+\s*(Sekunden|seconds)/);
    expect(msg.hint).toBe(search.I18N_DEFAULTS.busyHint);
  });

  test('a WAF block still gets the existing Retry-After treatment', () => {
    const msg = search._failureMessage({ retryable: false, kind: 'rateLimited' }, 300, new Date());
    expect(msg.title).toBe(search.I18N_DEFAULTS.rateLimited);
    expect(msg.hint).toContain('300');
  });

  test('quota and busy are distinguishable from the generic error', () => {
    const now = new Date();
    const titles = ['quotaExhausted', 'busy', 'error'].map(
      (kind) => search._failureMessage({ kind: kind }, null, now).title
    );
    expect(new Set(titles).size).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// i18n completeness
// ---------------------------------------------------------------------------

describe('i18n', () => {
  test('every new string exists in the defaults', () => {
    for (const key of ['quotaExhausted', 'quotaExhaustedHint', 'busy', 'busyHint']) {
      expect(typeof search.I18N_DEFAULTS[key]).toBe('string');
      expect(search.I18N_DEFAULTS[key].length).toBeGreaterThan(0);
    }
  });

  test('the quota hint carries the {time} placeholder', () => {
    // Without the placeholder the message would silently omit the one fact that makes
    // it actionable.
    expect(search.I18N_DEFAULTS.quotaExhaustedHint).toContain('{time}');
  });
});
