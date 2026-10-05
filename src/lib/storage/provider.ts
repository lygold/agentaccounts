/**
 * Storage backend seam. Everything media-related talks to this interface so
 * the S3 implementation can be swapped (e.g. Cloudflare R2, which speaks the
 * S3 API) by configuration. See docs/reference/storage-architecture.md.
 */

export interface PresignedUpload {
  url: string;
  method: "PUT";
  /** Headers the browser must send unchanged — they are part of the signature. */
  headers: Record<string, string>;
  key: string;
  expiresIn: number;
}

export interface ObjectHead {
  size: number;
  contentType?: string;
}

export interface StorageProvider {
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  getObject(key: string): Promise<{ body: Buffer; contentType?: string }>;
  /** null when the object does not exist. */
  headObject(key: string): Promise<ObjectHead | null>;
  presignPut(
    key: string,
    contentType: string,
    contentLength: number,
    expiresIn?: number,
  ): Promise<PresignedUpload>;
  presignGet(key: string, expiresIn?: number): Promise<string>;
}
