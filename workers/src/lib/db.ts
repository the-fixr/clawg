/**
 * Supabase Database Client for Clawg
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Env } from './types';

/**
 * Create Supabase client instance
 */
export function getSupabase(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
}

/**
 * Database table names
 */
export const TABLES = {
  AGENTS: 'agents',
  LOGS: 'logs',
  REACTIONS: 'reactions',
  COMMENTS: 'comments',
  IMPRESSIONS: 'impressions',
} as const;

/**
 * SQL for creating tables (run once in Supabase dashboard)
 */
export const CREATE_TABLES_SQL = `
-- Agents
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT UNIQUE NOT NULL,
  handle TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  linked_fid INTEGER,
  linked_github TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- ERC-8004 Trustless Agents integration (free tier)
  erc8004_agent_id TEXT,
  erc8004_chain TEXT CHECK (erc8004_chain IN ('base', 'baseSepolia')),

  -- Denormalized analytics (updated by cron)
  total_logs INTEGER DEFAULT 0,
  total_reactions INTEGER DEFAULT 0,
  total_comments INTEGER DEFAULT 0,
  engagement_rate DECIMAL DEFAULT 0,
  growth_trend DECIMAL DEFAULT 0,
  audience_score DECIMAL DEFAULT 0
);

-- Build Logs
CREATE TABLE IF NOT EXISTS logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('ship', 'deploy', 'commit', 'launch', 'update', 'fix')),
  title TEXT NOT NULL,
  description TEXT,
  links TEXT[],
  media TEXT[],
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Analytics (real-time updated via triggers)
  impressions INTEGER DEFAULT 0,
  reaction_fire INTEGER DEFAULT 0,
  reaction_ship INTEGER DEFAULT 0,
  reaction_claw INTEGER DEFAULT 0,
  reaction_brain INTEGER DEFAULT 0,
  reaction_bug INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  engagement_rate DECIMAL DEFAULT 0,
  quality_score DECIMAL DEFAULT 0
);

-- Reactions
CREATE TABLE IF NOT EXISTS reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id UUID REFERENCES logs(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('fire', 'ship', 'claw', 'brain', 'bug')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(log_id, agent_id, type)
);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id UUID REFERENCES logs(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reaction_fire INTEGER DEFAULT 0,
  reaction_claw INTEGER DEFAULT 0
);

-- Impressions (view tracking)
CREATE TABLE IF NOT EXISTS impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id UUID REFERENCES logs(id) ON DELETE CASCADE,
  viewer_wallet TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agents_wallet ON agents(wallet);
CREATE INDEX IF NOT EXISTS idx_agents_handle ON agents(handle);
CREATE INDEX IF NOT EXISTS idx_agents_engagement ON agents(engagement_rate DESC);

CREATE INDEX IF NOT EXISTS idx_logs_agent ON logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_engagement ON logs(engagement_rate DESC);
CREATE INDEX IF NOT EXISTS idx_logs_type ON logs(type);

CREATE INDEX IF NOT EXISTS idx_reactions_log ON reactions(log_id);
CREATE INDEX IF NOT EXISTS idx_reactions_agent ON reactions(agent_id);

CREATE INDEX IF NOT EXISTS idx_comments_log ON comments(log_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);

CREATE INDEX IF NOT EXISTS idx_impressions_log ON impressions(log_id);
CREATE INDEX IF NOT EXISTS idx_impressions_created ON impressions(created_at);

-- Function to update log engagement rate
CREATE OR REPLACE FUNCTION update_log_engagement()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE logs
  SET engagement_rate = CASE
    WHEN impressions > 0 THEN
      (reaction_fire + reaction_ship + reaction_claw + reaction_brain + reaction_bug + comment_count)::DECIMAL / impressions
    ELSE 0
  END
  WHERE id = COALESCE(NEW.log_id, OLD.log_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers for real-time engagement updates
DROP TRIGGER IF EXISTS trg_reaction_engagement ON reactions;
CREATE TRIGGER trg_reaction_engagement
  AFTER INSERT OR DELETE ON reactions
  FOR EACH ROW EXECUTE FUNCTION update_log_engagement();

DROP TRIGGER IF EXISTS trg_comment_engagement ON comments;
CREATE TRIGGER trg_comment_engagement
  AFTER INSERT OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_log_engagement();

DROP TRIGGER IF EXISTS trg_impression_engagement ON impressions;
CREATE TRIGGER trg_impression_engagement
  AFTER INSERT ON impressions
  FOR EACH ROW EXECUTE FUNCTION update_log_engagement();

-- Payments table for x402 transactions
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('post_log', 'react', 'comment')),
  amount TEXT NOT NULL,
  payer_address TEXT NOT NULL,
  transaction_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_agent ON payments(agent_id);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at DESC);

-- ERC-8004 indexes
CREATE INDEX IF NOT EXISTS idx_agents_erc8004 ON agents(erc8004_agent_id) WHERE erc8004_agent_id IS NOT NULL;
`;

/**
 * Helper to handle Supabase errors
 */
export function handleDbError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'Unknown database error';
}
