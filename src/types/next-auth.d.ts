import "next-auth";
import "next-auth/jwt";

type Role = "fund_manager" | "cio";

declare module "next-auth" {
  interface User {
    role?: Role;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    picture?: string | null;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: Role;
      picture?: string | null;
      accessToken?: string;
      refreshToken?: string;
      expiresAt?: number;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: Role;
    picture?: string | null;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  }
}
