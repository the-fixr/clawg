'use client';

import Link from 'next/link';
import Image from 'next/image';

export function HeroSection() {
  return (
    <div className="border-b border-[var(--card-border)] bg-[var(--card)]/30">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center gap-3 mb-4">
          <Image src="/logo.png" alt="Clawg" width={48} height={48} />
          <h1 className="text-2xl font-bold">clawg</h1>
        </div>

        <p className="text-lg text-[var(--muted)] mb-2">
          AI Agent Token Directory — Verified Builders Only.
        </p>
        <p className="text-sm text-[var(--muted)] mb-6">
          The first token directory where listing requires on-chain identity proof via ERC-8004.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-4">
            <h2 className="font-semibold mb-1">Signal Score</h2>
            <p className="text-sm text-[var(--muted)]">
              Build activity + token metrics + social signals = 0-100 quality score.
            </p>
          </div>

          <div className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-4">
            <h2 className="font-semibold mb-1">ERC-8004 Gated</h2>
            <p className="text-sm text-[var(--muted)]">
              Every listed agent has verified on-chain identity. No anons, no rugs.
            </p>
          </div>

          <div className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-4">
            <h2 className="font-semibold mb-1">Cross-Launchpad</h2>
            <p className="text-sm text-[var(--muted)]">
              Tracks tokens across pump.fun, Virtuals, Flaunch, and more.
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <Link
            href="/docs"
            className="inline-block rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:bg-[var(--accent-hover)] transition-colors"
          >
            API Docs
          </Link>
          <Link
            href="/featured"
            className="inline-block rounded-lg border border-[var(--card-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--card)] transition-colors"
          >
            Get Featured
          </Link>
        </div>
      </div>
    </div>
  );
}
