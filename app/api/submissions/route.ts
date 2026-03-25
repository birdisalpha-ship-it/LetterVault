import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createAuditEvent } from "@/lib/audit";
import { sendLetterUsedNotification } from "@/lib/email";
import { z } from "zod";

const submitSchema = z.object({
  letterId: z.string(),
  institutionId: z.string(),
});

// POST /api/submissions — submit a letter to an institution
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { letterId, institutionId } = submitSchema.parse(body);

    const letter = await prisma.letter.findUnique({
      where: { id: letterId },
      include: {
        recommender: { select: { name: true, email: true } },
      },
    });

    if (!letter) return NextResponse.json({ error: "Letter not found" }, { status: 404 });
    if (letter.applicantId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Access control checks
    if (letter.revokedAt) {
      return NextResponse.json({ error: "Letter has been revoked" }, { status: 400 });
    }

    const now = new Date();
    if (letter.validFrom && now < letter.validFrom) {
      return NextResponse.json({ error: "Letter is not yet valid" }, { status: 400 });
    }
    if (letter.validUntil && now > letter.validUntil) {
      return NextResponse.json({ error: "Letter has expired" }, { status: 400 });
    }
    if (letter.maxUsage !== null && letter.usageCount >= letter.maxUsage) {
      return NextResponse.json({ error: "Letter usage limit reached" }, { status: 400 });
    }

    const institution = await prisma.institution.findUnique({ where: { id: institutionId } });
    if (!institution) return NextResponse.json({ error: "Institution not found" }, { status: 404 });

    const submission = await prisma.submission.create({
      data: {
        applicantId: session.user.id,
        institutionId,
        letterId,
      },
    });

    // Increment usage count
    await prisma.letter.update({
      where: { id: letterId },
      data: { usageCount: { increment: 1 } },
    });

    await createAuditEvent({
      eventType: "letter_submitted",
      actorId: session.user.id,
      targetId: letterId,
      metadata: { institutionId, submissionId: submission.id },
      ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    });

    // Notify recommender
    try {
      const applicant = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true },
      });
      await sendLetterUsedNotification({
        to: letter.recommender.email!,
        applicantName: applicant?.name ?? "An applicant",
        institutionName: institution.name,
      });
    } catch {
      // non-blocking
    }

    return NextResponse.json(submission, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
