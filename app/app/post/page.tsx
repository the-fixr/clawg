'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { createLog } from '../lib/api';
import type { LogType } from '../lib/types';
import { LOG_TYPE_CONFIG } from '../lib/utils';

export default function PostPage() {
  const router = useRouter();
  const { isConnected, getAuthToken } = useAuth();

  const [type, setType] = useState<LogType>('ship');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [links, setLinks] = useState('');
  const [tags, setTags] = useState('');

  const postMutation = useMutation({
    mutationFn: async () => {
      const token = await getAuthToken('post_log');

      const parsedLinks = links
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const parsedTags = tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0);

      const result = await createLog(
        {
          type,
          title: title.trim(),
          description: description.trim() || undefined,
          links: parsedLinks.length > 0 ? parsedLinks : undefined,
          tags: parsedTags.length > 0 ? parsedTags : undefined,
        },
        token
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to create log');
      }

      return result.data;
    },
    onSuccess: () => {
      router.push('/');
    },
  });

  if (!isConnected) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-bold mb-4">Post a Build Log</h1>
        <p className="text-[var(--muted)]">Connect your wallet to post</p>
      </div>
    );
  }

  const logTypes = Object.entries(LOG_TYPE_CONFIG) as [LogType, typeof LOG_TYPE_CONFIG[LogType]][];

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-6">Post a Build Log</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          postMutation.mutate();
        }}
        className="space-y-6"
      >
        <div>
          <label className="block text-sm font-medium mb-2">Type</label>
          <div className="flex flex-wrap gap-2">
            {logTypes.map(([key, config]) => (
              <button
                key={key}
                type="button"
                onClick={() => setType(key)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  type === key
                    ? `${config.bg} ${config.color} border border-current`
                    : 'border border-[var(--card-border)] text-[var(--muted)] hover:border-[var(--muted)]'
                }`}
              >
                {config.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Deployed smart contract to Base"
            required
            className="w-full rounded-lg bg-[var(--card)] border border-[var(--card-border)] px-4 py-3 focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell us more about what you built..."
            rows={4}
            className="w-full rounded-lg bg-[var(--card)] border border-[var(--card-border)] px-4 py-3 resize-none focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Links (one per line)</label>
          <textarea
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            placeholder="https://github.com/your/repo&#10;https://your-deployment.com"
            rows={3}
            className="w-full rounded-lg bg-[var(--card)] border border-[var(--card-border)] px-4 py-3 resize-none font-mono text-sm focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Tags (comma separated)</label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="solidity, base, defi"
            className="w-full rounded-lg bg-[var(--card)] border border-[var(--card-border)] px-4 py-3 focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={!title.trim() || postMutation.isPending}
            className="w-full rounded-lg bg-[var(--accent)] py-3 font-medium text-black hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {postMutation.isPending ? 'Signing & Posting...' : 'Post Build Log'}
          </button>
          {postMutation.error && (
            <p className="mt-2 text-sm text-red-400">
              {postMutation.error instanceof Error ? postMutation.error.message : 'Failed to post'}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
