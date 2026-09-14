"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserRow } from "@/components/admin/user-row";
import { UserSearch } from "@/components/admin/user-search";
import { UserSheet } from "@/components/admin/user-sheet";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { useDebounce } from "@/hooks/use-debounce";
import { buildQueryString, type Pagination } from "@/lib/admin/pagination";
import type { User } from "@/lib/db/schema";
import type { UserRoleOptionApp } from "@/components/admin/user-role-assignments";

interface UserListProps {
  /** The current page of rows, already filtered and paged by the server. */
  users: User[];
  pagination: Pagination;
  /** The active `?q=` value, so the input can be seeded from the URL. */
  search: string;
  roleOptions: UserRoleOptionApp[];
}

/**
 * The admin user table.
 *
 * Paging and search are URL state, not component state: the server page reads
 * `?page=` and `?q=`, queries, and hands the rows down. That means a refresh or
 * a shared link reopens the same page of the same search, and there is no
 * second copy of the list to drift out of sync — mutations just ask the server
 * for fresh data.
 */
export function UserList({
  users,
  pagination,
  search,
  roleOptions,
}: UserListProps) {
  const router = useRouter();

  // The input stays local so typing is instant; the URL catches up on a debounce.
  const [searchQuery, setSearchQuery] = useState(search);
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [isNavigating, startNavigation] = useTransition();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("create");
  const [editingUser, setEditingUser] = useState<User | undefined>(undefined);

  // Re-seed the box when the URL changes underneath us — back/forward buttons,
  // or the redirect that clamps an out-of-range page. This is React's
  // adjust-state-during-render pattern rather than an effect: it re-renders
  // before paint instead of committing a throwaway frame.
  const [urlSearch, setUrlSearch] = useState(search);
  if (urlSearch !== search) {
    setUrlSearch(search);
    setSearchQuery(search);
  }

  // Push the debounced query into the URL once it diverges from what the URL
  // already says. Comparing against `search` rather than tracking the last push
  // makes this self-terminating: the navigation updates `search`, and the next
  // run finds them equal. A filter change drops `page`, since the old page
  // number means nothing against a new result set.
  useEffect(() => {
    if (debouncedSearch === search) return;

    startNavigation(() => {
      router.replace(
        `/admin/dashboard/users${buildQueryString({ q: debouncedSearch })}`,
        { scroll: false },
      );
    });
  }, [debouncedSearch, search, router]);

  const hrefForPage = (page: number) =>
    `/admin/dashboard/users${buildQueryString({
      page: page === 1 ? undefined : page,
      q: search,
    })}`;

  // The rows are server-owned, so a mutation refetches rather than patching a
  // local copy — no divergence between what the table shows and what exists.
  const refresh = () => router.refresh();

  const handleCreateUser = () => {
    setSheetMode("create");
    setEditingUser(undefined);
    setSheetOpen(true);
  };

  const handleEditUser = (user: User) => {
    setSheetMode("edit");
    setEditingUser(user);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-4" data-testid="user-list">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <UserSearch
          value={searchQuery}
          onChange={setSearchQuery}
          isSearching={isNavigating || searchQuery !== debouncedSearch}
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button data-testid="user-actions-button">
                <Plus className="h-4 w-4 mr-2" />
                Actions
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className={"w-48"}>
            <DropdownMenuItem
              onClick={handleCreateUser}
              data-testid="create-user-button"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Create User
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {users.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>
            {search
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
                  onDeleted={refresh}
                  onVerificationChanged={refresh}
                  onEdit={() => handleEditUser(user)}
                />
              ))}
            </div>
          </div>

          <PaginationControls
            pagination={pagination}
            hrefForPage={hrefForPage}
            itemLabel="user"
          />
        </>
      )}

      {/* User Sheet for create/edit */}
      <UserSheet
        mode={sheetMode}
        user={editingUser}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        roleOptions={roleOptions}
        onSuccess={refresh}
      />
    </div>
  );
}
