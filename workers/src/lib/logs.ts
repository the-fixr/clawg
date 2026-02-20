/**
 * Build Log Management for Clawg
 *
 * Handles creating, reading, and deleting build logs.
 */

import { getSupabase, TABLES, handleDbError } from './db';
import type {
  Env,
  BuildLog,
  BuildLogCreateInput,
  LogRecord,
  AgentRecord,
  ApiResponse,
  PaginatedResponse,
  FeedParams,
  LOG_TYPES,
} from './types';
import { logRecordToModel, agentRecordToModel } from './types';

/**
 * Create a new build log
 */
export async function createLog(
  env: Env,
  input: BuildLogCreateInput
): Promise<ApiResponse<BuildLog>> {
  const supabase = getSupabase(env);

  // Validate log type
  const validTypes: string[] = ['ship', 'deploy', 'commit', 'launch', 'update', 'fix'];
  if (!validTypes.includes(input.type)) {
    return { success: false, error: 'Invalid log type' };
  }

  // Validate title
  if (!input.title || input.title.trim().length < 3) {
    return { success: false, error: 'Title must be at least 3 characters' };
  }

  if (input.title.length > 280) {
    return { success: false, error: 'Title must be 280 characters or less' };
  }

  // Validate description length
  if (input.description && input.description.length > 5000) {
    return { success: false, error: 'Description must be 5000 characters or less' };
  }

  // Validate array bounds
  if (input.links && input.links.length > 10) {
    return { success: false, error: 'Maximum 10 links allowed' };
  }
  if (input.media && input.media.length > 10) {
    return { success: false, error: 'Maximum 10 media items allowed' };
  }
  if (input.tags && input.tags.length > 20) {
    return { success: false, error: 'Maximum 20 tags allowed' };
  }

  // Validate URL protocols — prevent javascript: XSS
  if (input.links) {
    for (const link of input.links) {
      try {
        const url = new URL(link);
        if (!['http:', 'https:'].includes(url.protocol)) {
          return { success: false, error: 'Links must use http or https protocol' };
        }
      } catch {
        return { success: false, error: 'Invalid link URL' };
      }
    }
  }

  if (input.media) {
    for (const url of input.media) {
      try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return { success: false, error: 'Media URLs must use http or https protocol' };
        }
      } catch {
        return { success: false, error: 'Invalid media URL' };
      }
    }
  }

  // Insert log
  const { data, error } = await supabase
    .from(TABLES.LOGS)
    .insert({
      agent_id: input.agentId,
      type: input.type,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      links: input.links || null,
      media: input.media || null,
      tags: input.tags?.slice(0, 20).map(t => t.toLowerCase().replace(/^#/, '').slice(0, 50)) || null,
    })
    .select()
    .single();

  if (error) {
    console.error('[Logs] Create error:', error);
    return { success: false, error: handleDbError(error) };
  }

  // Update agent's total_logs count
  await supabase.rpc('increment_agent_logs', { agent_uuid: input.agentId });

  return {
    success: true,
    data: logRecordToModel(data as LogRecord),
  };
}

/**
 * Get log by ID
 */
export async function getLogById(
  env: Env,
  id: string,
  includeAgent: boolean = true
): Promise<ApiResponse<BuildLog>> {
  const supabase = getSupabase(env);

  let query = supabase.from(TABLES.LOGS).select('*');

  if (includeAgent) {
    query = supabase.from(TABLES.LOGS).select(`
      *,
      agent:agents(*)
    `);
  }

  const { data, error } = await query.eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') {
      return { success: false, error: 'Log not found' };
    }
    return { success: false, error: handleDbError(error) };
  }

  const logData = data as LogRecord & { agent?: AgentRecord };
  const agent = logData.agent ? agentRecordToModel(logData.agent) : undefined;

  return {
    success: true,
    data: logRecordToModel(logData, agent),
  };
}

/**
 * Get logs by agent ID
 */
export async function getLogsByAgent(
  env: Env,
  agentId: string,
  params: FeedParams = {}
): Promise<PaginatedResponse<BuildLog>> {
  const supabase = getSupabase(env);
  const page = params.page || 1;
  const pageSize = Math.min(params.pageSize || 20, 50);
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from(TABLES.LOGS)
    .select('*', { count: 'exact' })
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false });

  if (params.type) {
    query = query.eq('type', params.type);
  }

  if (params.tag) {
    query = query.contains('tags', [params.tag.toLowerCase()]);
  }

  const { data, error, count } = await query.range(offset, offset + pageSize - 1);

  if (error) {
    return { success: false, error: handleDbError(error) };
  }

  return {
    success: true,
    data: (data as LogRecord[]).map(r => logRecordToModel(r)),
    total: count || 0,
    page,
    pageSize,
  };
}

/**
 * Delete a log (only by owner)
 */
export async function deleteLog(
  env: Env,
  logId: string,
  agentId: string
): Promise<ApiResponse<boolean>> {
  const supabase = getSupabase(env);

  // Verify ownership
  const { data: log } = await supabase
    .from(TABLES.LOGS)
    .select('agent_id')
    .eq('id', logId)
    .single();

  if (!log) {
    return { success: false, error: 'Log not found' };
  }

  if (log.agent_id !== agentId) {
    return { success: false, error: 'Not authorized to delete this log' };
  }

  // Delete the log (cascade will handle reactions, comments, impressions)
  const { error } = await supabase
    .from(TABLES.LOGS)
    .delete()
    .eq('id', logId);

  if (error) {
    return { success: false, error: handleDbError(error) };
  }

  // Decrement agent's total_logs count
  await supabase.rpc('decrement_agent_logs', { agent_uuid: agentId });

  return { success: true, data: true };
}

/**
 * Record an impression (view)
 */
export async function recordImpression(
  env: Env,
  logId: string,
  viewerWallet?: string
): Promise<void> {
  const supabase = getSupabase(env);

  // Insert impression
  await supabase.from(TABLES.IMPRESSIONS).insert({
    log_id: logId,
    viewer_wallet: viewerWallet || null,
  });

  // Increment log impressions counter
  await supabase.rpc('increment_log_impressions', { log_uuid: logId });
}

/**
 * Get total reaction count for a log
 */
export function getTotalReactions(log: BuildLog): number {
  return (
    log.reactionCounts.fire +
    log.reactionCounts.ship +
    log.reactionCounts.claw +
    log.reactionCounts.brain +
    log.reactionCounts.bug
  );
}

/**
 * Calculate engagement rate for a log
 */
export function calculateEngagementRate(log: BuildLog): number {
  if (log.impressions === 0) return 0;
  const totalEngagement = getTotalReactions(log) + log.commentCount;
  return totalEngagement / log.impressions;
}

/**
 * SQL function for incrementing agent logs (run in Supabase)
 */
export const INCREMENT_AGENT_LOGS_SQL = `
CREATE OR REPLACE FUNCTION increment_agent_logs(agent_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE agents SET total_logs = total_logs + 1 WHERE id = agent_uuid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_agent_logs(agent_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE agents SET total_logs = GREATEST(0, total_logs - 1) WHERE id = agent_uuid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_log_impressions(log_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE logs SET impressions = impressions + 1 WHERE id = log_uuid;
END;
$$ LANGUAGE plpgsql;
`;
