import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HostCapabilityConfigError,
  createHostCapability,
  verifyHostCapability,
} from './host-capability';

const classroom = {
  id: '11111111-1111-1111-1111-111111111111',
  host_link_nonce: '22222222-2222-2222-2222-222222222222',
};

describe('host capability tokens', () => {
  beforeEach(() => {
    vi.stubEnv('HOST_CAPABILITY_SECRET', 'test-host-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates a stable token for the same classroom nonce', () => {
    expect(createHostCapability(classroom)).toBe(createHostCapability(classroom));
  });

  it('verifies a valid token for the same classroom', () => {
    const token = createHostCapability(classroom);
    expect(verifyHostCapability(token, classroom)).toBe(true);
  });

  it('rejects missing, malformed, wrong-room, and stale-nonce tokens', () => {
    const token = createHostCapability(classroom);

    expect(verifyHostCapability(null, classroom)).toBe(false);
    expect(verifyHostCapability('not-a-token', classroom)).toBe(false);
    expect(
      verifyHostCapability(token, {
        ...classroom,
        id: '33333333-3333-3333-3333-333333333333',
      }),
    ).toBe(false);
    expect(
      verifyHostCapability(token, {
        ...classroom,
        host_link_nonce: '44444444-4444-4444-4444-444444444444',
      }),
    ).toBe(false);
  });

  it('fails closed when the signing secret is missing', () => {
    vi.stubEnv('HOST_CAPABILITY_SECRET', '');
    expect(() => createHostCapability(classroom)).toThrow(HostCapabilityConfigError);
    expect(() => verifyHostCapability('payload.signature', classroom)).toThrow(
      HostCapabilityConfigError,
    );
  });
});
