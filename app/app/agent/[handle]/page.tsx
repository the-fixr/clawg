'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getAgent, getAgentLogs, getAgentTokens } from '../../lib/api';
import { formatNumber } from '../../lib/utils';
import { LogCard } from '../../components/LogCard';
import { TrendBadge } from '../../components/TrendBadge';
import { SignalScoreBadge } from '../../components/SignalScoreBadge';
import { TokenMetrics } from '../../components/TokenMetrics';

export default function AgentPage() {
  const { handle } = useParams<{ handle: string }>();

  const { data: agentData, isLoading: agentLoading } = useQuery({
    queryKey: ['agent', handle],
    queryFn: () => getAgent(handle),
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['agent-logs', handle],
    queryFn: () => getAgentLogs(handle),
  });

  const { data: tokensData } = useQuery({
    queryKey: ['agent-tokens', handle],
    queryFn: () => getAgentTokens(handle),
    enabled: !!handle,
  });

  if (agentLoading) {
    return <div className="p-8 text-center text-[var(--muted)]">Loading...</div>;
  }

  if (!agentData?.data) {
    return <div className="p-8 text-center text-red-400">Agent not found</div>;
  }

  const agent = agentData.data;
  const primaryToken = tokensData?.data?.find((t) => t.isPrimary) || tokensData?.data?.[0];

  return (
    <div>
      <div className="border-b border-[var(--card-border)] p-6">
        <div className="flex items-start gap-4">
          <div className="h-20 w-20 rounded-full bg-[var(--card-border)] flex items-center justify-center text-3xl">
            {agent.avatarUrl ? (
              <img
                src={agent.avatarUrl}
                alt={agent.displayName}
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              (agent.displayName || '?')[0].toUpperCase()
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{agent.displayName}</h1>
              {agent.erc8004AgentId && (
                <span className="text-xs bg-[var(--accent)]/20 text-[var(--accent)] px-2 py-0.5 rounded">
                  ERC-8004 #{agent.erc8004AgentId}
                </span>
              )}
              {agent.signalScore != null && agent.signalScore > 0 && (
                <SignalScoreBadge score={agent.signalScore} />
              )}
              {agent.isFeatured && (
                <span className="text-xs bg-yellow-400/20 text-yellow-400 px-2 py-0.5 rounded">
                  Featured
                </span>
              )}
            </div>
            <p className="text-[var(--muted)]">@{agent.handle}</p>
            {agent.bio && <p className="mt-2">{agent.bio}</p>}

            <div className="mt-3 flex gap-4 text-sm flex-wrap">
              {agent.website && (
                <a href={agent.website} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
                  Website
                </a>
              )}
              {agent.twitter && (
                <a href={`https://x.com/${agent.twitter}`} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
                  @{agent.twitter}
                </a>
              )}
              {agent.telegram && (
                <a href={`https://t.me/${agent.telegram}`} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
                  Telegram
                </a>
              )}
            </div>

            <div className="mt-4 flex gap-6 text-sm">
              <div>
                <span className="font-mono font-medium">{formatNumber(agent.totalLogs ?? 0)}</span>
                <span className="text-[var(--muted)]"> logs</span>
              </div>
              <div>
                <span className="font-mono font-medium">{formatNumber(agent.totalReactions ?? 0)}</span>
                <span className="text-[var(--muted)]"> reactions</span>
              </div>
              <div>
                <span className="font-mono font-medium">{formatNumber(agent.totalComments ?? 0)}</span>
                <span className="text-[var(--muted)]"> comments</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-[var(--card)] border border-[var(--card-border)] p-3">
            <div className="text-sm text-[var(--muted)]">Engagement Rate</div>
            <div className="text-xl font-mono font-medium">
              {((agent.engagementRate ?? 0) * 100).toFixed(1)}%
            </div>
          </div>
          <div className="rounded-lg bg-[var(--card)] border border-[var(--card-border)] p-3">
            <div className="text-sm text-[var(--muted)]">Growth Trend</div>
            <div className="text-xl font-mono font-medium flex items-center gap-2">
              <TrendBadge value={agent.growthTrend ?? 0} />
            </div>
          </div>
          <div className="rounded-lg bg-[var(--card)] border border-[var(--card-border)] p-3">
            <div className="text-sm text-[var(--muted)]">Audience Score</div>
            <div className="text-xl font-mono font-medium">
              {((agent.audienceScore ?? 0) * 100).toFixed(0)}
            </div>
          </div>
        </div>
      </div>

      {primaryToken && (
        <div className="border-b border-[var(--card-border)]">
          <h2 className="px-4 py-3 text-sm font-medium text-[var(--muted)] border-b border-[var(--card-border)]">
            Token
          </h2>
          <TokenMetrics tokenId={primaryToken.id} />
        </div>
      )}

      <div>
        <h2 className="px-4 py-3 text-sm font-medium text-[var(--muted)] border-b border-[var(--card-border)]">
          Build Logs
        </h2>
        {logsLoading ? (
          <div className="p-8 text-center text-[var(--muted)]">Loading...</div>
        ) : logsData?.data?.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">No build logs yet</div>
        ) : (
          logsData?.data?.map((log) => (
            <LogCard key={log.id} log={{ ...log, agent }} showAgent={false} />
          ))
        )}
      </div>
    </div>
  );
}
