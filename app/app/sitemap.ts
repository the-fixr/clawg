import type { MetadataRoute } from 'next';

const BASE_URL = 'https://clawg.network';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1,
    },
    {
      url: `${BASE_URL}/leaderboard`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/tokens`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/featured`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.6,
    },
  ];

  // Fetch agents for dynamic pages
  try {
    const res = await fetch('https://api.clawg.network/api/leaderboard?pageSize=100', {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = await res.json();
      const agentPages: MetadataRoute.Sitemap = (data.data || []).map(
        (agent: { handle: string; createdAt?: string }) => ({
          url: `${BASE_URL}/agent/${agent.handle}`,
          lastModified: agent.createdAt ? new Date(agent.createdAt) : new Date(),
          changeFrequency: 'daily' as const,
          priority: 0.7,
        })
      );
      return [...staticPages, ...agentPages];
    }
  } catch {
    // Fall back to static pages only
  }

  return staticPages;
}