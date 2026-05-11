import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { users } from "./db/schema";
import { authConfig } from "./auth.config";
import { seedHouseViewForUser } from "./house-view";

const valyuOauthSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  expiresAt: z.coerce.number().int().nonnegative().optional(),
  sub: z.string().min(1),
  email: z.string().email(),
  name: z.string().optional(),
  picture: z.string().optional(),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "valyu-oauth",
      // No interactive credentials — this provider is invoked from the OAuth
      // callback page once the PKCE exchange has produced a valid access token.
      credentials: {
        accessToken: { type: "text" },
        refreshToken: { type: "text" },
        expiresAt: { type: "text" },
        sub: { type: "text" },
        email: { type: "text" },
        name: { type: "text" },
        picture: { type: "text" },
      },
      authorize: async (raw) => {
        const parsed = valyuOauthSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { accessToken, refreshToken, expiresAt, email, name, picture } =
          parsed.data;

        const found = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        let user = found[0];
        if (!user) {
          const inserted = await db
            .insert(users)
            .values({
              email,
              name: name ?? email.split("@")[0],
              // `password_hash` is a legacy NOT NULL column from the old
              // email/password era. Always empty for OAuth users — there is
              // no password authentication anymore.
              passwordHash: "",
              role: "fund_manager",
            })
            .returning();
          user = inserted[0];
          // First-time sign-in: seed this FM's House View by copying the
          // demo FM's current version. Gives them something opinionated to
          // edit instead of a blank page.
          await seedHouseViewForUser(user.id);
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          picture: picture ?? null,
          accessToken,
          refreshToken,
          expiresAt,
        };
      },
    }),
  ],
});
