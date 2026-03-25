import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RequestActions } from "@/components/requests/request-actions";
import { UploadLetter } from "@/components/letters/upload-letter";

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  const request = await prisma.recommendationRequest.findUnique({
    where: { id },
    include: {
      applicant: { select: { id: true, name: true, email: true, image: true, affiliation: true } },
      recommender: { select: { id: true, name: true, email: true, image: true } },
      letter: true,
    },
  });

  if (!request) notFound();

  const userId = session!.user.id;
  const isApplicant = request.applicantId === userId;
  const isRecommender = request.recommenderId === userId;

  if (!isApplicant && !isRecommender) notFound();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <LinkButton variant="ghost" size="sm" href="/requests">← Back to Requests</LinkButton>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recommendation Request</CardTitle>
            <Badge>{request.status.charAt(0) + request.status.slice(1).toLowerCase()}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Applicant</p>
              <p className="font-medium">{request.applicant.name ?? request.applicant.email}</p>
              {request.applicant.affiliation && (
                <p className="text-muted-foreground text-xs">{request.applicant.affiliation}</p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground">Recommender</p>
              <p className="font-medium">{request.recommender.name ?? request.recommender.email}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Purpose</p>
              <p className="font-medium capitalize">{request.purpose.toLowerCase()}</p>
            </div>
            {request.deadline && (
              <div>
                <p className="text-muted-foreground">Deadline</p>
                <p className="font-medium">{new Date(request.deadline).toLocaleDateString()}</p>
              </div>
            )}
          </div>

          {request.message && (
            <>
              <Separator />
              <div>
                <p className="text-muted-foreground text-sm mb-1">Personal Note</p>
                <p className="text-sm whitespace-pre-wrap">{request.message}</p>
              </div>
            </>
          )}

          {request.declineMessage && (
            <>
              <Separator />
              <div>
                <p className="text-muted-foreground text-sm mb-1">Decline Reason</p>
                <p className="text-sm">{request.declineMessage}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Actions for recommender */}
      {isRecommender && request.status === "PENDING" && (
        <RequestActions requestId={request.id} />
      )}

      {/* Letter upload for recommender (after accepting) */}
      {isRecommender && request.status === "ACCEPTED" && !request.letter && (
        <UploadLetter requestId={request.id} ferpaWaived={false} />
      )}

      {/* Letter status for applicant */}
      {isApplicant && request.letter && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Letter Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Letter received</p>
                <p className="text-sm text-muted-foreground">
                  {request.letter.visibility === "CONFIDENTIAL"
                    ? "Confidential — you cannot view this letter"
                    : "Open — you can view this letter"}
                </p>
              </div>
              <div className="flex gap-2">
                {request.letter.visibility === "OPEN" && (
                  <LinkButton variant="outline" size="sm" href={`/letters/${request.letter.id}`}>View Letter</LinkButton>
                )}
                <LinkButton size="sm" href="/letters">Manage Letters</LinkButton>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
