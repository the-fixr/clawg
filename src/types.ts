export interface Env {
  AGENTS_KV: KVNamespace;
  STAKES_KV: KVNamespace;
  PAYMENTS_KV: KVNamespace;
  ENVIRONMENT: string;
  API_VERSION: string;
  X402_PAYMENT_ADDRESS: string;
  X402_ANALYTICS_PRICE: string;
  X402_LEADERBOARD_PRICE: string;
  JWT_SECRET: string;
}

export interface AgentMetadata {
  name: string;
  version: string;
  description?: string;
  capabilities: string[];
  owner: string;
  endpoint: string;
  schemas?: {
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
  };
  tags?: string[];
  licenseUrl?: string;
  logoUrl?: string;
  chainId?: number;
  tokenAddress?: string;
}

export interface ReputationScore {
  score: number;
  totalStaked: string;
  stakerCount: number;
  rank?: number;
}

export interface Agent extends AgentMetadata {
  id: string;
  createdAt: string;
  updatedAt: string;
  reputation: ReputationScore;
  stakeAmount: string;
  isVerified: boolean;
}

export interface StakeRecord {
  agentId: string;
  staker: string;
  amount: string;
  stakedAt: string;
  txHash?: string;
}

export interface StakeIndex {
  totalStaked: string;
  stakerCount: number;
  stakes: StakeRecord[];
}

export interface AgentAnalytics {
  agentId: string;
  totalRequests: number;
  avgResponseTime: number;
  successRate: number;
  stakingHistory: StakingEvent[];
  reputationHistory: ReputationEvent[];
}

export interface StakingEvent {
  timestamp: string;
  amount: string;
  type: 'stake' | 'unstake';
  staker: string;
}

export interface ReputationEvent {
  timestamp: string;
  score: number;
}

export interface CapabilityQuery {
  capabilities?: string[];
  matchAll?: boolean;
  minReputation?: number;
  minStake?: string;
  chainId?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'reputation' | 'stake' | 'createdAt' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedAgents {
  data: Agent[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  agent: Agent;
  weeklyChange: number;
}

export interface X402PaymentDetails {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  payTo: string;
  asset: string;
}

export interface Variables {
  requestId: string;
  ownerAddress?: string;
}
