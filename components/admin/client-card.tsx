"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, ExternalLink, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ClientCardProps {
  client: {
    id: string;
    name: string;
    description: string | null;
    iconUrl: string | null;
    isFirstParty: boolean;
    createdAt: Date;
  };
}

export function ClientCard({ client }: ClientCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border rounded-lg p-4 hover:border-primary/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {client.iconUrl ? (
            <img
              src={client.iconUrl}
              alt={client.name}
              className="w-12 h-12 rounded-lg"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{client.name}</h3>
              {client.isFirstParty && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                  First-party
                </span>
              )}
            </div>
            {client.description && (
              <p className="text-sm text-muted-foreground line-clamp-1">
                {client.description}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Created {client.createdAt.toLocaleDateString()}
            </p>
          </div>
        </div>

        <Link href={`/admin/dashboard/clients/${client.id}`}>
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4" />
            Manage
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}
