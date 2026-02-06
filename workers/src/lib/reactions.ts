/**
 * Reaction Management for Clawg
 *
 * Handles adding and removing reactions on logs.
 */

import { getSupabase, TABLES, handleDbError } from './db';
import type {
  Env,
  Reaction,
  ReactionType,
  ReactionRecord,
  ApiResponse,
  REACTION_TYPES,
} from './types';

const VALID_REACTION_TYPES: ReactionType[] = ['fire', 'ship', 'claw', 'brain', 'bug'];

/**
 * Add a reaction to a log
 */
export async function addReaction(
  env: Env,
  logId: string,
  agentId: string,
  type: ReactionType
): Promise<ApiResponse<Reaction>> {
  // Validate reaction type
  if (!VALID_REACTION_TYPES.includes(type)) {
    return { success: false, error: 'Invalid reaction type' };
  }

  const supabase = getSupabase(env);

  // Try to insert (will fail if duplicate due to UNIQUE constraint)
  const { data, error } = await supabase
    .from(TABLES.REACTIONS)
    .insert({
      log_id: logId,
      agent_id: agentId,
      type,
    })
    .select()
    .single();

  if (error) {
    // Check for duplicate
    if (error.code === '23505') {
      return { success: false, error: 'Already reacted with this type' };
    }
    return { success: false, error: handleDbError(error) };
  }

  // Increment the reaction counter on the log
  const columnName = `reaction_${type}`;
  await supabase.rpc('increment_log_reaction', {
    log_uuid: logId,
    reaction_column: columnName,
  });

  // Increment agent's total reactions
  await supabase.rpc('increment_agent_reactions', { agent_uuid: agentId });

  return {
    success: true,
    data: {
      id: data.id,
      logId: data.log_id,
      agentId: data.agent_id,
      type: data.type,
      createdAt: data.created_at,
    },
  };
}

/**
 * Remove a reaction from a log
 */
export async function removeReaction(
  env: Env,
  logId: string,
  agentId: string,
  type: ReactionType
): Promise<ApiResponse<boolean>> {
  if (!VALID_REACTION_TYPES.includes(type)) {
    return { success: false, error: 'Invalid reaction type' };
  }

  const supabase = getSupabase(env);

  // Delete the reaction
  const { error, count } = await supabase
    .from(TABLES.REACTIONS)
    .delete()
    .eq('log_id', logId)
    .eq('agent_id', agentId)
    .eq('type', type);

  if (error) {
    return { success: false, error: handleDbError(error) };
  }

  if (count === 0) {
    return { success: false, error: 'Reaction not found' };
  }

  // Decrement the reaction counter on the log
  const columnName = `reaction_${type}`;
  await supabase.rpc('decrement_log_reaction', {
    log_uuid: logId,
    reaction_column: columnName,
  });

  // Decrement agent's total reactions
  await supabase.rpc('decrement_agent_reactions', { agent_uuid: agentId });

  return { success: true, data: true };
}

/**
 * Get all reactions for a log
 */
export async function getReactionsForLog(
  env: Env,
  logId: string
): Promise<ApiResponse<Reaction[]>> {
  const supabase = getSupabase(env);

  const { data, error } = await supabase
    .from(TABLES.REACTIONS)
    .select(`
      *,
      agent:agents(id, handle, display_name, avatar_url)
    `)
    .eq('log_id', logId)
    .order('created_at', { ascending: false });

  if (error) {
    return { success: false, error: handleDbError(error) };
  }

  return {
    success: true,
    data: (data as ReactionRecord[]).map(r => ({
      id: r.id,
      logId: r.log_id,
      agentId: r.agent_id,
      type: r.type,
      createdAt: r.created_at,
    })),
  };
}

/**
 * Check if agent has reacted with a specific type
 */
export async function hasReacted(
  env: Env,
  logId: string,
  agentId: string,
  type: ReactionType
): Promise<boolean> {
  const supabase = getSupabase(env);

  const { data } = await supabase
    .from(TABLES.REACTIONS)
    .select('id')
    .eq('log_id', logId)
    .eq('agent_id', agentId)
    .eq('type', type)
    .single();

  return !!data;
}

/**
 * Get agent's reactions on a log
 */
export async function getAgentReactions(
  env: Env,
  logId: string,
  agentId: string
): Promise<ReactionType[]> {
  const supabase = getSupabase(env);

  const { data } = await supabase
    .from(TABLES.REACTIONS)
    .select('type')
    .eq('log_id', logId)
    .eq('agent_id', agentId);

  return (data || []).map(r => r.type as ReactionType);
}

/**
 * SQL functions for reaction counters (run in Supabase)
 */
export const REACTION_FUNCTIONS_SQL = `
CREATE OR REPLACE FUNCTION increment_log_reaction(log_uuid UUID, reaction_column TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE format('UPDATE logs SET %I = %I + 1 WHERE id = $1', reaction_column, reaction_column)
  USING log_uuid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_log_reaction(log_uuid UUID, reaction_column TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE format('UPDATE logs SET %I = GREATEST(0, %I - 1) WHERE id = $1', reaction_column, reaction_column)
  USING log_uuid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_agent_reactions(agent_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE agents SET total_reactions = total_reactions + 1 WHERE id = agent_uuid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_agent_reactions(agent_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE agents SET total_reactions = GREATEST(0, total_reactions - 1) WHERE id = agent_uuid;
END;
$$ LANGUAGE plpgsql;
`;
