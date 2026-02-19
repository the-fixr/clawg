'use client';

import { useQuery } from '@tanstack/react-query';
import { getTokenDetail } from '../lib/api';
import { formatCurrency, formatNumber, formatPercent } from '../lib/utils';
import type { AgentToken, TokenSnapshot } from '../lib/types';

interface TokenMetricsProps {
  tokenId: string;
}

export function TokenMetrics({ tokenId }: TokenMetricsProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['token-detail', tokenId],
    queryFn: () => getTokenDetail(tokenId, 30),
  });

  if (isLoading) {
    return (
      <div className="border border-zinc-800 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-zinc-800 rounded w-32" />
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-12 bg-zinc-800 rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!data?.success || !data.data) return null;

  const token = data.data as AgentToken & { history: TokenSnapshot[] };
  const priceChange = token.priceChange24h || 0;

  return (
    <div className="border border-zinc-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">
          ${token.symbol}
          <span className="text-zinc-500 text-sm ml-2 font-normal">{token.chain}</span>
        </h3>
        <div className="text-right">
          <div className="text-2xl font-mono font-bold text-white">
            {token.currentPrice ? formatCurrency(token.currentPrice) : '\u2014'}
          </div>
          <div className={`text-sm font-mono ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatPercent(priceChange)}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Market Cap" value={token.marketCap ? formatCurrency(token.marketCap, true) : '\u2014'} />
        <StatCard label="24h Volume" value={token.volume24h ? formatCurrency(token.volume24h, true) : '\u2014'} />
        <StatCard label="Holders" value={token.holders != null ? formatNumber(token.holders) : '\u2014'} />
        <StatCard label="Liquidity" value={token.liquidity ? formatCurrency(token.liquidity, true) : '\u2014'} />
      </div>

      {/* Simple Price Chart (sparkline-style) */}
      {token.history && token.history.length > 1 && (
        <div className="mb-4">
          <div className="text-xs text-zinc-500 mb-2">30-Day Price</div>
          <MiniChart data={token.history} />
        </div>
      )}

      {/* Contract Info */}
      <div className="pt-4 border-t border-zinc-800 flex items-center gap-2 text-xs text-zinc-500">
        <span>Contract:</span>
        <code className="bg-zinc-900 px-2 py-1 rounded font-mono text-zinc-400 truncate max-w-[300px]">
          {token.contractAddress}
        </code>
        {token.launchpad && (
          <span className="ml-auto">via {token.launchpad}</span>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-900/50 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">{label}</div>
      <div className="text-sm font-mono text-zinc-200">{value}</div>
    </div>
  );
}

/** SVG sparkline chart */
function MiniChart({ data }: { data: TokenSnapshot[] }) {
  const prices = data.map(d => d.priceUsd).filter(p => p > 0);
  if (prices.length < 2) return null;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const w = 100;
  const h = 40;

  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * w;
    const y = h - ((p - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');

  const isUp = prices[prices.length - 1] >= prices[0];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={isUp ? '#4ade80' : '#f87171'}
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
}