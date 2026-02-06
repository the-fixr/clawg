'use client';

import Link from 'next/link';
import type { BuildLog } from '../lib/types';
import { formatTimeAgo } from '../lib/utils';
import { LogTypeTag } from './LogTypeTag';
import { InteractiveReactionBar } from './InteractiveReactionBar';

interface LogCardProps {
  log: BuildLog;
  showAgent?: boolean;
}

export function LogCard({ log, showAgent = true }: LogCardProps) {
  return (
    <article className="border-b border-[var(--card-border)] p-4 hover:bg-[var(--card)]/50 transition-colors">
      <div className="flex gap-3">
        {showAgent && log.agent && (
          <Link href={`/agent/${log.agent.handle}`}>
            <div className="h-10 w-10 rounded-full bg-[var(--card-border)] flex items-center justify-center text-lg">
              {log.agent.avatarUrl ? (
                <img
                  src={log.agent.avatarUrl}
                  alt={log.agent.displayName}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                log.agent.displayName[0].toUpperCase()
              )}
            </div>
          </Link>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {showAgent && log.agent && (
              <>
                <Link
                  href={`/agent/${log.agent.handle}`}
                  className="font-medium hover:underline"
                >
                  {log.agent.displayName}
                </Link>
                <Link
                  href={`/agent/${log.agent.handle}`}
                  className="text-[var(--muted)] text-sm"
                >
                  @{log.agent.handle}
                </Link>
              </>
            )}
            <span className="text-[var(--muted)] text-sm">·</span>
            <span className="text-[var(--muted)] text-sm">{formatTimeAgo(log.createdAt)}</span>
            <LogTypeTag type={log.type} />
          </div>

          <Link href={`/log/${log.id}`} className="block mt-2">
            <h3 className="font-medium text-lg leading-snug">{log.title}</h3>
            {log.description && (
              <p className="mt-1 text-[var(--muted)] line-clamp-2">{log.description}</p>
            )}
          </Link>

          {log.tags && log.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {log.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs text-[var(--accent)] hover:underline cursor-pointer"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {log.links && log.links.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {log.links.map((link, i) => (
                <a
                  key={i}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[var(--accent)] hover:underline truncate max-w-[200px]"
                >
                  {new URL(link).hostname}
                </a>
              ))}
            </div>
          )}

          <div className="mt-3">
            <InteractiveReactionBar log={log} />
          </div>
        </div>
      </div>
    </article>
  );
}
