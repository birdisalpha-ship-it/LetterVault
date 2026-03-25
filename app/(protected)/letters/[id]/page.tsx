import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { createDownloadPresignedUrl } from "@/lib/storage";
import { createAuditEvent } from "@/lib/audit";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "@/lib/utils";

export default async function LetterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  const letter = await prisma.letter.findUnique({
    where: { id },
    include: {
      recommender: { select: { id: true, name: true, email: true } },
      applicant: { select: { id: true, name: true, email: true } },
      submissions: {
        include: { institution: { select: { id: true, name: true } } },
        orderBy: { submittedAt: "desc" },
      },
    },
  });

  if (!letter) notFound();

  const userId = session!.user.id;
  const roles = session!.user.roles ?? [];
  const isRecommender = letter.recommenderId === userId;
  const isApplicant = letter.applicantId === userId;
  const isInstitution = roles.includes("INSTITUTION_ADMIN");

  if (!isRecommender && !isApplicant && !isInstitution) notFound();

  const canViewContent =
    isRecommender ||
    isInstitution ||
    (isApplicant && letter.visibility === "OPEN");

  let downloadUrl: string | null = null;
  if (canViewContent && letter.fileKey) {
    downloadUrl = await createDownloadPresignedUrl(letter.fileKey);
    try {
      await createAuditEvent({
        eventType: "letter_viewed",
        actorId: userId,
        targetId: id,
        metadata: {
          role: isRecommender ? "recommender" : isApplicant ? "applicant" : "institution",
        },
      });
    } catch {
      // Audit failure is non-blocking
    }
  }

  const usageLabel = {
    ONE_TIME: "One-time use",
    TIME_LIMITED: "Time-limited",
    ONGOING: "Ongoing",
  }[letter.usageType];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <LinkButton variant="ghost" size="sm" href="/letters">
          ← Back to Letters
        </LinkButton>
      </div>

      {/* Metadata card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>Letter of Recommendation</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {letter.revokedAt && <Badge variant="destructive">Revoked</Badge>}
              {letter.ferpaWaived && (
                <Badge variant="secondary" className="text-xs">FERPA Waived</Badge>
              )}
              <Badge variant={letter.visibility === "CONFIDENTIAL" ? "secondary" : "outline"}>
                {letter.visibility === "CONFIDENTIAL" ? "Confidential" : "Open"}
              </Badge>
              <Badge variant="outline">{usageLabel}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Written by</p>
              <p className="font-medium">
                {letter.recommender.name ?? letter.recommender.email}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">For</p>
              <p className="font-medium">
                {letter.applicant.name ?? letter.applicant.email}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium">{formatDistanceToNow(letter.createdAt)} ago</p>
            </div>
            <div>
              <p className="text-muted-foreground">Used</p>
              <p className="font-medium">
                {letter.usageCount} time{letter.usageCount !== 1 ? "s" : ""}
                {letter.maxUsage !== null ? ` of ${letter.maxUsage}` : ""}
              </p>
            </div>
            {letter.validFrom && (
              <div>
                <p className="text-muted-foreground">Valid from</p>
                <p className="font-medium">
                  {new Date(letter.validFrom).toLocaleDateString()}
                </p>
              </div>
            )}
            {letter.validUntil && (
              <div>
                <p className="text-muted-foreground">Expires</p>
                <p className="font-medium">
                  {new Date(letter.validUntil).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          {letter.submissions.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Submitted to ({letter.submissions.length}):
                </p>
                <div className="flex flex-wrap gap-2">
                  {letter.submissions.map((sub) => (
                    <Badge key={sub.id} variant="outline">
                      {sub.institution.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Letter content */}
      {canViewContent ? (
        downloadUrl ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Letter Content</CardTitle>
            </CardHeader>
            <CardContent>
              <iframe
                src={downloadUrl}
                className="w-full border rounded"
                style={{ height: "700px" }}
                title="Letter of Recommendation PDF"
              />
              <div className="mt-3 flex justify-end">
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  Open in new tab ↗
                </a>
              </div>
            </CardContent>
          </Card>
        ) : letter.content ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Letter Content</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                {letter.content}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No content has been uploaded for this letter yet.
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <p className="font-medium">Confidential Letter</p>
            <p className="text-sm text-muted-foreground">
              This letter is confidential. You have waived your right to view it under FERPA,
              or the recommender has marked it confidential.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
