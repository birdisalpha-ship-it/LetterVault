"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function RequestActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [declining, setDeclining] = useState(false);
  const [declineMessage, setDeclineMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function respond(action: "accept" | "decline") {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, declineMessage: declineMessage || undefined }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }

    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Respond to Request</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {declining ? (
          <div className="space-y-3">
            <Textarea
              placeholder="Optional: share why you're declining…"
              value={declineMessage}
              onChange={(e) => setDeclineMessage(e.target.value)}
              maxLength={500}
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setDeclining(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => respond("decline")}
                disabled={loading}
              >
                {loading ? "Declining…" : "Decline Request"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <Button onClick={() => respond("accept")} disabled={loading}>
              {loading ? "Accepting…" : "Accept Request"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setDeclining(true)}
              disabled={loading}
            >
              Decline
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
