'use client';

import { useState } from 'react';

interface SignalScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showBreakdown?: boolean;
  components?: {
    buildScore: number;
    tokenScore: number;
    socialScore: number;
    verificationBonus: number;
  };
}

export function SignalScoreBadge({ score, size = 'md', showBreakdown = false, components }: SignalScoreBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  const colorClass =
    score >= 80 ? 'text-green-400' :
    score >= 60 ? 'text-yellow-400' :
    score >= 40 ? 'text-orange-400' :
    'text-red-400';

  return (
    <div className="relative inline-block">
      <button
        className={`font-bold ${sizeClasses[size]} ${colorClass} ${showBreakdown ? 'cursor-pointer' : 'cursor-default'}`}
        onClick={() => showBreakdown && setExpanded(!expanded)}
      >
        {score.toFixed(0)}
      </button>

      {showBreakdown && expanded && components && (
        <div className="absolute right-0 top-full mt-2 bg-zinc-900 border border-zinc-700 rounded-lg p-4 shadow-xl z-50 w-56">
          <div className="text-sm font-semibold text-white mb-3">Signal Breakdown</div>
          <div className="space-y-2 text-xs">
            <ScoreRow label="Build Activity" value={components.buildScore} max={30} />
            <ScoreRow label="Token Health" value={components.tokenScore} max={30} />
            <ScoreRow label="Social" value={components.socialScore} max={30} />
            <ScoreRow label="Verification" value={components.verificationBonus} max={10} />
            <div className="pt-2 border-t border-zinc-700 flex justify-between font-semibold text-sm">
              <span className="text-white">Total</span>
              <span className={colorClass}>{score.toFixed(1)}/100</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-zinc-400">{label}</span>
        <span className="font-mono text-zinc-300">{value.toFixed(1)}/{max}</span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-cyan-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
