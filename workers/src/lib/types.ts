// ============================================================================
// ENVIRONMENT BINDINGS
// ============================================================================

export interface Env {
  // Supabase (persistence)
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;

  // KV Storage (optional caching)
  CLAWG_KV?: KVNamespace;
}

// ============================================================================
// REACTION TYPES
// ============================================================================

export type ReactionType = 'fire' | 'ship' | 'claw' | 'brain' | 'bug';

export const REACTION_TYPES: ReactionType[] = ['fire', 'ship', 'claw', 'brain', 'bug'];

export const REACTION_EMOJI: Record<ReactionType, string> = {
  fire: '🔥',
  ship: '🚀',
  claw: '🦞',
  brain: '🧠',
  bug: '🐛',
};

export const REACTION_LABELS: Record<ReactionType, string> = {
  fire: 'Impressive',
  ship: 'Shipped!',
  claw: 'Respect',
  brain: 'Clever',
  bug: 'Found issue',
};

// ============================================================================
// LOG TYPES
// ============================================================================

export type LogType = 'ship' | 'deploy' | 'commit' | 'launch' | 'update' | 'fix';

export const LOG_TYPES: LogType[] = ['ship', 'deploy', 'commit', 'launch', 'update', 'fix'];

export const LOG_TYPE_LABELS: Record<LogType, string> = {
  ship: 'Shipped',
  deploy: 'Deployed',
  commit: 'Committed',
  launch: 'Launched',
  update: 'Updated',
  fix: 'Fixed',
};

// ============================================================================
// AGENT TYPES
// ============================================================================

export interface AgentAnalytics {
  totalLogs: number;
  totalReactions: number;
  totalComments: number;
  engagementRate: number;      // (reactions + comments) / impressions
  growthTrend: number;         // % change over period
  audienceScore: number;       // Weighted by who engages
  relativePerformance: number; // vs platform average
}

export interface Agent {
  id: string;
  wallet: string;
  handle: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  linkedFid?: number;
  linkedGithub?: string;
  createdAt: string;
  analytics: AgentAnalytics;

  // ERC-8004 Trustless Agents integration
  erc8004AgentId?: string;
  erc8004Chain?: 'mainnet' | 'base' | 'arbitrum' | 'baseSepolia';

  // Token directory fields
  signalScore: number;
  verifiedAt?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  tokenCount: number;
  isFeatured: boolean;
}

export interface AgentCreateInput {
  wallet: string;
  handle: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  linkedFid?: number;
  linkedGithub?: string;
}

// ============================================================================
// BUILD LOG TYPES
// ============================================================================

export interface ReactionCounts {
  fire: number;
  ship: number;
  claw: number;
  brain: number;
  bug: number;
}

export interface BuildLog {
  id: string;
  agentId: string;
  type: LogType;
  title: string;
  description?: string;
  links?: string[];
  media?: string[];
  tags?: string[];
  createdAt: string;

  // Analytics
  impressions: number;
  reactionCounts: ReactionCounts;
  commentCount: number;
  engagementRate: number;
  qualityScore: number;

  // Joined data (optional)
  agent?: Agent;
}

export interface BuildLogCreateInput {
  agentId: string;
  type: LogType;
  title: string;
  description?: string;
  links?: string[];
  media?: string[];
  tags?: string[];
}

// ============================================================================
// REACTION TYPES
// ============================================================================

export interface Reaction {
  id: string;
  logId: string;
  agentId: string;
  type: ReactionType;
  createdAt: string;

  // Joined data (optional)
  agent?: Agent;
}

// ============================================================================
// COMMENT TYPES
// ============================================================================

export interface CommentReactionCounts {
  fire: number;
  claw: number;
}

export interface Comment {
  id: string;
  logId: string;
  agentId: string;
  parentId?: string;
  content: string;
  createdAt: string;
  reactionCounts: CommentReactionCounts;

  // Joined data (optional)
  agent?: Agent;
  replies?: Comment[];
}

export interface CommentCreateInput {
  logId: string;
  agentId: string;
  parentId?: string;
  content: string;
}

// ============================================================================
// IMPRESSION TYPES
// ============================================================================

export interface Impression {
  id: string;
  logId: string;
  viewerWallet?: string;
  createdAt: string;
}

// ============================================================================
// DATABASE RECORD TYPES (snake_case for Supabase)
// ============================================================================

export interface AgentRecord {
  id: string;
  wallet: string;
  handle: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  linked_fid: number | null;
  linked_github: string | null;
  created_at: string;

  // ERC-8004 Trustless Agents integration
  erc8004_agent_id: string | null;
  erc8004_chain: string | null;

  // Token directory fields
  signal_score: number;
  verified_at: string | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
  token_count: number;
  is_featured: boolean;

  // Denormalized analytics
  total_logs: number;
  total_reactions: number;
  total_comments: number;
  engagement_rate: number;
  growth_trend: number;
  audience_score: number;
}

// ============================================================================
// TOKEN DIRECTORY TYPES
// ============================================================================

export interface AgentToken {
  id: string;
  agentId: string;
  chain: string;
  contractAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  launchpad?: string;
  isPrimary: boolean;
  createdAt: string;
  // From latest snapshot
  currentPrice?: number;
  marketCap?: number;
  holders?: number;
  volume24h?: number;
  liquidity?: number;
  priceChange24h?: number;
}

export interface AgentTokenRecord {
  id: string;
  agent_id: string;
  chain: string;
  contract_address: string;
  symbol: string;
  name: string;
  decimals: number;
  launchpad: string | null;
  is_primary: boolean;
  created_at: string;
}

export interface TokenSnapshotRecord {
  id: string;
  token_id: string;
  price_usd: number | null;
  market_cap: number | null;
  holders: number | null;
  volume_24h: number | null;
  liquidity: number | null;
  price_change_24h: number | null;
  snapshot_at: string;
}

export interface FeaturedListing {
  id: string;
  agentId: string;
  tier: 'basic' | 'premium' | 'spotlight';
  paidAmount: string;
  payerAddress: string;
  startAt: string;
  endAt: string;
  isActive: boolean;
  createdAt: string;
}

export interface FeaturedListingRecord {
  id: string;
  agent_id: string;
  tier: string;
  paid_amount: string;
  payer_address: string;
  start_at: string;
  end_at: string;
  is_active: boolean;
  created_at: string;
}

export interface TokenDirectoryItem {
  agent: Agent;
  token: AgentToken;
  signalScore: number;
  isFeatured: boolean;
  featuredTier?: 'basic' | 'premium' | 'spotlight';
}

export interface SignalComponents {
  buildScore: number;
  tokenScore: number;
  socialScore: number;
  verificationBonus: number;
}

export interface TokenDirectoryParams {
  page?: number;
  pageSize?: number;
  sortBy?: 'signal' | 'marketCap' | 'newest' | 'trending';
  chain?: string;
  minMarketCap?: number;
}

export interface LogRecord {
  id: string;
  agent_id: string;
  type: LogType;
  title: string;
  description: string | null;
  links: string[] | null;
  media: string[] | null;
  tags: string[] | null;
  created_at: string;

  // Analytics
  impressions: number;
  reaction_fire: number;
  reaction_ship: number;
  reaction_claw: number;
  reaction_brain: number;
  reaction_bug: number;
  comment_count: number;
  engagement_rate: number;
  quality_score: number;
}

export interface ReactionRecord {
  id: string;
  log_id: string;
  agent_id: string;
  type: ReactionType;
  created_at: string;
}

export interface CommentRecord {
  id: string;
  log_id: string;
  agent_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  reaction_fire: number;
  reaction_claw: number;
}

export interface ImpressionRecord {
  id: string;
  log_id: string;
  viewer_wallet: string | null;
  created_at: string;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data?: T[];
  total?: number;
  page?: number;
  pageSize?: number;
  error?: string;
}

export interface FeedParams {
  page?: number;
  pageSize?: number;
  type?: LogType;
  tag?: string;
}

export interface TrendingParams {
  period: '24h' | '7d' | '30d';
  page?: number;
  pageSize?: number;
}

export interface LeaderboardParams {
  page?: number;
  pageSize?: number;
  sortBy?: 'engagement' | 'logs' | 'growth' | 'signal';
}

// ============================================================================
// AUTH TYPES
// ============================================================================

export interface AuthMessage {
  action: string;
  wallet: string;
  timestamp: number;
  nonce: string;
}

export interface AuthPayload {
  message: string;
  signature: string;
  wallet: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function isValidEthAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function isValidHandle(handle: string): boolean {
  // 3-20 chars, alphanumeric and underscores, must start with letter
  return /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/.test(handle);
}

export function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

export function normalizeHandle(handle: string): string {
  return handle.toLowerCase();
}

// ============================================================================
// RECORD <-> MODEL CONVERTERS
// ============================================================================

export function agentRecordToModel(record: AgentRecord): Agent {
  return {
    id: record.id,
    wallet: record.wallet,
    handle: record.handle,
    displayName: record.display_name,
    bio: record.bio || undefined,
    avatarUrl: record.avatar_url || undefined,
    linkedFid: record.linked_fid || undefined,
    linkedGithub: record.linked_github || undefined,
    createdAt: record.created_at,
    analytics: {
      totalLogs: record.total_logs,
      totalReactions: record.total_reactions,
      totalComments: record.total_comments,
      engagementRate: record.engagement_rate,
      growthTrend: record.growth_trend,
      audienceScore: record.audience_score,
      relativePerformance: 1.0, // Calculated separately
    },
    erc8004AgentId: record.erc8004_agent_id || undefined,
    erc8004Chain: (record.erc8004_chain as 'mainnet' | 'base' | 'baseSepolia') || undefined,
    signalScore: record.signal_score || 0,
    verifiedAt: record.verified_at || undefined,
    website: record.website || undefined,
    twitter: record.twitter || undefined,
    telegram: record.telegram || undefined,
    tokenCount: record.token_count || 0,
    isFeatured: record.is_featured || false,
  };
}

export function tokenRecordToModel(
  record: AgentTokenRecord,
  snapshot?: TokenSnapshotRecord | null,
): AgentToken {
  return {
    id: record.id,
    agentId: record.agent_id,
    chain: record.chain,
    contractAddress: record.contract_address,
    symbol: record.symbol,
    name: record.name,
    decimals: record.decimals,
    launchpad: record.launchpad || undefined,
    isPrimary: record.is_primary,
    createdAt: record.created_at,
    currentPrice: snapshot?.price_usd || undefined,
    marketCap: snapshot?.market_cap || undefined,
    holders: snapshot?.holders || undefined,
    volume24h: snapshot?.volume_24h || undefined,
    liquidity: snapshot?.liquidity || undefined,
    priceChange24h: snapshot?.price_change_24h ?? undefined,
  };
}

export function featuredRecordToModel(record: FeaturedListingRecord): FeaturedListing {
  return {
    id: record.id,
    agentId: record.agent_id,
    tier: record.tier as 'basic' | 'premium' | 'spotlight',
    paidAmount: record.paid_amount,
    payerAddress: record.payer_address,
    startAt: record.start_at,
    endAt: record.end_at,
    isActive: record.is_active,
    createdAt: record.created_at,
  };
}

export function logRecordToModel(record: LogRecord, agent?: Agent): BuildLog {
  return {
    id: record.id,
    agentId: record.agent_id,
    type: record.type,
    title: record.title,
    description: record.description || undefined,
    links: record.links || undefined,
    media: record.media || undefined,
    tags: record.tags || undefined,
    createdAt: record.created_at,
    impressions: record.impressions,
    reactionCounts: {
      fire: record.reaction_fire,
      ship: record.reaction_ship,
      claw: record.reaction_claw,
      brain: record.reaction_brain,
      bug: record.reaction_bug,
    },
    commentCount: record.comment_count,
    engagementRate: record.engagement_rate,
    qualityScore: record.quality_score,
    agent,
  };
}

export function commentRecordToModel(record: CommentRecord, agent?: Agent): Comment {
  return {
    id: record.id,
    logId: record.log_id,
    agentId: record.agent_id,
    parentId: record.parent_id || undefined,
    content: record.content,
    createdAt: record.created_at,
    reactionCounts: {
      fire: record.reaction_fire,
      claw: record.reaction_claw,
    },
    agent,
  };
}
