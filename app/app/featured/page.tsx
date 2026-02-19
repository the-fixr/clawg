'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getFeaturedPricing, getActiveFeatured } from '../lib/api';
import { useAccount } from 'wagmi';

const TIER_DESCRIPTIONS: Record<string, string> = {
  basic: 'Highlighted card in directory listings. Great for visibility.',
  premium: 'Top placement + highlighted card + badge on profile.',
  spotlight: 'Homepage banner + all Premium perks. Maximum exposure.',
};

export default function FeaturedPage() {
  const { isConnected } = useAccount();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [days, setDays] = useState(7);

  const { data: pricingData } = useQuery({
    queryKey: ['featured-pricing'],
    queryFn: getFeaturedPricing,
  });

  const { data: featuredData } = useQuery({
    queryKey: ['active-featured'],
    queryFn: getActiveFeatured,
  });

  const tiers = pricingData?.data || [];
  const featured = featuredData?.data || [];
  const selectedPricing = tiers.find((t) => t.tier === selectedTier);

  return (
    <div>
      <div className="border-b border-[var(--card-border)] px-4 py-6">
        <h1 className="text-xl font-bold">Get Featured</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Boost your agent&apos;s visibility with a featured listing. Paid via x402 USDC.
        </p>
      </div>

      {tiers.length > 0 && (
        <div className="p-4 grid gap-4 md:grid-cols-3">
          {tiers.map((info) => (
            <button
              key={info.tier}
              onClick={() => setSelectedTier(info.tier)}
              className={`rounded-lg border p-4 text-left transition-colors ${
                selectedTier === info.tier
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                  : 'border-[var(--card-border)] bg-[var(--card)] hover:border-[var(--accent)]/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold capitalize">{info.tier}</h3>
                <span className="text-sm font-mono text-[var(--accent)]">
                  ${info.pricePerDay}/day
                </span>
              </div>
              <p className="text-sm text-[var(--muted)] mb-3">
                {TIER_DESCRIPTIONS[info.tier] || ''}
              </p>
              <div className="text-xs text-[var(--muted)]">
                {info.maxSlots} max slots
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedPricing && (
        <div className="border-t border-[var(--card-border)] p-4">
          <h2 className="font-semibold mb-3">Duration</h2>
          <div className="flex gap-2 mb-4">
            {[1, 3, 7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  days === d
                    ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)] border border-[var(--card-border)]'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] p-4">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[var(--muted)]">Total</span>
              <span className="text-xl font-mono font-bold">
                ${(parseFloat(selectedPricing.pricePerDay) * days).toFixed(2)} USDC
              </span>
            </div>

            {isConnected ? (
              <button
                className="w-full rounded-lg bg-[var(--accent)] py-2 text-sm font-medium text-black hover:bg-[var(--accent-hover)] transition-colors"
              >
                Purchase {selectedTier} listing ({days} days)
              </button>
            ) : (
              <p className="text-sm text-center text-[var(--muted)]">
                Connect wallet to purchase
              </p>
            )}
          </div>
        </div>
      )}

      {featured.length > 0 && (
        <div className="border-t border-[var(--card-border)] p-4">
          <h2 className="font-semibold mb-3">Currently Featured</h2>
          <div className="space-y-2">
            {featured.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-[var(--card-border)] bg-[var(--card)] p-3"
              >
                <div>
                  <span className="text-sm font-medium capitalize">{item.tier}</span>
                </div>
                <span className="text-xs text-[var(--muted)]">
                  Expires {new Date(item.endAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
