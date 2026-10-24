// App Store Server JWS (StoreKit 2 `Transaction.jwsRepresentation`) trust checks, WebCrypto-only so
// it runs on Cloudflare Workers. Mirrors Apple's app-store-server-library verification: ES256 over
// the JWS, x5c chain leaf -> WWDR intermediate -> Apple Root CA - G3 (pinned by SHA-256 of its DER),
// every cert valid at the payload's signedDate, Apple marker OIDs, then payload guards. No
// revocation lookup: the JWS revocationDate is the signal.

export const APPLE_ROOT_CA_G3_SHA256 =
  "63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179";
export const APPLE_BUNDLE_ID = "dat.waqtu.ios";
/** Auto-renewable subscriptions in the "Waqtu Premium" group. */
export const APPLE_PRODUCT_IDS = ["dat.waqtu.premium.monthly", "dat.waqtu.premium.yearly"] as const;

// 1.2.840.113635.100.6.2.1 marks Apple WWDR intermediates, 1.2.840.113635.100.6.11.1
// marks the App Store signing certificate (same OIDs Apple's own verifier checks).
const APPLE_WWDR_OID = "1.2.840.113635.100.6.2.1";
const APPLE_APP_STORE_LEAF_OID = "1.2.840.113635.100.6.11.1";
// Apple's chain: leaf is P-256, but WWDR G6 and Root CA - G3 are P-384 and
// sign with ecdsa-with-SHA384, so both hash and curve must come per cert.
const ECDSA_WITH_SHA256_OID = "1.2.840.10045.4.3.2";
const ECDSA_WITH_SHA384_OID = "1.2.840.10045.4.3.3";
const EC_PUBLIC_KEY_OID = "1.2.840.10045.2.1";
const P256_OID = "1.2.840.10045.3.1.7";
const P384_OID = "1.3.132.0.34";

type HashName = "SHA-256" | "SHA-384";
type CurveName = "P-256" | "P-384";

const SIG_ALGS: Record<string, { hash: HashName; byteSize: number }> = {
  [ECDSA_WITH_SHA256_OID]: { hash: "SHA-256", byteSize: 32 },
  [ECDSA_WITH_SHA384_OID]: { hash: "SHA-384", byteSize: 48 },
};
const CURVES: Record<string, CurveName> = {
  [P256_OID]: "P-256",
  [P384_OID]: "P-384",
};

export type AppleVerifyOptions = {
  /** SHA-256 (hex, colons tolerated) of the trusted root cert's DER. Tests pin their own root. */
  rootSha256: string;
  bundleId: string;
  /** Any of these product ids is accepted. */
  productIds: readonly string[];
  /**
   * Accept a transaction Apple revoked (refund, family-sharing removal). Purchases submitted by the
   * app never are; REFUND/REVOKE notifications must be.
   */
  allowRevoked?: boolean;
  /** App Store numeric app id (APPLE_APP_ID); when set, Production notifications must carry it. */
  appAppleId?: number;
};

export interface AppleTransaction {
  transactionId: string;
  productId: string;
  environment: "Sandbox" | "Production";
  signedDate: Date;
  /** Stable across every renewal of one subscription; equals transactionId on the first purchase. */
  originalTransactionId: string;
  /** End of the paid period; null for non-renewing purchases. */
  expiresDate: Date | null;
  /** Set when Apple refunded or revoked this transaction. */
  revocationDate: Date | null;
  /** The UUID the app passed at purchase (see appleAccountToken); null on legacy purchases. */
  appAccountToken: string | null;
}

export type FailureReason =
  | "format"
  | "algorithm"
  | "chain"
  | "root"
  | "signature"
  | "oid"
  | "validity"
  | "payload"
  | "bundle"
  | "product"
  | "revoked"
  | "environment";

export type AppleVerification =
  | { ok: true; transaction: AppleTransaction }
  | { ok: false; reason: FailureReason };

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const str = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const finite = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

export async function verifyAppleTransactionJws(
  jws: string,
  opts: AppleVerifyOptions,
): Promise<AppleVerification> {
  try {
    return await verify(jws, opts);
  } catch {
    return { ok: false, reason: "format" };
  }
}

async function verify(jws: string, opts: AppleVerifyOptions): Promise<AppleVerification> {
  const chain = await verifyChain(jws, opts.rootSha256);
  if (!chain.ok) return chain;

  const payload = chain.payload;
  const transactionId = str(payload.transactionId);
  const bundleId = str(payload.bundleId);
  const productId = str(payload.productId);
  const environment = payload.environment;
  if (!transactionId || bundleId === undefined || productId === undefined) {
    return { ok: false, reason: "payload" };
  }
  if (bundleId !== opts.bundleId) return { ok: false, reason: "bundle" };
  if (!opts.productIds.includes(productId)) return { ok: false, reason: "product" };
  const revocation = finite(payload.revocationDate);
  if (revocation !== undefined && !opts.allowRevoked) return { ok: false, reason: "revoked" };
  if (environment !== "Sandbox" && environment !== "Production") {
    return { ok: false, reason: "environment" };
  }
  const expires = finite(payload.expiresDate);

  return {
    ok: true,
    transaction: {
      transactionId,
      productId,
      environment,
      signedDate: chain.signedDate,
      originalTransactionId: str(payload.originalTransactionId) ?? transactionId,
      expiresDate: expires !== undefined ? new Date(expires) : null,
      revocationDate: revocation !== undefined ? new Date(revocation) : null,
      appAccountToken: str(payload.appAccountToken) ?? null,
    },
  };
}

type ChainResult =
  | { ok: true; payload: JsonObject; signedDate: Date }
  | { ok: false; reason: FailureReason };

/**
 * Trust check shared by every Apple-signed JWS (transactions, renewal info, server notifications):
 * ES256 signature, x5c chain to the pinned root, Apple marker OIDs, certificate validity at
 * signedDate. Returns the raw payload.
 */
async function verifyChain(jws: string, rootSha256: string): Promise<ChainResult> {
  const parts = jws.split(".");
  if (parts.length !== 3) return { ok: false, reason: "format" };
  const [headB64, payloadB64, sigB64] = parts as [string, string, string];

  const header = parseJson(b64urlDecode(headB64));
  if (!isObject(header)) return { ok: false, reason: "format" };
  if (typeof header.alg !== "string") return { ok: false, reason: "algorithm" };
  const x5c = header.x5c;
  if (!Array.isArray(x5c) || !x5c.every((cert) => typeof cert === "string")) {
    return { ok: false, reason: "chain" };
  }
  if (header.alg !== "ES256") return { ok: false, reason: "algorithm" };
  if (x5c.length !== 3) return { ok: false, reason: "chain" };

  let leaf: ParsedCert;
  let intermediate: ParsedCert;
  let root: ParsedCert;
  try {
    leaf = parseCert(base64Bytes(x5c[0] as string));
    intermediate = parseCert(base64Bytes(x5c[1] as string));
    root = parseCert(base64Bytes(x5c[2] as string));
  } catch {
    return { ok: false, reason: "chain" };
  }

  const rootDigestBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", root.raw));
  const rootDigest = [...rootDigestBytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (rootDigest !== normalizeFingerprint(rootSha256)) return { ok: false, reason: "root" };

  if (!bytesEqual(leaf.issuer, intermediate.subject)) return { ok: false, reason: "chain" };
  if (!bytesEqual(intermediate.issuer, root.subject)) return { ok: false, reason: "chain" };
  if (!intermediate.isCa) return { ok: false, reason: "chain" };
  if (!(await certSignedBy(leaf, intermediate))) return { ok: false, reason: "signature" };
  if (!(await certSignedBy(intermediate, root))) return { ok: false, reason: "signature" };

  if (!leaf.oids.includes(APPLE_APP_STORE_LEAF_OID)) return { ok: false, reason: "oid" };
  if (!intermediate.oids.includes(APPLE_WWDR_OID)) return { ok: false, reason: "oid" };

  const payload = parseJson(b64urlDecode(payloadB64));
  if (!isObject(payload)) return { ok: false, reason: "payload" };
  const signed = finite(payload.signedDate);
  if (signed === undefined) return { ok: false, reason: "payload" };

  const signedDate = new Date(signed);
  for (const cert of [leaf, intermediate, root]) {
    if (signed < cert.notBefore || signed > cert.notAfter) return { ok: false, reason: "validity" };
  }

  // alg is ES256 (checked above): P-256 over SHA-256, whatever curve the chain uses.
  const key = await crypto.subtle.importKey(
    "spki",
    leaf.spki,
    { name: "ECDSA", namedCurve: leaf.curve },
    false,
    ["verify"],
  );
  const signingInput = new TextEncoder().encode(`${headB64}.${payloadB64}`);
  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    b64urlDecode(sigB64),
    signingInput,
  );
  if (!valid) return { ok: false, reason: "signature" };

  return { ok: true, payload, signedDate };
}

// --- App Store Server Notifications V2 ------------------------------------

export interface AppleRenewalInfo {
  originalTransactionId: string;
  /** 1 = renews at period end, 0 = turned off. */
  autoRenewStatus: number | null;
  /** End of the billing grace period while Apple retries a failed renewal; null otherwise. */
  gracePeriodExpiresDate: Date | null;
}

export interface AppleNotification {
  notificationType: string;
  subtype: string | null;
  /** When Apple signed (sent) this notification; orders it against other events. */
  signedDate: Date;
  /** Verified transaction the notification is about; null for TEST. */
  transaction: AppleTransaction | null;
  /** Verified renewal info; null when absent. */
  renewalInfo: AppleRenewalInfo | null;
}

export type AppleNotificationVerification =
  | { ok: true; notification: AppleNotification }
  | { ok: false; reason: FailureReason };

/**
 * Verifies a V2 `signedPayload` and its embedded signedTransactionInfo / signedRenewalInfo against
 * the pinned root. The inner transaction may be revoked (REFUND / REVOKE).
 */
export async function verifyAppleNotificationJws(
  signedPayload: string,
  opts: AppleVerifyOptions,
): Promise<AppleNotificationVerification> {
  try {
    const chain = await verifyChain(signedPayload, opts.rootSha256);
    if (!chain.ok) return chain;
    const notificationType = str(chain.payload.notificationType);
    if (!notificationType) return { ok: false, reason: "payload" };
    const data = isObject(chain.payload.data) ? chain.payload.data : undefined;
    if (data?.bundleId !== undefined && data.bundleId !== opts.bundleId) {
      return { ok: false, reason: "bundle" };
    }
    // Production notifications carry the numeric App Store id; Sandbox ones may not.
    if (
      opts.appAppleId !== undefined &&
      data?.environment === "Production" &&
      data.appAppleId !== opts.appAppleId
    ) {
      return { ok: false, reason: "bundle" };
    }

    let transaction: AppleTransaction | null = null;
    const signedTransactionInfo = str(data?.signedTransactionInfo);
    if (signedTransactionInfo) {
      const inner = await verifyAppleTransactionJws(signedTransactionInfo, {
        ...opts,
        allowRevoked: true,
      });
      if (!inner.ok) return inner;
      transaction = inner.transaction;
    }

    let renewalInfo: AppleRenewalInfo | null = null;
    const signedRenewalInfo = str(data?.signedRenewalInfo);
    if (signedRenewalInfo) {
      const renewal = await verifyChain(signedRenewalInfo, opts.rootSha256);
      if (!renewal.ok) return renewal;
      const originalTransactionId = str(renewal.payload.originalTransactionId);
      if (!originalTransactionId) return { ok: false, reason: "payload" };
      const grace = finite(renewal.payload.gracePeriodExpiresDate);
      renewalInfo = {
        originalTransactionId,
        autoRenewStatus: finite(renewal.payload.autoRenewStatus) ?? null,
        gracePeriodExpiresDate: grace !== undefined ? new Date(grace) : null,
      };
    }

    return {
      ok: true,
      notification: {
        notificationType,
        subtype: str(chain.payload.subtype) ?? null,
        signedDate: chain.signedDate,
        transaction,
        renewalInfo,
      },
    };
  } catch {
    return { ok: false, reason: "format" };
  }
}

/**
 * Deterministic UUID the app passes as StoreKit `appAccountToken` so a purchase is tied to the
 * Waqtu account. Must match apps/mobile/src/premium/accountToken.ts: SHA-256("waqtu-apple:<userId>"),
 * first 16 bytes, version 5 and RFC 4122 variant bits set.
 */
export async function appleAccountToken(userId: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`waqtu-apple:${userId}`)),
  );
  const bytes = digest.slice(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function certSignedBy(cert: ParsedCert, issuer: ParsedCert): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "spki",
    issuer.spki,
    { name: "ECDSA", namedCurve: issuer.curve },
    false,
    ["verify"],
  );
  return crypto.subtle.verify({ name: "ECDSA", hash: cert.sigHash }, key, cert.signature, cert.tbs);
}

// --- Minimal DER (X.509) reader -------------------------------------------
// Only what the checks above need: certificate wrapper, TBSCertificate fields,
// validity times, extension OIDs, basicConstraints, SubjectPublicKeyInfo and
// the ECDSA signature (DER r||s converted to the raw 64-byte WebCrypto form).

type Tlv = {
  /** Offset of the tag byte; content spans [start, end). */
  pos: number;
  tag: number;
  start: number;
  end: number;
};

type ParsedCert = {
  raw: Uint8Array;
  /** DER tbsCertificate: the exact bytes the signature covers. */
  tbs: Uint8Array;
  spki: Uint8Array;
  /** Cert's own signature as raw r||s (64 or 96 bytes). */
  signature: Uint8Array;
  /** Hash of the cert's own signatureAlgorithm (what its issuer signed with). */
  sigHash: HashName;
  /** Curve of the cert's own public key. */
  curve: CurveName;
  notBefore: number;
  notAfter: number;
  oids: string[];
  isCa: boolean;
  issuer: Uint8Array;
  subject: Uint8Array;
};

function parseCert(der: Uint8Array): ParsedCert {
  const cert = readTlv(der, 0, der.length);
  if (cert.tag !== 0x30) throw new Error("not a certificate");
  const [tbs, sigAlg, sigValue] = children(der, cert);
  if (!tbs || tbs.tag !== 0x30 || !sigAlg || sigAlg.tag !== 0x30) {
    throw new Error("bad certificate");
  }
  const algOid = children(der, sigAlg)[0];
  const sigAlgName = algOid && algOid.tag === 0x06 ? SIG_ALGS[oidOf(der, algOid)] : undefined;
  if (!sigAlgName) throw new Error("unsupported signature algorithm");

  const fields = children(der, tbs);
  // [0] version is optional; subjectPublicKeyInfo sits six required fields in.
  const offset = fields[0]?.tag === 0xa0 ? 1 : 0;
  const issuer = fields[offset + 2];
  const validity = fields[offset + 3];
  const subject = fields[offset + 4];
  const spkiTlv = fields[offset + 5];
  if (!issuer || !validity || !subject || !spkiTlv || spkiTlv.tag !== 0x30) {
    throw new Error("bad tbsCertificate");
  }
  const [notBeforeTlv, notAfterTlv] = children(der, validity);
  if (!notBeforeTlv || !notAfterTlv) throw new Error("bad validity");
  const notBefore = asn1TimeMs(der, notBeforeTlv);
  const notAfter = asn1TimeMs(der, notAfterTlv);

  // SubjectPublicKeyInfo: SEQUENCE { AlgorithmIdentifier { ecPublicKey, curve }, BIT STRING }.
  const spkiChildren = children(der, spkiTlv);
  const spkiAlg = spkiChildren[0];
  const algParts = spkiAlg && spkiAlg.tag === 0x30 ? children(der, spkiAlg) : [];
  const keyAlgOid = algParts[0];
  const curveOid = algParts[1];
  const curveName =
    keyAlgOid?.tag === 0x06 && curveOid?.tag === 0x06 && oidOf(der, keyAlgOid) === EC_PUBLIC_KEY_OID
      ? CURVES[oidOf(der, curveOid)]
      : undefined;
  if (!curveName) throw new Error("unsupported public key algorithm");

  const oids: string[] = [];
  let isCa = false;
  const extsWrapper = fields.find((f) => f.tag === 0xa3);
  const extSeq = extsWrapper ? children(der, extsWrapper)[0] : undefined;
  for (const ext of extSeq ? children(der, extSeq) : []) {
    const parts = children(der, ext);
    const oidTlv = parts[0];
    if (!oidTlv || oidTlv.tag !== 0x06) throw new Error("bad extension");
    const extOid = oidOf(der, oidTlv);
    oids.push(extOid);
    if (extOid !== "2.5.29.19") continue;
    // basicConstraints: the OCTET STRING holds SEQUENCE { BOOLEAN cA optional }.
    const value = parts.find((p) => p.tag === 0x04);
    const innerSeq = value ? children(der, value)[0] : undefined;
    const flag = innerSeq ? children(der, innerSeq).find((p) => p.tag === 0x01) : undefined;
    isCa = flag !== undefined && der[flag.start] !== 0;
  }

  if (!sigValue || sigValue.tag !== 0x03 || der[sigValue.start] !== 0) {
    throw new Error("bad signatureValue");
  }
  const signature = derSigToRaw(
    der.subarray(sigValue.start + 1, sigValue.end),
    sigAlgName.byteSize,
  );

  return {
    raw: der,
    tbs: der.subarray(tbs.pos, tbs.end),
    spki: der.subarray(spkiTlv.pos, spkiTlv.end),
    signature,
    sigHash: sigAlgName.hash,
    curve: curveName,
    notBefore,
    notAfter,
    oids,
    isCa,
    issuer: der.subarray(issuer.pos, issuer.end),
    subject: der.subarray(subject.pos, subject.end),
  };
}

function readTlv(data: Uint8Array, pos: number, end: number): Tlv {
  if (pos + 2 > end) throw new Error("truncated tlv");
  const tag = data[pos]!;
  if ((tag & 0x1f) === 0x1f) throw new Error("unsupported tag");
  let len = data[pos + 1]!;
  let header = 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 3 || pos + 2 + n > end) throw new Error("bad length");
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + data[pos + 2 + i]!;
    header = 2 + n;
  }
  const start = pos + header;
  if (start + len > end) throw new Error("tlv overruns");
  return { pos, tag, start, end: start + len };
}

function children(data: Uint8Array, tlv: Tlv): Tlv[] {
  const out: Tlv[] = [];
  let pos = tlv.start;
  while (pos < tlv.end) {
    const child = readTlv(data, pos, tlv.end);
    out.push(child);
    pos = child.end;
  }
  return out;
}

function oidOf(data: Uint8Array, tlv: Tlv): string {
  const bytes = data.subarray(tlv.start, tlv.end);
  if (bytes.length < 2 || (bytes[bytes.length - 1]! & 0x80) !== 0) throw new Error("bad oid");
  const parts = [Math.floor(bytes[0]! / 40), bytes[0]! % 40];
  let value = 0;
  for (const byte of bytes.subarray(1)) {
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) {
      parts.push(value);
      value = 0;
    }
  }
  return parts.join(".");
}

/** UTCTime ("YYMMDDHHMMSSZ") or GeneralizedTime ("YYYYMMDDHHMMSSZ") in ms. */
function asn1TimeMs(data: Uint8Array, tlv: Tlv): number {
  const text = new TextDecoder().decode(data.subarray(tlv.start, tlv.end));
  if (!text.endsWith("Z")) throw new Error("bad time");
  const digits = text.slice(0, -1);
  const num = (from: number, to: number) => Number(digits.slice(from, to));
  let year: number;
  let ms: number;
  if (tlv.tag === 0x17 && /^\d{12}$/.test(digits)) {
    year = (num(0, 2) < 50 ? 2000 : 1900) + num(0, 2);
    ms = Date.UTC(year, num(2, 4) - 1, num(4, 6), num(6, 8), num(8, 10), num(10, 12));
  } else if (tlv.tag === 0x18 && /^\d{14}$/.test(digits)) {
    year = num(0, 4);
    ms = Date.UTC(year, num(4, 6) - 1, num(6, 8), num(8, 10), num(10, 12), num(12, 14));
  } else {
    throw new Error("bad time");
  }
  if (Number.isNaN(ms)) throw new Error("bad time");
  return ms;
}

/** ECDSA-Sig-Value (DER INTEGER r, INTEGER s) -> raw r||s (2x byteSize). */
function derSigToRaw(der: Uint8Array, byteSize: number): Uint8Array {
  const seq = readTlv(der, 0, der.length);
  if (seq.tag !== 0x30) throw new Error("bad ecdsa signature");
  const [r, s] = children(der, seq);
  if (!r || !s) throw new Error("bad ecdsa signature");
  // Drop INTEGER sign padding, then left-align each half to the curve size.
  const unsigned = (tlv: Tlv): Uint8Array => {
    let content = der.subarray(tlv.start, tlv.end);
    while (content.length > byteSize && content[0] === 0) content = content.subarray(1);
    if (content.length > byteSize) throw new Error("bad ecdsa signature");
    return content;
  };
  const rBytes = unsigned(r);
  const sBytes = unsigned(s);
  const raw = new Uint8Array(byteSize * 2);
  rBytes.forEach((byte, i) => (raw[i + byteSize - rBytes.length] = byte));
  sBytes.forEach((byte, i) => (raw[i + byteSize * 2 - sBytes.length] = byte));
  return raw;
}

function parseJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

/** Standard or URL-safe base64, padding optional. */
function base64Bytes(value: string): Uint8Array {
  const compact = value.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
  const padded = compact + "=".repeat((4 - (compact.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

const b64urlDecode = base64Bytes;

/** Fingerprint pins tolerate uppercase and openssl's colon separators. */
function normalizeFingerprint(value: string): string {
  return value.replace(/:/g, "").trim().toLowerCase();
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}
