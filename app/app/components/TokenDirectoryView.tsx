'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTokenDirectory, getTrendingTokens, getNewTokens } from '../lib/api';
import type { TokenDirectoryItem } from '../lib/types';
import { TokenCard } from './TokenCard';

type DirectoryTab = 'signal' | 'marketCap' | 'trending' | 'new';

const CHAINS = [
  { id: '', label: 'All Chains' },
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'base', label: 'Base' },
  { id: 'solana', label: 'Solana' },
  { id: 'monad', label: 'Monad' },
  { id: 'arbitrum', label: 'Arbitrum' },
];

const MCAP_FILTERS = [
  { label: 'All', value: undefined },
  { label: '$10K+', value: 10000 },
  { label: '$100K+', value: 100000 },
  { label: '$1M+', value: 1000000 },
  { label: '$10M+', value: 10000000 },
];

const TABS: { id: DirectoryTab; label: string }[] = [
  { id: 'signal', label: 'Top Signal' },
  { id: 'marketCap', label: 'Market Cap' },
  { id: 'trending', label: 'Trending' },
  { id: 'new', label: 'New' },
];

export function TokenDirectoryView() {
  const [activeTab, setActiveTab] = useState<DirectoryTab>('signal');
  const [selectedChain, setSelectedChain] = useState('');
  const [minMarketCap, setMinMarketCap] = useState<number | undefined>();
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery<{ data?: TokenDirectoryItem[]; total?: number }>({
    queryKey: ['directory', activeTab, selectedChain, minMarketCap, page],
    queryFn: async () => {
      if (activeTab === 'trending') return await getTrendingTokens('24h') as any;
      if (activeTab === 'new') return await getNewTokens(7) as any;
      return await getTokenDirectory({
        sortBy: activeTab,
        chain: selectedChain || undefined,
        minMarketCap,
        page,
        pageSize: 50,
      }) as any;
    },
  });

  const items = (data as any)?.data || [];
  const total = (data as any)?.total || 0;
  const hasMore = activeTab !== 'trending' && activeTab !== 'new' && items.length >= 50;

  return (
    <div>
      {/* Tabs */}
      <div className="sticky top-[57px] z-40 bg-black/80 backdrop-blur-sm border-b border-zinc-800">
        <div className="flex items-center border-b border-zinc-800">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setPage(1); }}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-cyan-400 text-white'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        {(activeTab === 'signal' || activeTab === 'marketCap') && (
          <div className="flex items-center gap-4 px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Chain:</span>
              <select
                value={selectedChain}
                onChange={(e) => { setSelectedChain(e.target.value); setPage(1); }}
                className="text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-300"
              >
                {CHAINS.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Min MCap:</span>
              <select
                value={String(minMarketCap || '')}
                onChange={(e) => {
                  setMinMarketCap(e.target.value ? parseInt(e.target.value) : undefined);
                  setPage(1);
                }}
                className="text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-300"
              >
                {MCAP_FILTERS.map((f) => (
                  <option key={f.label} value={f.value || ''}>{f.label}</option>
                ))}
              </select>
            </div>
            {total > 0 && (
              <span className="text-xs text-zinc-600 ml-auto">{total} agents</span>
            )}
          </div>
        )}
      </div>

      {/* Column Headers */}
      <div className="flex items-center gap-4 px-4 py-2 text-[10px] uppercase tracking-wider text-zinc-600 border-b border-zinc-800/50">
        <div className="w-8 text-center">#</div>
        <div className="w-10" />
        <div className="flex-1">Agent / Token</div>
        <div className="w-24 text-right">Price</div>
        <div className="w-20 text-right hidden md:block">MCap</div>
        <div className="w-16 text-right hidden lg:block">Holders</div>
        <div className="w-16 text-center">Signal</div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
          <div className="animate-spin h-8 w-8 border-2 border-zinc-600 border-t-cyan-400 rounded-full mb-4" />
          <p>Loading directory...</p>
        </div>
      ) : error ? (
        <div className="py-20 text-center text-red-400">Failed to load directory</div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-zinc-400 text-lg mb-2">No tokens listed yet</p>
          <p className="text-zinc-600 text-sm">Register your ERC-8004 agent and link a token to be first</p>
        </div>
      ) : (
        <>
          {items.map((item: any, i: number) => (
            <TokenCard key={item.token.id} item={item} rank={(page - 1) * 50 + i + 1} />
          ))}

          {/* Pagination */}
          {hasMore && (
            <div className="flex justify-center gap-4 py-6">
              {page > 1 && (
                <button
                  onClick={() => setPage(p => p - 1)}
                  className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300"
                >
                  Previous
                </button>
              )}
              <button
                onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
