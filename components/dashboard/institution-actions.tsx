"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function InstitutionActions({
  submissionId,
  slug,
  hasFile,
}: {
  submissionId: string;
  slug: string;
  hasFile: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function doAction(action: "view" | "archive") {
    setLoading(true);
    const res = await fetch(`/api/institutions/${slug}/submissions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, action }),
    });

    const data = await res.json();

    if (action === "view" && data.downloadUrl) {
      window.open(data.downloadUrl, "_blank");
    }

    setLoading(false);
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button size="sm" variant="outline" disabled={loading}>
          Actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {hasFile && (
          <DropdownMenuItem onClick={() => doAction("view")}>
            View Letter
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => doAction("archive")}>
          Archive
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
