import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe config: no DB or Node-only deps. Used by middleware.
 * The full provider list lives in auth.ts.
 */
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt: async ({ token, user, trigger, session }) => {
      if (user) {
        token.role = (user as { role: "fund_manager" | "cio" }).role;
        token.uid = user.id;
        const u = user as {
          accessToken?: string;
          refreshToken?: string;
          expiresAt?: number;
          picture?: string | null;
        };
        if (u.accessToken) token.accessToken = u.accessToken;
        if (u.refreshToken) token.refreshToken = u.refreshToken;
        if (u.expiresAt) token.expiresAt = u.expiresAt;
        if (u.picture !== undefined) token.picture = u.picture ?? null;
      }
      // Allow client to push a refreshed token into the JWT via update().
      if (trigger === "update" && session && typeof session === "object") {
        const s = session as {
          accessToken?: string;
          refreshToken?: string;
          expiresAt?: number;
        };
        if (s.accessToken) token.accessToken = s.accessToken;
        if (s.refreshToken) token.refreshToken = s.refreshToken;
        if (s.expiresAt) token.expiresAt = s.expiresAt;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as "fund_manager" | "cio";
        session.user.picture = (token.picture as string | null) ?? null;
        session.user.accessToken = token.accessToken as string | undefined;
        session.user.refreshToken = token.refreshToken as string | undefined;
        session.user.expiresAt = token.expiresAt as number | undefined;
      }
      return session;
    },
  },
};
