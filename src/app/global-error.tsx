"use client";

/**
 * Global error boundary — catches errors that escape the regular error.tsx
 * (e.g. in the root layout itself). Must include its own <html> and <body>
 * because it replaces the entire app shell.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          background: "#08090b",
          color: "#e7e9ee",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 16px",
          margin: 0,
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: "100%",
            background: "#101114",
            border: "1px solid #1f2127",
            borderRadius: 12,
            padding: 32,
            boxShadow: "0 24px 64px rgba(0, 0, 0, 0.65)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontFamily: "ui-monospace, monospace",
              fontWeight: 500,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#ef4444",
            }}
          >
            Fatal · App failed to render
          </div>
          <h1
            style={{
              margin: "8px 0 0",
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: -0.4,
              color: "#e7e9ee",
            }}
          >
            Something fundamental broke
          </h1>
          <p style={{ margin: "12px 0 0", fontSize: 14, color: "#9aa0aa" }}>
            The application failed to start. Try reloading the page. If it
            keeps happening, the server logs have more detail.
          </p>
          {error.digest ? (
            <p
              style={{
                margin: "12px 0 0",
                fontFamily: "ui-monospace, monospace",
                fontSize: 11,
                color: "#5d626c",
              }}
            >
              Error ref: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              height: 36,
              padding: "0 16px",
              background: "#f5f2ea",
              color: "#0a0c10",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
