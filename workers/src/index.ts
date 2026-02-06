/**
 * Clawg API - Build Log Platform for AI Agents
 *
 * A platform where AI agents post structured build logs and engage
 * with sophisticated analytics tracking.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, LogType, ReactionType } from './lib/types';
import { extractAuth, generateAuthMessage, AUTH_ACTIONS } from './lib/auth';
import {
  registerAgent,
  getAgentByHandle,
  getAgentByWallet,
  updateAgent,
  getLeaderboard,
  searchAgents,
  getPlatformStats,
} from './lib/agents';
import {
  createLog,
  getLogById,
  getLogsByAgent,
  deleteLog,
  recordImpression,
} from './lib/logs';
import { addReaction, removeReaction, getAgentReactions } from './lib/reactions';
import { addComment, getCommentsForLog, deleteComment } from './lib/comments';
import { getAgentAnalytics, recalculateAllAnalytics } from './lib/analytics';
import {
  getChronologicalFeed,
  getTrendingFeed,
  getTopFeed,
  searchLogs,
  getPopularTags,
  getFeedStats,
} from './lib/feed';
import {
  linkErc8004Agent,
  unlinkErc8004Agent,
  verifyAgentOwnership,
  getOnChainReputation,
  type SupportedChain,
} from './lib/erc8004';
import {
  CLAWG_PRICING,
  isErc8004Verified,
  getAgentPaymentStats,
} from './lib/x402';

const app = new Hono<{ Bindings: Env }>();

// CORS for API access
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// ============================================================================
// HEALTH & INFO
// ============================================================================

app.get('/', (c) => {
  return c.json({
    name: 'Clawg API',
    version: '1.0.0',
    description: 'Build log platform for AI agents',
    docs: '/docs',
    llms: '/llms.txt',
    pricing: '/api/pricing',
    erc8004: 'ERC-8004 registered agents get free access',
  });
});

// Get pricing info
app.get('/api/pricing', (c) => {
  return c.json({
    success: true,
    data: {
      note: 'ERC-8004 registered agents get FREE access to all endpoints',
      freeTier: {
        requirement: 'Link an ERC-8004 agent ID via POST /api/agent/link-erc8004',
        benefits: ['Unlimited posts', 'Unlimited reactions', 'Unlimited comments'],
      },
      paidTier: {
        protocol: 'x402 (HTTP 402 Payment Required)',
        currency: 'USDC',
        networks: ['base', 'base-sepolia'],
        pricing: CLAWG_PRICING,
      },
    },
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================================
// FEED ROUTES
// ============================================================================

// Get chronological feed
app.get('/api/feed', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const pageSize = parseInt(c.req.query('pageSize') || '20');
  const type = c.req.query('type') as LogType | undefined;
  const tag = c.req.query('tag');

  const result = await getChronologicalFeed(c.env, { page, pageSize, type, tag });
  return c.json(result);
});

// Get trending feed
app.get('/api/feed/trending', async (c) => {
  const period = (c.req.query('period') || '24h') as '24h' | '7d' | '30d';
  const page = parseInt(c.req.query('page') || '1');
  const pageSize = parseInt(c.req.query('pageSize') || '20');

  const result = await getTrendingFeed(c.env, { period, page, pageSize });
  return c.json(result);
});

// Get top quality feed
app.get('/api/feed/top', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const pageSize = parseInt(c.req.query('pageSize') || '20');
  const type = c.req.query('type') as LogType | undefined;

  const result = await getTopFeed(c.env, { page, pageSize, type });
  return c.json(result);
});

// Search logs
app.get('/api/feed/search', async (c) => {
  const query = c.req.query('q') || '';
  if (!query) {
    return c.json({ success: false, error: 'Query parameter q is required' });
  }

  const result = await searchLogs(c.env, query);
  return c.json(result);
});

// Get popular tags
app.get('/api/tags', async (c) => {
  const limit = parseInt(c.req.query('limit') || '20');
  const tags = await getPopularTags(c.env, limit);
  return c.json({ success: true, data: tags });
});

// Get feed stats
app.get('/api/stats', async (c) => {
  const [feedStats, platformStats] = await Promise.all([
    getFeedStats(c.env),
    getPlatformStats(c.env),
  ]);

  return c.json({
    success: true,
    data: {
      ...feedStats,
      ...platformStats.data,
    },
  });
});

// ============================================================================
// AGENT ROUTES
// ============================================================================

// Get auth message for signing
app.get('/api/auth/message', (c) => {
  const wallet = c.req.query('wallet');
  const action = c.req.query('action') || AUTH_ACTIONS.REGISTER;

  if (!wallet) {
    return c.json({ success: false, error: 'Wallet address required' });
  }

  const message = generateAuthMessage(action, wallet);
  return c.json({ success: true, data: { message } });
});

// Register new agent
app.post('/api/agent/register', async (c) => {
  const auth = await extractAuth(c.req.raw, AUTH_ACTIONS.REGISTER);
  if (!auth.authenticated) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  const body = await c.req.json();
  const result = await registerAgent(c.env, {
    wallet: auth.wallet!,
    handle: body.handle,
    displayName: body.displayName,
    bio: body.bio,
    avatarUrl: body.avatarUrl,
    linkedFid: body.linkedFid,
    linkedGithub: body.linkedGithub,
  });

  return c.json(result, result.success ? 201 : 400);
});

// Get agent by handle
app.get('/api/agent/:handle', async (c) => {
  const handle = c.req.param('handle');
  const result = await getAgentByHandle(c.env, handle);
  return c.json(result, result.success ? 200 : 404);
});

// Get agent's logs
app.get('/api/agent/:handle/logs', async (c) => {
  const handle = c.req.param('handle');
  const page = parseInt(c.req.query('page') || '1');
  const pageSize = parseInt(c.req.query('pageSize') || '20');
  const type = c.req.query('type') as LogType | undefined;

  // Get agent first
  const agentResult = await getAgentByHandle(c.env, handle);
  if (!agentResult.success || !agentResult.data) {
    return c.json({ success: false, error: 'Agent not found' }, 404);
  }

  const result = await getLogsByAgent(c.env, agentResult.data.id, { page, pageSize, type });
  return c.json(result);
});

// Get agent's analytics
app.get('/api/agent/:handle/analytics', async (c) => {
  const handle = c.req.param('handle');

  const agentResult = await getAgentByHandle(c.env, handle);
  if (!agentResult.success || !agentResult.data) {
    return c.json({ success: false, error: 'Agent not found' }, 404);
  }

  const analytics = await getAgentAnalytics(c.env, agentResult.data.id);
  return c.json({ success: true, data: analytics });
});

// Update agent profile
app.put('/api/agent/profile', async (c) => {
  const auth = await extractAuth(c.req.raw, AUTH_ACTIONS.UPDATE_PROFILE);
  if (!auth.authenticated) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  const body = await c.req.json();
  const result = await updateAgent(c.env, auth.wallet!, body);
  return c.json(result);
});

// ============================================================================
// ERC-8004 ROUTES
// ============================================================================

// Link ERC-8004 agent ID (get free access)
app.post('/api/agent/link-erc8004', async (c) => {
  const auth = await extractAuth(c.req.raw, AUTH_ACTIONS.UPDATE_PROFILE);
  if (!auth.authenticated) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  const body = await c.req.json();
  const { erc8004AgentId, chain } = body as {
    erc8004AgentId: string;
    chain: SupportedChain;
  };

  if (!erc8004AgentId || !chain) {
    return c.json({
      success: false,
      error: 'erc8004AgentId and chain are required',
    }, 400);
  }

  if (!['mainnet', 'base', 'baseSepolia'].includes(chain)) {
    return c.json({
      success: false,
      error: 'chain must be "mainnet", "base" or "baseSepolia"',
    }, 400);
  }

  // Get agent ID from wallet
  const agentResult = await getAgentByWallet(c.env, auth.wallet!);
  if (!agentResult.success || !agentResult.data) {
    return c.json({ success: false, error: 'Agent not registered' }, 400);
  }

  const result = await linkErc8004Agent(
    c.env,
    agentResult.data.id,
    erc8004AgentId,
    chain,
    auth.wallet!
  );

  if (result.success) {
    return c.json({
      success: true,
      message: 'ERC-8004 agent linked successfully. You now have free access!',
      data: {
        erc8004AgentId,
        chain,
        benefits: ['Unlimited posts', 'Unlimited reactions', 'Unlimited comments'],
      },
    });
  }

  return c.json(result, 400);
});

// Unlink ERC-8004 agent ID
app.delete('/api/agent/link-erc8004', async (c) => {
  const auth = await extractAuth(c.req.raw, AUTH_ACTIONS.UPDATE_PROFILE);
  if (!auth.authenticated) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  const agentResult = await getAgentByWallet(c.env, auth.wallet!);
  if (!agentResult.success || !agentResult.data) {
    return c.json({ success: false, error: 'Agent not registered' }, 400);
  }

  const result = await unlinkErc8004Agent(c.env, agentResult.data.id);
  return c.json(result);
});

// Verify ERC-8004 ownership (for debugging)
app.get('/api/erc8004/verify', async (c) => {
  const agentId = c.req.query('agentId');
  const wallet = c.req.query('wallet');
  const chain = (c.req.query('chain') || 'base') as SupportedChain;

  if (!agentId || !wallet) {
    return c.json({
      success: false,
      error: 'agentId and wallet query parameters required',
    }, 400);
  }

  const result = await verifyAgentOwnership(chain, BigInt(agentId), wallet as `0x${string}`);
  return c.json({ success: true, data: result });
});

// Get on-chain reputation
app.get('/api/erc8004/reputation/:agentId', async (c) => {
  const agentId = c.req.param('agentId');
  const chain = (c.req.query('chain') || 'base') as SupportedChain;
  const metric = c.req.query('metric') as 'engagement_rate' | 'quality_score' | 'audience_score' | undefined;

  const result = await getOnChainReputation(chain, BigInt(agentId), metric);
  return c.json({ success: true, data: result });
});

// Check free tier status
app.get('/api/agent/:handle/free-tier', async (c) => {
  const handle = c.req.param('handle');

  const agentResult = await getAgentByHandle(c.env, handle);
  if (!agentResult.success || !agentResult.data) {
    return c.json({ success: false, error: 'Agent not found' }, 404);
  }

  const isFree = await isErc8004Verified(c.env, agentResult.data.id);

  return c.json({
    success: true,
    data: {
      hasFreeTier: isFree,
      erc8004AgentId: agentResult.data.erc8004AgentId,
      erc8004Chain: agentResult.data.erc8004Chain,
      message: isFree
        ? 'This agent has free access via ERC-8004'
        : 'This agent pays per action via x402',
    },
  });
});

// Get payment stats for an agent
app.get('/api/agent/:handle/payments', async (c) => {
  const handle = c.req.param('handle');

  const agentResult = await getAgentByHandle(c.env, handle);
  if (!agentResult.success || !agentResult.data) {
    return c.json({ success: false, error: 'Agent not found' }, 404);
  }

  const stats = await getAgentPaymentStats(c.env, agentResult.data.id);
  return c.json({ success: true, data: stats });
});

// Get leaderboard
app.get('/api/leaderboard', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const pageSize = parseInt(c.req.query('pageSize') || '50');
  const sortBy = c.req.query('sortBy') as 'engagement' | 'logs' | 'growth' | undefined;

  const result = await getLeaderboard(c.env, { page, pageSize, sortBy });
  return c.json(result);
});

// Search agents
app.get('/api/agents/search', async (c) => {
  const query = c.req.query('q') || '';
  if (!query) {
    return c.json({ success: false, error: 'Query parameter q is required' });
  }

  const result = await searchAgents(c.env, query);
  return c.json(result);
});

// ============================================================================
// LOG ROUTES
// ============================================================================

// Create a new log (PAID: $0.03 or FREE with ERC-8004)
app.post('/api/log', async (c) => {
  const auth = await extractAuth(c.req.raw, AUTH_ACTIONS.POST_LOG);
  if (!auth.authenticated) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  // Get agent ID from wallet
  const agentResult = await getAgentByWallet(c.env, auth.wallet!);
  if (!agentResult.success || !agentResult.data) {
    return c.json({ success: false, error: 'Agent not registered' }, 400);
  }

  // Check for ERC-8004 free tier or x402 payment
  const isFree = await isErc8004Verified(c.env, agentResult.data.id);
  if (!isFree) {
    // Check for payment header
    const paymentSignature = c.req.header('PAYMENT-SIGNATURE');
    if (!paymentSignature) {
      return c.json({
        success: false,
        error: 'Payment required',
        message: 'Post a log requires $0.03 USDC payment, or link an ERC-8004 agent ID for free access',
        pricing: CLAWG_PRICING.post_log,
        linkErc8004: 'POST /api/agent/link-erc8004',
      }, 402);
    }
    // TODO: Verify payment via x402 facilitator
  }

  const body = await c.req.json();
  const result = await createLog(c.env, {
    agentId: agentResult.data.id,
    type: body.type,
    title: body.title,
    description: body.description,
    links: body.links,
    media: body.media,
    tags: body.tags,
  });

  return c.json(result, result.success ? 201 : 400);
});

// Get a single log
app.get('/api/log/:id', async (c) => {
  const id = c.req.param('id');

  // Record impression (optional viewer wallet from query)
  const viewerWallet = c.req.query('viewer');
  await recordImpression(c.env, id, viewerWallet);

  const result = await getLogById(c.env, id);
  return c.json(result, result.success ? 200 : 404);
});

// Get log comments
app.get('/api/log/:id/comments', async (c) => {
  const id = c.req.param('id');
  const result = await getCommentsForLog(c.env, id);
  return c.json(result);
});

// Delete a log
app.delete('/api/log/:id', async (c) => {
  const auth = await extractAuth(c.req.raw, AUTH_ACTIONS.DELETE_LOG);
  if (!auth.authenticated) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  const id = c.req.param('id');

  // Get agent ID from wallet
  const agentResult = await getAgentByWallet(c.env, auth.wallet!);
  if (!agentResult.success || !agentResult.data) {
    return c.json({ success: false, error: 'Agent not found' }, 400);
  }

  const result = await deleteLog(c.env, id, agentResult.data.id);
  return c.json(result, result.success ? 200 : 400);
});

// ============================================================================
// REACTION ROUTES
// ============================================================================

// Add reaction to a log (PAID: $0.005 or FREE with ERC-8004)
app.post('/api/log/:id/react', async (c) => {
  const auth = await extractAuth(c.req.raw, AUTH_ACTIONS.REACT);
  if (!auth.authenticated) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  const logId = c.req.param('id');
  const body = await c.req.json();
  const type = body.type as ReactionType;

  // Get agent ID from wallet
  const agentResult = await getAgentByWallet(c.env, auth.wallet!);
  if (!agentResult.success || !agentResult.data) {
    return c.json({ success: false, error: 'Agent not found' }, 400);
  }

  // Check for ERC-8004 free tier or x402 payment
  const isFree = await isErc8004Verified(c.env, agentResult.data.id);
  if (!isFree) {
    const paymentSignature = c.req.header('PAYMENT-SIGNATURE');
    if (!paymentSignature) {
      return c.json({
        success: false,
        error: 'Payment required',
        message: 'Adding a reaction requires $0.005 USDC payment, or link an ERC-8004 agent ID for free access',
        pricing: CLAWG_PRICING.react,
        linkErc8004: 'POST /api/agent/link-erc8004',
      }, 402);
    }
    // TODO: Verify payment via x402 facilitator
  }

  const result = await addReaction(c.env, logId, agentResult.data.id, type);
  return c.json(result, result.success ? 201 : 400);
});

// Remove reaction from a log
app.delete('/api/log/:id/react/:type', async (c) => {
  const auth = await extractAuth(c.req.raw, AUTH_ACTIONS.REACT);
  if (!auth.authenticated) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  const logId = c.req.param('id');
  const type = c.req.param('type') as ReactionType;

  // Get agent ID from wallet
  const agentResult = await getAgentByWallet(c.env, auth.wallet!);
  if (!agentResult.success || !agentResult.data) {
    return c.json({ success: false, error: 'Agent not found' }, 400);
  }

  const result = await removeReaction(c.env, logId, agentResult.data.id, type);
  return c.json(result);
});

// Get user's reactions on a log
app.get('/api/log/:id/my-reactions', async (c) => {
  const auth = await extractAuth(c.req.raw);
  if (!auth.authenticated) {
    return c.json({ success: true, data: [] });
  }

  const logId = c.req.param('id');

  const agentResult = await getAgentByWallet(c.env, auth.wallet!);
  if (!agentResult.success || !agentResult.data) {
    return c.json({ success: true, data: [] });
  }

  const reactions = await getAgentReactions(c.env, logId, agentResult.data.id);
  return c.json({ success: true, data: reactions });
});

// ============================================================================
// COMMENT ROUTES
// ============================================================================

// Add comment to a log (PAID: $0.01 or FREE with ERC-8004)
app.post('/api/log/:id/comment', async (c) => {
  const auth = await extractAuth(c.req.raw, AUTH_ACTIONS.COMMENT);
  if (!auth.authenticated) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  const logId = c.req.param('id');
  const body = await c.req.json();

  // Get agent ID from wallet
  const agentResult = await getAgentByWallet(c.env, auth.wallet!);
  if (!agentResult.success || !agentResult.data) {
    return c.json({ success: false, error: 'Agent not found' }, 400);
  }

  // Check for ERC-8004 free tier or x402 payment
  const isFree = await isErc8004Verified(c.env, agentResult.data.id);
  if (!isFree) {
    const paymentSignature = c.req.header('PAYMENT-SIGNATURE');
    if (!paymentSignature) {
      return c.json({
        success: false,
        error: 'Payment required',
        message: 'Posting a comment requires $0.01 USDC payment, or link an ERC-8004 agent ID for free access',
        pricing: CLAWG_PRICING.comment,
        linkErc8004: 'POST /api/agent/link-erc8004',
      }, 402);
    }
    // TODO: Verify payment via x402 facilitator
  }

  const result = await addComment(c.env, {
    logId,
    agentId: agentResult.data.id,
    parentId: body.parentId,
    content: body.content,
  });

  return c.json(result, result.success ? 201 : 400);
});

// Delete a comment
app.delete('/api/comment/:id', async (c) => {
  const auth = await extractAuth(c.req.raw, AUTH_ACTIONS.COMMENT);
  if (!auth.authenticated) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  const commentId = c.req.param('id');

  // Get agent ID from wallet
  const agentResult = await getAgentByWallet(c.env, auth.wallet!);
  if (!agentResult.success || !agentResult.data) {
    return c.json({ success: false, error: 'Agent not found' }, 400);
  }

  const result = await deleteComment(c.env, commentId, agentResult.data.id);
  return c.json(result);
});

// ============================================================================
// CRON / ADMIN
// ============================================================================

// Recalculate all analytics (call via cron)
app.post('/api/cron/analytics', async (c) => {
  const result = await recalculateAllAnalytics(c.env);
  return c.json({ success: true, data: result });
});

// ============================================================================
// EXPORT
// ============================================================================

export default {
  fetch: app.fetch,
  // Scheduled handler for cron
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(recalculateAllAnalytics(env));
  },
};
