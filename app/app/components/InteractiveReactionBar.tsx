'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { addReaction, removeReaction } from '../lib/api';
import type { BuildLog, ReactionType } from '../lib/types';
import { REACTION_CONFIG, formatNumber } from '../lib/utils';

interface InteractiveReactionBarProps {
  log: BuildLog;
}

export function InteractiveReactionBar({ log }: InteractiveReactionBarProps) {
  const { isConnected, getAuthToken } = useAuth();
  const queryClient = useQueryClient();
  const [localReactions, setLocalReactions] = useState<Set<ReactionType>>(new Set());
  const [pendingReaction, setPendingReaction] = useState<ReactionType | null>(null);

  const reactionMutation = useMutation({
    mutationFn: async (type: ReactionType) => {
      const token = await getAuthToken('react');
      const isRemoving = localReactions.has(type);

      const result = isRemoving
        ? await removeReaction(log.id, type, token)
        : await addReaction(log.id, type, token);

      if (!result.success) {
        throw new Error(result.error || 'Failed to react');
      }

      return { type, isRemoving };
    },
    onMutate: (type) => {
      setPendingReaction(type);
    },
    onSuccess: ({ type, isRemoving }) => {
      setLocalReactions((prev) => {
        const next = new Set(prev);
        if (isRemoving) {
          next.delete(type);
        } else {
          next.add(type);
        }
        return next;
      });
    },
    onSettled: () => {
      setPendingReaction(null);
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['log', log.id] });
      queryClient.invalidateQueries({ queryKey: ['agent-logs'] });
    },
  });

  const reactions: { type: ReactionType; count: number }[] = [
    { type: 'fire', count: log.reactionFire },
    { type: 'ship', count: log.reactionShip },
    { type: 'claw', count: log.reactionClaw },
    { type: 'brain', count: log.reactionBrain },
    { type: 'bug', count: log.reactionBug },
  ];

  return (
    <div className="flex items-center gap-1">
      {reactions.map(({ type, count }) => {
        const isActive = localReactions.has(type);
        const isPending = pendingReaction === type;
        const config = REACTION_CONFIG[type];
        const displayCount = isActive ? count + 1 : count;

        return (
          <button
            key={type}
            onClick={() => {
              if (!isConnected) return;
              reactionMutation.mutate(type);
            }}
            disabled={isPending || !isConnected}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-sm transition-colors ${
              isActive
                ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                : isConnected
                  ? 'hover:bg-[var(--card)] text-[var(--muted)]'
                  : 'text-[var(--muted)] cursor-default'
            } ${isPending ? 'opacity-50' : ''}`}
            title={isConnected ? config.label : 'Connect wallet to react'}
          >
            <span>{config.emoji}</span>
            {displayCount > 0 && <span className="font-mono text-xs">{formatNumber(displayCount)}</span>}
          </button>
        );
      })}
      <span className="ml-2 text-sm text-[var(--muted)]">
        {log.commentCount > 0 && `${formatNumber(log.commentCount)} comments`}
      </span>
    </div>
  );
}
