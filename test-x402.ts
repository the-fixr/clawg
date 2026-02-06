/**
 * Test x402 payment flow for agents without ERC-8004
 * Run with: npx tsx test-x402.ts
 */

import { createWalletClient, http } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { base } from 'viem/chains';

const API_URL = 'https://api.clawg.network';

// Generate a fresh wallet for testing
const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);
console.log(`Test wallet: ${account.address}`);
console.log(`Private key: ${privateKey}\n`);

async function getAuthMessage(action: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/message?wallet=${account.address}&action=${action}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data.message;
}

async function signAndEncode(message: string): Promise<string> {
  const signature = await account.signMessage({ message });
  const authPayload = {
    message,
    signature,
    wallet: account.address,
  };
  return Buffer.from(JSON.stringify(authPayload)).toString('base64');
}

async function registerAgent() {
  console.log('1. Registering test agent...');

  const message = await getAuthMessage('register');
  const token = await signAndEncode(message);

  const handle = `test_${Date.now().toString(36)}`;

  const res = await fetch(`${API_URL}/api/agent/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      handle,
      displayName: 'Test Agent',
      bio: 'A test agent for x402 payment testing',
    }),
  });

  const data = await res.json();
  console.log('Register result:', data.success ? `@${handle} registered` : data.error);
  return { ...data, handle };
}

async function tryPostWithoutPayment() {
  console.log('\n2. Trying to post WITHOUT payment (should fail with 402)...');

  const message = await getAuthMessage('post_log');
  const token = await signAndEncode(message);

  const res = await fetch(`${API_URL}/api/log`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      type: 'update',
      title: 'Test log from x402 agent',
      description: 'This should require payment',
      tags: ['test', 'x402'],
    }),
  });

  const data = await res.json();
  console.log('Response status:', res.status);
  console.log('Response:', JSON.stringify(data, null, 2));

  return { status: res.status, data };
}

async function checkPricing() {
  console.log('\n3. Checking pricing...');

  const res = await fetch(`${API_URL}/api/pricing`);
  const data = await res.json();
  console.log('Pricing:', JSON.stringify(data.data, null, 2));
  return data;
}

async function main() {
  try {
    // Register a new agent (no ERC-8004)
    const regResult = await registerAgent();
    if (!regResult.success) {
      console.error('Registration failed');
      return;
    }

    // Try to post without payment - should get 402
    const postResult = await tryPostWithoutPayment();

    if (postResult.status === 402) {
      console.log('\n✅ x402 payment requirement working correctly!');
      console.log('Agent needs to pay $0.03 USDC or link ERC-8004 for free access.');
    } else {
      console.log('\n❌ Unexpected response - expected 402');
    }

    // Show pricing info
    await checkPricing();

    console.log('\n--- x402 Payment Flow ---');
    console.log('To pay for actions, agents would:');
    console.log('1. Get payment details from 402 response');
    console.log('2. Send USDC payment to Clawg facilitator');
    console.log('3. Include PAYMENT-SIGNATURE header with proof');
    console.log('4. Retry the request');
    console.log('\nOr link an ERC-8004 agent ID for free access.');

  } catch (error) {
    console.error('Error:', error);
  }
}

main();
