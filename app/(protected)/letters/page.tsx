import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from "@/lib/utils";
import { RevokeButton } from "@/components/letters/revoke-button";
import { SubmitLetterButton } from "@/components/letters/submit-letter-button";

export default async function LettersPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [myLetters, writtenLetters, institutions] = await Promise.all([
    prisma.letter.findMany({
      where: { applicantId: userId },
      include: {
        recommender: { select: { name: true, email: true } },
        submissions: {
          include: { institution: { select: { name: true } } },
          orderBy: { submittedAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.letter.findMany({
      where: { recommenderId: userId },
      include: {
        applicant: { select: { name: true, email: true } },
        submissions: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.institutionMember.findMany({
      where: { userId },
      include: { institution: { select: { id: true, name: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Letters</h1>

      <Tabs defaultValue="received">
        <TabsList>
          <TabsTrigger value="received">Received ({myLetters.length})</TabsTrigger>
          <TabsTrigger value="written">Written ({writtenLetters.length})</TabsTrigger>
        </TabsList>

        {/* Letters I received */}
        <TabsContent value="received" className="space-y-3 mt-4">
          {myLetters.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12 text-muted-foreground">
                No letters yet.{" "}
                <Link href="/requests/new" className="text-primary hover:underline">
                  Request one
                </Link>
              </CardContent>
            </Card>
          ) : (
            myLetters.map((letter) => {
              const isExpired =
                letter.revokedAt !== null ||
                (letter.usageType === "ONE_TIME" && letter.usageCount >= (letter.maxUsage ?? 1)) ||
                (letter.validUntil && new Date() > letter.validUntil);

              return (
                <Card key={letter.id} className={isExpired ? "opacity-60" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        From {letter.recommender.name ?? letter.recommender.email}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {letter.revokedAt && <Badge variant="destructive">Revoked</Badge>}
                        <Badge variant={letter.visibility === "CONFIDENTIAL" ? "secondary" : "outline"}>
                          {letter.visibility === "CONFIDENTIAL" ? "Confidential" : "Open"}
                        </Badge>
                        <Badge variant="outline">
                          {letter.usageType === "ONE_TIME"
                            ? "One-time"
                            : letter.usageType === "TIME_LIMITED"
                            ? "Time-limited"
                            : "Ongoing"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Received {formatDistanceToNow(letter.createdAt)} ago</span>
                      <span>Used {letter.usageCount} time{letter.usageCount !== 1 ? "s" : ""}</span>
                      {letter.validUntil && (
                        <span>Expires {new Date(letter.validUntil).toLocaleDateString()}</span>
                      )}
                      {letter.ferpaWaived && (
                        <Badge variant="secondary" className="text-xs">FERPA Waived</Badge>
                      )}
                    </div>

                    {/* Submission history */}
                    {letter.submissions.length > 0 && (
                      <div className="text-sm">
                        <p className="text-muted-foreground mb-1">Submitted to:</p>
                        <div className="flex flex-wrap gap-2">
                          {letter.submissions.map((sub) => (
                            <Badge key={sub.id} variant="outline">
                              {sub.institution.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {letter.visibility === "OPEN" && !letter.revokedAt && (
                        <LinkButton size="sm" variant="outline" href={`/letters/${letter.id}`}>View</LinkButton>
                      )}
                      {!isExpired && institutions.length > 0 && (
                        <SubmitLetterButton
                          letterId={letter.id}
                          institutions={institutions.map((m) => m.institution)}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* Letters I wrote */}
        <TabsContent value="written" className="space-y-3 mt-4">
          {writtenLetters.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12 text-muted-foreground">
                You haven&apos;t written any letters yet.
              </CardContent>
            </Card>
          ) : (
            writtenLetters.map((letter) => (
              <Card key={letter.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      For {letter.applicant.name ?? letter.applicant.email}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {letter.revokedAt && <Badge variant="destructive">Revoked</Badge>}
                      <Badge variant={letter.visibility === "CONFIDENTIAL" ? "secondary" : "outline"}>
                        {letter.visibility === "CONFIDENTIAL" ? "Confidential" : "Open"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Written {formatDistanceToNow(letter.createdAt)} ago</span>
                    <span>Submitted {letter.submissions.length} time{letter.submissions.length !== 1 ? "s" : ""}</span>
                  </div>
                  {!letter.revokedAt && (
                    <RevokeButton letterId={letter.id} />
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
