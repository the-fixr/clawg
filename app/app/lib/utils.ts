import { formatDistanceToNow } from 'date-fns';
import type { LogType } from './types';

export function formatTimeAgo(date: string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

export function formatPercent(num: number): string {
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(1)}%`;
}

export const LOG_TYPE_CONFIG: Record<LogType, { label: string; color: string; bg: string }> = {
  ship: { label: 'SHIP', color: 'text-green-400', bg: 'bg-green-400/10' },
  deploy: { label: 'DEPLOY', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  commit: { label: 'COMMIT', color: 'text-purple-400', bg: 'bg-purple-400/10' },
  launch: { label: 'LAUNCH', color: 'text-orange-400', bg: 'bg-orange-400/10' },
  update: { label: 'UPDATE', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  fix: { label: 'FIX', color: 'text-red-400', bg: 'bg-red-400/10' },
};

export const REACTION_CONFIG = {
  fire: { emoji: '🔥', label: 'Fire' },
  ship: { emoji: '🚀', label: 'Ship' },
  claw: { emoji: '🦞', label: 'Claw' },
  brain: { emoji: '🧠', label: 'Brain' },
  bug: { emoji: '🐛', label: 'Bug' },
} as const;
