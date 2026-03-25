import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from "@/lib/utils";
import { InstitutionActions } from "@/components/dashboard/institution-actions";

export default async function InstitutionInboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const session = await auth();
  const { slug } = await params;
  const { search, status } = await searchParams;

  const institution = await prisma.institution.findUnique({
    where: { inboxSlug: slug },
    include: { members: { select: { userId: true } } },
  });

  if (!institution) notFound();

  const isMember = institution.members.some((m) => m.userId === session!.user.id);
  if (!isMember) notFound();

  const submissions = await prisma.submission.findMany({
    where: {
      institutionId: institution.id,
      ...(status ? { status: status as "DELIVERED" | "VIEWED" | "ARCHIVED" } : {}),
      ...(search
        ? {
            applicant: {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    include: {
      applicant: { select: { id: true, name: true, email: true, image: true } },
      letter: {
        include: {
          recommender: { select: { name: true } },
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  const statusCounts = await prisma.submission.groupBy({
    by: ["status"],
    where: { institutionId: institution.id },
    _count: true,
  });

  const counts = Object.fromEntries(statusCounts.map((s) => [s.status, s._count]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{institution.name}</h1>
        <p className="text-muted-foreground mt-1">
          Application inbox · <code className="text-xs bg-muted px-1 py-0.5 rounded">{institution.inboxSlug}</code>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{counts["DELIVERED"] ?? 0}</div>
            <p className="text-xs text-muted-foreground">Unreviewed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{counts["VIEWED"] ?? 0}</div>
            <p className="text-xs text-muted-foreground">Viewed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{counts["ARCHIVED"] ?? 0}</div>
            <p className="text-xs text-muted-foreground">Archived</p>
          </CardContent>
        </Card>
      </div>

      {/* Inbox */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              No submissions yet.
            </p>
          ) : (
            <div className="space-y-3">
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between py-3 border-b last:border-0"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {sub.applicant.name ?? sub.applicant.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Letter from {sub.letter.recommender.name} · Submitted{" "}
                      {formatDistanceToNow(sub.submittedAt)} ago
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        sub.status === "DELIVERED"
                          ? "default"
                          : sub.status === "VIEWED"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {sub.status === "DELIVERED"
                        ? "New"
                        : sub.status === "VIEWED"
                        ? "Viewed"
                        : "Archived"}
                    </Badge>
                    <InstitutionActions
                      submissionId={sub.id}
                      slug={slug}
                      hasFile={!!sub.letter.fileKey}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
