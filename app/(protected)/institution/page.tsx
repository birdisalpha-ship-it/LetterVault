import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function InstitutionPage() {
  const session = await auth();
  const userId = session!.user.id;

  const memberships = await prisma.institutionMember.findMany({
    where: { userId },
    include: {
      institution: {
        include: {
          _count: { select: { submissions: true } },
        },
      },
    },
  });

  if (memberships.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Institution Dashboard</h1>
        <Card>
          <CardContent className="text-center py-16">
            <h2 className="text-lg font-semibold mb-2">No institution yet</h2>
            <p className="text-muted-foreground mb-6">
              Set up your institution to start receiving letters of recommendation.
            </p>
            <LinkButton href="/institution/new">Set Up Institution</LinkButton>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Institution Dashboard</h1>
        <LinkButton href="/institution/new">Add Institution</LinkButton>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {memberships.map(({ institution }) => (
          <Card key={institution.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{institution.name}</CardTitle>
                <div className="flex items-center gap-2">
                  {institution.verified && <Badge variant="default">Verified</Badge>}
                  <Badge variant="outline" className="capitalize">
                    {institution.type.toLowerCase()}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total submissions</span>
                <span className="font-medium">{institution._count.submissions}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Inbox slug</span>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{institution.inboxSlug}</code>
              </div>
              <LinkButton className="w-full" href={`/institution/${institution.inboxSlug}`}>View Inbox</LinkButton>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
