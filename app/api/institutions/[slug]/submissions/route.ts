import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createAuditEvent } from "@/lib/audit";
import { createDownloadPresignedUrl } from "@/lib/storage";
import { z } from "zod";

// GET /api/institutions/[slug]/submissions — institution inbox
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const institution = await prisma.institution.findUnique({
    where: { inboxSlug: slug },
    include: { members: { select: { userId: true } } },
  });

  if (!institution) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isMember = institution.members.some((m) => m.userId === session.user.id);
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status");

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
          recommender: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  return NextResponse.json(submissions);
}

// PATCH /api/institutions/[slug]/submissions/[submissionId] — update status or view letter
const patchSchema = z.object({
  submissionId: z.string(),
  action: z.enum(["view", "archive", "mark_in_review", "mark_decided"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const institution = await prisma.institution.findUnique({
    where: { inboxSlug: slug },
    include: { members: { select: { userId: true } } },
  });

  if (!institution) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isMember = institution.members.some((m) => m.userId === session.user.id);
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const { submissionId, action } = patchSchema.parse(body);

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { letter: true },
    });

    if (!submission || submission.institutionId !== institution.id) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    let downloadUrl: string | null = null;

    if (action === "view") {
      await prisma.submission.update({
        where: { id: submissionId },
        data: { viewedAt: new Date(), status: "VIEWED" },
      });

      if (submission.letter.fileKey) {
        downloadUrl = await createDownloadPresignedUrl(submission.letter.fileKey);
      }

      await createAuditEvent({
        eventType: "submission_viewed",
        actorId: session.user.id,
        targetId: submissionId,
        metadata: { institutionId: institution.id },
        ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
      });
    } else if (action === "archive") {
      await prisma.submission.update({
        where: { id: submissionId },
        data: { status: "ARCHIVED" },
      });
    }

    return NextResponse.json({ success: true, downloadUrl });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
