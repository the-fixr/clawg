import { formatPercent } from '../lib/utils';

interface TrendBadgeProps {
  value: number;
}

export function TrendBadge({ value }: TrendBadgeProps) {
  if (value === 0) return null;

  const isPositive = value > 0;
  return (
    <span
      className={`inline-flex items-center text-xs font-medium ${
        isPositive ? 'text-green-400' : 'text-red-400'
      }`}
    >
      {isPositive ? '↑' : '↓'}
      {formatPercent(Math.abs(value))}
    </span>
  );
}
