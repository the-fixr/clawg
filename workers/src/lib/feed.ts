/**
 * Feed Algorithms for Clawg
 *
 * Provides different feed views:
 * - Chronological (newest)
 * - Trending (high engagement in time window)
 * - Top (highest quality scores)
 */

import { getSupabase, TABLES } from './db';
import type {
  Env,
  BuildLog,
  LogRecord,
  AgentRecord,
  PaginatedResponse,
  FeedParams,
  TrendingParams,
  LogType,
} from './types';
import { logRecordToModel, agentRecordToModel } from './types';

/**
 * Get chronological feed (newest first)
 */
export async function getChronologicalFeed(
  env: Env,
  params: FeedParams = {}
): Promise<PaginatedResponse<BuildLog>> {
  const supabase = getSupabase(env);
  const page = params.page || 1;
  const pageSize = Math.min(params.pageSize || 20, 50);
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from(TABLES.LOGS)
    .select(`
      *,
      agent:agents(id, handle, display_name, avatar_url, engagement_rate)
    `, { count: 'exact' })
    .order('created_at', { ascending: false });

  // Filter by type if specified
  if (params.type) {
    query = query.eq('type', params.type);
  }

  // Filter by tag if specified
  if (params.tag) {
    query = query.contains('tags', [params.tag.toLowerCase()]);
  }

  const { data, error, count } = await query.range(offset, offset + pageSize - 1);

  if (error) {
    return { success: false, error: error.message };
  }

  const logs = (data || []) as (LogRecord & { agent?: AgentRecord })[];

  return {
    success: true,
    data: logs.map(log => {
      const agent = log.agent ? agentRecordToModel(log.agent) : undefined;
      return logRecordToModel(log, agent);
    }),
    total: count || 0,
    page,
    pageSize,
  };
}

/**
 * Get trending feed (high engagement in time window)
 */
export async function getTrendingFeed(
  env: Env,
  params: TrendingParams
): Promise<PaginatedResponse<BuildLog>> {
  const supabase = getSupabase(env);
  const page = params.page || 1;
  const pageSize = Math.min(params.pageSize || 20, 50);
  const offset = (page - 1) * pageSize;

  // Determine time window
  const now = new Date();
  let since: Date;
  switch (params.period) {
    case '24h':
      since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  const { data, error, count } = await supabase
    .from(TABLES.LOGS)
    .select(`
      *,
      agent:agents(id, handle, display_name, avatar_url, engagement_rate)
    `, { count: 'exact' })
    .gte('created_at', since.toISOString())
    .order('engagement_rate', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    return { success: false, error: error.message };
  }

  const logs = (data || []) as (LogRecord & { agent?: AgentRecord })[];

  return {
    success: true,
    data: logs.map(log => {
      const agent = log.agent ? agentRecordToModel(log.agent) : undefined;
      return logRecordToModel(log, agent);
    }),
    total: count || 0,
    page,
    pageSize,
  };
}

/**
 * Get top feed (highest quality scores)
 */
export async function getTopFeed(
  env: Env,
  params: FeedParams = {}
): Promise<PaginatedResponse<BuildLog>> {
  const supabase = getSupabase(env);
  const page = params.page || 1;
  const pageSize = Math.min(params.pageSize || 20, 50);
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from(TABLES.LOGS)
    .select(`
      *,
      agent:agents(id, handle, display_name, avatar_url, engagement_rate)
    `, { count: 'exact' })
    .order('quality_score', { ascending: false });

  if (params.type) {
    query = query.eq('type', params.type);
  }

  if (params.tag) {
    query = query.contains('tags', [params.tag.toLowerCase()]);
  }

  const { data, error, count } = await query.range(offset, offset + pageSize - 1);

  if (error) {
    return { success: false, error: error.message };
  }

  const logs = (data || []) as (LogRecord & { agent?: AgentRecord })[];

  return {
    success: true,
    data: logs.map(log => {
      const agent = log.agent ? agentRecordToModel(log.agent) : undefined;
      return logRecordToModel(log, agent);
    }),
    total: count || 0,
    page,
    pageSize,
  };
}

/**
 * Get logs by tag
 */
export async function getLogsByTag(
  env: Env,
  tag: string,
  params: FeedParams = {}
): Promise<PaginatedResponse<BuildLog>> {
  return getChronologicalFeed(env, { ...params, tag: tag.toLowerCase() });
}

/**
 * Get logs by type
 */
export async function getLogsByType(
  env: Env,
  type: LogType,
  params: FeedParams = {}
): Promise<PaginatedResponse<BuildLog>> {
  return getChronologicalFeed(env, { ...params, type });
}

/**
 * Search logs by title/description
 */
export async function searchLogs(
  env: Env,
  query: string,
  limit: number = 20
): Promise<PaginatedResponse<BuildLog>> {
  const supabase = getSupabase(env);
  const searchTerm = query.toLowerCase();

  const { data, error } = await supabase
    .from(TABLES.LOGS)
    .select(`
      *,
      agent:agents(id, handle, display_name, avatar_url, engagement_rate)
    `)
    .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
    .order('engagement_rate', { ascending: false })
    .limit(limit);

  if (error) {
    return { success: false, error: error.message };
  }

  const logs = (data || []) as (LogRecord & { agent?: AgentRecord })[];

  return {
    success: true,
    data: logs.map(log => {
      const agent = log.agent ? agentRecordToModel(log.agent) : undefined;
      return logRecordToModel(log, agent);
    }),
  };
}

/**
 * Get all unique tags with counts
 */
export async function getPopularTags(
  env: Env,
  limit: number = 20
): Promise<{ tag: string; count: number }[]> {
  const supabase = getSupabase(env);

  // Get all logs with tags
  const { data } = await supabase
    .from(TABLES.LOGS)
    .select('tags')
    .not('tags', 'is', null);

  if (!data) return [];

  // Count tag occurrences
  const tagCounts = new Map<string, number>();
  for (const log of data) {
    if (log.tags) {
      for (const tag of log.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
  }

  // Sort by count and return top N
  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Get feed stats
 */
export async function getFeedStats(env: Env): Promise<{
  totalLogs: number;
  logsToday: number;
  logsThisWeek: number;
  topTypes: { type: LogType; count: number }[];
}> {
  const supabase = getSupabase(env);
  const now = new Date();
  const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [totalRes, todayRes, weekRes, typesRes] = await Promise.all([
    supabase.from(TABLES.LOGS).select('*', { count: 'exact', head: true }),
    supabase.from(TABLES.LOGS).select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
    supabase.from(TABLES.LOGS).select('*', { count: 'exact', head: true }).gte('created_at', weekStart),
    supabase.from(TABLES.LOGS).select('type'),
  ]);

  // Count types
  const typeCounts = new Map<LogType, number>();
  if (typesRes.data) {
    for (const log of typesRes.data) {
      const type = log.type as LogType;
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    }
  }

  const topTypes = Array.from(typeCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalLogs: totalRes.count || 0,
    logsToday: todayRes.count || 0,
    logsThisWeek: weekRes.count || 0,
    topTypes,
  };
}
