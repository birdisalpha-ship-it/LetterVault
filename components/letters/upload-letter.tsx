"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface UploadLetterProps {
  requestId: string;
  ferpaWaived: boolean;
}

export function UploadLetter({ requestId, ferpaWaived }: UploadLetterProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [visibility, setVisibility] = useState<"CONFIDENTIAL" | "OPEN">("CONFIDENTIAL");
  const [usageType, setUsageType] = useState<"ONE_TIME" | "TIME_LIMITED" | "ONGOING">("ONGOING");
  const [validUntil, setValidUntil] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please select a PDF file");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // 1. Create letter record to get an ID (no fileKey yet)
      const createRes = await fetch("/api/letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          visibility,
          usageType,
          validUntil: usageType === "TIME_LIMITED" ? validUntil : undefined,
          ferpaWaived,
        }),
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        throw new Error(data.error ?? "Failed to create letter");
      }

      const letter = await createRes.json();

      // 2. Get presigned upload URL (returns actual S3 key)
      const urlRes = await fetch(`/api/letters/${letter.id}/upload-url`, {
        method: "POST",
      });

      if (!urlRes.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { url, fields, key } = await urlRes.json();

      // 3. Upload to S3
      const formData = new FormData();
      Object.entries(fields).forEach(([k, v]) => formData.append(k, v as string));
      formData.append("file", file);

      const uploadRes = await fetch(url, { method: "POST", body: formData });
      if (!uploadRes.ok) {
        throw new Error("File upload failed");
      }

      // 4. Confirm fileKey on the letter record
      await fetch(`/api/letters/${letter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileKey: key }),
      });

      router.refresh();
      router.push("/letters");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upload Letter</CardTitle>
        <CardDescription>Upload the PDF letter and set access controls.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Visibility */}
          <div className="space-y-1">
            <Label>Visibility</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["CONFIDENTIAL", "OPEN"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={`text-left px-3 py-2 rounded-lg border-2 text-sm transition-colors ${
                    visibility === v ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="font-medium">{v === "CONFIDENTIAL" ? "Confidential" : "Open"}</div>
                  <div className="text-xs text-muted-foreground">
                    {v === "CONFIDENTIAL"
                      ? "Applicant cannot view"
                      : "Applicant can view"}
                  </div>
                </button>
              ))}
            </div>
            {ferpaWaived && (
              <div className="flex items-center gap-1 mt-1">
                <Badge variant="secondary" className="text-xs">FERPA Waived</Badge>
                <span className="text-xs text-muted-foreground">The applicant has waived their viewing rights</span>
              </div>
            )}
          </div>

          {/* Usage Type */}
          <div className="space-y-1">
            <Label>Access Type</Label>
            <Select value={usageType} onValueChange={(v) => { if (v) setUsageType(v as typeof usageType) }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ONGOING">Ongoing — available indefinitely</SelectItem>
                <SelectItem value="ONE_TIME">One-time — expires after first use</SelectItem>
                <SelectItem value="TIME_LIMITED">Time-limited — expires on a date</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {usageType === "TIME_LIMITED" && (
            <div className="space-y-1">
              <Label>Valid Until</Label>
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                required
              />
            </div>
          )}

          {/* File Upload */}
          <div className="space-y-1">
            <Label>PDF Letter</Label>
            <Input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
            <p className="text-xs text-muted-foreground">Max 10MB, PDF only</p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={uploading}>
            {uploading ? "Uploading…" : "Upload Letter"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
