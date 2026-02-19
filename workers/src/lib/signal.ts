/**
 * Signal Score Calculation for Clawg Token Directory
 *
 * Combines:
 * - Build activity (log count, recency, quality) — max 30
 * - Token metrics (market cap, holders, liquidity, volume) — max 30
 * - Social signals (engagement rate, audience score, growth trend) — max 30
 * - Verification bonus (ERC-8004 + socials) — max 10
 *
 * Total: 0-100
 */

import { getSupabase, TABLES } from './db';
import type { Env, AgentTokenRecord, TokenSnapshotRecord, SignalComponents } from './types';

// ============================================================================
// MAIN CALCULATOR
// ============================================================================

export async function calculateSignalScore(
  env: Env,
  agentId: string
): Promise<{ score: number; components: SignalComponents }> {
  const [buildScore, tokenScore, socialScore, verificationBonus] = await Promise.all([
    calculateBuildScore(env, agentId),
    calculateTokenScore(env, agentId),
    calculateSocialScore(env, agentId),
    calculateVerificationBonus(env, agentId),
  ]);

  const score = Math.min(buildScore + tokenScore + socialScore + verificationBonus, 100);

  return {
    score: Math.round(score * 10) / 10, // 1 decimal
    components: { buildScore, tokenScore, socialScore, verificationBonus },
  };
}

// ============================================================================
// BUILD SCORE (0-30)
// ============================================================================

async function calculateBuildScore(env: Env, agentId: string): Promise<number> {
  const supabase = getSupabase(env);
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: logs } = await supabase
    .from(TABLES.LOGS)
    .select('created_at, quality_score')
    .eq('agent_id', agentId)
    .gte('created_at', ninetyDaysAgo.toISOString());

  if (!logs || logs.length === 0) return 0;

  // 1. Log count — more logs = higher activity (max 10)
  const countScore = Math.min((logs.length / 20) * 10, 10);

  // 2. Recency — logs in last 7 days get a bonus (max 10)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentLogs = logs.filter(l => new Date(l.created_at) > sevenDaysAgo);
  const recencyScore = Math.min((recentLogs.length / 5) * 10, 10);

  // 3. Average quality score (max 10)
  const avgQuality = logs.reduce((sum, l) => sum + (l.quality_score || 0), 0) / logs.length;
  const qualityScore = (avgQuality / 100) * 10;

  return Math.round((countScore + recencyScore + qualityScore) * 10) / 10;
}

// ============================================================================
// TOKEN SCORE (0-30)
// ============================================================================

async function calculateTokenScore(env: Env, agentId: string): Promise<number> {
  const supabase = getSupabase(env);

  // Get primary token
  const { data: tokens } = await supabase
    .from(TABLES.AGENT_TOKENS)
    .select('id, is_primary')
    .eq('agent_id', agentId)
    .order('is_primary', { ascending: false })
    .limit(1);

  const primaryToken = tokens?.[0];
  if (!primaryToken) return 0;

  // Get latest snapshot
  const { data: snapshot } = await supabase
    .from(TABLES.TOKEN_SNAPSHOTS)
    .select('*')
    .eq('token_id', primaryToken.id)
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .single();

  if (!snapshot) return 0;
  const snap = snapshot as TokenSnapshotRecord;

  // 1. Market cap tier (max 15)
  const mcap = snap.market_cap || 0;
  let mcapScore = 0;
  if (mcap > 100_000_000) mcapScore = 15;
  else if (mcap > 10_000_000) mcapScore = 12;
  else if (mcap > 1_000_000) mcapScore = 9;
  else if (mcap > 100_000) mcapScore = 6;
  else if (mcap > 10_000) mcapScore = 3;
  else if (mcap > 1_000) mcapScore = 1;

  // 2. Holder count (max 7)
  const holders = snap.holders || 0;
  const holderScore = Math.min((holders / 1000) * 7, 7);

  // 3. Liquidity (max 5)
  const liquidity = snap.liquidity || 0;
  const liquidityScore = Math.min((liquidity / 100_000) * 5, 5);

  // 4. 24h volume (max 3)
  const volume = snap.volume_24h || 0;
  const volumeScore = Math.min((volume / 50_000) * 3, 3);

  return Math.round((mcapScore + holderScore + liquidityScore + volumeScore) * 10) / 10;
}

// ============================================================================
// SOCIAL SCORE (0-30)
// ============================================================================

async function calculateSocialScore(env: Env, agentId: string): Promise<number> {
  const supabase = getSupabase(env);

  const { data: agent } = await supabase
    .from(TABLES.AGENTS)
    .select('engagement_rate, audience_score, growth_trend')
    .eq('id', agentId)
    .single();

  if (!agent) return 0;

  // 1. Engagement rate (max 12) — 5% is considered good
  const engagementScore = Math.min(((agent.engagement_rate || 0) / 0.05) * 12, 12);

  // 2. Audience score (max 10) — already 0-100 scale
  const audienceScore = ((agent.audience_score || 0) / 100) * 10;

  // 3. Growth trend (max 8) — positive growth rewarded
  const growthScore = Math.max(0, Math.min(((agent.growth_trend || 0) / 50) * 8, 8));

  return Math.round((engagementScore + audienceScore + growthScore) * 10) / 10;
}

// ============================================================================
// VERIFICATION BONUS (0-10)
// ============================================================================

async function calculateVerificationBonus(env: Env, agentId: string): Promise<number> {
  const supabase = getSupabase(env);

  const { data: agent } = await supabase
    .from(TABLES.AGENTS)
    .select('erc8004_agent_id, twitter, website, linked_github')
    .eq('id', agentId)
    .single();

  if (!agent) return 0;

  let bonus = 0;

  // ERC-8004 = 5 points (required for listing, but still counts)
  if (agent.erc8004_agent_id) bonus += 5;

  // Twitter = 2 points
  if (agent.twitter) bonus += 2;

  // GitHub = 2 points
  if (agent.linked_github) bonus += 2;

  // Website = 1 point
  if (agent.website) bonus += 1;

  return Math.min(bonus, 10);
}

// ============================================================================
// BATCH UPDATE (CRON)
// ============================================================================

/** Update signal scores for all verified agents */
export async function updateAllSignalScores(env: Env): Promise<number> {
  const supabase = getSupabase(env);

  const { data: agents } = await supabase
    .from(TABLES.AGENTS)
    .select('id')
    .not('erc8004_agent_id', 'is', null);

  if (!agents) return 0;

  let updated = 0;
  for (const agent of agents) {
    try {
      const { score } = await calculateSignalScore(env, agent.id);

      await supabase
        .from(TABLES.AGENTS)
        .update({ signal_score: score })
        .eq('id', agent.id);

      updated++;
    } catch (error) {
      console.error(`[Signal] Failed to update score for ${agent.id}:`, error);
    }
  }

  return updated;
}
