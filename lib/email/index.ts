import { Resend } from "resend";

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = process.env.EMAIL_FROM ?? "noreply@lettervault.com";

export async function sendRequestNotification({
  to,
  applicantName,
  purpose,
  deadline,
  message,
  requestId,
}: {
  to: string;
  applicantName: string;
  purpose: string;
  deadline?: Date | null;
  message?: string | null;
  requestId: string;
}) {
  const resend = getResend();
  if (!resend) return;

  const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";
  const actionUrl = `${baseUrl}/requests/${requestId}`;

  return resend.emails.send({
    from: FROM,
    to,
    subject: `${applicantName} has requested a letter of recommendation`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Letter of Recommendation Request</h2>
        <p><strong>${applicantName}</strong> has requested a letter of recommendation from you.</p>
        <p><strong>Purpose:</strong> ${purpose}</p>
        ${deadline ? `<p><strong>Deadline:</strong> ${new Date(deadline).toLocaleDateString()}</p>` : ""}
        ${message ? `<p><strong>Personal note:</strong> ${message}</p>` : ""}
        <a href="${actionUrl}" style="display:inline-block;padding:12px 24px;background:#0f172a;color:white;border-radius:6px;text-decoration:none;margin-top:16px;">
          View Request
        </a>
        <p style="color:#888;margin-top:24px;font-size:12px;">
          You can accept or decline this request in LetterVault.
        </p>
      </div>
    `,
  });
}

export async function sendRequestResponseNotification({
  to,
  recommenderName,
  accepted,
  requestId,
}: {
  to: string;
  recommenderName: string;
  accepted: boolean;
  requestId: string;
}) {
  const resend = getResend();
  if (!resend) return;

  const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";
  return resend.emails.send({
    from: FROM,
    to,
    subject: `${recommenderName} has ${accepted ? "accepted" : "declined"} your request`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Request ${accepted ? "Accepted" : "Declined"}</h2>
        <p><strong>${recommenderName}</strong> has ${accepted ? "accepted" : "declined"} your letter of recommendation request.</p>
        <a href="${baseUrl}/dashboard" style="display:inline-block;padding:12px 24px;background:#0f172a;color:white;border-radius:6px;text-decoration:none;margin-top:16px;">
          View Dashboard
        </a>
      </div>
    `,
  });
}

export async function sendLetterReadyNotification({
  to,
  recommenderName,
}: {
  to: string;
  recommenderName: string;
}) {
  const resend = getResend();
  if (!resend) return;

  const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";
  return resend.emails.send({
    from: FROM,
    to,
    subject: `Your letter of recommendation from ${recommenderName} is ready`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Letter Ready</h2>
        <p><strong>${recommenderName}</strong> has uploaded your letter of recommendation.</p>
        <a href="${baseUrl}/dashboard" style="display:inline-block;padding:12px 24px;background:#0f172a;color:white;border-radius:6px;text-decoration:none;margin-top:16px;">
          View in Dashboard
        </a>
      </div>
    `,
  });
}

export async function sendLetterUsedNotification({
  to,
  applicantName,
  institutionName,
}: {
  to: string;
  applicantName: string;
  institutionName: string;
}) {
  const resend = getResend();
  if (!resend) return;

  return resend.emails.send({
    from: FROM,
    to,
    subject: `Your letter was submitted for ${applicantName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Letter Submitted</h2>
        <p>Your letter of recommendation for <strong>${applicantName}</strong> was submitted to <strong>${institutionName}</strong>.</p>
      </div>
    `,
  });
}
