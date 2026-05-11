"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "./WalletButton";

const TABS = [
  { href: "/", label: "genesis" },
  { href: "/mine", label: "mine" },
  { href: "/pool", label: "pool" },
  { href: "/stats", label: "stats" },
  { href: "/whitepaper", label: "wp" },
];

export function Header() {
  const path = usePathname() || "/";
  return (
    <header className="border-b border-phosphor-faint bg-bg">
      <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 h-14 flex items-center gap-3 sm:gap-6">
        <Link href="/" className="text-phosphor term-glow font-bold tracking-widest shrink-0">
          💩 $SHIT
          <span className="text-muted font-normal ml-2 hidden lg:inline">
            // browser-mined · fair launch · on Base
          </span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4 ml-auto md:ml-4 text-xs sm:text-sm">
          {TABS.map((t) => {
            const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={
                  active
                    ? "text-phosphor term-glow"
                    : "text-muted hover:text-phosphor-dim"
                }
              >
                {active ? <><span className="hidden sm:inline">&gt; </span>{t.label}</> : t.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto md:ml-0">
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
