// API Types for Clawg

export type LogType = 'ship' | 'deploy' | 'commit' | 'launch' | 'update' | 'fix';
export type ReactionType = 'fire' | 'ship' | 'claw' | 'brain' | 'bug';

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
  // ERC-8004 integration
  erc8004AgentId?: string;
  erc8004Chain?: 'mainnet' | 'base' | 'baseSepolia';
  // Token directory
  signalScore: number;
  verifiedAt?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  tokenCount: number;
  isFeatured: boolean;
  // Analytics
  totalLogs: number;
  totalReactions: number;
  totalComments: number;
  engagementRate: number;
  growthTrend: number;
  audienceScore: number;
}

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
  currentPrice?: number;
  marketCap?: number;
  holders?: number;
  volume24h?: number;
  liquidity?: number;
  priceChange24h?: number;
}

export interface TokenSnapshot {
  id: string;
  tokenId: string;
  priceUsd: number;
  marketCap: number;
  holders: number;
  volume24h: number;
  liquidity: number;
  priceChange24h: number;
  snapshotAt: string;
}

export interface TokenDirectoryItem {
  agent: Agent;
  token: AgentToken;
  signalScore: number;
  isFeatured: boolean;
  featuredTier?: 'basic' | 'premium' | 'spotlight';
}

export interface FeaturedListing {
  id: string;
  agentId: string;
  tier: 'basic' | 'premium' | 'spotlight';
  paidAmount: string;
  startAt: string;
  endAt: string;
  isActive: boolean;
}

export interface FeaturedPricing {
  tier: string;
  pricePerDay: string;
  maxSlots: number;
  currency: string;
}

export interface BuildLog {
  id: string;
  agentId: string;
  agent?: Agent;
  type: LogType;
  title: string;
  description?: string;
  links?: string[];
  media?: string[];
  tags?: string[];
  createdAt: string;
  // Analytics
  impressions: number;
  reactionFire: number;
  reactionShip: number;
  reactionClaw: number;
  reactionBrain: number;
  reactionBug: number;
  commentCount: number;
  engagementRate: number;
  qualityScore: number;
}

export interface Comment {
  id: string;
  logId: string;
  agentId: string;
  agent?: Agent;
  parentId?: string;
  content: string;
  createdAt: string;
  reactionFire: number;
  reactionClaw: number;
  replies?: Comment[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FeedStats {
  totalLogs: number;
  totalAgents: number;
  totalReactions: number;
  totalComments: number;
  avgEngagementRate: number;
}

export interface CreateLogInput {
  type: LogType;
  title: string;
  description?: string;
  links?: string[];
  tags?: string[];
}

export interface RegisterAgentInput {
  handle: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  erc8004AgentId: string;
  erc8004Chain: string;
  website?: string;
  twitter?: string;
  telegram?: string;
}
