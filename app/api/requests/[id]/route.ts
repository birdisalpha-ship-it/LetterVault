import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createAuditEvent } from "@/lib/audit";
import { sendRequestResponseNotification } from "@/lib/email";
import { z } from "zod";

const respondSchema = z.object({
  action: z.enum(["accept", "decline"]),
  declineMessage: z.string().max(500).optional(),
});

// GET /api/requests/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const request = await prisma.recommendationRequest.findUnique({
    where: { id },
    include: {
      applicant: { select: { id: true, name: true, email: true, image: true, affiliation: true } },
      recommender: { select: { id: true, name: true, email: true, image: true } },
      letter: true,
    },
  });

  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (
    request.applicantId !== session.user.id &&
    request.recommenderId !== session.user.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(request);
}

// PATCH /api/requests/[id] — accept or decline
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const request = await prisma.recommendationRequest.findUnique({
    where: { id },
    include: {
      applicant: { select: { name: true, email: true } },
      recommender: { select: { name: true } },
    },
  });

  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (request.recommenderId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (request.status !== "PENDING") {
    return NextResponse.json({ error: "Request is not pending" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { action, declineMessage } = respondSchema.parse(body);

    const updated = await prisma.recommendationRequest.update({
      where: { id },
      data: {
        status: action === "accept" ? "ACCEPTED" : "DECLINED",
        declineMessage: action === "decline" ? declineMessage : null,
        respondedAt: new Date(),
      },
    });

    await createAuditEvent({
      eventType: action === "accept" ? "request_accepted" : "request_declined",
      actorId: session.user.id,
      targetId: id,
      ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    });

    try {
      await sendRequestResponseNotification({
        to: request.applicant.email!,
        recommenderName: request.recommender.name ?? "Your recommender",
        accepted: action === "accept",
        requestId: id,
      });
    } catch {
      // non-blocking
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/requests/[id] — cancel (applicant only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const request = await prisma.recommendationRequest.findUnique({ where: { id } });

  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (request.applicantId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.recommendationRequest.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  await createAuditEvent({
    eventType: "request_cancelled",
    actorId: session.user.id,
    targetId: id,
  });

  return NextResponse.json({ success: true });
}
