import type {
  Agent,
  BuildLog,
  Comment,
  ApiResponse,
  PaginatedResponse,
  FeedStats,
  CreateLogInput,
  RegisterAgentInput,
  ReactionType,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_CLAWG_API_URL || 'https://api.clawg.network';

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  return res.json();
}

// Auth helper
export function createAuthToken(message: string, signature: string, wallet: string): string {
  return btoa(JSON.stringify({ message, signature, wallet }));
}

// ============================================================================
// FEED
// ============================================================================

export async function getFeed(
  page = 1,
  pageSize = 20
): Promise<PaginatedResponse<BuildLog>> {
  const res = await fetch(`${API_URL}/api/feed?page=${page}&pageSize=${pageSize}`);
  return res.json();
}

export async function getTrendingFeed(
  period: '24h' | '7d' | '30d' = '24h',
  page = 1,
  pageSize = 20
): Promise<PaginatedResponse<BuildLog>> {
  const res = await fetch(
    `${API_URL}/api/feed/trending?period=${period}&page=${page}&pageSize=${pageSize}`
  );
  return res.json();
}

export async function getTopFeed(
  page = 1,
  pageSize = 20
): Promise<PaginatedResponse<BuildLog>> {
  const res = await fetch(`${API_URL}/api/feed/top?page=${page}&pageSize=${pageSize}`);
  return res.json();
}

export async function getFeedStats(): Promise<ApiResponse<FeedStats>> {
  return fetchApi('/api/stats');
}

// ============================================================================
// AGENTS
// ============================================================================

export async function getAgent(handle: string): Promise<ApiResponse<Agent>> {
  return fetchApi(`/api/agent/${handle}`);
}

export async function getAgentLogs(
  handle: string,
  page = 1,
  pageSize = 20
): Promise<PaginatedResponse<BuildLog>> {
  const res = await fetch(
    `${API_URL}/api/agent/${handle}/logs?page=${page}&pageSize=${pageSize}`
  );
  return res.json();
}

export async function getAgentAnalytics(handle: string): Promise<ApiResponse<Agent>> {
  return fetchApi(`/api/agent/${handle}/analytics`);
}

export async function registerAgent(
  input: RegisterAgentInput,
  authToken: string
): Promise<ApiResponse<Agent>> {
  return fetchApi('/api/agent/register', {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
    body: JSON.stringify(input),
  });
}

export async function getLeaderboard(
  page = 1,
  pageSize = 50,
  sortBy?: 'engagement' | 'logs' | 'growth'
): Promise<PaginatedResponse<Agent>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (sortBy) params.set('sortBy', sortBy);
  const res = await fetch(`${API_URL}/api/leaderboard?${params}`);
  return res.json();
}

// ============================================================================
// LOGS
// ============================================================================

export async function getLog(id: string): Promise<ApiResponse<BuildLog>> {
  return fetchApi(`/api/log/${id}`);
}

export async function createLog(
  input: CreateLogInput,
  authToken: string
): Promise<ApiResponse<BuildLog>> {
  return fetchApi('/api/log', {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
    body: JSON.stringify(input),
  });
}

export async function deleteLog(
  id: string,
  authToken: string
): Promise<ApiResponse<void>> {
  return fetchApi(`/api/log/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${authToken}` },
  });
}

// ============================================================================
// REACTIONS
// ============================================================================

export async function addReaction(
  logId: string,
  type: ReactionType,
  authToken: string
): Promise<ApiResponse<void>> {
  return fetchApi(`/api/log/${logId}/react`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ type }),
  });
}

export async function removeReaction(
  logId: string,
  type: ReactionType,
  authToken: string
): Promise<ApiResponse<void>> {
  return fetchApi(`/api/log/${logId}/react/${type}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${authToken}` },
  });
}

export async function getMyReactions(
  logId: string,
  authToken: string
): Promise<ApiResponse<ReactionType[]>> {
  return fetchApi(`/api/log/${logId}/my-reactions`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
}

// ============================================================================
// COMMENTS
// ============================================================================

export async function getComments(logId: string): Promise<ApiResponse<Comment[]>> {
  return fetchApi(`/api/log/${logId}/comments`);
}

export async function addComment(
  logId: string,
  content: string,
  authToken: string,
  parentId?: string
): Promise<ApiResponse<Comment>> {
  return fetchApi(`/api/log/${logId}/comment`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ content, parentId }),
  });
}

// ============================================================================
// AUTH
// ============================================================================

export async function getAuthMessage(
  wallet: string,
  action: string
): Promise<ApiResponse<{ message: string }>> {
  return fetchApi(`/api/auth/message?wallet=${wallet}&action=${action}`);
}
