import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "@/lib/utils";

const roleLabels: Record<string, string> = {
  APPLICANT: "Applicant",
  RECOMMENDER: "Recommender",
  INSTITUTION_ADMIN: "Institution Admin",
};

export default async function SettingsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      roles: true,
      title: true,
      affiliation: true,
      createdAt: true,
      emailVerified: true,
      _count: {
        select: {
          sentRequests: true,
          writtenLetters: true,
          applicantLetters: true,
        },
      },
    },
  });

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences.</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your account information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarImage src={user.image ?? undefined} />
              <AvatarFallback className="text-lg">
                {user.name?.slice(0, 2).toUpperCase() ?? "LV"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-lg">{user.name ?? "—"}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4 text-sm">
            {user.title && (
              <div>
                <p className="text-muted-foreground">Title</p>
                <p className="font-medium">{user.title}</p>
              </div>
            )}
            {user.affiliation && (
              <div>
                <p className="text-muted-foreground">Affiliation</p>
                <p className="font-medium">{user.affiliation}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Member since</p>
              <p className="font-medium">{formatDistanceToNow(user.createdAt)} ago</p>
            </div>
            <div>
              <p className="text-muted-foreground">Email verified</p>
              <p className="font-medium">
                {user.emailVerified ? "Yes" : "Not verified"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Roles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Roles</CardTitle>
          <CardDescription>
            Your active roles on LetterVault. Roles are granted automatically when you
            perform actions (e.g., creating an institution grants Institution Admin).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {user.roles.map((role) => (
              <Badge key={role} variant="secondary">
                {roleLabels[role] ?? role}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Activity summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <p className="text-2xl font-bold">{user._count.sentRequests}</p>
              <p className="text-muted-foreground">Requests sent</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{user._count.applicantLetters}</p>
              <p className="text-muted-foreground">Letters received</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{user._count.writtenLetters}</p>
              <p className="text-muted-foreground">Letters written</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
