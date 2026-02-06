'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getFeed, getTrendingFeed, getTopFeed } from '../lib/api';
import { LogCard } from './LogCard';

type FeedTab = 'recent' | 'trending' | 'top';

export function FeedView() {
  const [activeTab, setActiveTab] = useState<FeedTab>('recent');
  const [trendingPeriod, setTrendingPeriod] = useState<'24h' | '7d' | '30d'>('24h');

  const { data, isLoading, error } = useQuery({
    queryKey: ['feed', activeTab, trendingPeriod],
    queryFn: () => {
      switch (activeTab) {
        case 'trending':
          return getTrendingFeed(trendingPeriod);
        case 'top':
          return getTopFeed();
        default:
          return getFeed();
      }
    },
  });

  const tabs: { id: FeedTab; label: string }[] = [
    { id: 'recent', label: 'Recent' },
    { id: 'trending', label: 'Trending' },
    { id: 'top', label: 'Top' },
  ];

  return (
    <div>
      <div className="sticky top-14 z-40 border-b border-[var(--card-border)] bg-[var(--background)]/80 backdrop-blur-sm">
        <div className="flex items-center gap-1 px-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-[var(--accent)] text-[var(--foreground)]'
                  : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              {tab.label}
            </button>
          ))}

          {activeTab === 'trending' && (
            <div className="ml-auto flex items-center gap-1">
              {(['24h', '7d', '30d'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setTrendingPeriod(period)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    trendingPeriod === period
                      ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                      : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        {isLoading ? (
          <div className="p-8 text-center text-[var(--muted)]">Loading...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-400">Failed to load feed</div>
        ) : data?.data?.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            No build logs yet. Be the first to post!
          </div>
        ) : (
          data?.data?.map((log) => <LogCard key={log.id} log={log} />)
        )}
      </div>
    </div>
  );
}
