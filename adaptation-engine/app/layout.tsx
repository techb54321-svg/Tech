import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";
import { loadMethod } from "../src/method/loader";

export const metadata: Metadata = {
  title: "Adaptation engine",
  description: "Clinical content adaptation with a governance record",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  let methodLine = "method not loading";
  let warnings: string[] = [];
  try {
    const method = loadMethod();
    methodLine = `method ${method.manifest.method_version} (${method.manifest.status}) · ${method.statusCounts.confirmed}/${method.ruleCount} rules confirmed`;
    if (!method.manifest.author) {
      warnings.push("method.yaml has no author set — it prints blank on every governance record");
    }
    const unconfirmed = method.ruleCount - method.statusCounts.confirmed;
    if (unconfirmed > 0) {
      warnings.push(
        `${unconfirmed} of ${method.ruleCount} rules are unconfirmed — changes they produce are marked in review`,
      );
    }
  } catch (err) {
    warnings.push(`method files did not load: ${(err as Error).message.split("\n")[0]}`);
  }

  return (
    <html lang="en-AU">
      <body>
        <header className="no-print border-b border-stone-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-baseline gap-x-6 gap-y-2 px-6 py-4">
            <Link href="/" className="text-sm font-semibold tracking-tight">
              Adaptation engine
            </Link>
            <nav className="flex gap-4 text-sm text-stone-600">
              <Link href="/" className="hover:text-stone-900">
                Library
              </Link>
              <Link href="/intake" className="hover:text-stone-900">
                Intake
              </Link>
              <Link href="/method" className="hover:text-stone-900">
                Method
              </Link>
            </nav>
            <span className="ml-auto text-xs text-stone-500">{methodLine}</span>
          </div>
          {warnings.length > 0 && (
            <div className="border-t border-amber-200 bg-amber-50 px-6 py-2 text-xs text-amber-900">
              <div className="mx-auto max-w-7xl space-y-1">
                {warnings.map((w) => (
                  <p key={w}>{w}</p>
                ))}
              </div>
            </div>
          )}
        </header>
        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
