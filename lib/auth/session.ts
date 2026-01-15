import { getIronSession, IronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  userId?: string;
  email?: string;
  isLoggedIn: boolean;
}

export interface AdminSessionData {
  isAdmin: boolean;
}

const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "rxlab-auth-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

const adminSessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "rxlab-admin-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 1 day
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function getAdminSession(): Promise<IronSession<AdminSessionData>> {
  const cookieStore = await cookies();
  return getIronSession<AdminSessionData>(cookieStore, adminSessionOptions);
}

export async function createSession(userId: string, email: string): Promise<void> {
  const session = await getSession();
  session.userId = userId;
  session.email = email;
  session.isLoggedIn = true;
  await session.save();
}

export async function destroySession(): Promise<void> {
  const session = await getSession();
  session.destroy();
}

export async function createAdminSession(): Promise<void> {
  const session = await getAdminSession();
  session.isAdmin = true;
  await session.save();
}

export async function destroyAdminSession(): Promise<void> {
  const session = await getAdminSession();
  session.destroy();
}

export async function requireAuth(): Promise<SessionData> {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireAdmin(): Promise<AdminSessionData> {
  const session = await getAdminSession();
  if (!session.isAdmin) {
    throw new Error("Unauthorized");
  }
  return session;
}
