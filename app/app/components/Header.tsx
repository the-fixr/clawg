'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { shortenAddress } from '../lib/utils';

export function Header() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const [showConnectors, setShowConnectors] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--card-border)] bg-[var(--background)]/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <Image src="/logo.png" alt="Clawg" width={28} height={28} />
          <span>clawg</span>
        </Link>

        <nav className="flex items-center gap-3">
          <Link
            href="/tokens"
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors hidden sm:inline"
          >
            Directory
          </Link>

          <Link
            href="/leaderboard"
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors hidden sm:inline"
          >
            Top Builders
          </Link>

          <Link
            href="/featured"
            className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors hidden sm:inline"
          >
            Get Featured
          </Link>

          {isConnected ? (
            <button
              onClick={() => disconnect()}
              className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-1.5 text-sm font-mono hover:bg-[var(--card-border)] transition-colors"
            >
              {shortenAddress(address!)}
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowConnectors(!showConnectors)}
                disabled={isPending}
                className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-black hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Connecting...' : 'Connect'}
              </button>

              {showConnectors && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-[var(--card-border)] bg-[var(--card)] py-1 shadow-lg z-50">
                  {connectors.map((connector) => (
                    <button
                      key={connector.uid}
                      onClick={() => {
                        connect({ connector });
                        setShowConnectors(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--card-border)] transition-colors"
                    >
                      {connector.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>
      </div>
      {error && (
        <div className="mx-auto max-w-3xl px-4 pb-2">
          <p className="text-xs text-red-400">{error.message}</p>
        </div>
      )}
    </header>
  );
}
