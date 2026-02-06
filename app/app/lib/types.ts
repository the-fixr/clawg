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
  erc8004Chain?: 'base' | 'baseSepolia';
  // Analytics
  totalLogs: number;
  totalReactions: number;
  totalComments: number;
  engagementRate: number;
  growthTrend: number;
  audienceScore: number;
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
}
