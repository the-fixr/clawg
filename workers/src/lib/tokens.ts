/**
 * Token Management for Clawg Token Directory
 *
 * Handles token CRUD, data fetching from DexScreener/Jupiter,
 * snapshot recording, and directory queries.
 */

import { getSupabase, TABLES } from './db';
import type {
  Env,
  ApiResponse,
  PaginatedResponse,
  AgentToken,
  AgentTokenRecord,
  TokenSnapshotRecord,
  TokenDirectoryItem,
  TokenDirectoryParams,
  AgentRecord,
} from './types';
import { tokenRecordToModel, agentRecordToModel } from './types';

// ============================================================================
// TOKEN CRUD
// ============================================================================

export async function linkToken(
  env: Env,
  params: {
    agentId: string;
    chain: string;
    contractAddress: string;
    symbol: string;
    name: string;
    decimals: number;
    launchpad?: string;
    isPrimary?: boolean;
  }
): Promise<ApiResponse<AgentToken>> {
  const supabase = getSupabase(env);

  // If setting as primary, unset any existing primary
  if (params.isPrimary) {
    await supabase
      .from(TABLES.AGENT_TOKENS)
      .update({ is_primary: false })
      .eq('agent_id', params.agentId);
  }

  const { data, error } = await supabase
    .from(TABLES.AGENT_TOKENS)
    .insert({
      agent_id: params.agentId,
      chain: params.chain.toLowerCase(),
      contract_address: params.contractAddress.toLowerCase(),
      symbol: params.symbol.toUpperCase(),
      name: params.name,
      decimals: params.decimals,
      launchpad: params.launchpad || null,
      is_primary: params.isPrimary ?? false,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Token already linked for this chain' };
    }
    return { success: false, error: error.message };
  }

  // Update token_count on agent
  await supabase.rpc('increment_agent_token_count', { agent_uuid: params.agentId });

  // Trigger initial snapshot
  try {
    await recordTokenSnapshot(env, data.id, params.chain.toLowerCase(), params.contractAddress.toLowerCase());
  } catch (e) {
    console.error('Initial snapshot failed:', e);
  }

  return { success: true, data: tokenRecordToModel(data as AgentTokenRecord) };
}

export async function unlinkToken(
  env: Env,
  tokenId: string,
  agentId: string
): Promise<ApiResponse<void>> {
  const supabase = getSupabase(env);

  const { error } = await supabase
    .from(TABLES.AGENT_TOKENS)
    .delete()
    .eq('id', tokenId)
    .eq('agent_id', agentId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Decrement token_count
  await supabase
    .from(TABLES.AGENTS)
    .update({ token_count: supabase.rpc ? 0 : 0 })
    .eq('id', agentId);

  // Recalculate token_count
  const { count } = await supabase
    .from(TABLES.AGENT_TOKENS)
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agentId);

  await supabase
    .from(TABLES.AGENTS)
    .update({ token_count: count || 0 })
    .eq('id', agentId);

  return { success: true };
}

export async function getAgentTokens(
  env: Env,
  agentId: string
): Promise<ApiResponse<AgentToken[]>> {
  const supabase = getSupabase(env);

  const { data: tokens, error } = await supabase
    .from(TABLES.AGENT_TOKENS)
    .select('*')
    .eq('agent_id', agentId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    return { success: false, error: error.message };
  }

  // Get latest snapshot for each token
  const result: AgentToken[] = [];
  for (const token of tokens as AgentTokenRecord[]) {
    const { data: snapshot } = await supabase
      .from(TABLES.TOKEN_SNAPSHOTS)
      .select('*')
      .eq('token_id', token.id)
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .single();

    result.push(tokenRecordToModel(token, snapshot as TokenSnapshotRecord | null));
  }

  return { success: true, data: result };
}

export async function getTokenById(
  env: Env,
  tokenId: string
): Promise<ApiResponse<AgentToken>> {
  const supabase = getSupabase(env);

  const { data: token, error } = await supabase
    .from(TABLES.AGENT_TOKENS)
    .select('*')
    .eq('id', tokenId)
    .single();

  if (error) {
    return { success: false, error: 'Token not found' };
  }

  const { data: snapshot } = await supabase
    .from(TABLES.TOKEN_SNAPSHOTS)
    .select('*')
    .eq('token_id', tokenId)
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .single();

  return {
    success: true,
    data: tokenRecordToModel(token as AgentTokenRecord, snapshot as TokenSnapshotRecord | null),
  };
}

export async function setPrimaryToken(
  env: Env,
  tokenId: string,
  agentId: string
): Promise<ApiResponse<void>> {
  const supabase = getSupabase(env);

  // Unset all primary for this agent
  await supabase
    .from(TABLES.AGENT_TOKENS)
    .update({ is_primary: false })
    .eq('agent_id', agentId);

  // Set new primary
  const { error } = await supabase
    .from(TABLES.AGENT_TOKENS)
    .update({ is_primary: true })
    .eq('id', tokenId)
    .eq('agent_id', agentId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ============================================================================
// TOKEN DATA FETCHING
// ============================================================================

interface TokenData {
  priceUsd: number;
  marketCap: number;
  holders: number;
  volume24h: number;
  liquidity: number;
  priceChange24h: number;
}

/** Map chain names to GeckoTerminal network IDs */
const GECKO_NETWORK: Record<string, string> = {
  ethereum: 'eth',
  base: 'base',
  arbitrum: 'arbitrum',
  solana: 'solana',
  monad: 'monad',
};

/** Fetch token data from GeckoTerminal (all chains) */
async function fetchFromGeckoTerminal(chain: string, contractAddress: string): Promise<TokenData> {
  const network = GECKO_NETWORK[chain] || chain;
  const res = await fetch(
    `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${contractAddress}`,
    { headers: { Accept: 'application/json' } }
  );

  if (!res.ok) throw new Error(`GeckoTerminal returned ${res.status}`);

  const json = await res.json() as {
    data?: {
      attributes?: {
        price_usd?: string | null;
        fdv_usd?: string | null;
        market_cap_usd?: string | null;
        total_reserve_in_usd?: string | null;
        volume_usd?: { h24?: string | null };
      };
    };
  };

  const attrs = json.data?.attributes;
  if (!attrs) throw new Error('Token not found on GeckoTerminal');

  return {
    priceUsd: parseFloat(attrs.price_usd || '0'),
    marketCap: parseFloat(attrs.fdv_usd || attrs.market_cap_usd || '0'),
    holders: 0,
    volume24h: parseFloat(attrs.volume_usd?.h24 || '0'),
    liquidity: parseFloat(attrs.total_reserve_in_usd || '0'),
    priceChange24h: 0, // GeckoTerminal token endpoint doesn't include price change
  };
}

/** Fetch token data from the best available source */
export async function fetchTokenData(
  chain: string,
  contractAddress: string
): Promise<TokenData> {
  try {
    return await fetchFromGeckoTerminal(chain, contractAddress);
  } catch (error) {
    console.error(`[Tokens] Failed to fetch data for ${chain}:${contractAddress}:`, error);
    return {
      priceUsd: 0,
      marketCap: 0,
      holders: 0,
      volume24h: 0,
      liquidity: 0,
      priceChange24h: 0,
    };
  }
}

/** Record a snapshot for a token */
export async function recordTokenSnapshot(
  env: Env,
  tokenId: string,
  chain?: string,
  contractAddress?: string
): Promise<void> {
  const supabase = getSupabase(env);

  // If chain/address not provided, look them up
  if (!chain || !contractAddress) {
    const { data: token } = await supabase
      .from(TABLES.AGENT_TOKENS)
      .select('chain, contract_address')
      .eq('id', tokenId)
      .single();

    if (!token) return;
    chain = token.chain;
    contractAddress = token.contract_address;
  }

  const data = await fetchTokenData(chain, contractAddress);

  await supabase.from(TABLES.TOKEN_SNAPSHOTS).insert({
    token_id: tokenId,
    price_usd: data.priceUsd,
    market_cap: data.marketCap,
    holders: data.holders,
    volume_24h: data.volume24h,
    liquidity: data.liquidity,
    price_change_24h: data.priceChange24h,
  });
}

/** Get token price history */
export async function getTokenHistory(
  env: Env,
  tokenId: string,
  days: number = 30
): Promise<TokenSnapshotRecord[]> {
  const supabase = getSupabase(env);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data } = await supabase
    .from(TABLES.TOKEN_SNAPSHOTS)
    .select('*')
    .eq('token_id', tokenId)
    .gte('snapshot_at', since.toISOString())
    .order('snapshot_at', { ascending: true });

  return (data || []) as TokenSnapshotRecord[];
}

// ============================================================================
// DIRECTORY QUERIES
// ============================================================================

/** Get token directory listing */
export async function getTokenDirectory(
  env: Env,
  params: TokenDirectoryParams = {}
): Promise<PaginatedResponse<TokenDirectoryItem>> {
  const supabase = getSupabase(env);
  const page = params.page || 1;
  const pageSize = Math.min(params.pageSize || 50, 100);
  const offset = (page - 1) * pageSize;

  // Get agents with tokens, sorted by signal_score
  let query = supabase
    .from(TABLES.AGENTS)
    .select('*, agent_tokens(*)', { count: 'exact' })
    .gt('token_count', 0)
    .not('erc8004_agent_id', 'is', null);

  // Chain filter
  if (params.chain) {
    query = query.eq('agent_tokens.chain', params.chain);
  }

  // Sort
  switch (params.sortBy) {
    case 'marketCap':
      query = query.order('signal_score', { ascending: false }); // Fallback; real mcap sort needs snapshot join
      break;
    case 'newest':
      query = query.order('created_at', { ascending: false });
      break;
    case 'trending':
      query = query.order('growth_trend', { ascending: false });
      break;
    case 'signal':
    default:
      query = query.order('signal_score', { ascending: false });
      break;
  }

  query = query.range(offset, offset + pageSize - 1);

  const { data: agents, count, error } = await query;

  if (error) {
    return { success: false, error: error.message };
  }

  // Get featured listings
  const { data: featuredData } = await supabase
    .from(TABLES.FEATURED_LISTINGS)
    .select('agent_id, tier')
    .eq('is_active', true)
    .gt('end_at', new Date().toISOString());

  const featuredMap = new Map<string, string>();
  for (const f of featuredData || []) {
    featuredMap.set(f.agent_id, f.tier);
  }

  // Build directory items
  const items: TokenDirectoryItem[] = [];
  for (const agentRow of (agents || [])) {
    const tokens = (agentRow as any).agent_tokens as AgentTokenRecord[] || [];
    const primaryToken = tokens.find(t => t.is_primary) || tokens[0];
    if (!primaryToken) continue;

    // Get latest snapshot for primary token
    const { data: snapshot } = await supabase
      .from(TABLES.TOKEN_SNAPSHOTS)
      .select('*')
      .eq('token_id', primaryToken.id)
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .single();

    // Apply market cap filter
    if (params.minMarketCap && (!snapshot || (snapshot.market_cap || 0) < params.minMarketCap)) {
      continue;
    }

    const agentRecord = { ...agentRow } as any;
    delete agentRecord.agent_tokens;

    const featuredTier = featuredMap.get(agentRecord.id);

    items.push({
      agent: agentRecordToModel(agentRecord as AgentRecord),
      token: tokenRecordToModel(primaryToken, snapshot as TokenSnapshotRecord | null),
      signalScore: agentRecord.signal_score || 0,
      isFeatured: !!featuredTier,
      featuredTier: featuredTier as 'basic' | 'premium' | 'spotlight' | undefined,
    });
  }

  // Sort featured to top
  items.sort((a, b) => {
    if (a.isFeatured && !b.isFeatured) return -1;
    if (!a.isFeatured && b.isFeatured) return 1;
    return 0;
  });

  return {
    success: true,
    data: items,
    total: count || 0,
    page,
    pageSize,
  };
}

/** Get trending tokens (biggest 24h movers) */
export async function getTrendingTokens(
  env: Env,
  period: '24h' | '7d' = '24h'
): Promise<ApiResponse<TokenDirectoryItem[]>> {
  const supabase = getSupabase(env);
  const hoursAgo = period === '24h' ? 24 : 168;
  const since = new Date();
  since.setHours(since.getHours() - hoursAgo);

  // Get tokens with recent snapshots showing biggest price changes
  const { data: snapshots } = await supabase
    .from(TABLES.TOKEN_SNAPSHOTS)
    .select('token_id, price_change_24h, price_usd, market_cap, holders, volume_24h, liquidity')
    .gte('snapshot_at', since.toISOString())
    .order('price_change_24h', { ascending: false })
    .limit(20);

  if (!snapshots || snapshots.length === 0) {
    return { success: true, data: [] };
  }

  // Deduplicate by token_id (take latest)
  const seen = new Set<string>();
  const uniqueSnapshots = snapshots.filter(s => {
    if (seen.has(s.token_id)) return false;
    seen.add(s.token_id);
    return true;
  });

  const items: TokenDirectoryItem[] = [];
  for (const snap of uniqueSnapshots.slice(0, 10)) {
    const { data: token } = await supabase
      .from(TABLES.AGENT_TOKENS)
      .select('*, agents(*)')
      .eq('id', snap.token_id)
      .single();

    if (!token) continue;

    const agentRecord = (token as any).agents as AgentRecord;
    if (!agentRecord) continue;

    const tokenRecord = { ...token } as any;
    delete tokenRecord.agents;

    items.push({
      agent: agentRecordToModel(agentRecord),
      token: tokenRecordToModel(tokenRecord as AgentTokenRecord, snap as TokenSnapshotRecord),
      signalScore: agentRecord.signal_score || 0,
      isFeatured: agentRecord.is_featured || false,
    });
  }

  return { success: true, data: items };
}

/** Get newly listed tokens */
export async function getNewTokens(
  env: Env,
  days: number = 7
): Promise<ApiResponse<TokenDirectoryItem[]>> {
  const supabase = getSupabase(env);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: tokens } = await supabase
    .from(TABLES.AGENT_TOKENS)
    .select('*, agents(*)')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(20);

  if (!tokens) return { success: true, data: [] };

  const items: TokenDirectoryItem[] = [];
  for (const token of tokens) {
    const agentRecord = (token as any).agents as AgentRecord;
    if (!agentRecord) continue;

    const tokenRecord = { ...token } as any;
    delete tokenRecord.agents;

    // Get latest snapshot
    const { data: snapshot } = await supabase
      .from(TABLES.TOKEN_SNAPSHOTS)
      .select('*')
      .eq('token_id', token.id)
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .single();

    items.push({
      agent: agentRecordToModel(agentRecord),
      token: tokenRecordToModel(tokenRecord as AgentTokenRecord, snapshot as TokenSnapshotRecord | null),
      signalScore: agentRecord.signal_score || 0,
      isFeatured: agentRecord.is_featured || false,
    });
  }

  return { success: true, data: items };
}

/** Get all linked tokens (for cron snapshot updates) */
export async function getAllLinkedTokens(
  env: Env
): Promise<AgentTokenRecord[]> {
  const supabase = getSupabase(env);

  const { data } = await supabase
    .from(TABLES.AGENT_TOKENS)
    .select('*');

  return (data || []) as AgentTokenRecord[];
}
