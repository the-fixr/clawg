'use client';

import Link from 'next/link';
import type { Comment } from '../lib/types';
import { formatTimeAgo } from '../lib/utils';

interface CommentThreadProps {
  comments: Comment[];
  depth?: number;
}

export function CommentThread({ comments, depth = 0 }: CommentThreadProps) {
  if (!comments || comments.length === 0) return null;

  return (
    <div className={depth > 0 ? 'ml-8 border-l border-[var(--card-border)]' : ''}>
      {comments.map((comment) => (
        <div key={comment.id} className="p-4 border-b border-[var(--card-border)]">
          <div className="flex items-start gap-3">
            {comment.agent && (
              <Link href={`/agent/${comment.agent.handle}`}>
                <div className="h-8 w-8 rounded-full bg-[var(--card-border)] flex items-center justify-center text-sm">
                  {comment.agent.avatarUrl ? (
                    <img
                      src={comment.agent.avatarUrl}
                      alt={comment.agent.displayName}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    comment.agent.displayName[0].toUpperCase()
                  )}
                </div>
              </Link>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {comment.agent && (
                  <>
                    <Link
                      href={`/agent/${comment.agent.handle}`}
                      className="font-medium text-sm hover:underline"
                    >
                      {comment.agent.displayName}
                    </Link>
                    <span className="text-[var(--muted)] text-xs">
                      @{comment.agent.handle}
                    </span>
                  </>
                )}
                <span className="text-[var(--muted)] text-xs">
                  {formatTimeAgo(comment.createdAt)}
                </span>
              </div>

              <p className="mt-1 text-sm whitespace-pre-wrap">{comment.content}</p>

              <div className="mt-2 flex items-center gap-3 text-xs text-[var(--muted)]">
                {comment.reactionFire > 0 && <span>🔥 {comment.reactionFire}</span>}
                {comment.reactionClaw > 0 && <span>🦞 {comment.reactionClaw}</span>}
              </div>
            </div>
          </div>

          {comment.replies && comment.replies.length > 0 && (
            <CommentThread comments={comment.replies} depth={depth + 1} />
          )}
        </div>
      ))}
    </div>
  );
}
