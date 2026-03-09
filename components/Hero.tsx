import ObolLogo from './ObolLogo';

export default function Hero() {
  return (
    <section className="pt-32 pb-20 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        {/* Logo + Title */}
        <div className="flex flex-col items-center text-center mb-12">
          <div className="mb-6">
            <ObolLogo size={72} />
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold text-zinc-50 tracking-tight mb-4">
            Obol
          </h1>
          <p className="text-xl sm:text-2xl text-zinc-400 font-light mb-2">
            Pay-per-call APIs via x402.{' '}
            <span className="text-zinc-300">No subscriptions.</span>
          </p>
          <p className="text-base text-zinc-500 max-w-2xl leading-relaxed">
            Two APIs on Base. AI code generation that forks your repo and opens a PR{' '}
            <span className="text-zinc-300 font-medium">($5 USDC)</span>. Clanker token analytics
            across 639k+ tokens{' '}
            <span className="text-zinc-300 font-medium">($0.01 USDC)</span>.
          </p>
        </div>

        {/* Terminal */}
        <div className="terminal-glow rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900/80 mb-10 max-w-2xl mx-auto">
          {/* Terminal header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 bg-zinc-900">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest ml-auto mr-auto">
              terminal
            </span>
            <div className="flex items-center gap-1.5 absolute left-4">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
            </div>
          </div>
          {/* Terminal body */}
          <div className="p-5 font-mono text-sm leading-relaxed">
            <div className="text-zinc-400">
              <span className="text-blue-400">$</span>{' '}
              <span className="text-zinc-200">curl -X POST api.obol.sh/tests \</span>
            </div>
            <div className="text-zinc-400 pl-4">
              <span className="text-emerald-400">-H</span>{' '}
              <span className="text-amber-300">&quot;X-Payment: &lt;x402&gt;&quot;</span>{' '}
              <span className="text-zinc-500">\</span>
            </div>
            <div className="text-zinc-400 pl-4">
              <span className="text-emerald-400">-d</span>{' '}
              <span className="text-amber-300">'&#123; &quot;repo&quot;: &quot;you/app&quot;, &quot;path&quot;: &quot;src/lib/utils.ts&quot; &#125;'</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-emerald-400">→</span>
              <span className="text-zinc-300">PR opened in 12s</span>
              <span className="text-emerald-400 font-semibold">✓</span>
            </div>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex items-center justify-center gap-3">
          <a
            href="https://obol.sh/docs"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all duration-200 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
          >
            View Docs
          </a>
          <a
            href="https://github.com/obol-sh"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-zinc-700 hover:border-zinc-600 text-zinc-300 hover:text-zinc-100 font-medium text-sm transition-all duration-200 bg-zinc-900 hover:bg-zinc-800"
          >
            <GitHubIcon />
            GitHub
          </a>
        </div>
      </div>
    </section>
  );
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}
