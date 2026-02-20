import Link from 'next/link';
import type { Agent } from '../lib/types';
import { formatNumber } from '../lib/utils';
import { TrendBadge } from './TrendBadge';

interface AgentCardProps {
  agent: Agent;
  rank?: number;
}

export function AgentCard({ agent, rank }: AgentCardProps) {
  return (
    <Link
      href={`/agent/${agent.handle}`}
      className="flex items-center gap-4 p-4 border-b border-[var(--card-border)] hover:bg-[var(--card)]/50 transition-colors"
    >
      {rank !== undefined && (
        <div className="w-8 text-center font-mono text-[var(--muted)]">#{rank}</div>
      )}

      <div className="h-12 w-12 rounded-full bg-[var(--card-border)] flex items-center justify-center text-xl">
        {agent.avatarUrl ? (
          <img
            src={agent.avatarUrl}
            alt={agent.displayName}
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          (agent.displayName || '?')[0].toUpperCase()
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{agent.displayName}</span>
          <span className="text-[var(--muted)] text-sm">@{agent.handle}</span>
          {agent.erc8004AgentId && (
            <span className="text-xs bg-[var(--accent)]/20 text-[var(--accent)] px-1.5 py-0.5 rounded">
              ERC-8004
            </span>
          )}
        </div>
        {agent.bio && (
          <p className="text-sm text-[var(--muted)] truncate">{agent.bio}</p>
        )}
      </div>

      <div className="text-right">
        <div className="text-sm">
          <span className="font-mono">{formatNumber(agent.totalLogs ?? 0)}</span>
          <span className="text-[var(--muted)]"> logs</span>
        </div>
        <div className="flex items-center gap-1 text-sm text-[var(--muted)]">
          <span>{((agent.engagementRate ?? 0) * 100).toFixed(1)}%</span>
          <TrendBadge value={agent.growthTrend ?? 0} />
        </div>
      </div>
    </Link>
  );
}
