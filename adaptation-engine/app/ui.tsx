import Link from "next/link";

/** Small shared pieces. Kept in one file so the pages stay readable. */

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "bg-stone-100 text-stone-700 ring-stone-200",
    good: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    warn: "bg-amber-50 text-amber-900 ring-amber-200",
    bad: "bg-red-50 text-red-800 ring-red-200",
    info: "bg-sky-50 text-sky-800 ring-sky-200",
  };
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function statusTone(status: string): "neutral" | "good" | "warn" | "bad" | "info" {
  if (status === "BLOCKED" || status === "FAILED") return "bad";
  if (status === "REVIEW_COMPLETE") return "good";
  if (status === "IN_REVIEW" || status === "PLAN_REVIEW") return "info";
  return "neutral";
}

export function verdictTone(verdict: string): "good" | "bad" {
  return verdict === "PRESENT_UNCHANGED" ? "good" : "bad";
}

export function RuleTag({ ruleId, status }: { ruleId: string; status: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <code className="rounded bg-stone-900 px-1.5 py-0.5 text-xs font-medium text-white">{ruleId}</code>
      {status !== "confirmed" && (
        <Badge tone="warn">{status === "strawman" ? "unconfirmed rule" : "assumed rule"}</Badge>
      )}
    </span>
  );
}

export function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-stone-200 bg-white p-5 ${className}`}>
      {title && <h2 className="text-sm font-semibold tracking-tight">{title}</h2>}
      {subtitle && <p className="mt-0.5 text-xs text-stone-500">{subtitle}</p>}
      {(title || subtitle) && <div className="mt-4" />}
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-stone-700">{label}</span>
      {hint && <span className="block text-xs text-stone-500">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export const inputClass =
  "w-full rounded border border-stone-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-stone-500";

export function Button({
  children,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const variants = {
    primary: "bg-stone-900 text-white hover:bg-stone-700",
    secondary: "bg-white text-stone-800 ring-1 ring-inset ring-stone-300 hover:bg-stone-50",
    danger: "bg-red-700 text-white hover:bg-red-600",
  };
  return (
    <button
      {...props}
      className={`rounded px-3 py-1.5 text-sm font-medium disabled:opacity-40 ${variants[variant]} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function Prose({ text }: { text: string }) {
  // Deliberately not a markdown renderer: the reviewer must see exactly the
  // characters that will be handed over, not a prettified interpretation.
  return <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-stone-800">{text}</pre>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-stone-500">{children}</p>;
}

export function Crumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav className="no-print mb-4 flex flex-wrap items-center gap-1 text-xs text-stone-500">
      {items.map((item, i) => (
        <span key={item.label} className="flex items-center gap-1">
          {i > 0 && <span>/</span>}
          {item.href ? (
            <Link href={item.href} className="hover:text-stone-900">
              {item.label}
            </Link>
          ) : (
            <span className="text-stone-700">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
