"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

export default function NewRequestPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [purpose, setPurpose] = useState("");
  const [message, setMessage] = useState("");
  const [deadline, setDeadline] = useState("");
  const [ferpaWaived, setFerpaWaived] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (ferpaWaived === null) {
      setError("Please make a FERPA waiver decision to continue.");
      return;
    }
    setLoading(true);
    setError(null);

    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recommenderEmail: email,
        purpose,
        message: message || undefined,
        deadline: deadline || undefined,
        ferpaWaived,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to send request");
      return;
    }

    router.push("/requests");
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Recommendation Request</h1>
        <p className="text-muted-foreground mt-1">
          Send a letter of recommendation request to a recommender.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recommender</CardTitle>
            <CardDescription>
              Enter the email of the person you&apos;re asking. If they don&apos;t have an account,
              they&apos;ll receive an invitation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <Label htmlFor="email">Recommender Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="professor@university.edu"
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Request Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="purpose">Purpose</Label>
              <Select value={purpose} onValueChange={(v) => { if (v) setPurpose(v) }} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select purpose" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACADEMIC">Academic</SelectItem>
                  <SelectItem value="EMPLOYMENT">Employment</SelectItem>
                  <SelectItem value="HOUSING">Housing</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="deadline">Deadline (optional)</Label>
              <Input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="message">Personal Note (optional)</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Include any context that would help your recommender write the letter…"
                rows={4}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground text-right">{message.length}/1000</p>
            </div>
          </CardContent>
        </Card>

        {/* FERPA Waiver */}
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-base">FERPA Waiver</CardTitle>
            <CardDescription>
              FERPA gives you the right to view letters of recommendation written about you.
              You may waive this right voluntarily. Many institutions require a waiver.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Separator />
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setFerpaWaived(true)}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                  ferpaWaived === true
                    ? "border-amber-500 bg-amber-100"
                    : "border-border hover:border-muted-foreground"
                }`}
              >
                <div className="font-medium text-sm">I waive my right to view this letter</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  The letter will be confidential. This is the option most institutions prefer.
                </div>
              </button>
              <button
                type="button"
                onClick={() => setFerpaWaived(false)}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                  ferpaWaived === false
                    ? "border-amber-500 bg-amber-100"
                    : "border-border hover:border-muted-foreground"
                }`}
              >
                <div className="font-medium text-sm">I do not waive my right</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  You retain the right to view this letter. The recommender will be notified of this choice.
                </div>
              </button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading || !purpose}>
            {loading ? "Sending…" : "Send Request"}
          </Button>
        </div>
      </form>
    </div>
  );
}
