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
    .update({ token_count: 0 })
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
// TOKEN DATA FETCHING — Direct DEX reads via raw RPC
// ============================================================================

interface TokenData {
  priceUsd: number;
  marketCap: number;
  holders: number;
  volume24h: number;
  liquidity: number;
  priceChange24h: number;
}

// ---------------------------------------------------------------------------
// Known pool configs (keyed by "chain:address" lowercase)
// ---------------------------------------------------------------------------

interface PoolConfig {
  dexType: 'uniswap_v4' | 'uniswap_v3' | 'uniswap_v2' | 'raydium_launchlab';
  poolAddress: string; // Pool contract or PoolId (V4)
  isToken0: boolean;   // Is the token token0 in the pair?
}

const KNOWN_POOLS: Record<string, PoolConfig> = {
  // Base CLAWG / WETH on Uniswap V4
  'base:0x06a127f0b53f83dd5d94e83d96b55a279705bb07': {
    dexType: 'uniswap_v4',
    poolAddress: '0xdc591017ff208c02a8e05baf3a7e2ed9785101f2e789b602b402ae9d529bafe0',
    isToken0: true, // CLAWG (0x06a1) < WETH (0x4200)
  },
  // Solana CLAWG / SOL on Raydium LaunchLab
  'solana:hqq7wtkme1lskkhllb6zri2rssxnbbqb4tohzbanbvbjf': {
    dexType: 'raydium_launchlab',
    poolAddress: 'EZSyfLfLpbyD5FctevtUHv1YYJxf4G2w8w93d4qLwaVw',
    isToken0: true,
  },
};

// ---------------------------------------------------------------------------
// Raw RPC helper (lightweight, no viem overhead for CF Workers)
// ---------------------------------------------------------------------------

const BASE_RPCS = [
  'https://base-mainnet.public.blastapi.io',
  'https://1rpc.io/base',
  'https://base.llamarpc.com',
];
const Q96 = 2n ** 96n;

/** Single eth_call with RPC failover */
async function ethCall(rpc: string, to: string, data: string): Promise<string> {
  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_call', params: [{ to, data }, 'latest'], id: 1 }),
  });
  if (!res.ok) throw new Error(`RPC returned ${res.status}`);
  const json = await res.json() as { result?: string; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result || '0x';
}

/** Batch eth_call — sends multiple calls in one HTTP request */
async function ethCallBatch(calls: Array<{ to: string; data: string }>): Promise<string[]> {
  const batch = calls.map((c, i) => ({
    jsonrpc: '2.0',
    method: 'eth_call',
    params: [{ to: c.to, data: c.data }, 'latest'],
    id: i + 1,
  }));

  // Try RPCs in order until one succeeds
  for (const rpc of BASE_RPCS) {
    try {
      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
      if (!res.ok) continue;
      const json = await res.json() as Array<{ id: number; result?: string; error?: { message: string } }>;
      if (!Array.isArray(json)) continue;
      // Sort by id and extract results
      json.sort((a, b) => a.id - b.id);
      return json.map(r => {
        if (r.error) throw new Error(r.error.message);
        return r.result || '0x';
      });
    } catch {
      continue; // Try next RPC
    }
  }
  throw new Error('All RPCs failed');
}

// ---------------------------------------------------------------------------
// ETH price from Uniswap V3 WETH/USDC pool on Base
// ---------------------------------------------------------------------------

let ethPriceCache: { price: number; ts: number } | null = null;

function parseEthPrice(sqrtPriceX96: bigint): number {
  // V3 WETH/USDC pool: token0=WETH(18dec), token1=USDC(6dec)
  // price = sqrtPriceX96^2 / Q192 = USDC_raw / WETH_raw
  // ethPrice = price * 10^12
  const ethPriceE6 = (sqrtPriceX96 * sqrtPriceX96 * (10n ** 18n)) / (Q96 * Q96);
  return Number(ethPriceE6) / 1e6;
}

// ---------------------------------------------------------------------------
// Uniswap V4 direct read — single batch RPC call for all data
// ---------------------------------------------------------------------------

async function fetchFromUniswapV4(
  poolId: string,
  tokenAddress: string,
  tokenDecimals: number,
  _isToken0: boolean,
): Promise<TokenData> {
  const poolIdHex = poolId.startsWith('0x') ? poolId.slice(2) : poolId;

  // One batch: V3 slot0 (ETH price) + V4 getSlot0 (token price) + totalSupply
  let results: string[];
  if (ethPriceCache && Date.now() - ethPriceCache.ts < 300_000) {
    // ETH price cached, only need 2 calls
    results = ['CACHED', ...await ethCallBatch([
      { to: '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71', data: '0xc815641c' + poolIdHex },
      { to: tokenAddress, data: '0x18160ddd' },
    ])];
  } else {
    results = await ethCallBatch([
      { to: '0xd0b53D9277642d899DF5C87A3966A349A798F224', data: '0x3850c7bd' }, // V3 slot0
      { to: '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71', data: '0xc815641c' + poolIdHex }, // V4 getSlot0
      { to: tokenAddress, data: '0x18160ddd' }, // totalSupply
    ]);
  }

  // Parse ETH price
  let ethPrice: number;
  if (results[0] === 'CACHED') {
    ethPrice = ethPriceCache!.price;
  } else {
    const ethSqrt = BigInt('0x' + results[0].slice(2, 66));
    ethPrice = parseEthPrice(ethSqrt);
    ethPriceCache = { price: ethPrice, ts: Date.now() };
  }

  // Parse CLAWG price
  const v4Idx = results[0] === 'CACHED' ? 1 : 1;
  const tsIdx = results[0] === 'CACHED' ? 2 : 2;
  const sqrtPriceX96 = BigInt('0x' + results[v4Idx].slice(2, 66));

  const priceE18 = (sqrtPriceX96 * sqrtPriceX96 * (10n ** 18n)) / (Q96 * Q96);
  let tokenPriceInWeth: number;
  if (tokenDecimals === 18) {
    tokenPriceInWeth = Number(priceE18) / 1e18;
  } else {
    const adj = 10n ** BigInt(Math.abs(tokenDecimals - 18));
    tokenPriceInWeth = tokenDecimals > 18
      ? Number(priceE18 * adj) / 1e18
      : Number(priceE18) / (Number(adj) * 1e18);
  }

  const priceUsd = tokenPriceInWeth * ethPrice;
  const totalSupply = BigInt(results[tsIdx]);
  const totalSupplyHuman = Number(totalSupply) / (10 ** tokenDecimals);
  const marketCap = priceUsd * totalSupplyHuman;

  return {
    priceUsd,
    marketCap,
    holders: 0,
    volume24h: 0,
    liquidity: 0,
    priceChange24h: 0,
  };
}

// ---------------------------------------------------------------------------
// GeckoTerminal — multi-endpoint data aggregation
// ---------------------------------------------------------------------------

const GECKO_NETWORK: Record<string, string> = {
  ethereum: 'eth',
  base: 'base',
  arbitrum: 'arbitrum',
  solana: 'solana',
  monad: 'monad',
};

/** Fetch price/volume/liquidity from GeckoTerminal pools endpoint (best pool) */
async function fetchGeckoPoolData(chain: string, contractAddress: string): Promise<Partial<TokenData>> {
  const network = GECKO_NETWORK[chain] || chain;
  try {
    const res = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${contractAddress}/pools?page=1`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return {};

    const json = await res.json() as {
      data?: Array<{
        attributes?: {
          base_token_price_usd?: string | null;
          fdv_usd?: string | null;
          market_cap_usd?: string | null;
          reserve_in_usd?: string | null;
          volume_usd?: { h24?: string | null };
          price_change_percentage?: { h24?: string | null };
        };
      }>;
    };

    const pool = json.data?.[0]?.attributes;
    if (!pool) return {};

    return {
      priceUsd: parseFloat(pool.base_token_price_usd || '0'),
      marketCap: parseFloat(pool.fdv_usd || pool.market_cap_usd || '0'),
      volume24h: parseFloat(pool.volume_usd?.h24 || '0'),
      liquidity: parseFloat(pool.reserve_in_usd || '0'),
      priceChange24h: parseFloat(pool.price_change_percentage?.h24 || '0'),
    };
  } catch (e) {
    console.error('[Tokens] GeckoTerminal pool fetch failed:', e);
    return {};
  }
}

/** Fetch holder count + honeypot status from GeckoTerminal info endpoint */
async function fetchGeckoHolderData(chain: string, contractAddress: string): Promise<{ holders: number }> {
  const network = GECKO_NETWORK[chain] || chain;
  try {
    const res = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${contractAddress}/info`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return { holders: 0 };

    const json = await res.json() as {
      data?: {
        attributes?: {
          holders?: { count?: number | null };
        };
      };
    };

    return { holders: json.data?.attributes?.holders?.count || 0 };
  } catch (e) {
    console.error('[Tokens] GeckoTerminal holder fetch failed:', e);
    return { holders: 0 };
  }
}

// ---------------------------------------------------------------------------
// Dispatch: aggregate data from multiple sources
// ---------------------------------------------------------------------------

/** Pick the best non-zero value */
function best(a: number | undefined, b: number | undefined): number {
  return (a && a > 0) ? a : (b && b > 0) ? b : 0;
}

export async function fetchTokenData(
  chain: string,
  contractAddress: string,
  decimals: number = 18,
): Promise<TokenData> {
  const key = `${chain}:${contractAddress}`.toLowerCase();
  const pool = KNOWN_POOLS[key];

  // Two data sources only (stay under GeckoTerminal 30 req/min):
  //   1. Direct DEX read (if known pool) — price, market cap
  //   2. GeckoTerminal /pools — price, volume, liquidity, price change, FDV
  //   3. GeckoTerminal /info — holder count (staggered 1s after /pools)
  const results: Partial<TokenData>[] = [];

  // Batch 1: Direct DEX read + GeckoTerminal pools (in parallel)
  const batch1: Promise<Partial<TokenData>>[] = [];
  if (pool?.dexType === 'uniswap_v4') {
    batch1.push(
      fetchFromUniswapV4(pool.poolAddress, contractAddress, decimals, pool.isToken0)
        .catch(e => { console.error('[Tokens] Uniswap V4 read failed:', e); return {}; })
    );
  }
  batch1.push(fetchGeckoPoolData(chain, contractAddress));
  results.push(...await Promise.all(batch1));

  // Batch 2: GeckoTerminal holder data (staggered — 1s delay to avoid 429)
  await new Promise(r => setTimeout(r, 1000));
  results.push(await fetchGeckoHolderData(chain, contractAddress));

  // Merge: best value from each source wins
  const merged: TokenData = {
    priceUsd: 0,
    marketCap: 0,
    holders: 0,
    volume24h: 0,
    liquidity: 0,
    priceChange24h: 0,
  };

  for (const r of results) {
    merged.priceUsd = best(merged.priceUsd, r.priceUsd);
    merged.marketCap = best(merged.marketCap, r.marketCap);
    merged.holders = best(merged.holders, r.holders);
    merged.volume24h = best(merged.volume24h, r.volume24h);
    merged.liquidity = best(merged.liquidity, r.liquidity);
    if (merged.priceChange24h === 0 && r.priceChange24h !== undefined && r.priceChange24h !== 0) {
      merged.priceChange24h = r.priceChange24h;
    }
  }

  return merged;
}

/** Record a snapshot for a token */
export async function recordTokenSnapshot(
  env: Env,
  tokenId: string,
  chain?: string,
  contractAddress?: string,
  decimals?: number,
): Promise<void> {
  const supabase = getSupabase(env);

  // If chain/address not provided, look them up
  if (!chain || !contractAddress) {
    const { data: token } = await supabase
      .from(TABLES.AGENT_TOKENS)
      .select('chain, contract_address, decimals')
      .eq('id', tokenId)
      .single();

    if (!token) return;
    chain = token.chain;
    contractAddress = token.contract_address;
    decimals = token.decimals;
  }

  const data = await fetchTokenData(chain!, contractAddress!, decimals ?? 18);

  // Carry forward last known non-zero holders when current fetch returns 0
  if (data.holders === 0) {
    const { data: rows } = await supabase
      .from(TABLES.TOKEN_SNAPSHOTS)
      .select('holders')
      .eq('token_id', tokenId)
      .gt('holders', 0)
      .order('snapshot_at', { ascending: false })
      .limit(1);
    if (rows && rows.length > 0) data.holders = rows[0].holders;
  }

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