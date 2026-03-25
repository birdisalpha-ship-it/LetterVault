import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { formatDistanceToNow } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const userId = session.user.id;

  const [pendingRequests, letters, receivedRequests] = await Promise.all([
    prisma.recommendationRequest.findMany({
      where: { applicantId: userId, status: "PENDING" },
      include: { recommender: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.letter.findMany({
      where: { applicantId: userId, revokedAt: null },
      include: { recommender: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.recommendationRequest.findMany({
      where: { recommenderId: userId, status: "PENDING" },
      include: { applicant: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const stats = {
    activeLetters: letters.length,
    pendingOutgoing: pendingRequests.length,
    pendingIncoming: receivedRequests.length,
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {session.user.name?.split(" ")[0]}</h1>
        <p className="text-muted-foreground mt-1">Here&apos;s what&apos;s happening with your letters.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Letters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.activeLetters}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Requests (Sent)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.pendingOutgoing}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Requests to Answer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.pendingIncoming}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Letters */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Your Letters</CardTitle>
            <LinkButton variant="ghost" size="sm" href="/letters">View all</LinkButton>
          </CardHeader>
          <CardContent>
            {letters.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No letters yet.{" "}
                <Link href="/requests/new" className="text-primary hover:underline">
                  Request one
                </Link>
              </p>
            ) : (
              <div className="space-y-3">
                {letters.map((letter) => (
                  <div key={letter.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{letter.recommender.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(letter.createdAt)} ago
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={letter.visibility === "CONFIDENTIAL" ? "secondary" : "outline"}>
                        {letter.visibility === "CONFIDENTIAL" ? "Confidential" : "Open"}
                      </Badge>
                      <LetterStatusBadge letter={letter} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Requests */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Pending Requests</CardTitle>
            <LinkButton variant="ghost" size="sm" href="/requests">View all</LinkButton>
          </CardHeader>
          <CardContent>
            {pendingRequests.length === 0 && receivedRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No pending requests.{" "}
                <Link href="/requests/new" className="text-primary hover:underline">
                  Make a request
                </Link>
              </p>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">To: {req.recommender.name ?? "Invited"}</p>
                      <p className="text-xs text-muted-foreground capitalize">{req.purpose.toLowerCase()}</p>
                    </div>
                    <Badge variant="outline">Pending</Badge>
                  </div>
                ))}
                {receivedRequests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">From: {req.applicant.name ?? "Applicant"}</p>
                      <p className="text-xs text-muted-foreground">Awaiting your response</p>
                    </div>
                    <LinkButton size="sm" variant="outline" href={`/requests/${req.id}`}>Respond</LinkButton>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <LinkButton href="/requests/new">Request a Letter</LinkButton>
          <LinkButton variant="outline" href="/letters">Manage Letters</LinkButton>
          <LinkButton variant="outline" href="/institution/new">Set Up Institution</LinkButton>
        </CardContent>
      </Card>
    </div>
  );
}

function LetterStatusBadge({ letter }: { letter: { usageType: string; usageCount: number; maxUsage: number | null; validUntil: Date | null } }) {
  if (letter.usageType === "ONE_TIME") {
    return (
      <Badge variant={letter.usageCount > 0 ? "secondary" : "default"}>
        {letter.usageCount > 0 ? "Used" : "One-time"}
      </Badge>
    );
  }
  if (letter.usageType === "TIME_LIMITED" && letter.validUntil) {
    const expired = new Date() > letter.validUntil;
    return <Badge variant={expired ? "destructive" : "default"}>{expired ? "Expired" : "Active"}</Badge>;
  }
  return <Badge variant="default">Active</Badge>;
}
