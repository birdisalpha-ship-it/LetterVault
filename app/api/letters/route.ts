import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createAuditEvent } from "@/lib/audit";
import { sendLetterReadyNotification } from "@/lib/email";
import { z } from "zod";
import { Visibility, UsageType } from "@prisma/client";

const createLetterSchema = z.object({
  requestId: z.string(),
  fileKey: z.string().optional(),
  content: z.string().optional(),
  visibility: z.nativeEnum(Visibility),
  usageType: z.nativeEnum(UsageType),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  maxUsage: z.number().int().positive().optional(),
  ferpaWaived: z.boolean().default(false),
});

// GET /api/letters — list letters for the current user
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role") ?? "applicant";

  const where =
    role === "recommender"
      ? { recommenderId: session.user.id }
      : { applicantId: session.user.id };

  const letters = await prisma.letter.findMany({
    where,
    include: {
      recommender: { select: { id: true, name: true, email: true, image: true } },
      applicant: { select: { id: true, name: true, email: true, image: true } },
      submissions: { select: { id: true, institutionId: true, submittedAt: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(letters);
}

// POST /api/letters — upload/create a letter (recommender only)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      requestId,
      fileKey,
      content,
      visibility,
      usageType,
      validFrom,
      validUntil,
      maxUsage,
      ferpaWaived,
    } = createLetterSchema.parse(body);

    const request = await prisma.recommendationRequest.findUnique({
      where: { id: requestId },
      include: { applicant: { select: { name: true, email: true } } },
    });

    if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    if (request.recommenderId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (request.status !== "ACCEPTED") {
      return NextResponse.json({ error: "Request must be accepted first" }, { status: 400 });
    }

    const letter = await prisma.letter.create({
      data: {
        recommenderId: session.user.id,
        applicantId: request.applicantId,
        ...(fileKey ? { fileKey, fileUrl: `s3://${process.env.AWS_S3_BUCKET}/${fileKey}` } : {}),
        ...(content ? { content } : {}),
        visibility,
        usageType,
        validFrom: validFrom ? new Date(validFrom) : null,
        validUntil: validUntil ? new Date(validUntil) : null,
        maxUsage: usageType === "ONE_TIME" ? 1 : (maxUsage ?? null),
        ferpaWaived,
      },
    });

    // Link letter to request and mark as completed
    await prisma.recommendationRequest.update({
      where: { id: requestId },
      data: { letterId: letter.id, status: "COMPLETED" },
    });

    await createAuditEvent({
      eventType: "letter_uploaded",
      actorId: session.user.id,
      targetId: letter.id,
      metadata: { requestId, visibility, usageType, ferpaWaived },
      ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    });

    try {
      await sendLetterReadyNotification({
        to: request.applicant.email!,
        recommenderName: (await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true } }))?.name ?? "Your recommender",
      });
    } catch {
      // non-blocking
    }

    return NextResponse.json(letter, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
