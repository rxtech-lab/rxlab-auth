"use server";

import { db } from "@/lib/db";
import { oauthClientRoles, oauthClients } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import {
  createClientRoleSchema,
  updateClientRoleSchema,
  setClientDefaultRoleSchema,
  type CreateClientRoleInput,
  type SetClientDefaultRoleInput,
  type UpdateClientRoleInput,
} from "@/lib/validations/admin";
import { and, eq, not } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { OAuthClientRole } from "@/lib/db/schema";

export interface ClientRoleResult {
  success: boolean;
  error?: string;
  role?: OAuthClientRole;
}

export interface GetClientRolesResult {
  success: boolean;
  error?: string;
  data?: OAuthClientRole[];
}

export async function getClientRoles(
  clientId: string
): Promise<GetClientRolesResult> {
  try {
    await requireAdmin();

    const roles = await db.query.oauthClientRoles.findMany({
      where: eq(oauthClientRoles.clientId, clientId),
      orderBy: (table, { asc }) => [asc(table.name)],
    });

    return { success: true, data: roles };
  } catch (error) {
    console.error("Get client roles error:", error);
    return { success: false, error: "Failed to get roles" };
  }
}

export async function createClientRole(
  input: CreateClientRoleInput
): Promise<ClientRoleResult> {
  try {
    await requireAdmin();

    const parsed = createClientRoleSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid input",
      };
    }

    const { clientId, key, name } = parsed.data;
    const normalizedKey = key.toLowerCase();

    const existing = await db.query.oauthClientRoles.findFirst({
      where: and(
        eq(oauthClientRoles.clientId, clientId),
        eq(oauthClientRoles.key, normalizedKey)
      ),
    });

    if (existing) {
      return {
        success: false,
        error: "Role key is already used for this app",
      };
    }

    const now = new Date();
    const role: OAuthClientRole = {
      id: crypto.randomUUID(),
      clientId,
      key: normalizedKey,
      name,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(oauthClientRoles).values(role);

    revalidatePath(`/admin/dashboard/clients/${clientId}`);
    revalidatePath("/admin/dashboard/users");

    return { success: true, role };
  } catch (error) {
    console.error("Create client role error:", error);
    return { success: false, error: "Failed to create role" };
  }
}

export async function updateClientRole(
  input: UpdateClientRoleInput
): Promise<ClientRoleResult> {
  try {
    await requireAdmin();

    const parsed = updateClientRoleSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid input",
      };
    }

    const { roleId, clientId, key, name } = parsed.data;
    const normalizedKey = key.toLowerCase();

    const existingRole = await db.query.oauthClientRoles.findFirst({
      where: and(
        eq(oauthClientRoles.id, roleId),
        eq(oauthClientRoles.clientId, clientId)
      ),
    });

    if (!existingRole) {
      return { success: false, error: "Role not found" };
    }

    const duplicate = await db.query.oauthClientRoles.findFirst({
      where: and(
        eq(oauthClientRoles.clientId, clientId),
        eq(oauthClientRoles.key, normalizedKey),
        not(eq(oauthClientRoles.id, roleId))
      ),
    });

    if (duplicate) {
      return {
        success: false,
        error: "Role key is already used for this app",
      };
    }

    await db
      .update(oauthClientRoles)
      .set({
        key: normalizedKey,
        name,
        updatedAt: new Date(),
      })
      .where(eq(oauthClientRoles.id, roleId));

    const role = await db.query.oauthClientRoles.findFirst({
      where: eq(oauthClientRoles.id, roleId),
    });

    revalidatePath(`/admin/dashboard/clients/${clientId}`);
    revalidatePath("/admin/dashboard/users");

    return { success: true, role };
  } catch (error) {
    console.error("Update client role error:", error);
    return { success: false, error: "Failed to update role" };
  }
}

export async function setClientDefaultRole(
  input: SetClientDefaultRoleInput
): Promise<ClientRoleResult> {
  try {
    await requireAdmin();

    const parsed = setClientDefaultRoleSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid input",
      };
    }

    const { clientId, roleId } = parsed.data;

    const client = await db.query.oauthClients.findFirst({
      where: eq(oauthClients.id, clientId),
    });
    if (!client) {
      return { success: false, error: "OAuth client not found" };
    }

    if (roleId) {
      const role = await db.query.oauthClientRoles.findFirst({
        where: and(
          eq(oauthClientRoles.id, roleId),
          eq(oauthClientRoles.clientId, clientId)
        ),
      });
      if (!role) {
        return { success: false, error: "Role not found for this app" };
      }
    }

    await db
      .update(oauthClients)
      .set({ defaultRoleId: roleId, updatedAt: new Date() })
      .where(eq(oauthClients.id, clientId));

    revalidatePath(`/admin/dashboard/clients/${clientId}`);

    return { success: true };
  } catch (error) {
    console.error("Set client default role error:", error);
    return { success: false, error: "Failed to set default role" };
  }
}

export async function deleteClientRole(
  roleId: string,
  clientId: string
): Promise<ClientRoleResult> {
  try {
    await requireAdmin();

    await db
      .delete(oauthClientRoles)
      .where(
        and(
          eq(oauthClientRoles.id, roleId),
          eq(oauthClientRoles.clientId, clientId)
        )
      );

    revalidatePath(`/admin/dashboard/clients/${clientId}`);
    revalidatePath("/admin/dashboard/users");

    return { success: true };
  } catch (error) {
    console.error("Delete client role error:", error);
    return { success: false, error: "Failed to delete role" };
  }
}
