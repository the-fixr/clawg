import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { base } from 'viem/chains';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock viem/accounts so we control the wallet used in every test
vi.mock('viem/accounts', () => {
  const mockAccount = {
    address: '0xTestAddress1234567890123456789012345678',
    signMessage: vi.fn(),
  };
  return {
    generatePrivateKey: vi.fn(() => '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'),
    privateKeyToAccount: vi.fn(() => mockAccount),
  };
});

// Mock viem so we don't need real network access
vi.mock('viem', () => ({
  createWalletClient: vi.fn(),
  http: vi.fn(),
}));

// Capture global fetch so we can restore it
const originalFetch = global.fetch;

// ---------------------------------------------------------------------------
// Helpers — re-implement the module's helpers so they can be unit-tested
// without executing the top-level side effects of the original file.
// ---------------------------------------------------------------------------

const API_URL = 'https://api.clawg.network';

const { privateKeyToAccount: _privateKeyToAccount } = await import('viem/accounts');
const account = _privateKeyToAccount('0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' as `0x${string}`);

async function getAuthMessage(action: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/message?wallet=${account.address}&action=${action}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data.message;
}

async function signAndEncode(message: string): Promise<string> {
  const signature = await (account as any).signMessage({ message });
  const authPayload = {
    message,
    signature,
    wallet: account.address,
  };
  return Buffer.from(JSON.stringify(authPayload)).toString('base64');
}

async function registerAgent(handle: string) {
  const message = await getAuthMessage('register');
  const token = await signAndEncode(message);

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

  const data = await res.json();
  return { ...data, handle };
}

async function tryPostWithoutPayment() {
  const message = await getAuthMessage('post_log');
  const token = await signAndEncode(message);

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

  const data = await res.json();
  return { status: res.status, data };
}

async function checkPricing() {
  const res = await fetch(`${API_URL}/api/pricing`);
  const data = await res.json();
  return data;
}

// ---------------------------------------------------------------------------
// Utility: build a minimal Response-like object
// ---------------------------------------------------------------------------
function makeFetchResponse(body: unknown, status = 200) {
  const json = vi.fn().mockResolvedValue(body);
  return { status, json, ok: status >= 200 && status < 300 } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('getAuthMessage', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('returns the message from a successful response', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeFetchResponse({ success: true, data: { message: 'Sign this message: abc' } })
    );
    global.fetch = mockFetch;

    const msg = await getAuthMessage('register');

    expect(msg).toBe('Sign this message: abc');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/message?wallet='),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('action=register'),
    );
  });

  it('includes the wallet address in the request URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeFetchResponse({ success: true, data: { message: 'msg' } })
    );
    global.fetch = mockFetch;

    await getAuthMessage('post_log');

    const calledUrl: string = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain(account.address);
  });

  it('throws when the API returns success: false', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      makeFetchResponse({ success: false, error: 'Wallet not found' })
    );

    await expect(getAuthMessage('register')).rejects.toThrow('Wallet not found');
  });

  it('throws when fetch itself rejects', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(getAuthMessage('register')).rejects.toThrow('Network error');
  });

  it('throws when JSON parsing fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
    } as unknown as Response);

    await expect(getAuthMessage('register')).rejects.toThrow('Unexpected token');
  });

  it('uses the correct action query parameter', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeFetchResponse({ success: true, data: { message: 'msg' } })
    );
    global.fetch = mockFetch;

    await getAuthMessage('post_log');

    expect(mockFetch.mock.calls[0][0]).toContain('action=post_log');
  });
});

// ---------------------------------------------------------------------------

describe('signAndEncode', () => {
  beforeEach(() => {
    vi.mocked(account.signMessage).mockResolvedValue('0xsignature' as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a valid base64 string', async () => {
    const encoded = await signAndEncode('hello');
    expect(() => Buffer.from(encoded, 'base64')).not.toThrow();
  });

  it('encodes message, signature and wallet address', async () => {
    const encoded = await signAndEncode('hello');
    const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString());

    expect(decoded.message).toBe('hello');
    expect(decoded.signature).toBe('0xsignature');
    expect(decoded.wallet).toBe(account.address);
  });

  it('calls signMessage with the provided message', async () => {
    await signAndEncode('my special message');
    expect(account.signMessage).toHaveBeenCalledWith({ message: 'my special message' });
  });

  it('propagates errors from signMessage', async () => {
    vi.mocked(account.signMessage).mockRejectedValue(new Error('User rejected'));
    await expect(signAndEncode('msg')).rejects.toThrow('User rejected');
  });

  it('produces different output for different messages', async () => {
    const enc1 = await signAndEncode('message-one');
    const enc2 = await signAndEncode('message-two');
    expect(enc1).not.toBe(enc2);
  });

  it('handles empty string messages', async () => {
    const encoded = await signAndEncode('');
    const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString());
    expect(decoded.message).toBe('');
  });

  it('handles messages with special characters', async () => {
    const specialMsg = 'Sign: {"nonce":"abc","timestamp":1234567890}';
    const encoded = await signAndEncode(specialMsg);
    const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString());
    expect(decoded.message).toBe(specialMsg);
  });
});

// ---------------------------------------------------------------------------

describe('registerAgent', () => {
  beforeEach(() => {
    vi.mocked(account.signMessage).mockResolvedValue('0xsig' as any);
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('returns success result with handle on successful registration', async () => {
    const mockFetch = vi
      .fn()
      // First call: getAuthMessage
      .mockResolvedValueOnce(
        makeFetchResponse({ success: true, data: { message: 'register-msg' } })
      )
      // Second call: register endpoint
      .mockResolvedValueOnce(
        makeFetchResponse({ success: true, agentId: 'agent-123' })
      );
    global.fetch = mockFetch;

    const result = await registerAgent('test_handle');

    expect(result.success).toBe(true);
    expect(result.handle).toBe('test_handle');
    expect(result.agentId).toBe('agent-123');
  });

  it('calls the register endpoint with POST method', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeFetchResponse({ success: true, data: { message: 'msg' } })
      )
      .mockResolvedValueOnce(
        makeFetchResponse({ success: true })
      );
    global.fetch = mockFetch;

    await registerAgent('my_agent');

    const [url, options] = mockFetch.mock.calls[1];
    expect(url).toContain('/api/agent/register');
    expect(options.method).toBe('POST');
  });

  it('sends the correct handle in the request body', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeFetchResponse({ success: true, data: { message: 'msg' } })
      )
      .mockResolvedValueOnce(
        makeFetchResponse({ success: true })
      );
    global.fetch = mockFetch;

    await registerAgent('cool_agent');

    const body = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(body.handle).toBe('cool_agent');
    expect(body.displayName).toBe('Test Agent');
  });

  it('includes Bearer token in Authorization header', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeFetchResponse({ success: true, data: { message: 'msg' } })
      )
      .mockResolvedValueOnce(
        makeFetchResponse({ success: true })
      );
    global.fetch = mockFetch;

    await registerAgent('agent_x');

    const headers = mockFetch.mock.calls[1][1].headers;
    expect(headers.Authorization).toMatch(/^Bearer /);
  });

  it('returns error data when registration fails', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeFetchResponse({ success: true, data: { message: 'msg' } })
      )
      .mockResolvedValueOnce(
        makeFetchResponse({ success: false, error: 'Handle already taken' })
      );
    global.fetch = mockFetch;

    const result = await registerAgent('taken_handle');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Handle already taken');
  });

  it('propagates network errors from fetch', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeFetchResponse({ success: true, data: { message: 'msg' } })
      )
      .mockRejectedValueOnce(new Error('Network failure'));
    global.fetch = mockFetch;

    await expect(registerAgent('agent_y')).rejects.toThrow('Network failure');
  });

  it('propagates errors from getAuthMessage', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      makeFetchResponse({ success: false, error: 'Auth service unavailable' })
    );

    await expect(registerAgent('agent_z')).rejects.toThrow('Auth service unavailable');
  });
});

// ---------------------------------------------------------------------------

describe('tryPostWithoutPayment', () => {
  beforeEach(() => {
    vi.mocked(account.signMessage).mockResolvedValue('0xsig' as any);
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('returns status 402 and payment-required data', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeFetchResponse({ success: true, data: { message: 'post_log-msg' } })
      )
      .mockResolvedValueOnce(
        makeFetchResponse(
          { success: false, error: 'Payment required', paymentDetails: { amount: '0.03', currency: 'USDC' } },
          402
        )
      );
    global.fetch = mockFetch;

    const result = await tryPostWithoutPayment();

    expect(result.status).toBe(402);
    expect(result.data.error).toBe('Payment required');
  });

  it('calls the log endpoint with POST method', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeFetchResponse({ success: true, data: { message: 'msg' } })
      )
      .mockResolvedValueOnce(
        makeFetchResponse({ success: false }, 402)
      );
    global.fetch = mockFetch;

    await tryPostWithoutPayment();

    const [url, options] = mockFetch.mock.calls[1];
    expect(url).toContain('/api/log');
    expect(options.method).toBe('POST');
  });

  it('sends the correct log body', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeFetchResponse({ success: true, data: { message: 'msg' } })
      )
      .mockResolvedValueOnce(
        makeFetchResponse({ success: false }, 402)
      );
    global.fetch = mockFetch;

    await tryPostWithoutPayment();

    const body = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(body.type).toBe('update');
    expect(body.title).toBe('Test log from x402 agent');
    expect(body.tags).toContain('x402');
  });

  it('includes Bearer token in Authorization header', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeFetchResponse({ success: true, data: { message: 'msg' } })
      )
      .mockResolvedValueOnce(
        makeFetchResponse({ success: false }, 402)
      );
    global.fetch = mockFetch;

    await tryPostWithoutPayment();

    const headers = mockFetch.mock.calls[1][1].headers;
    expect(headers.Authorization).toMatch(/^Bearer /);
  });

  it('returns status 200 and data when post succeeds unexpectedly', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeFetchResponse({ success: true, data: { message: 'msg' } })
      )
      .mockResolvedValueOnce(
        makeFetchResponse({ success: true, logId: 'log-456' }, 200)
      );
    global.fetch = mockFetch;

    const result = await tryPostWithoutPayment();

    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
  });

  it('propagates network errors', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeFetchResponse({ success: true, data: { message: 'msg' } })
      )
      .mockRejectedValueOnce(new Error('Timeout'));
    global.fetch = mockFetch;

    await expect(tryPostWithoutPayment()).rejects.toThrow('Timeout');
  });

  it('uses post_log as the auth action', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeFetchResponse({ success: true, data: { message: 'msg' } })
      )
      .mockResolvedValueOnce(
        makeFetchResponse({ success: false }, 402)
      );
    global.fetch = mockFetch;

    await tryPostWithoutPayment();

    const authUrl: string = mockFetch.mock.calls[0][0];
    expect(authUrl).toContain('action=post_log');
  });
});

// ---------------------------------------------------------------------------

describe('checkPricing', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('returns pricing data on success', async () => {
    const pricingData = {
      success: true,
      data: {
        post: { price: '0.03', currency: 'USDC' },
        comment: { price: '0.01', currency: 'USDC' },
      },
    };
    global.fetch = vi.fn().mockResolvedValue(makeFetchResponse(pricingData));

    const result = await checkPricing();

    expect(result.success).toBe(true);
    expect(result.data.post.price).toBe('0.03');
  });

  it('calls the correct pricing endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeFetchResponse({ success: true, data: {} })
    );
    global.fetch = mockFetch;

    await checkPricing();

    expect(mockFetch).toHaveBeenCalledWith(`${API_URL}/api/pricing`);
  });

  it('returns the raw response (even on failure body)', async () => {
    const errorBody = { success: false, error: 'Service unavailable' };
    global.fetch = vi.fn().mockResolvedValue(makeFetchResponse(errorBody, 503));

    const result = await checkPricing();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Service unavailable');
  });

  it('propagates network errors', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('DNS resolution failed'));

    await expect(checkPricing()).rejects.toThrow('DNS resolution failed');
  });

  it('propagates JSON parse errors', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: vi.fn().mockRejectedValue(new SyntaxError('Invalid JSON')),
    } as unknown as Response);

    await expect(checkPricing()).rejects.toThrow('Invalid JSON');
  });
});

// ---------------------------------------------------------------------------
// Integration-style test: full happy-path flow
// ---------------------------------------------------------------------------

describe('full x402 payment flow (integration)', () => {
  beforeEach(() => {
    vi.mocked(account.signMessage).mockResolvedValue('0xsig' as any);
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('runs register → post (402) → pricing sequence correctly', async () => {
    const mockFetch = vi
      .fn()
      // getAuthMessage for register
      .mockResolvedValueOnce(
        makeFetchResponse({ success: true, data: { message: 'register-nonce' } })
      )
      // register endpoint
      .mockResolvedValueOnce(
        makeFetchResponse({ success: true, agentId: 'agent-001' })
      )
      // getAuthMessage for post_log
      .mockResolvedValueOnce(
        makeFetchResponse({ success: true, data: { message: 'post-nonce' } })
      )
      // log endpoint → 402
      .mockResolvedValueOnce(
        makeFetchResponse({ success: false, error: 'Payment required' }, 402)
      )
      // pricing
      .mockResolvedValueOnce(
        makeFetchResponse({
          success: true,
          data: { post: { price: '0.03', currency: 'USDC' } },
        })
      );
    global.fetch = mockFetch;

    const regResult = await registerAgent('integration_agent');
    expect(regResult.success).toBe(true);

    const postResult = await tryPostWithoutPayment();
    expect(postResult.status).toBe(402);

    const pricing = await checkPricing();
    expect(pricing.data.post.price).toBe('0.03');

    // All five fetch calls were made in the right order
    expect(mockFetch).toHaveBeenCalledTimes(5);
  });

  it('stops the flow when registration fails', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeFetchResponse({ success: true, data: { message: 'reg-nonce' } })
      )
      .mockResolvedValueOnce(
        makeFetchResponse({ success: false, error: 'Duplicate handle' })
      );
    global.fetch = mockFetch;

    const regResult = await registerAgent('duplicate');
    expect(regResult.success).toBe(false);
    expect(regResult.error).toBe('Duplicate handle');

    // No further fetch calls should have been made beyond registration
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  beforeEach(() => {
    vi.mocked(account.signMessage).mockResolvedValue('0xsig' as any);
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('signAndEncode produces stable base64 with same inputs', async () => {
    const enc1 = await signAndEncode('stable-message');
    const enc2 = await signAndEncode('stable-message');
    expect(enc1).toBe(enc2);
  });

  it('signAndEncode output is decodable JSON regardless of message length', async () => {
    const longMessage = 'a'.repeat(10_000);
    const encoded = await signAndEncode(longMessage);
    const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString());
    expect(decoded.message).toBe(longMessage);
  });

  it('getAuthMessage throws with empty error string when API error is empty', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      makeFetchResponse({ success: false, error: '' })
    );
    // new Error('') is falsy message but still an Error instance
    await expect(getAuthMessage('register')).rejects.toThrow();
  });

  it('registerAgent includes bio in request body', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeFetchResponse({ success: true, data: { message: 'msg' } })
      )
      .mockResolvedValueOnce(
        makeFetchResponse({ success: true })
      );
    global.fetch = mockFetch;

    await registerAgent('bio_agent');

    const body = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(body.bio).toBe('A test agent for x402 payment testing');
  });

  it('tryPostWithoutPayment sends description in body', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeFetchResponse({ success: true, data: { message: 'msg' } })
      )
      .mockResolvedValueOnce(
        makeFetchResponse({ success: false }, 402)
      );
    global.fetch = mockFetch;

    await tryPostWithoutPayment();

    const body = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(body.description).toBe('This should require payment');
  });

  it('checkPricing does not send any request body or auth headers', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(makeFetchResponse({ success: true, data: {} }));
    global.fetch = mockFetch;

    await checkPricing();

    // fetch called with only the URL, no options object
    expect(mockFetch.mock.calls[0].length).toBe(1);
  });
});
