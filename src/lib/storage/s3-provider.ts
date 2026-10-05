import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ObjectHead, PresignedUpload, StorageProvider } from "./provider";

let _s3: S3Client | null = null;

/** Same region/credential pattern as s3-attachments.ts: static keys in local
 *  dev, the Amplify compute role's own credentials in prod (no secrets). */
function getS3(): S3Client {
  if (_s3) return _s3;
  const region = process.env.DYNAMO_REGION || process.env.AWS_REGION;
  if (!region) throw new Error("DYNAMO_REGION / AWS_REGION is not set");

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const useStaticKeys = !!accessKeyId && !!secretAccessKey && !process.env.AWS_SESSION_TOKEN;

  _s3 = new S3Client(useStaticKeys ? { region, credentials: { accessKeyId, secretAccessKey } } : { region });
  return _s3;
}

function getBucket(): string {
  const bucket = process.env.S3_ATTACHMENTS_BUCKET;
  if (!bucket) throw new Error("S3_ATTACHMENTS_BUCKET is not set");
  return bucket;
}

export const s3Provider: StorageProvider = {
  async putObject(key, body, contentType) {
    await getS3().send(
      new PutObjectCommand({ Bucket: getBucket(), Key: key, Body: body, ContentType: contentType }),
    );
  },

  async getObject(key) {
    const res = await getS3().send(new GetObjectCommand({ Bucket: getBucket(), Key: key }));
    if (!res.Body) throw new Error(`Empty storage object: ${key}`);
    return {
      body: Buffer.from(await res.Body.transformToByteArray()),
      contentType: res.ContentType,
    };
  },

  async headObject(key): Promise<ObjectHead | null> {
    try {
      const res = await getS3().send(new HeadObjectCommand({ Bucket: getBucket(), Key: key }));
      return { size: res.ContentLength ?? 0, contentType: res.ContentType };
    } catch (e) {
      const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404) return null;
      throw e;
    }
  },

  async presignPut(key, contentType, contentLength, expiresIn = 600): Promise<PresignedUpload> {
    const url = await getSignedUrl(
      getS3(),
      new PutObjectCommand({
        Bucket: getBucket(),
        Key: key,
        ContentType: contentType,
        ContentLength: contentLength,
      }),
      { expiresIn },
    );
    return {
      url,
      method: "PUT",
      headers: { "Content-Type": contentType },
      key,
      expiresIn,
    };
  },

  async presignGet(key, expiresIn = 600) {
    return getSignedUrl(getS3(), new GetObjectCommand({ Bucket: getBucket(), Key: key }), { expiresIn });
  },
};
