import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LinkButton } from "@/components/ui/link-button";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-lg">LetterVault</span>
          <div className="flex items-center gap-3">
            <LinkButton variant="ghost" href="/auth/login">Sign in</LinkButton>
            <LinkButton href="/auth/register">Get started</LinkButton>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24">
        <div className="max-w-2xl space-y-6">
          <h1 className="text-5xl font-bold tracking-tight">
            Letters of Recommendation,{" "}
            <span className="text-primary">Simplified</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            Write once. Control distribution. LetterVault is the secure hub for
            applicants, recommenders, and institutions.
          </p>
          <div className="flex items-center justify-center gap-4">
            <LinkButton size="lg" href="/auth/register">Get started for free</LinkButton>
            <LinkButton size="lg" variant="outline" href="/auth/login">Sign in</LinkButton>
          </div>
        </div>

        {/* Features */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl w-full text-left">
          {[
            {
              title: "For Applicants",
              desc: "One hub for all your letters. Attach to any application instantly without re-asking your recommenders.",
            },
            {
              title: "For Recommenders",
              desc: "Write once, control access. Set expiry, usage limits, and visibility. Revoke at any time.",
            },
            {
              title: "For Institutions",
              desc: "Verified, structured inboxes. No more email PDFs. Full audit trail for FERPA compliance.",
            },
          ].map((f) => (
            <div key={f.title} className="space-y-2">
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
