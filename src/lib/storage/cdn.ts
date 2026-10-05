import "server-only";
import { getSignedUrl } from "@aws-sdk/cloudfront-signer";

/**
 * CloudFront signed URLs for tenant media (`media/*` only — the distribution's
 * bucket policy never exposes offers/ or attachments/). Env:
 *   CLOUDFRONT_MEDIA_DOMAIN   e.g. d3xfa9lhxiv8i.cloudfront.net
 *   CLOUDFRONT_KEY_PAIR_ID    the CloudFront public key id
 *   CLOUDFRONT_PRIVATE_KEY    its PEM private key (literal `\n` escapes ok,
 *                             same handling as the Drive key) — the one new
 *                             secret in this design; rotate by adding a second
 *                             key to the key group, then switching.
 * Returns null when not configured so callers fall back to storage presigning.
 */

function getPrivateKeyPem(): string | null {
  let raw = process.env.CLOUDFRONT_PRIVATE_KEY;
  if (!raw) return null;
  if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1);
  return raw.replace(/\\n/g, "\n");
}

export function cdnSignedUrl(key: string, expiresInSeconds: number): string | null {
  const domain = process.env.CLOUDFRONT_MEDIA_DOMAIN;
  const keyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID;
  const privateKey = getPrivateKeyPem();
  if (!domain || !keyPairId || !privateKey) return null;
  if (!key.startsWith("media/")) return null;

  return getSignedUrl({
    url: `https://${domain}/${key.split("/").map(encodeURIComponent).join("/")}`,
    keyPairId,
    privateKey,
    dateLessThan: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
  });
}
