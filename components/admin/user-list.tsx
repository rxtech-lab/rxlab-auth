"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserRow } from "@/components/admin/user-row";
import { getUsers } from "@/actions/admin/users/list";
import type { User } from "@/lib/db/schema";

interface UserListProps {
  initialUsers: User[];
  initialCursor: string | null;
  totalCount: number;
}

export function UserList({
  initialUsers,
  initialCursor,
  totalCount: initialTotalCount,
}: UserListProps) {
  const [users, setUsers] = useState(initialUsers);
  const [cursor, setCursor] = useState(initialCursor);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const loadMore = () => {
    if (!cursor) return;
    setError(null);

    startTransition(async () => {
      const result = await getUsers({ cursor });
      if (result.success && result.data) {
        setUsers([...users, ...result.data.users]);
        setCursor(result.data.nextCursor);
      } else {
        setError(result.error || "Failed to load more users");
      }
    });
  };

  const handleUserDeleted = (userId: string) => {
    setUsers(users.filter((u) => u.id !== userId));
    setTotalCount((prev) => prev - 1);
  };

  if (users.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No users registered yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="user-list">
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3"
        >
          {error}
        </motion.div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        {/* Table header */}
        <div className="hidden sm:grid sm:grid-cols-[1fr_120px_100px_50px] gap-4 px-4 py-3 bg-muted/50 text-sm font-medium text-muted-foreground border-b">
          <div>User</div>
          <div>Status</div>
          <div>Created</div>
          <div></div>
        </div>

        {/* User rows */}
        <div className="divide-y">
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              onDeleted={() => handleUserDeleted(user.id)}
            />
          ))}
        </div>
      </div>

      {/* Load more button */}
      {cursor && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={isPending}
            data-testid="load-more-users"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ChevronDown className="h-4 w-4 mr-2" />
            )}
            Load More
          </Button>
        </div>
      )}

      <div className="text-center text-sm text-muted-foreground">
        Showing {users.length} of {totalCount} users
      </div>
    </div>
  );
}
