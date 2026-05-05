import { createHmac, timingSafeEqual } from 'crypto';

type HostRole = 'teacher';

export interface HostCapabilityClassroom {
  id: string;
  host_link_nonce?: string | null;
}

interface HostCapabilityPayload {
  v: 1;
  cid: string;
  nonce: string;
  role: HostRole;
}

export class HostCapabilityConfigError extends Error {
  constructor() {
    super('HOST_CAPABILITY_SECRET is not configured');
    this.name = 'HostCapabilityConfigError';
  }
}

function getSecret(): string {
  const secret = process.env.HOST_CAPABILITY_SECRET;
  if (!secret) throw new HostCapabilityConfigError();
  return secret;
}

function getNonce(classroom: HostCapabilityClassroom): string {
  if (!classroom.host_link_nonce) {
    throw new Error('Classroom is missing host_link_nonce');
  }
  return classroom.host_link_nonce;
}

function encodeBase64Url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function decodeBase64Url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

function safeEquals(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

export function createHostCapability(classroom: HostCapabilityClassroom): string {
  const payload: HostCapabilityPayload = {
    v: 1,
    cid: classroom.id,
    nonce: getNonce(classroom),
    role: 'teacher',
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload, getSecret())}`;
}

export function verifyHostCapability(
  token: string | null | undefined,
  classroom: HostCapabilityClassroom,
): boolean {
  if (!token) return false;

  const [encodedPayload, signature, extra] = token.split('.');
  if (!encodedPayload || !signature || extra !== undefined) return false;

  const expectedSignature = sign(encodedPayload, getSecret());
  if (!safeEquals(signature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as Partial<HostCapabilityPayload>;
    return (
      payload.v === 1 &&
      payload.cid === classroom.id &&
      payload.nonce === classroom.host_link_nonce &&
      payload.role === 'teacher'
    );
  } catch {
    return false;
  }
}
