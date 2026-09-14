import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import {
  DELETION_STATE_COLUMNS,
  buildAccountDeletionStatus,
} from "@/lib/account/deletion-status";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ user: null });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarSeed: true,
        emailVerified: true,
        ...DELETION_STATE_COLUMNS,
      },
    });

    if (!user) {
      return NextResponse.json({ user: null });
    }

    // Replace the raw Date columns with the serialized deletion status so
    // clients see one documented shape rather than two representations.
    const { deletionScheduledAt, deletionRequestedAt, ...profile } = user;

    return NextResponse.json({
      user: {
        ...profile,
        ...buildAccountDeletionStatus({ deletionScheduledAt, deletionRequestedAt }),
      },
    });
  } catch (error) {
    console.error("Session error:", error);
    return NextResponse.json({ user: null });
  }
}
