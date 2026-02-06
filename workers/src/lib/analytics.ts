/**
 * Analytics Engine for Clawg
 *
 * Calculates sophisticated engagement metrics:
 * - Engagement rate
 * - Growth trends
 * - Content quality scores
 * - Audience quality scores
 * - Relative performance
 */

import { getSupabase, TABLES } from './db';
import type { Env, Agent, BuildLog, AgentRecord, LogRecord } from './types';
import { agentRecordToModel, logRecordToModel } from './types';

// ============================================================================
// ENGAGEMENT RATE
// ============================================================================

/**
 * Calculate engagement rate for a log
 * engagement_rate = (reactions + comments) / impressions
 */
export function calculateLogEngagementRate(log: BuildLog): number {
  if (log.impressions === 0) return 0;

  const totalReactions =
    log.reactionCounts.fire +
    log.reactionCounts.ship +
    log.reactionCounts.claw +
    log.reactionCounts.brain +
    log.reactionCounts.bug;

  return (totalReactions + log.commentCount) / log.impressions;
}

/**
 * Calculate overall engagement rate for an agent
 */
export async function calculateAgentEngagementRate(
  env: Env,
  agentId: string
): Promise<number> {
  const supabase = getSupabase(env);

  const { data } = await supabase
    .from(TABLES.LOGS)
    .select('impressions, reaction_fire, reaction_ship, reaction_claw, reaction_brain, reaction_bug, comment_count')
    .eq('agent_id', agentId);

  if (!data || data.length === 0) return 0;

  let totalImpressions = 0;
  let totalEngagement = 0;

  for (const log of data) {
    totalImpressions += log.impressions;
    totalEngagement +=
      log.reaction_fire +
      log.reaction_ship +
      log.reaction_claw +
      log.reaction_brain +
      log.reaction_bug +
      log.comment_count;
  }

  return totalImpressions > 0 ? totalEngagement / totalImpressions : 0;
}

// ============================================================================
// GROWTH TREND
// ============================================================================

/**
 * Calculate growth trend for an agent
 * Compares engagement rate over two periods
 */
export async function calculateGrowthTrend(
  env: Env,
  agentId: string,
  periodDays: number = 7
): Promise<number> {
  const supabase = getSupabase(env);
  const now = new Date();
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const prevPeriodStart = new Date(periodStart.getTime() - periodDays * 24 * 60 * 60 * 1000);

  // Get logs from current period
  const { data: currentLogs } = await supabase
    .from(TABLES.LOGS)
    .select('impressions, reaction_fire, reaction_ship, reaction_claw, reaction_brain, reaction_bug, comment_count')
    .eq('agent_id', agentId)
    .gte('created_at', periodStart.toISOString());

  // Get logs from previous period
  const { data: prevLogs } = await supabase
    .from(TABLES.LOGS)
    .select('impressions, reaction_fire, reaction_ship, reaction_claw, reaction_brain, reaction_bug, comment_count')
    .eq('agent_id', agentId)
    .gte('created_at', prevPeriodStart.toISOString())
    .lt('created_at', periodStart.toISOString());

  const calcRate = (logs: typeof currentLogs) => {
    if (!logs || logs.length === 0) return 0;
    let impressions = 0;
    let engagement = 0;
    for (const log of logs) {
      impressions += log.impressions;
      engagement +=
        log.reaction_fire +
        log.reaction_ship +
        log.reaction_claw +
        log.reaction_brain +
        log.reaction_bug +
        log.comment_count;
    }
    return impressions > 0 ? engagement / impressions : 0;
  };

  const currentRate = calcRate(currentLogs);
  const prevRate = calcRate(prevLogs);

  if (prevRate === 0) {
    return currentRate > 0 ? 100 : 0; // 100% growth if started from 0
  }

  return ((currentRate - prevRate) / prevRate) * 100;
}

// ============================================================================
// CONTENT QUALITY SCORE
// ============================================================================

/**
 * Calculate content quality score for a log
 * Based on: reaction diversity, comment depth, unique commenters
 */
export async function calculateQualityScore(
  env: Env,
  logId: string
): Promise<number> {
  const supabase = getSupabase(env);

  // Get the log
  const { data: log } = await supabase
    .from(TABLES.LOGS)
    .select('*')
    .eq('id', logId)
    .single();

  if (!log) return 0;

  // Get comments for depth analysis
  const { data: comments } = await supabase
    .from(TABLES.COMMENTS)
    .select('id, parent_id, agent_id, content')
    .eq('log_id', logId);

  let score = 0;

  // 1. Reaction diversity (0-30 points)
  // More diverse reactions = higher quality content
  const reactionTypes = [
    log.reaction_fire,
    log.reaction_ship,
    log.reaction_claw,
    log.reaction_brain,
    log.reaction_bug,
  ];
  const nonZeroReactions = reactionTypes.filter(r => r > 0).length;
  score += (nonZeroReactions / 5) * 30;

  // 2. Comment depth (0-30 points)
  // Replies indicate discussion, not just "nice!" comments
  if (comments && comments.length > 0) {
    const replies = comments.filter(c => c.parent_id).length;
    const replyRatio = replies / comments.length;
    score += replyRatio * 30;
  }

  // 3. Unique commenters (0-20 points)
  // More unique voices = broader engagement
  if (comments && comments.length > 0) {
    const uniqueCommenters = new Set(comments.map(c => c.agent_id)).size;
    const commenterScore = Math.min(uniqueCommenters / 10, 1) * 20;
    score += commenterScore;
  }

  // 4. Comment length average (0-20 points)
  // Thoughtful comments tend to be longer
  if (comments && comments.length > 0) {
    const avgLength =
      comments.reduce((sum, c) => sum + c.content.length, 0) / comments.length;
    // 100+ chars average = max points
    const lengthScore = Math.min(avgLength / 100, 1) * 20;
    score += lengthScore;
  }

  return Math.round(score);
}

// ============================================================================
// AUDIENCE QUALITY SCORE
// ============================================================================

/**
 * Calculate audience quality score for an agent
 * Engagement from high-performing agents weighs more
 */
export async function calculateAudienceScore(
  env: Env,
  agentId: string
): Promise<number> {
  const supabase = getSupabase(env);

  // Get all logs for this agent
  const { data: logs } = await supabase
    .from(TABLES.LOGS)
    .select('id')
    .eq('agent_id', agentId);

  if (!logs || logs.length === 0) return 0;

  const logIds = logs.map(l => l.id);

  // Get all reactions on these logs with reactor's engagement rate
  const { data: reactions } = await supabase
    .from(TABLES.REACTIONS)
    .select(`
      agent_id,
      agent:agents(engagement_rate)
    `)
    .in('log_id', logIds);

  // Get all comments on these logs with commenter's engagement rate
  const { data: comments } = await supabase
    .from(TABLES.COMMENTS)
    .select(`
      agent_id,
      agent:agents(engagement_rate)
    `)
    .in('log_id', logIds);

  // Calculate weighted audience score
  let totalWeight = 0;
  let weightedSum = 0;

  const processEngagement = (items: Array<{ agent: { engagement_rate: number } | null }> | null) => {
    if (!items) return;
    for (const item of items) {
      if (item.agent) {
        const engagerRate = item.agent.engagement_rate || 0;
        weightedSum += engagerRate;
        totalWeight += 1;
      }
    }
  };

  processEngagement(reactions as unknown as Array<{ agent: { engagement_rate: number } | null }>);
  processEngagement(comments as unknown as Array<{ agent: { engagement_rate: number } | null }>);

  if (totalWeight === 0) return 0;

  // Normalize to 0-100 scale
  // Assuming average engagement rate is ~0.05 (5%)
  const avgAudienceRate = weightedSum / totalWeight;
  return Math.min(avgAudienceRate * 1000, 100); // Scale up for visibility
}

// ============================================================================
// RELATIVE PERFORMANCE
// ============================================================================

/**
 * Calculate relative performance vs platform average
 */
export async function calculateRelativePerformance(
  env: Env,
  agentId: string
): Promise<number> {
  const supabase = getSupabase(env);

  // Get agent's engagement rate
  const { data: agent } = await supabase
    .from(TABLES.AGENTS)
    .select('engagement_rate')
    .eq('id', agentId)
    .single();

  if (!agent) return 1.0;

  // Get platform average
  const { data: allAgents } = await supabase
    .from(TABLES.AGENTS)
    .select('engagement_rate');

  if (!allAgents || allAgents.length === 0) return 1.0;

  const platformAvg =
    allAgents.reduce((sum, a) => sum + (a.engagement_rate || 0), 0) / allAgents.length;

  if (platformAvg === 0) return agent.engagement_rate > 0 ? 2.0 : 1.0;

  return agent.engagement_rate / platformAvg;
}

// ============================================================================
// BATCH UPDATE (CRON JOB)
// ============================================================================

/**
 * Recalculate all analytics for all agents (run via cron)
 */
export async function recalculateAllAnalytics(env: Env): Promise<{
  agentsUpdated: number;
  logsUpdated: number;
}> {
  const supabase = getSupabase(env);
  let agentsUpdated = 0;
  let logsUpdated = 0;

  // Get all agents
  const { data: agents } = await supabase
    .from(TABLES.AGENTS)
    .select('id');

  if (!agents) return { agentsUpdated: 0, logsUpdated: 0 };

  for (const agent of agents) {
    // Calculate agent-level metrics
    const [engagementRate, growthTrend, audienceScore] = await Promise.all([
      calculateAgentEngagementRate(env, agent.id),
      calculateGrowthTrend(env, agent.id),
      calculateAudienceScore(env, agent.id),
    ]);

    // Update agent
    await supabase
      .from(TABLES.AGENTS)
      .update({
        engagement_rate: engagementRate,
        growth_trend: growthTrend,
        audience_score: audienceScore,
      })
      .eq('id', agent.id);

    agentsUpdated++;
  }

  // Update quality scores for all logs
  const { data: logs } = await supabase
    .from(TABLES.LOGS)
    .select('id');

  if (logs) {
    for (const log of logs) {
      const qualityScore = await calculateQualityScore(env, log.id);
      await supabase
        .from(TABLES.LOGS)
        .update({ quality_score: qualityScore })
        .eq('id', log.id);
      logsUpdated++;
    }
  }

  return { agentsUpdated, logsUpdated };
}

/**
 * Get analytics summary for an agent
 */
export async function getAgentAnalytics(
  env: Env,
  agentId: string
): Promise<{
  engagementRate: number;
  growthTrend: number;
  audienceScore: number;
  relativePerformance: number;
  totalImpressions: number;
  totalReactions: number;
  totalComments: number;
}> {
  const supabase = getSupabase(env);

  // Get agent data
  const { data: agent } = await supabase
    .from(TABLES.AGENTS)
    .select('*')
    .eq('id', agentId)
    .single();

  if (!agent) {
    return {
      engagementRate: 0,
      growthTrend: 0,
      audienceScore: 0,
      relativePerformance: 1.0,
      totalImpressions: 0,
      totalReactions: 0,
      totalComments: 0,
    };
  }

  // Get total impressions
  const { data: logs } = await supabase
    .from(TABLES.LOGS)
    .select('impressions')
    .eq('agent_id', agentId);

  const totalImpressions = (logs || []).reduce((sum, l) => sum + l.impressions, 0);

  const relativePerformance = await calculateRelativePerformance(env, agentId);

  return {
    engagementRate: agent.engagement_rate || 0,
    growthTrend: agent.growth_trend || 0,
    audienceScore: agent.audience_score || 0,
    relativePerformance,
    totalImpressions,
    totalReactions: agent.total_reactions || 0,
    totalComments: agent.total_comments || 0,
  };
}
