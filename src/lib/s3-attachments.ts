import "server-only";
import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { AgentLedgerAttachment } from "./types";

let _s3: S3Client | null = null;

/** Same region/credential pattern as store/dynamo-client.ts's getDynamoDoc —
 *  static keys in local dev, the compute role's own credentials on
 *  Amplify/Lambda. Grant that role S3 access on S3_ATTACHMENTS_BUCKET rather
 *  than storing static keys there. */
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

/**
 * Uploads one agent-payout document (invoice/receipt) to
 * S3_ATTACHMENTS_BUCKET and returns the AgentLedgerAttachment record to
 * store on the Deal (and later copy onto the payment_to_agent ledger
 * entry). The bucket is private — files are only ever read back via
 * getAttachmentUrl's short-lived presigned URL, never a public link.
 */
export async function uploadAttachment(
  officeId: string,
  dealId: string,
  kind: "invoice" | "receipt",
  file: File,
  label: string,
): Promise<AgentLedgerAttachment> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const s3Key = `attachments/${officeId}/deals/${dealId}/${kind}/${randomUUID()}-${safeName}`;

  await getS3().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: s3Key,
      Body: buffer,
      ContentType: file.type || "application/octet-stream",
    }),
  );

  return { label, s3Key, uploadedAt: new Date().toISOString() };
}

/** Short-lived (10 min) presigned GET URL — generated fresh on each page
 *  render, never baked into a long-lived link. */
export async function getAttachmentUrl(s3Key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: getBucket(), Key: s3Key });
  return getSignedUrl(getS3(), command, { expiresIn: 600 });
}
