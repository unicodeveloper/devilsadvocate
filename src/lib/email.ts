import { Resend } from "resend";
import { SITE, siteUrl } from "./site";

let _client: Resend | null = null;

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (_client) return _client;
  _client = new Resend(key);
  return _client;
}

function getFromAddress(): string {
  // Defaults to a sender on the same domain as the app. In Resend, this
  // must be a verified domain. Falls back to onboarding@resend.dev (their
  // test sender — works without verification but Resend rate-limits it).
  return (
    process.env.RESEND_FROM_EMAIL ??
    `${SITE.name} <onboarding@resend.dev>`
  );
}

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Sends a password reset email. The link points at /reset-password with
 * the raw token in the query string — the token is then verified by
 * hashing and looking up the matching row in password_reset_tokens.
 */
export async function sendPasswordResetEmail(args: {
  to: string;
  resetUrl: string;
  expiresInMinutes: number;
}): Promise<SendResult> {
  const client = getClient();
  if (!client) {
    return { ok: false, error: "RESEND_API_KEY is not configured" };
  }
  const { to, resetUrl, expiresInMinutes } = args;
  const subject = `Reset your ${SITE.name} password`;
  const text =
    `Someone (hopefully you) requested a password reset for your ${SITE.name} account.\n\n` +
    `Click this link to set a new password — it expires in ${expiresInMinutes} minutes:\n` +
    `${resetUrl}\n\n` +
    `If you didn't request this, you can safely ignore this email.\n\n` +
    `— ${SITE.name}\n${siteUrl()}`;

  const html = `
<!doctype html>
<html lang="en">
  <body style="background:#08090b;color:#e7e9ee;font-family:'IBM Plex Sans',-apple-system,system-ui,sans-serif;margin:0;padding:40px 0;">
    <table align="center" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#101114;border:1px solid #1f2127;border-radius:12px;">
      <tr><td style="padding:32px;">
        <div style="font-size:11px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:#5d626c;">${SITE.name}</div>
        <h1 style="margin:8px 0 0;font-size:22px;font-weight:600;color:#e7e9ee;letter-spacing:-0.4px;">Reset your password</h1>
        <p style="margin:16px 0 0;font-size:14px;line-height:1.55;color:#9aa0aa;">
          Someone (hopefully you) requested a password reset for your ${SITE.name} account.
          Click the button below to set a new password.
        </p>
        <p style="margin:24px 0 0;">
          <a href="${resetUrl}"
             style="display:inline-block;background:#f5f2ea;color:#0a0c10;text-decoration:none;font-weight:600;font-size:14px;padding:11px 18px;border-radius:8px;">
            Set a new password
          </a>
        </p>
        <p style="margin:20px 0 0;font-size:12px;color:#5d626c;">
          This link expires in ${expiresInMinutes} minutes. If you didn't request a reset,
          you can safely ignore this email.
        </p>
        <p style="margin:24px 0 0;font-size:11px;color:#5d626c;word-break:break-all;">
          Or paste this URL into your browser:<br/><span style="color:#9aa0aa;">${resetUrl}</span>
        </p>
        <div style="margin-top:32px;padding-top:16px;border-top:1px solid #1f2127;font-size:11px;color:#5d626c;">
          ${SITE.name} · ${SITE.titleSuffix}
        </div>
      </td></tr>
    </table>
  </body>
</html>`.trim();

  try {
    const res = await client.emails.send({
      from: getFromAddress(),
      to,
      subject,
      text,
      html,
    });
    if (res.error) return { ok: false, error: res.error.message };
    return { ok: true, id: res.data?.id ?? "" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "send failed",
    };
  }
}
