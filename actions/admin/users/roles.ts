"use server";

import { db } from "@/lib/db";
import {
  oauthClientRoles,
  oauthClientUserRoles,
  users,
} from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import {
  setUserRolesSchema,
  type SetUserRolesInput,
} from "@/lib/validations/admin";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface UserRoleAssignment {
  clientId: string;
  roleIds: string[];
}

export interface GetUserRolesResult {
  success: boolean;
  error?: string;
  data?: UserRoleAssignment[];
}

export interface SetUserRolesResult {
  success: boolean;
  error?: string;
  data?: UserRoleAssignment[];
}

export async function getUserRoleAssignments(
  userId: string
): Promise<GetUserRolesResult> {
  try {
    await requireAdmin();

    const rows = await db.query.oauthClientUserRoles.findMany({
      where: eq(oauthClientUserRoles.userId, userId),
      orderBy: (table, { asc }) => [asc(table.clientId)],
    });

    const byClient = new Map<string, string[]>();
    for (const row of rows) {
      const roleIds = byClient.get(row.clientId) ?? [];
      roleIds.push(row.roleId);
      byClient.set(row.clientId, roleIds);
    }

    return {
      success: true,
      data: Array.from(byClient.entries()).map(([clientId, roleIds]) => ({
        clientId,
        roleIds,
      })),
    };
  } catch (error) {
    console.error("Get user role assignments error:", error);
    return { success: false, error: "Failed to get user roles" };
  }
}

export async function setUserRoleAssignments(
  input: SetUserRolesInput
): Promise<SetUserRolesResult> {
  try {
    await requireAdmin();

    const parsed = setUserRolesSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid input",
      };
    }

    const { userId, assignments } = parsed.data;

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    const normalizedAssignments = assignments.map((assignment) => ({
      clientId: assignment.clientId,
      roleIds: Array.from(new Set(assignment.roleIds)),
    }));
    const requestedRoleIds = normalizedAssignments.flatMap(
      (assignment) => assignment.roleIds
    );

    if (requestedRoleIds.length > 0) {
      const roles = await db.query.oauthClientRoles.findMany({
        where: inArray(oauthClientRoles.id, requestedRoleIds),
      });
      const rolesById = new Map(roles.map((role) => [role.id, role]));

      for (const assignment of normalizedAssignments) {
        for (const roleId of assignment.roleIds) {
          const role = rolesById.get(roleId);
          if (!role || role.clientId !== assignment.clientId) {
            return {
              success: false,
              error: "Role does not belong to the selected app",
            };
          }
        }
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(oauthClientUserRoles)
        .where(eq(oauthClientUserRoles.userId, userId));

      const rows = normalizedAssignments.flatMap((assignment) =>
        assignment.roleIds.map((roleId) => ({
          id: crypto.randomUUID(),
          clientId: assignment.clientId,
          userId,
          roleId,
          createdAt: new Date(),
        }))
      );

      if (rows.length > 0) {
        await tx.insert(oauthClientUserRoles).values(rows);
      }
    });

    revalidatePath("/admin/dashboard/users");

    return { success: true, data: normalizedAssignments };
  } catch (error) {
    console.error("Set user role assignments error:", error);
    return { success: false, error: "Failed to update user roles" };
  }
}
