import type { LogType } from '../lib/types';
import { LOG_TYPE_CONFIG } from '../lib/utils';

export function LogTypeTag({ type }: { type: LogType }) {
  const config = LOG_TYPE_CONFIG[type];
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${config.color} ${config.bg}`}
    >
      {config.label}
    </span>
  );
}
