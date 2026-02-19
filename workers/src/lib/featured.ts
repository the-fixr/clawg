/**
 * Featured Listings Management for Clawg Token Directory
 *
 * Tiers:
 * - Basic: $1/day, up to 10 slots — blue highlight
 * - Premium: $3/day, up to 5 slots — purple highlight
 * - Spotlight: $5/day, up to 2 slots — gold highlight
 */

import { getSupabase, TABLES } from './db';
import type { Env, ApiResponse, FeaturedListing, FeaturedListingRecord } from './types';
import { featuredRecordToModel } from './types';

// ============================================================================
// PRICING
// ============================================================================

export const FEATURED_PRICING = {
  basic: { pricePerDay: '1.00', maxSlots: 10, currency: 'USDC' },
  premium: { pricePerDay: '3.00', maxSlots: 5, currency: 'USDC' },
  spotlight: { pricePerDay: '5.00', maxSlots: 2, currency: 'USDC' },
} as const;

export type FeaturedTier = keyof typeof FEATURED_PRICING;

// ============================================================================
// CRUD
// ============================================================================

/** Purchase a featured listing */
export async function purchaseFeaturedListing(
  env: Env,
  params: {
    agentId: string;
    tier: FeaturedTier;
    days: number;
    payerAddress: string;
    transactionHash?: string;
  }
): Promise<ApiResponse<FeaturedListing>> {
  const supabase = getSupabase(env);
  const pricing = FEATURED_PRICING[params.tier];

  // Check slot availability
  const { count: activeCount } = await supabase
    .from(TABLES.FEATURED_LISTINGS)
    .select('*', { count: 'exact', head: true })
    .eq('tier', params.tier)
    .eq('is_active', true)
    .gt('end_at', new Date().toISOString());

  if ((activeCount || 0) >= pricing.maxSlots) {
    return {
      success: false,
      error: `No available ${params.tier} slots. Max: ${pricing.maxSlots}`,
    };
  }

  // Check if agent already has an active listing
  const { data: existing } = await supabase
    .from(TABLES.FEATURED_LISTINGS)
    .select('id, end_at')
    .eq('agent_id', params.agentId)
    .eq('is_active', true)
    .gt('end_at', new Date().toISOString())
    .single();

  // Calculate dates
  const startAt = existing
    ? new Date(existing.end_at) // Extend from current end date
    : new Date();
  const endAt = new Date(startAt.getTime() + params.days * 24 * 60 * 60 * 1000);

  const totalAmount = (parseFloat(pricing.pricePerDay) * params.days).toFixed(2);

  const { data, error } = await supabase
    .from(TABLES.FEATURED_LISTINGS)
    .insert({
      agent_id: params.agentId,
      tier: params.tier,
      paid_amount: totalAmount,
      payer_address: params.payerAddress.toLowerCase(),
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  // Update agent's is_featured flag
  await supabase
    .from(TABLES.AGENTS)
    .update({ is_featured: true })
    .eq('id', params.agentId);

  return { success: true, data: featuredRecordToModel(data as FeaturedListingRecord) };
}

/** Get all active featured listings */
export async function getActiveFeatured(
  env: Env
): Promise<FeaturedListing[]> {
  const supabase = getSupabase(env);
  const now = new Date().toISOString();

  const { data } = await supabase
    .from(TABLES.FEATURED_LISTINGS)
    .select('*')
    .eq('is_active', true)
    .gt('end_at', now)
    .order('tier', { ascending: true }) // spotlight first
    .order('start_at', { ascending: true });

  return ((data || []) as FeaturedListingRecord[]).map(featuredRecordToModel);
}

/** Get featured listing for a specific agent */
export async function getAgentFeaturedListing(
  env: Env,
  agentId: string
): Promise<FeaturedListing | null> {
  const supabase = getSupabase(env);
  const now = new Date().toISOString();

  const { data } = await supabase
    .from(TABLES.FEATURED_LISTINGS)
    .select('*')
    .eq('agent_id', agentId)
    .eq('is_active', true)
    .gt('end_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!data) return null;
  return featuredRecordToModel(data as FeaturedListingRecord);
}

/** Get featured listing pricing info */
export function getFeaturedPricing() {
  return Object.entries(FEATURED_PRICING).map(([tier, pricing]) => ({
    tier,
    pricePerDay: pricing.pricePerDay,
    maxSlots: pricing.maxSlots,
    currency: pricing.currency,
  }));
}

// ============================================================================
// CRON — EXPIRY
// ============================================================================

/** Expire featured listings that have passed their end date */
export async function expireFeaturedListings(env: Env): Promise<number> {
  const supabase = getSupabase(env);
  const now = new Date().toISOString();

  // Get listings to expire
  const { data: expiring } = await supabase
    .from(TABLES.FEATURED_LISTINGS)
    .select('id, agent_id')
    .eq('is_active', true)
    .lte('end_at', now);

  if (!expiring || expiring.length === 0) return 0;

  // Mark as inactive
  const ids = expiring.map(e => e.id);
  await supabase
    .from(TABLES.FEATURED_LISTINGS)
    .update({ is_active: false })
    .in('id', ids);

  // Update agent is_featured flags
  const agentIds = [...new Set(expiring.map(e => e.agent_id))];
  for (const agentId of agentIds) {
    // Check if agent has any remaining active listings
    const { count } = await supabase
      .from(TABLES.FEATURED_LISTINGS)
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('is_active', true)
      .gt('end_at', now);

    if (!count || count === 0) {
      await supabase
        .from(TABLES.AGENTS)
        .update({ is_featured: false })
        .eq('id', agentId);
    }
  }

  return expiring.length;
}
