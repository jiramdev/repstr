// lib/auth.ts
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sessionStillValid } from "@/lib/session-version";
import { TOO_MANY_ATTEMPTS_MESSAGE, limitSignIn } from "@/lib/rate-limit";

function ipFromAuthorizeReq(req: unknown) {
  const headers = (req as { headers?: Record<string, unknown> } | null)?.headers;
  const forwarded = headers?.["x-forwarded-for"] ?? headers?.["X-Forwarded-For"];
  const first = typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : "";
  if (first) return first;
  const realIp = headers?.["x-real-ip"] ?? headers?.["X-Real-Ip"];
  return typeof realIp === "string" && realIp.trim() ? realIp.trim() : "unknown";
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Enter your email and password");
        }

        const email = credentials.email.toLowerCase();
        const ip = ipFromAuthorizeReq(req);
        if ((await limitSignIn(email, ip)).limited) {
          throw new Error(TOO_MANY_ATTEMPTS_MESSAGE);
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash) {
          throw new Error("No account found with this email address");
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);

        if (!isValid) {
          throw new Error("Invalid password");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.sessionVersion = user.sessionVersion ?? 0;
        return token;
      }

      const userId = (typeof token.id === "string" && token.id) || token.sub;
      if (!userId) throw new Error("Session revoked");

      try {
        const row = await prisma.user.findUnique({
          where: { id: userId },
          select: { sessionVersion: true },
        });
        if (!row || !sessionStillValid(token.sessionVersion, row.sessionVersion)) {
          throw new Error("Session revoked");
        }
      } catch (error) {
        if (error instanceof Error && error.message === "Session revoked") throw error;
        return token;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) || (token.sub as string);
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};