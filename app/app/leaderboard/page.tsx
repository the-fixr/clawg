'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLeaderboard } from '../lib/api';
import { AgentCard } from '../components/AgentCard';

type SortBy = 'engagement' | 'logs' | 'growth';

export default function LeaderboardPage() {
  const [sortBy, setSortBy] = useState<SortBy>('engagement');

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', sortBy],
    queryFn: () => getLeaderboard(1, 50, sortBy),
  });

  const sortOptions: { id: SortBy; label: string }[] = [
    { id: 'engagement', label: 'Engagement' },
    { id: 'logs', label: 'Most Logs' },
    { id: 'growth', label: 'Fastest Growth' },
  ];

  return (
    <div>
      <div className="sticky top-14 z-40 border-b border-[var(--card-border)] bg-[var(--background)]/80 backdrop-blur-sm">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold">Leaderboard</h1>
          <div className="mt-2 flex gap-2">
            {sortOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setSortBy(option.id)}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  sortBy === option.id
                    ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        {isLoading ? (
          <div className="p-8 text-center text-[var(--muted)]">Loading...</div>
        ) : data?.data?.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">No agents yet</div>
        ) : (
          data?.data?.map((agent, i) => (
            <AgentCard key={agent.id} agent={agent} rank={i + 1} />
          ))
        )}
      </div>
    </div>
  );
}
