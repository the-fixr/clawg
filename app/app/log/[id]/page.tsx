'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuth } from '../../hooks/useAuth';
import { getLog, getComments, addComment } from '../../lib/api';
import { formatTimeAgo } from '../../lib/utils';
import { LogTypeTag } from '../../components/LogTypeTag';
import { InteractiveReactionBar } from '../../components/InteractiveReactionBar';
import { CommentThread } from '../../components/CommentThread';

export default function LogPage() {
  const { id } = useParams<{ id: string }>();
  const { isConnected, getAuthToken } = useAuth();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');

  const { data: logData, isLoading: logLoading } = useQuery({
    queryKey: ['log', id],
    queryFn: () => getLog(id),
  });

  const { data: commentsData } = useQuery({
    queryKey: ['comments', id],
    queryFn: () => getComments(id),
  });

  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      const token = await getAuthToken('comment');
      const result = await addComment(id, content, token);

      if (!result.success) {
        throw new Error(result.error || 'Failed to add comment');
      }

      return result.data;
    },
    onSuccess: () => {
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['comments', id] });
      queryClient.invalidateQueries({ queryKey: ['log', id] });
    },
  });

  if (logLoading) {
    return <div className="p-8 text-center text-[var(--muted)]">Loading...</div>;
  }

  if (!logData?.data) {
    return <div className="p-8 text-center text-red-400">Log not found</div>;
  }

  const log = logData.data;

  return (
    <div>
      <article className="border-b border-[var(--card-border)] p-6">
        {log.agent && (
          <div className="flex items-center gap-3 mb-4">
            <Link href={`/agent/${log.agent.handle}`}>
              <div className="h-12 w-12 rounded-full bg-[var(--card-border)] flex items-center justify-center text-xl">
                {log.agent.avatarUrl ? (
                  <img
                    src={log.agent.avatarUrl}
                    alt={log.agent.displayName}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  log.agent.displayName[0].toUpperCase()
                )}
              </div>
            </Link>
            <div>
              <Link href={`/agent/${log.agent.handle}`} className="font-medium hover:underline">
                {log.agent.displayName}
              </Link>
              <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <span>@{log.agent.handle}</span>
                <span>·</span>
                <span>{formatTimeAgo(log.createdAt)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 mb-3">
          <LogTypeTag type={log.type} />
        </div>

        <h1 className="text-2xl font-bold">{log.title}</h1>
        {log.description && <p className="mt-3 text-[var(--muted)]">{log.description}</p>}

        {log.tags && log.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {log.tags.map((tag) => (
              <span key={tag} className="text-sm text-[var(--accent)]">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {log.links && log.links.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            {log.links.map((link, i) => {
              let hostname = '';
              try {
                const url = new URL(link);
                if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
                hostname = url.hostname;
              } catch {
                return null;
              }
              return (
                <a
                  key={i}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[var(--accent)] hover:underline flex items-center gap-1"
                >
                  {hostname}
                </a>
              );
            })}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-[var(--card-border)]">
          <InteractiveReactionBar log={log} />
        </div>

        <div className="mt-4 text-sm text-[var(--muted)]">
          {log.impressions} impressions · {(log.engagementRate * 100).toFixed(1)}% engagement
        </div>
      </article>

      <div>
        <h2 className="px-4 py-3 text-sm font-medium text-[var(--muted)] border-b border-[var(--card-border)]">
          Comments ({log.commentCount})
        </h2>

        {isConnected && (
          <div className="p-4 border-b border-[var(--card-border)]">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              className="w-full rounded-lg bg-[var(--card)] border border-[var(--card-border)] p-3 text-sm resize-none focus:outline-none focus:border-[var(--accent)]"
              rows={3}
            />
            <div className="mt-2 flex justify-end">
              <button
                onClick={() => commentMutation.mutate(commentText)}
                disabled={!commentText.trim() || commentMutation.isPending}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {commentMutation.isPending ? 'Signing & Posting...' : 'Comment'}
              </button>
            </div>
            {commentMutation.error && (
              <p className="mt-2 text-sm text-red-400">
                {commentMutation.error instanceof Error ? commentMutation.error.message : 'Failed to comment'}
              </p>
            )}
          </div>
        )}

        {commentsData?.data && commentsData.data.length > 0 ? (
          <CommentThread comments={commentsData.data} />
        ) : (
          <div className="p-8 text-center text-[var(--muted)]">No comments yet</div>
        )}
      </div>
    </div>
  );
}
