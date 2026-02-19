'use client';

import Link from 'next/link';
import type { TokenDirectoryItem } from '../lib/types';
import { formatNumber, formatCurrency, formatPercent } from '../lib/utils';

interface TokenCardProps {
  item: TokenDirectoryItem;
  rank?: number;
}

export function TokenCard({ item, rank }: TokenCardProps) {
  const { agent, token, signalScore, isFeatured, featuredTier } = item;
  const priceChange = token.priceChange24h || 0;

  return (
    <Link
      href={`/agent/${agent.handle}`}
      className={`
        flex items-center gap-4 p-4 border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors
        ${isFeatured ? `border-l-4 ${
          featuredTier === 'spotlight' ? 'border-l-yellow-400 bg-yellow-400/5' :
          featuredTier === 'premium' ? 'border-l-purple-400 bg-purple-400/5' :
          'border-l-blue-400 bg-blue-400/5'
        }` : ''}
      `}
    >
      {/* Rank */}
      {rank !== undefined && (
        <div className="w-8 text-center font-mono text-zinc-500 text-sm shrink-0">
          #{rank}
        </div>
      )}

      {/* Avatar */}
      <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
        {agent.avatarUrl ? (
          <img src={agent.avatarUrl} alt={agent.displayName} className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <span className="text-sm font-bold text-zinc-400">
            {agent.displayName[0]?.toUpperCase()}
          </span>
        )}
      </div>

      {/* Agent + Token Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-white truncate">{agent.displayName}</span>
          <span className="text-zinc-500 text-sm">@{agent.handle}</span>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-medium">
            8004
          </span>
          {isFeatured && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
              featuredTier === 'spotlight' ? 'bg-yellow-400/20 text-yellow-400' :
              featuredTier === 'premium' ? 'bg-purple-400/20 text-purple-400' :
              'bg-blue-400/20 text-blue-400'
            }`}>
              {featuredTier === 'spotlight' ? 'SPOTLIGHT' : featuredTier === 'premium' ? 'FEATURED' : 'AD'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-cyan-400">${token.symbol}</span>
          <span className="text-xs text-zinc-600">{token.chain}</span>
          {token.launchpad && (
            <span className="text-xs text-zinc-600">via {token.launchpad}</span>
          )}
        </div>
      </div>

      {/* Price + Change */}
      <div className="text-right shrink-0 w-24">
        <div className="text-sm font-mono text-white">
          {token.currentPrice ? formatCurrency(token.currentPrice) : '\u2014'}
        </div>
        <div className={`text-xs font-mono ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {formatPercent(priceChange)}
        </div>
      </div>

      {/* Market Cap */}
      <div className="text-right shrink-0 w-20 hidden md:block">
        <div className="text-xs text-zinc-500">MCap</div>
        <div className="text-sm font-mono text-zinc-300">
          {token.marketCap ? formatCurrency(token.marketCap, true) : '\u2014'}
        </div>
      </div>

      {/* Holders */}
      <div className="text-right shrink-0 w-16 hidden lg:block">
        <div className="text-xs text-zinc-500">Holders</div>
        <div className="text-sm font-mono text-zinc-300">
          {token.holders != null ? formatNumber(token.holders) : '\u2014'}
        </div>
      </div>

      {/* Signal Score */}
      <div className="text-center shrink-0 w-16">
        <div className={`text-xl font-bold ${
          signalScore >= 80 ? 'text-green-400' :
          signalScore >= 60 ? 'text-yellow-400' :
          signalScore >= 40 ? 'text-orange-400' :
          'text-red-400'
        }`}>
          {signalScore.toFixed(0)}
        </div>
        <div className="text-[10px] text-zinc-600 uppercase tracking-wider">Signal</div>
      </div>
    </Link>
  );
}