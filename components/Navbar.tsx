import Link from 'next/link';
import ObolLogo from './ObolLogo';

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <ObolLogo size={28} />
          <span className="font-semibold text-zinc-100 text-sm tracking-tight">obol.sh</span>
        </Link>
        <div className="flex items-center gap-1">
          <NavLink href="https://obol.sh/docs">Docs</NavLink>
          <NavLink href="https://obol.sh/examples">Examples</NavLink>
          <NavLink href="https://obol.sh/dashboard">Dashboard</NavLink>
          <NavLink href="https://github.com/obol-sh" external>
            GitHub
          </NavLink>
        </div>
      </div>
    </nav>
  );
}

function NavLink({
  href,
  children,
  external,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 transition-colors rounded-md hover:bg-zinc-800/60"
    >
      {children}
    </a>
  );
}
