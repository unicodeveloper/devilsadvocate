import Link from "next/link";

export const metadata = {
  title: "Privacy Policy · Devil's Advocate",
  description:
    "How Devil's Advocate handles your data — what we collect, why, and how to delete it.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        Home
      </Link>
      <div>
        <div className="text-[11px] font-medium uppercase tracking-wider text-text-subtle">
          Legal
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-text">
          Privacy Policy
        </h1>
        <p className="mt-2 text-xs text-text-subtle">
          Last updated: May 2026
        </p>
      </div>

      <div className="prose prose-zinc dark:prose-invert max-w-none prose-headings:tracking-tight prose-headings:text-text prose-p:text-text-muted prose-li:text-text-muted prose-strong:text-text prose-a:text-accent">
        <h2>What this is</h2>
        <p>
          Devil&apos;s Advocate is an internal-style fund manager tool. This page describes
          what data the application collects, why, and how to remove it. If
          anything here is unclear, contact the operator listed below.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Account data</strong> — your email address and a bcrypt-
            hashed password. We never store passwords in plain text.
          </li>
          <li>
            <strong>Memo content</strong> — every thesis, area of concern,
            attached document, and reviewer note you submit, plus the
            multi-agent stress-test outputs generated against them.
          </li>
          <li>
            <strong>Audit trail</strong> — every prompt and response sent to
            our LLM and research providers, stored for reproducibility.
          </li>
          <li>
            <strong>Operational logs</strong> — timestamped request paths
            and error traces, retained for debugging.
          </li>
        </ul>

        <h2>What we don&apos;t collect</h2>
        <ul>
          <li>No analytics, telemetry, or cookies beyond an auth session token.</li>
          <li>No advertising identifiers, no fingerprinting.</li>
          <li>No data is sold or shared with third parties for marketing.</li>
        </ul>

        <h2>Third parties we use</h2>
        <ul>
          <li>
            <strong>OpenAI</strong> — receives memo content for stress-test
            generation. Subject to{" "}
            <a
              href="https://openai.com/policies/privacy-policy"
              target="_blank"
              rel="noreferrer noopener"
            >
              OpenAI&apos;s privacy policy
            </a>
            .
          </li>
          <li>
            <strong>Valyu</strong> — receives query strings for research
            retrieval. Memo body is included as research context.
          </li>
          <li>
            <strong>Resend</strong> — used only for transactional email
            (password reset). No marketing communication.
          </li>
          <li>
            <strong>Railway</strong> — hosting infrastructure. Your data
            sits on encrypted disks within Railway&apos;s infrastructure.
          </li>
        </ul>

        <h2>Data retention</h2>
        <p>
          Active memos and account data are retained until you request
          deletion. Operational logs are rotated automatically. Audit-trail
          entries are retained as long as the parent memo exists; deleting
          a memo cascades to all associated traces.
        </p>

        <h2>Your rights</h2>
        <p>
          You can request full export or full deletion of your account data
          at any time by contacting the operator. We aim to respond within
          14 days. If you&apos;re an EU/UK resident you also have rights
          under GDPR/UK-GDPR to access, correct, and erase personal data.
        </p>

        <h2>Security</h2>
        <p>
          Traffic is served over HTTPS with HSTS. Passwords use bcrypt
          (12 rounds). Session tokens are signed JWTs with a server-only
          secret. Rate limiting protects sign-in and password reset from
          brute force.
        </p>

        <h2>Contact</h2>
        <p>
          Questions, requests, or breach reports: please reach out via the
          contact channel published with this deployment.
        </p>
      </div>
    </div>
  );
}
