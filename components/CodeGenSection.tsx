const endpoints = [
  {
    method: 'POST',
    path: '/site',
    params: 'URL + repo',
    description:
      'Clone any website&#39;s visual identity into a production-ready Next.js 15 TypeScript project.',
    price: '$5',
  },
  {
    method: 'POST',
    path: '/miniapp',
    params: 'Idea + repo',
    description:
      'Generate a complete Farcaster mini app from a plain-English idea. Ships with manifest, wagmi, and SDK.',
    price: '$5',
  },
  {
    method: 'POST',
    path: '/api',
    params: 'Description + repo',
    description:
      'Describe an API in plain English. Get back an OpenAPI 3.1 spec and a Hono Cloudflare Worker.',
    price: '$5',
  },
  {
    method: 'POST',
    path: '/tests',
    params: 'Repo + file path',
    description:
      'Point at any file in a public repo and get back comprehensive Vitest unit tests.',
    price: '$1',
  },
  {
    method: 'POST',
    path: '/docs',
    params: 'Repo',
    description:
      'Claude reads your codebase and generates a full MDX documentation site.',
    price: '$5',
  },
  {
    method: 'POST',
    path: '/deploy',
    params: 'Repo + platform',
    description:
      'Adds GitHub Actions CI/CD and platform config for Vercel, Cloudflare, or Railway.',
    price: '$5',
  },
  {
    method: 'POST',
    path: '/refactor',
    params: 'Repo + file path',
    description:
      'Modernizes any TypeScript file: strict types, JSDoc, dead code removal, consistent naming.',
    price: '$1',
  },
  {
    method: 'POST',
    path: '/label',
    params: 'Bluesky DID',
    description:
      'Apply a Verified Builder badge to any Bluesky account via the Obol AT Protocol labeler.',
    price: '$5',
  },
  {
    method: 'POST',
    path: '/fix',
    params: 'Issue URL',
    description:
      'Paste a GitHub issue URL — Obol reads the issue and relevant source files, generates a targeted fix, and opens a PR.',
    price: '$5',
  },
];

export default function CodeGenSection() {
  return (
    <section id="code-gen" className="py-20 px-4 sm:px-6 border-t border-zinc-800/50">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-2xl font-bold text-zinc-50">Code Generation</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
              api.obol.sh
            </span>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-zinc-400 text-sm">
              from{' '}
              <span className="text-emerald-400 font-semibold font-mono">$1 USDC</span>
            </span>
          </div>
          <p className="text-zinc-400 text-sm max-w-2xl leading-relaxed">
            You describe it — Claude generates it, forks your repo, opens the PR. Tests and refactor
            are{' '}
            <span className="text-zinc-200">$1 USDC</span>. All others{' '}
            <span className="text-zinc-200">$5 USDC</span>.
          </p>
        </div>

        {/* Endpoints grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {endpoints.map((ep) => (
            <EndpointCard key={ep.path} {...ep} />
          ))}
        </div>
      </div>
    </section>
  );
}

function EndpointCard({
  method,
  path,
  params,
  description,
  price,
}: {
  method: string;
  path: string;
  params: string;
  description: string;
  price: string;
}) {
  return (
    <div className="card-hover rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="method-post px-2 py-0.5 rounded text-xs font-mono font-bold uppercase">
            {method}
          </span>
          <code className="text-blue-400 text-sm font-mono font-semibold">{path}</code>
        </div>
        <span className="text-xs font-mono text-emerald-400 font-semibold whitespace-nowrap">
          {price} USDC
        </span>
      </div>
      <div>
        <span className="inline-block text-xs text-zinc-500 font-mono bg-zinc-800/60 rounded px-2 py-0.5 mb-2">
          {params}
        </span>
        <p
          className="text-zinc-400 text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: description }}
        />
      </div>
    </div>
  );
}
