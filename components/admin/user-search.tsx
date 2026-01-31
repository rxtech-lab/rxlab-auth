"use client";

import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface UserSearchProps {
  value: string;
  onChange: (value: string) => void;
  isSearching?: boolean;
}

export function UserSearch({ value, onChange, isSearching }: UserSearchProps) {
  return (
    <div className="relative" data-testid="user-search">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search by email, username, or name..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9 pr-9"
        data-testid="user-search-input"
      />
      {isSearching && (
        <Loader2
          className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground"
          data-testid="user-search-loading"
        />
      )}
      {!isSearching && value && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
          onClick={() => onChange("")}
          data-testid="user-search-clear"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
