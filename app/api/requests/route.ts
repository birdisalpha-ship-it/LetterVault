import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createAuditEvent } from "@/lib/audit";
import { sendRequestNotification } from "@/lib/email";
import { z } from "zod";
import { Purpose } from "@prisma/client";

const createRequestSchema = z.object({
  recommenderEmail: z.string().email(),
  purpose: z.nativeEnum(Purpose),
  message: z.string().max(1000).optional(),
  deadline: z.string().optional(),
  ferpaWaived: z.boolean(),
});

// GET /api/requests — list requests for the current user
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role") ?? "applicant";

  const where =
    role === "recommender"
      ? { recommenderId: session.user.id }
      : { applicantId: session.user.id };

  const requests = await prisma.recommendationRequest.findMany({
    where,
    include: {
      applicant: { select: { id: true, name: true, email: true, image: true } },
      recommender: { select: { id: true, name: true, email: true, image: true } },
      letter: { select: { id: true, visibility: true, usageType: true, revokedAt: true, ferpaWaived: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
}

// POST /api/requests — create a new recommendation request
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { recommenderEmail, purpose, message, deadline, ferpaWaived } =
      createRequestSchema.parse(body);

    // Find or invite recommender
    let recommender = await prisma.user.findUnique({
      where: { email: recommenderEmail },
    });

    if (!recommender) {
      // Create a placeholder account for the invited recommender
      recommender = await prisma.user.create({
        data: {
          email: recommenderEmail,
          roles: ["RECOMMENDER"],
        },
      });
    }

    if (recommender.id === session.user.id) {
      return NextResponse.json({ error: "You cannot request from yourself" }, { status: 400 });
    }

    const request = await prisma.recommendationRequest.create({
      data: {
        applicantId: session.user.id,
        recommenderId: recommender.id,
        purpose,
        message,
        deadline: deadline ? new Date(deadline) : undefined,
      },
      include: {
        applicant: { select: { name: true } },
        recommender: { select: { name: true, email: true } },
      },
    });

    // Store FERPA waiver decision on a future letter (tracked on request for now)
    // The actual ferpaWaived field is set on the letter when created

    await createAuditEvent({
      eventType: "request_created",
      actorId: session.user.id,
      targetId: request.id,
      metadata: { purpose, ferpaWaived },
      ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    });

    // Send email notification
    try {
      await sendRequestNotification({
        to: recommender.email!,
        applicantName: request.applicant.name ?? "An applicant",
        purpose,
        deadline: request.deadline,
        message,
        requestId: request.id,
      });
    } catch {
      // Email failure should not block request creation
    }

    return NextResponse.json({ ...request, ferpaWaived }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
