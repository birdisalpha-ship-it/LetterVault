import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET!;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function createUploadPresignedPost(key: string) {
  return createPresignedPost(s3, {
    Bucket: BUCKET,
    Key: key,
    Conditions: [
      ["content-length-range", 1, MAX_FILE_SIZE],
      ["eq", "$Content-Type", "application/pdf"],
    ],
    Fields: { "Content-Type": "application/pdf" },
    Expires: 300, // 5 minutes
  });
}

export async function createDownloadPresignedUrl(key: string, expiresIn = 3600) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn }
  );
}

export async function deleteObject(key: string) {
  return s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export function generateLetterKey(letterId: string) {
  return `letters/${letterId}.pdf`;
}
