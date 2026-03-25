import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Nav } from "@/components/dashboard/nav";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  return (
    <div className="min-h-screen bg-muted/20">
      <Nav user={session.user} />
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
