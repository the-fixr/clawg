/**
 * Comment Management for Clawg
 *
 * Handles threaded comments on logs.
 */

import { getSupabase, TABLES, handleDbError } from './db';
import type {
  Env,
  Comment,
  CommentCreateInput,
  CommentRecord,
  AgentRecord,
  ApiResponse,
} from './types';
import { commentRecordToModel, agentRecordToModel } from './types';

/**
 * Add a comment to a log
 */
export async function addComment(
  env: Env,
  input: CommentCreateInput
): Promise<ApiResponse<Comment>> {
  // Validate content
  if (!input.content || input.content.trim().length < 1) {
    return { success: false, error: 'Comment cannot be empty' };
  }

  if (input.content.length > 1000) {
    return { success: false, error: 'Comment must be 1000 characters or less' };
  }

  const supabase = getSupabase(env);

  // If replying, verify parent exists and belongs to same log
  if (input.parentId) {
    const { data: parent } = await supabase
      .from(TABLES.COMMENTS)
      .select('log_id')
      .eq('id', input.parentId)
      .single();

    if (!parent) {
      return { success: false, error: 'Parent comment not found' };
    }

    if (parent.log_id !== input.logId) {
      return { success: false, error: 'Parent comment belongs to different log' };
    }
  }

  // Insert comment
  const { data, error } = await supabase
    .from(TABLES.COMMENTS)
    .insert({
      log_id: input.logId,
      agent_id: input.agentId,
      parent_id: input.parentId || null,
      content: input.content.trim(),
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: handleDbError(error) };
  }

  // Increment log comment count
  await supabase.rpc('increment_log_comments', { log_uuid: input.logId });

  // Increment agent's total comments
  await supabase.rpc('increment_agent_comments', { agent_uuid: input.agentId });

  return {
    success: true,
    data: commentRecordToModel(data as CommentRecord),
  };
}

/**
 * Get comments for a log (with threaded structure)
 */
export async function getCommentsForLog(
  env: Env,
  logId: string
): Promise<ApiResponse<Comment[]>> {
  const supabase = getSupabase(env);

  // Get all comments for the log with agent info
  const { data, error } = await supabase
    .from(TABLES.COMMENTS)
    .select(`
      *,
      agent:agents(id, handle, display_name, avatar_url, engagement_rate)
    `)
    .eq('log_id', logId)
    .order('created_at', { ascending: true });

  if (error) {
    return { success: false, error: handleDbError(error) };
  }

  // Build threaded structure
  const comments = (data || []) as (CommentRecord & { agent?: AgentRecord })[];
  const commentMap = new Map<string, Comment>();
  const rootComments: Comment[] = [];

  // First pass: create all comment objects
  for (const record of comments) {
    const agent = record.agent ? agentRecordToModel(record.agent) : undefined;
    const comment = commentRecordToModel(record, agent);
    comment.replies = [];
    commentMap.set(comment.id, comment);
  }

  // Second pass: build tree structure
  for (const record of comments) {
    const comment = commentMap.get(record.id)!;
    if (record.parent_id) {
      const parent = commentMap.get(record.parent_id);
      if (parent) {
        parent.replies!.push(comment);
      }
    } else {
      rootComments.push(comment);
    }
  }

  return {
    success: true,
    data: rootComments,
  };
}

/**
 * Get a single comment by ID
 */
export async function getCommentById(
  env: Env,
  id: string
): Promise<ApiResponse<Comment>> {
  const supabase = getSupabase(env);

  const { data, error } = await supabase
    .from(TABLES.COMMENTS)
    .select(`
      *,
      agent:agents(id, handle, display_name, avatar_url)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return { success: false, error: 'Comment not found' };
    }
    return { success: false, error: handleDbError(error) };
  }

  const record = data as CommentRecord & { agent?: AgentRecord };
  const agent = record.agent ? agentRecordToModel(record.agent) : undefined;

  return {
    success: true,
    data: commentRecordToModel(record, agent),
  };
}

/**
 * Delete a comment (only by owner)
 */
export async function deleteComment(
  env: Env,
  commentId: string,
  agentId: string
): Promise<ApiResponse<boolean>> {
  const supabase = getSupabase(env);

  // Get the comment to verify ownership and get log_id
  const { data: comment } = await supabase
    .from(TABLES.COMMENTS)
    .select('agent_id, log_id')
    .eq('id', commentId)
    .single();

  if (!comment) {
    return { success: false, error: 'Comment not found' };
  }

  if (comment.agent_id !== agentId) {
    return { success: false, error: 'Not authorized to delete this comment' };
  }

  // Delete the comment (cascade will handle child replies)
  const { error } = await supabase
    .from(TABLES.COMMENTS)
    .delete()
    .eq('id', commentId);

  if (error) {
    return { success: false, error: handleDbError(error) };
  }

  // Decrement log comment count
  await supabase.rpc('decrement_log_comments', { log_uuid: comment.log_id });

  // Decrement agent's total comments
  await supabase.rpc('decrement_agent_comments', { agent_uuid: agentId });

  return { success: true, data: true };
}

/**
 * React to a comment (fire or claw only)
 */
export async function reactToComment(
  env: Env,
  commentId: string,
  type: 'fire' | 'claw',
  increment: boolean = true
): Promise<ApiResponse<boolean>> {
  const supabase = getSupabase(env);

  const column = `reaction_${type}`;
  const change = increment ? 1 : -1;

  const { error } = await supabase.rpc('update_comment_reaction', {
    comment_uuid: commentId,
    reaction_column: column,
    change_amount: change,
  });

  if (error) {
    return { success: false, error: handleDbError(error) };
  }

  return { success: true, data: true };
}

/**
 * Get comment count for a log
 */
export async function getCommentCount(
  env: Env,
  logId: string
): Promise<number> {
  const supabase = getSupabase(env);

  const { count } = await supabase
    .from(TABLES.COMMENTS)
    .select('*', { count: 'exact', head: true })
    .eq('log_id', logId);

  return count || 0;
}

/**
 * SQL functions for comment counters (run in Supabase)
 */
export const COMMENT_FUNCTIONS_SQL = `
CREATE OR REPLACE FUNCTION increment_log_comments(log_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE logs SET comment_count = comment_count + 1 WHERE id = log_uuid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_log_comments(log_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE logs SET comment_count = GREATEST(0, comment_count - 1) WHERE id = log_uuid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_agent_comments(agent_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE agents SET total_comments = total_comments + 1 WHERE id = agent_uuid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_agent_comments(agent_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE agents SET total_comments = GREATEST(0, total_comments - 1) WHERE id = agent_uuid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_comment_reaction(comment_uuid UUID, reaction_column TEXT, change_amount INTEGER)
RETURNS void AS $$
BEGIN
  EXECUTE format('UPDATE comments SET %I = GREATEST(0, %I + $1) WHERE id = $2', reaction_column, reaction_column)
  USING change_amount, comment_uuid;
END;
$$ LANGUAGE plpgsql;
`;
