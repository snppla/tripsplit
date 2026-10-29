import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { claimEmailInvites } from "@/lib/claim";
import { devLoginEnabled } from "@/lib/dev-login";

/**
 * Dev-only: signs in as any email without Google by creating a database
 * session directly, exactly as Auth.js would after an OAuth callback.
 */
export async function POST(req: NextRequest) {
  if (!devLoginEnabled()) return new NextResponse("Not found", { status: 404 });

  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const name = String(form.get("name") ?? "").trim() || email.split("@")[0];
  const callbackUrl = String(form.get("callbackUrl") ?? "/");
  if (!email.includes("@")) return new NextResponse("Bad email", { status: 400 });

  let user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) [user] = await db.insert(users).values({ email, name }).returning();
  await claimEmailInvites(user.id, email);

  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ sessionToken, userId: user.id, expires });

  const target = callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";
  const res = NextResponse.redirect(new URL(target, req.url), 303);
  res.cookies.set("authjs.session-token", sessionToken, { httpOnly: true, sameSite: "lax", path: "/", expires });
  return res;
}
