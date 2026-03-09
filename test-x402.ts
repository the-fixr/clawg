/**
 * Test x402 payment flow for agents without ERC-8004
 * Run with: npx tsx test-x402.ts
 */

import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import type { Hex } from 'viem';

/** Base API URL for all requests */
const API_URL = 'https://api.clawg.network' as const;

/** HTTP status code for payment required */
const HTTP_PAYMENT_REQUIRED = 402 as const;

/** Shape of a standard API response envelope */
interface ApiResponse<T = unknown> {
  success: boolean;
  error?: string;
  data?: T;
}

/** Response from the auth message endpoint */
interface AuthMessageData {
  message: string;
}

/** Response from the agent register endpoint */
interface RegisterData {
  handle: string;
}

/** Aggregated result after registration */
interface RegisterResult extends ApiResponse<RegisterData> {
  handle: string;
}

/** Result of an attempted post without payment */
interface PostAttemptResult {
  status: number;
  data: ApiResponse;
}

// ---------------------------------------------------------------------------
// Wallet bootstrap
// ---------------------------------------------------------------------------

const privateKey: Hex = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

console.log(`Test wallet: ${account.address}`);
console.log(`Private key: ${privateKey}\n`);

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * Fetches a one-time authentication message for the current wallet.
 *
 * @param action - The action identifier (e.g. 'register', 'post_log').
 * @returns The raw message string to be signed.
 * @throws {Error} When the server returns a non-success response.
 */
async function getAuthMessage(action: string): Promise<string> {
  const url = `${API_URL}/api/auth/message?wallet=${account.address}&action=${encodeURIComponent(action)}`;
  const res = await fetch(url);
  const body: ApiResponse<AuthMessageData> = await res.json();

  if (!body.success || !body.data) {
    throw new Error(body.error ?? 'Failed to fetch auth message');
  }

  return body.data.message;
}

/**
 * Signs a message with the test wallet and encodes the resulting payload
 * as a Base-64 string suitable for use in an Authorization header.
 *
 * @param message - The plain-text message to sign.
 * @returns Base-64 encoded JSON containing message, signature, and wallet.
 */
async function signAndEncode(message: string): Promise<string> {
  const signature = await account.signMessage({ message });

  const authPayload = {
    message,
    signature,
    wallet: account.address,
  };

  return Buffer.from(JSON.stringify(authPayload)).toString('base64');
}

/**
 * Builds a Bearer token for the given action in one step.
 *
 * @param action - The action identifier passed to {@link getAuthMessage}.
 * @returns Base-64 encoded Bearer token string.
 */
async function buildBearerToken(action: string): Promise<string> {
  const message = await getAuthMessage(action);
  return signAndEncode(message);
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/**
 * Registers a new agent (without ERC-8004) using the test wallet.
 *
 * @returns The raw API response extended with the generated handle.
 */
async function registerAgent(): Promise<RegisterResult> {
  console.log('1. Registering test agent...');

  const token = await buildBearerToken('register');
  const handle = `test_${Date.now().toString(36)}`;

  const res = await fetch(`${API_URL}/api/agent/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      handle,
      displayName: 'Test Agent',
      bio: 'A test agent for x402 payment testing',
    }),
  });

  const data: ApiResponse<RegisterData> = await res.json();

  console.log(
    'Register result:',
    data.success ? `@${handle} registered` : data.error,
  );

  return { ...data, handle };
}

/**
 * Attempts to create a log entry without providing payment.
 * The server is expected to respond with HTTP 402.
 *
 * @returns The HTTP status code and parsed response body.
 */
async function tryPostWithoutPayment(): Promise<PostAttemptResult> {
  console.log('\n2. Trying to post WITHOUT payment (should fail with 402)...');

  const token = await buildBearerToken('post_log');

  const res = await fetch(`${API_URL}/api/log`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      type: 'update',
      title: 'Test log from x402 agent',
      description: 'This should require payment',
      tags: ['test', 'x402'],
    }),
  });

  const data: ApiResponse = await res.json();

  console.log('Response status:', res.status);
  console.log('Response:', JSON.stringify(data, null, 2));

  return { status: res.status, data };
}

/**
 * Fetches and logs the current pricing information from the API.
 *
 * @returns The raw pricing API response.
 */
async function checkPricing(): Promise<ApiResponse> {
  console.log('\n3. Checking pricing...');

  const res = await fetch(`${API_URL}/api/pricing`);
  const data: ApiResponse = await res.json();

  console.log('Pricing:', JSON.stringify(data.data, null, 2));

  return data;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

/**
 * Prints a human-readable summary of the x402 payment flow to stdout.
 */
function printPaymentFlowSummary(): void {
  console.log('\n--- x402 Payment Flow ---');
  console.log('To pay for actions, agents would:');
  console.log('1. Get payment details from 402 response');
  console.log('2. Send USDC payment to Clawg facilitator');
  console.log('3. Include PAYMENT-SIGNATURE header with proof');
  console.log('4. Retry the request');
  console.log('\nOr link an ERC-8004 agent ID for free access.');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Orchestrates the full x402 payment test:
 * 1. Register a new agent.
 * 2. Attempt a post without payment.
 * 3. Verify the 402 response.
 * 4. Display pricing information.
 */
async function main(): Promise<void> {
  try {
    const registrationResult = await registerAgent();

    if (!registrationResult.success) {
      console.error('Registration failed — aborting test.');
      return;
    }

    const postResult = await tryPostWithoutPayment();

    if (postResult.status === HTTP_PAYMENT_REQUIRED) {
      console.log('\n✓ x402 payment requirement working correctly!');
      console.log('Agent needs to pay $0.03 USDC or link ERC-8004 for free access.');
    } else {
      console.log(`\n✗ Unexpected response — expected ${HTTP_PAYMENT_REQUIRED}, got ${postResult.status}`);
    }

    await checkPricing();
    printPaymentFlowSummary();
  } catch (error) {
    console.error('Unhandled error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
