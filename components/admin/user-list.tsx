"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserRow } from "@/components/admin/user-row";
import { UserSearch } from "@/components/admin/user-search";
import { getUsers } from "@/actions/admin/users/list";
import { useDebounce } from "@/hooks/use-debounce";
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

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [isSearchPending, startSearchTransition] = useTransition();
  const prevDebouncedSearch = useRef(debouncedSearch);

  // Effect to trigger search when debounced value changes
  useEffect(() => {
    // Skip if the value hasn't changed
    if (prevDebouncedSearch.current === debouncedSearch) {
      return;
    }
    prevDebouncedSearch.current = debouncedSearch;

    if (debouncedSearch) {
      startSearchTransition(async () => {
        const result = await getUsers({ search: debouncedSearch });
        if (result.success && result.data) {
          setUsers(result.data.users);
          setCursor(result.data.nextCursor);
          setTotalCount(result.data.totalCount);
        } else {
          setError(result.error || "Failed to search users");
        }
      });
    } else {
      // Reset to initial state when search is cleared
      startSearchTransition(() => {
        setUsers(initialUsers);
        setCursor(initialCursor);
        setTotalCount(initialTotalCount);
      });
    }
  }, [debouncedSearch, initialUsers, initialCursor, initialTotalCount]);

  const loadMore = () => {
    if (!cursor) return;
    setError(null);

    startTransition(async () => {
      const result = await getUsers({
        cursor,
        search: debouncedSearch || undefined,
      });
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

  const handleVerificationChanged = (userId: string, verified: boolean) => {
    setUsers(
      users.map((u) => (u.id === userId ? { ...u, emailVerified: verified } : u))
    );
  };

  return (
    <div className="space-y-4" data-testid="user-list">
      {/* Search */}
      <UserSearch
        value={searchQuery}
        onChange={setSearchQuery}
        isSearching={isSearchPending}
      />

      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3"
        >
          {error}
        </motion.div>
      )}

      {users.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>
            {searchQuery
              ? "No users found matching your search."
              : "No users registered yet."}
          </p>
        </div>
      ) : (
        <>
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
                  onVerificationChanged={handleVerificationChanged}
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
        </>
      )}
    </div>
  );
}
