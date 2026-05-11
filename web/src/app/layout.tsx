import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "SATOSHIT 💩 — browser-mined ERC20 on Base",
  description:
    "Mine SATOSHIT ($SHIT) from your browser. Phone or PC. No downloads. No GPU. 21 million hard cap. Fair launch. No team. No presale. No admin.",
  openGraph: {
    title: "SATOSHIT — browser-mined ERC20",
    description: "Fair-launch PoW token on Base. 21M hard cap. No team. No presale.",
  },
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="min-h-dvh flex flex-col">
            <Header />
            <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6">{children}</main>
            <footer className="border-t border-phosphor-faint mt-12">
              <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 text-xs text-muted space-y-2">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <a href="/whitepaper">whitepaper</a>
                  <a href="/pool">pool</a>
                  <a href="/stats">stats</a>
                  <span className="ml-auto term-cursor">$ shit --version 0.1.0</span>
                </div>
                <div className="text-muted/70">
                  Experimental software. No profit promised. You may lose ETH on gas.
                  Not financial advice.
                </div>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
