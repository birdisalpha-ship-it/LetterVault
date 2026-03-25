import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export type AuditEventType =
  | "user_registered"
  | "user_login"
  | "request_created"
  | "request_accepted"
  | "request_declined"
  | "request_cancelled"
  | "letter_uploaded"
  | "letter_viewed"
  | "letter_submitted"
  | "letter_revoked"
  | "letter_access_checked"
  | "waiver_signed"
  | "submission_created"
  | "submission_viewed"
  | "institution_created";

export async function createAuditEvent({
  eventType,
  actorId,
  targetId,
  metadata = {},
  ipAddress,
}: {
  eventType: AuditEventType;
  actorId: string;
  targetId: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
}) {
  return prisma.auditEvent.create({
    data: {
      eventType,
      actorId,
      targetId,
      metadata,
      ipAddress,
    },
  });
}
