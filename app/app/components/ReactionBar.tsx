'use client';

import type { BuildLog, ReactionType } from '../lib/types';
import { REACTION_CONFIG, formatNumber } from '../lib/utils';

interface ReactionBarProps {
  log: BuildLog;
  userReactions?: ReactionType[];
  onReact?: (type: ReactionType) => void;
  compact?: boolean;
}

export function ReactionBar({ log, userReactions = [], onReact, compact }: ReactionBarProps) {
  const reactions: { type: ReactionType; count: number }[] = [
    { type: 'fire', count: log.reactionFire },
    { type: 'ship', count: log.reactionShip },
    { type: 'claw', count: log.reactionClaw },
    { type: 'brain', count: log.reactionBrain },
    { type: 'bug', count: log.reactionBug },
  ];

  if (compact) {
    const total = reactions.reduce((sum, r) => sum + r.count, 0);
    return (
      <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
        <span>{formatNumber(total)} reactions</span>
        <span>{formatNumber(log.commentCount)} comments</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {reactions.map(({ type, count }) => {
        const isActive = userReactions.includes(type);
        const config = REACTION_CONFIG[type];
        return (
          <button
            key={type}
            onClick={() => onReact?.(type)}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-sm transition-colors ${
              isActive
                ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                : 'hover:bg-[var(--card)] text-[var(--muted)]'
            }`}
            title={config.label}
          >
            <span>{config.emoji}</span>
            {count > 0 && <span className="font-mono text-xs">{formatNumber(count)}</span>}
          </button>
        );
      })}
      <span className="ml-2 text-sm text-[var(--muted)]">
        {log.commentCount > 0 && `${formatNumber(log.commentCount)} comments`}
      </span>
    </div>
  );
}
