import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createUploadPresignedPost, generateLetterKey } from "@/lib/storage";

// POST /api/letters/[id]/upload-url — get a presigned S3 URL for PDF upload
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const key = generateLetterKey(id);

  try {
    const presignedPost = await createUploadPresignedPost(key);
    return NextResponse.json({ ...presignedPost, key });
  } catch {
    return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 });
  }
}
