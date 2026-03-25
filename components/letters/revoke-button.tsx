"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RevokeButton({ letterId }: { letterId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function revoke() {
    setLoading(true);
    await fetch(`/api/letters/${letterId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke" }),
    });
    setLoading(false);
    router.refresh();
  }

  if (!confirming) {
    return (
      <Button size="sm" variant="outline" className="text-destructive" onClick={() => setConfirming(true)}>
        Revoke Letter
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-destructive">Revoke this letter? This cannot be undone.</span>
      <Button size="sm" variant="destructive" onClick={revoke} disabled={loading}>
        {loading ? "Revoking…" : "Yes, Revoke"}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={loading}>
        Cancel
      </Button>
    </div>
  );
}
