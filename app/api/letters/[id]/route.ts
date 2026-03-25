import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createAuditEvent } from "@/lib/audit";
import { createDownloadPresignedUrl } from "@/lib/storage";

// GET /api/letters/[id] — get letter details + signed download URL
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const letter = await prisma.letter.findUnique({
    where: { id },
    include: {
      recommender: { select: { id: true, name: true, email: true } },
      applicant: { select: { id: true, name: true, email: true } },
    },
  });

  if (!letter) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isRecommender = letter.recommenderId === session.user.id;
  const isApplicant = letter.applicantId === session.user.id;
  const roles = session.user.roles ?? [];
  const isInstitution = roles.includes("INSTITUTION_ADMIN");

  if (!isRecommender && !isApplicant && !isInstitution) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Confidential letters: applicant cannot view content
  const canViewContent =
    isRecommender ||
    isInstitution ||
    (isApplicant && letter.visibility === "OPEN");

  let downloadUrl: string | null = null;

  if (canViewContent && letter.fileKey) {
    downloadUrl = await createDownloadPresignedUrl(letter.fileKey);
    await createAuditEvent({
      eventType: "letter_viewed",
      actorId: session.user.id,
      targetId: id,
      metadata: { role: isRecommender ? "recommender" : isApplicant ? "applicant" : "institution" },
      ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    });
  }

  return NextResponse.json({
    ...letter,
    canViewContent,
    downloadUrl,
    content: canViewContent ? letter.content : null,
  });
}

// PATCH /api/letters/[id] — revoke or update fileKey (recommender only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const letter = await prisma.letter.findUnique({ where: { id } });

  if (!letter) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (letter.recommenderId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  if (body.action === "revoke" || Object.keys(body).length === 0) {
    const updated = await prisma.letter.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    await createAuditEvent({
      eventType: "letter_revoked",
      actorId: session.user.id,
      targetId: id,
      ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    });
    return NextResponse.json(updated);
  }

  if (body.fileKey) {
    const updated = await prisma.letter.update({
      where: { id },
      data: {
        fileKey: body.fileKey,
        fileUrl: `s3://${process.env.AWS_S3_BUCKET}/${body.fileKey}`,
      },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
