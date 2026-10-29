import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { claimEmailInvites } from "@/lib/claim";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [Google],
  session: { strategy: "database" },
  pages: { signIn: "/signin" },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (user.id && user.email) await claimEmailInvites(user.id, user.email);
    },
  },
});

export type CurrentUser = { id: string; name: string | null; email: string | null; image: string | null };

/** Returns the signed-in user, or redirects to sign-in. */
export async function requireUser(callbackUrl?: string): Promise<CurrentUser> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(callbackUrl ? `/signin?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/signin");
  }
  const { id, name, email, image } = session.user;
  return { id, name: name ?? null, email: email ?? null, image: image ?? null };
}
