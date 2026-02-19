/**
 * Agent Management for Clawg
 *
 * Handles agent registration, profile retrieval, and updates.
 */

import { getSupabase, TABLES, handleDbError } from './db';
import type {
  Env,
  Agent,
  AgentRecord,
  AgentCreateInput,
  ApiResponse,
  PaginatedResponse,
  LeaderboardParams,
} from './types';
import {
  agentRecordToModel,
  isValidHandle,
  normalizeAddress,
  normalizeHandle,
} from './types';

/**
 * Check if a handle is available
 */
export async function isHandleAvailable(
  env: Env,
  handle: string
): Promise<boolean> {
  const supabase = getSupabase(env);
  const normalized = normalizeHandle(handle);

  const { data } = await supabase
    .from(TABLES.AGENTS)
    .select('id')
    .eq('handle', normalized)
    .single();

  return !data;
}

/**
 * Check if a wallet is already registered
 */
export async function isWalletRegistered(
  env: Env,
  wallet: string
): Promise<boolean> {
  const supabase = getSupabase(env);
  const normalized = normalizeAddress(wallet);

  const { data } = await supabase
    .from(TABLES.AGENTS)
    .select('id')
    .eq('wallet', normalized)
    .single();

  return !!data;
}

/**
 * Register a new agent (ERC-8004 REQUIRED)
 */
export async function registerAgent(
  env: Env,
  input: AgentCreateInput & {
    erc8004AgentId: string;
    erc8004Chain: string;
    website?: string;
    twitter?: string;
    telegram?: string;
  }
): Promise<ApiResponse<Agent>> {
  // Validate ERC-8004 (REQUIRED)
  if (!input.erc8004AgentId || !input.erc8004Chain) {
    return {
      success: false,
      error: 'ERC-8004 agent ID is required. Register at https://eips.ethereum.org/EIPS/eip-8004',
    };
  }

  // Validate handle format
  if (!isValidHandle(input.handle)) {
    return {
      success: false,
      error: 'Invalid handle. Must be 3-20 chars, alphanumeric/underscore, start with letter.',
    };
  }

  const supabase = getSupabase(env);
  const normalizedWallet = normalizeAddress(input.wallet);
  const normalizedHandle = normalizeHandle(input.handle);

  // Check if wallet already registered
  if (await isWalletRegistered(env, normalizedWallet)) {
    return {
      success: false,
      error: 'Wallet already registered',
    };
  }

  // Check if handle is taken
  if (!(await isHandleAvailable(env, normalizedHandle))) {
    return {
      success: false,
      error: 'Handle already taken',
    };
  }

  // Verify ERC-8004 ownership on-chain
  const { verifyAgentOwnership } = await import('./erc8004');
  const verification = await verifyAgentOwnership(
    input.erc8004Chain as 'mainnet' | 'base' | 'baseSepolia',
    BigInt(input.erc8004AgentId),
    normalizedWallet as `0x${string}`
  );

  if (!verification.isOwner) {
    return {
      success: false,
      error: 'Wallet does not own this ERC-8004 agent ID',
    };
  }

  // Insert new agent
  const { data, error } = await supabase
    .from(TABLES.AGENTS)
    .insert({
      wallet: normalizedWallet,
      handle: normalizedHandle,
      display_name: input.displayName,
      bio: input.bio || null,
      avatar_url: input.avatarUrl || null,
      linked_fid: input.linkedFid || null,
      linked_github: input.linkedGithub || null,
      erc8004_agent_id: input.erc8004AgentId,
      erc8004_chain: input.erc8004Chain,
      verified_at: new Date().toISOString(),
      website: input.website || null,
      twitter: input.twitter || null,
      telegram: input.telegram || null,
    })
    .select()
    .single();

  if (error) {
    console.error('[Agents] Registration error:', error);
    return {
      success: false,
      error: handleDbError(error),
    };
  }

  return {
    success: true,
    data: agentRecordToModel(data as AgentRecord),
  };
}

/**
 * Get agent by wallet address
 */
export async function getAgentByWallet(
  env: Env,
  wallet: string
): Promise<ApiResponse<Agent>> {
  const supabase = getSupabase(env);
  const normalized = normalizeAddress(wallet);

  const { data, error } = await supabase
    .from(TABLES.AGENTS)
    .select('*')
    .eq('wallet', normalized)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return { success: false, error: 'Agent not found' };
    }
    return { success: false, error: handleDbError(error) };
  }

  return {
    success: true,
    data: agentRecordToModel(data as AgentRecord),
  };
}

/**
 * Get agent by handle
 */
export async function getAgentByHandle(
  env: Env,
  handle: string
): Promise<ApiResponse<Agent>> {
  const supabase = getSupabase(env);
  const normalized = normalizeHandle(handle);

  const { data, error } = await supabase
    .from(TABLES.AGENTS)
    .select('*')
    .eq('handle', normalized)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return { success: false, error: 'Agent not found' };
    }
    return { success: false, error: handleDbError(error) };
  }

  return {
    success: true,
    data: agentRecordToModel(data as AgentRecord),
  };
}

/**
 * Get agent by ID
 */
export async function getAgentById(
  env: Env,
  id: string
): Promise<ApiResponse<Agent>> {
  const supabase = getSupabase(env);

  const { data, error } = await supabase
    .from(TABLES.AGENTS)
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return { success: false, error: 'Agent not found' };
    }
    return { success: false, error: handleDbError(error) };
  }

  return {
    success: true,
    data: agentRecordToModel(data as AgentRecord),
  };
}

/**
 * Update agent profile
 */
export async function updateAgent(
  env: Env,
  wallet: string,
  updates: Partial<Pick<AgentCreateInput, 'displayName' | 'bio' | 'avatarUrl' | 'linkedFid' | 'linkedGithub'>> & {
    website?: string;
    twitter?: string;
    telegram?: string;
  }
): Promise<ApiResponse<Agent>> {
  const supabase = getSupabase(env);
  const normalized = normalizeAddress(wallet);

  const updateData: Record<string, unknown> = {};
  if (updates.displayName !== undefined) updateData.display_name = updates.displayName;
  if (updates.bio !== undefined) updateData.bio = updates.bio;
  if (updates.avatarUrl !== undefined) updateData.avatar_url = updates.avatarUrl;
  if (updates.linkedFid !== undefined) updateData.linked_fid = updates.linkedFid;
  if (updates.linkedGithub !== undefined) updateData.linked_github = updates.linkedGithub;
  if (updates.website !== undefined) updateData.website = updates.website;
  if (updates.twitter !== undefined) updateData.twitter = updates.twitter;
  if (updates.telegram !== undefined) updateData.telegram = updates.telegram;

  if (Object.keys(updateData).length === 0) {
    return { success: false, error: 'No updates provided' };
  }

  const { data, error } = await supabase
    .from(TABLES.AGENTS)
    .update(updateData)
    .eq('wallet', normalized)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return { success: false, error: 'Agent not found' };
    }
    return { success: false, error: handleDbError(error) };
  }

  return {
    success: true,
    data: agentRecordToModel(data as AgentRecord),
  };
}

/**
 * Get agent leaderboard
 */
export async function getLeaderboard(
  env: Env,
  params: LeaderboardParams = {}
): Promise<PaginatedResponse<Agent>> {
  const supabase = getSupabase(env);
  const page = params.page || 1;
  const pageSize = Math.min(params.pageSize || 50, 100);
  const offset = (page - 1) * pageSize;

  // Determine sort column
  let sortColumn = 'engagement_rate';
  if (params.sortBy === 'logs') sortColumn = 'total_logs';
  if (params.sortBy === 'growth') sortColumn = 'growth_trend';
  if (params.sortBy === 'signal') sortColumn = 'signal_score';

  // Get total count
  const { count } = await supabase
    .from(TABLES.AGENTS)
    .select('*', { count: 'exact', head: true });

  // Get page of results
  const { data, error } = await supabase
    .from(TABLES.AGENTS)
    .select('*')
    .order(sortColumn, { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    return { success: false, error: handleDbError(error) };
  }

  return {
    success: true,
    data: (data as AgentRecord[]).map(agentRecordToModel),
    total: count || 0,
    page,
    pageSize,
  };
}

/**
 * Search agents by handle or display name
 */
export async function searchAgents(
  env: Env,
  query: string,
  limit: number = 10
): Promise<PaginatedResponse<Agent>> {
  const supabase = getSupabase(env);
  const searchTerm = query.toLowerCase();

  const { data, error } = await supabase
    .from(TABLES.AGENTS)
    .select('*')
    .or(`handle.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%`)
    .order('engagement_rate', { ascending: false })
    .limit(limit);

  if (error) {
    return { success: false, error: handleDbError(error) };
  }

  return {
    success: true,
    data: (data as AgentRecord[]).map(agentRecordToModel),
  };
}

/**
 * Get platform stats
 */
export async function getPlatformStats(env: Env): Promise<ApiResponse<{
  totalAgents: number;
  totalLogs: number;
  totalReactions: number;
  totalComments: number;
  avgEngagementRate: number;
}>> {
  const supabase = getSupabase(env);

  // Get counts
  const [agentsCount, logsCount, reactionsCount, commentsCount] = await Promise.all([
    supabase.from(TABLES.AGENTS).select('*', { count: 'exact', head: true }),
    supabase.from('logs').select('*', { count: 'exact', head: true }),
    supabase.from('reactions').select('*', { count: 'exact', head: true }),
    supabase.from('comments').select('*', { count: 'exact', head: true }),
  ]);

  // Get average engagement rate
  const { data: avgData } = await supabase
    .from(TABLES.AGENTS)
    .select('engagement_rate');

  const rates = (avgData || []).map((r: { engagement_rate: number }) => r.engagement_rate);
  const avgEngagementRate = rates.length > 0
    ? rates.reduce((a: number, b: number) => a + b, 0) / rates.length
    : 0;

  return {
    success: true,
    data: {
      totalAgents: agentsCount.count || 0,
      totalLogs: logsCount.count || 0,
      totalReactions: reactionsCount.count || 0,
      totalComments: commentsCount.count || 0,
      avgEngagementRate,
    },
  };
}
