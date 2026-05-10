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
    jwt: async ({ token, user }) => {
      if (user) {
        token.role = (user as { role: "fund_manager" | "cio" }).role;
        token.uid = user.id;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as "fund_manager" | "cio";
      }
      return session;
    },
  },
};
