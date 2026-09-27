import "server-only";
import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/**
 * Offer PDFs/signatures on S3 — same bucket, private/presigned-read-only
 * model, and client/credential setup as src/lib/s3-attachments.ts (kept
 * separate rather than extended: that module's uploadAttachment is
 * deal-invoice/receipt-specific — "kind" and key shape don't line up).
 * Reads reuse s3-attachments.ts's getAttachmentUrl(s3Key) as-is, it's
 * already generic over any key in the bucket.
 */

let _s3: S3Client | null = null;

function getS3(): S3Client {
  if (_s3) return _s3;
  const region = process.env.DYNAMO_REGION || process.env.AWS_REGION;
  if (!region) throw new Error("DYNAMO_REGION / AWS_REGION is not set");

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const useStaticKeys =
    !!accessKeyId && !!secretAccessKey && !process.env.AWS_SESSION_TOKEN;

  _s3 = new S3Client(
    useStaticKeys ? { region, credentials: { accessKeyId, secretAccessKey } } : { region },
  );
  return _s3;
}

function getBucket(): string {
  const bucket = process.env.S3_ATTACHMENTS_BUCKET;
  if (!bucket) throw new Error("S3_ATTACHMENTS_BUCKET is not set");
  return bucket;
}

export type OfferFileKind = "signature1" | "signature2" | "pdf";

const CONTENT_TYPES: Record<OfferFileKind, string> = {
  signature1: "image/png",
  signature2: "image/png",
  pdf: "application/pdf",
};

const EXTENSIONS: Record<OfferFileKind, string> = {
  signature1: "png",
  signature2: "png",
  pdf: "pdf",
};

export async function uploadOfferFile(
  officeId: string,
  offerId: string,
  kind: OfferFileKind,
  buffer: Buffer,
): Promise<string> {
  const s3Key = `offers/${officeId}/${offerId}/${kind}-${randomUUID()}.${EXTENSIONS[kind]}`;
  await getS3().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: s3Key,
      Body: buffer,
      ContentType: CONTENT_TYPES[kind],
    }),
  );
  return s3Key;
}
