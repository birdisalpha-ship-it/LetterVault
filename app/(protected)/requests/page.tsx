import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from "@/lib/utils";

const statusColor: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  ACCEPTED: "default",
  DECLINED: "destructive",
  COMPLETED: "secondary",
  CANCELLED: "secondary",
};

export default async function RequestsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [sentRequests, receivedRequests] = await Promise.all([
    prisma.recommendationRequest.findMany({
      where: { applicantId: userId },
      include: {
        recommender: { select: { id: true, name: true, email: true, image: true } },
        letter: { select: { id: true, visibility: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.recommendationRequest.findMany({
      where: { recommenderId: userId },
      include: {
        applicant: { select: { id: true, name: true, email: true, image: true, affiliation: true } },
        letter: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Requests</h1>
        <LinkButton href="/requests/new">New Request</LinkButton>
      </div>

      <Tabs defaultValue="sent">
        <TabsList>
          <TabsTrigger value="sent">Sent ({sentRequests.length})</TabsTrigger>
          <TabsTrigger value="received">Received ({receivedRequests.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="sent" className="space-y-3 mt-4">
          {sentRequests.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12 text-muted-foreground">
                No requests sent yet.{" "}
                <Link href="/requests/new" className="text-primary hover:underline">
                  Request a letter
                </Link>
              </CardContent>
            </Card>
          ) : (
            sentRequests.map((req) => (
              <Card key={req.id}>
                <CardContent className="py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{req.recommender.name ?? req.recommender.email}</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {req.purpose.toLowerCase()} · {formatDistanceToNow(req.createdAt)} ago
                    </p>
                    {req.deadline && (
                      <p className="text-xs text-muted-foreground">
                        Due {new Date(req.deadline).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusColor[req.status] ?? "outline"}>
                      {req.status.charAt(0) + req.status.slice(1).toLowerCase()}
                    </Badge>
                    <LinkButton size="sm" variant="ghost" href={`/requests/${req.id}`}>View</LinkButton>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="received" className="space-y-3 mt-4">
          {receivedRequests.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12 text-muted-foreground">
                No requests received yet.
              </CardContent>
            </Card>
          ) : (
            receivedRequests.map((req) => (
              <Card key={req.id}>
                <CardContent className="py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{req.applicant.name ?? req.applicant.email}</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {req.purpose.toLowerCase()} · {formatDistanceToNow(req.createdAt)} ago
                    </p>
                    {req.applicant.affiliation && (
                      <p className="text-xs text-muted-foreground">{req.applicant.affiliation}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusColor[req.status] ?? "outline"}>
                      {req.status.charAt(0) + req.status.slice(1).toLowerCase()}
                    </Badge>
                    <LinkButton size="sm" variant={req.status === "PENDING" ? "default" : "ghost"} href={`/requests/${req.id}`}>
                      {req.status === "PENDING" ? "Respond" : "View"}
                    </LinkButton>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
