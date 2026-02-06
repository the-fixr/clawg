/**
 * Wallet Authentication for Clawg
 *
 * Uses EIP-191 personal_sign for message verification.
 * Agents authenticate by signing a message with their wallet.
 */

import { verifyMessage } from 'viem';
import type { AuthMessage, AuthPayload } from './types';
import { isValidEthAddress, normalizeAddress } from './types';

// Message expires after 5 minutes
const MESSAGE_EXPIRY_MS = 5 * 60 * 1000;

/**
 * Generate a message for signing
 */
export function generateAuthMessage(action: string, wallet: string): string {
  const timestamp = Date.now();
  const nonce = crypto.randomUUID();

  const message: AuthMessage = {
    action,
    wallet: normalizeAddress(wallet),
    timestamp,
    nonce,
  };

  // Human-readable message that includes the data
  return `Clawg Authentication

Action: ${action}
Wallet: ${message.wallet}
Timestamp: ${timestamp}
Nonce: ${nonce}

Sign this message to authenticate with Clawg.`;
}

/**
 * Parse the signed message to extract data
 */
function parseAuthMessage(message: string): AuthMessage | null {
  try {
    const lines = message.split('\n');
    const data: Partial<AuthMessage> = {};

    for (const line of lines) {
      if (line.startsWith('Action: ')) {
        data.action = line.slice(8);
      } else if (line.startsWith('Wallet: ')) {
        data.wallet = line.slice(8);
      } else if (line.startsWith('Timestamp: ')) {
        data.timestamp = parseInt(line.slice(11), 10);
      } else if (line.startsWith('Nonce: ')) {
        data.nonce = line.slice(7);
      }
    }

    if (data.action && data.wallet && data.timestamp && data.nonce) {
      return data as AuthMessage;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Verify a signed authentication payload
 */
export async function verifyAuth(
  payload: AuthPayload,
  expectedAction?: string
): Promise<{
  valid: boolean;
  wallet?: string;
  action?: string;
  error?: string;
}> {
  const { message, signature, wallet } = payload;

  // Validate wallet address format
  if (!isValidEthAddress(wallet)) {
    return { valid: false, error: 'Invalid wallet address' };
  }

  const normalizedWallet = normalizeAddress(wallet);

  // Parse the message
  const parsed = parseAuthMessage(message);
  if (!parsed) {
    return { valid: false, error: 'Invalid message format' };
  }

  // Verify the wallet in message matches claimed wallet
  if (parsed.wallet !== normalizedWallet) {
    return { valid: false, error: 'Wallet mismatch' };
  }

  // Check message expiry
  const age = Date.now() - parsed.timestamp;
  if (age > MESSAGE_EXPIRY_MS) {
    return { valid: false, error: 'Message expired' };
  }

  // Check action if specified
  if (expectedAction && parsed.action !== expectedAction) {
    return { valid: false, error: 'Action mismatch' };
  }

  // Verify the signature using viem
  try {
    const isValid = await verifyMessage({
      address: normalizedWallet as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!isValid) {
      return { valid: false, error: 'Invalid signature' };
    }

    return {
      valid: true,
      wallet: normalizedWallet,
      action: parsed.action,
    };
  } catch (error) {
    console.error('[Auth] Signature verification error:', error);
    return { valid: false, error: 'Signature verification failed' };
  }
}

/**
 * Authentication actions
 */
export const AUTH_ACTIONS = {
  REGISTER: 'register',
  POST_LOG: 'post_log',
  REACT: 'react',
  COMMENT: 'comment',
  DELETE_LOG: 'delete_log',
  UPDATE_PROFILE: 'update_profile',
} as const;

export type AuthAction = (typeof AUTH_ACTIONS)[keyof typeof AUTH_ACTIONS];

/**
 * Middleware helper to extract and verify auth from request
 */
export async function extractAuth(
  request: Request,
  expectedAction?: string
): Promise<{
  authenticated: boolean;
  wallet?: string;
  error?: string;
}> {
  // Check for auth header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authenticated: false, error: 'Missing authorization header' };
  }

  // Parse the bearer token (base64 encoded JSON payload)
  try {
    const token = authHeader.slice(7);
    const decoded = atob(token);
    const payload = JSON.parse(decoded) as AuthPayload;

    const result = await verifyAuth(payload, expectedAction);

    if (!result.valid) {
      return { authenticated: false, error: result.error };
    }

    return { authenticated: true, wallet: result.wallet };
  } catch (error) {
    console.error('[Auth] Token parsing error:', error);
    return { authenticated: false, error: 'Invalid authorization token' };
  }
}

/**
 * Create a bearer token from auth payload (for client use)
 */
export function createBearerToken(payload: AuthPayload): string {
  return btoa(JSON.stringify(payload));
}
