import { NextResponse } from "next/server";
import { getSessionUser, destroySession } from "@/lib/session";
import { getEnv, SESSION_COOKIE } from "@/lib/env";

export const runtime = "nodejs";

export async function POST() {
  const su = await getSessionUser();
  if (su) {
    await destroySession(su.sid);
  }
  const { cookieSecure } = getEnv();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
