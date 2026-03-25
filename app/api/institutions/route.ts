import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createAuditEvent } from "@/lib/audit";
import { z } from "zod";
import { InstitutionType } from "@prisma/client";

const createInstitutionSchema = z.object({
  name: z.string().min(2),
  type: z.nativeEnum(InstitutionType),
  website: z.string().url().optional(),
  inboxSlug: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const members = await prisma.institutionMember.findMany({
    where: { userId: session.user.id },
    include: {
      institution: {
        include: {
          submissions: {
            include: {
              applicant: { select: { name: true, email: true } },
              letter: {
                include: {
                  recommender: { select: { name: true } },
                },
              },
            },
            orderBy: { submittedAt: "desc" },
          },
        },
      },
    },
  });

  return NextResponse.json(members.map((m) => m.institution));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, type, website, inboxSlug } = createInstitutionSchema.parse(body);

    const existing = await prisma.institution.findUnique({ where: { inboxSlug } });
    if (existing) {
      return NextResponse.json({ error: "Inbox slug is already taken" }, { status: 400 });
    }

    const institution = await prisma.institution.create({
      data: {
        name,
        type,
        website,
        inboxSlug,
        members: {
          create: { userId: session.user.id },
        },
      },
    });

    // Add INSTITUTION_ADMIN role to user if not already set
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (user && !user.roles.includes("INSTITUTION_ADMIN")) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { roles: { push: "INSTITUTION_ADMIN" } },
      });
    }

    await createAuditEvent({
      eventType: "institution_created",
      actorId: session.user.id,
      targetId: institution.id,
      metadata: { name, type },
      ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    });

    return NextResponse.json(institution, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
