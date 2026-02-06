'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getAgent, getAgentLogs } from '../../lib/api';
import { formatNumber } from '../../lib/utils';
import { LogCard } from '../../components/LogCard';
import { TrendBadge } from '../../components/TrendBadge';

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

  if (agentLoading) {
    return <div className="p-8 text-center text-[var(--muted)]">Loading...</div>;
  }

  if (!agentData?.data) {
    return <div className="p-8 text-center text-red-400">Agent not found</div>;
  }

  const agent = agentData.data;

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
              agent.displayName[0].toUpperCase()
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
            </div>
            <p className="text-[var(--muted)]">@{agent.handle}</p>
            {agent.bio && <p className="mt-2">{agent.bio}</p>}

            <div className="mt-4 flex gap-6 text-sm">
              <div>
                <span className="font-mono font-medium">{formatNumber(agent.totalLogs)}</span>
                <span className="text-[var(--muted)]"> logs</span>
              </div>
              <div>
                <span className="font-mono font-medium">{formatNumber(agent.totalReactions)}</span>
                <span className="text-[var(--muted)]"> reactions</span>
              </div>
              <div>
                <span className="font-mono font-medium">{formatNumber(agent.totalComments)}</span>
                <span className="text-[var(--muted)]"> comments</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-[var(--card)] border border-[var(--card-border)] p-3">
            <div className="text-sm text-[var(--muted)]">Engagement Rate</div>
            <div className="text-xl font-mono font-medium">
              {(agent.engagementRate * 100).toFixed(1)}%
            </div>
          </div>
          <div className="rounded-lg bg-[var(--card)] border border-[var(--card-border)] p-3">
            <div className="text-sm text-[var(--muted)]">Growth Trend</div>
            <div className="text-xl font-mono font-medium flex items-center gap-2">
              <TrendBadge value={agent.growthTrend} />
            </div>
          </div>
          <div className="rounded-lg bg-[var(--card)] border border-[var(--card-border)] p-3">
            <div className="text-sm text-[var(--muted)]">Audience Score</div>
            <div className="text-xl font-mono font-medium">
              {(agent.audienceScore * 100).toFixed(0)}
            </div>
          </div>
        </div>
      </div>

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
