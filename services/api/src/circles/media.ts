import { MAX_AUDIO_BYTES, MAX_AUDIO_SECONDS } from "./constants";
import { badRequest, HttpError, json, notFound, readLimited } from "./http";
import { NOT_BLOCKED } from "./posts";
import { isAudioMime } from "./validate";

export interface MediaView {
  mediaId: string;
  mime: string;
  bytes: number;
  durationSeconds: number;
}

function parseDuration(raw: string | null): number {
  if (raw === null || !/^\d{1,4}$/.test(raw)) {
    throw badRequest("x-duration-seconds header is required");
  }
  const n = Number(raw);
  if (n < 1 || n > MAX_AUDIO_SECONDS) {
    throw badRequest(`voice notes are 1..${MAX_AUDIO_SECONDS} seconds`);
  }
  return n;
}

/**
 * Worker-proxied voice note upload: the Worker enforces the 5 MB limit and the audio allowlist
 * before anything reaches R2. The note stays unattached until a post references it.
 */
export async function uploadMedia(
  env: { APP_DB: D1Database; CIRCLE_MEDIA: R2Bucket },
  request: Request,
  userId: string,
  circleId: string,
  now: number,
): Promise<Response> {
  const mime =
    (request.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (!isAudioMime(mime)) {
    throw new HttpError(
      415,
      "unsupported_media_type",
      "send an audio file (m4a, aac, mp3, ogg, wav)",
    );
  }
  const durationSeconds = parseDuration(request.headers.get("x-duration-seconds"));
  const bytes = await readLimited(request, MAX_AUDIO_BYTES);
  if (bytes.byteLength === 0) throw badRequest("empty upload");

  const mediaId = crypto.randomUUID();
  const key = `circle/${circleId}/${mediaId}`;
  await env.CIRCLE_MEDIA.put(key, bytes, { httpMetadata: { contentType: mime } });
  try {
    await env.APP_DB.prepare(
      `INSERT INTO circle_media (id, circle_id, user_id, r2_key, mime, bytes, duration_seconds, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    )
      .bind(mediaId, circleId, userId, key, mime, bytes.byteLength, durationSeconds, now)
      .run();
  } catch (e) {
    await env.CIRCLE_MEDIA.delete(key);
    throw e;
  }
  const view: MediaView = { mediaId, mime, bytes: bytes.byteLength, durationSeconds };
  return json(view, 201);
}

function parseRange(header: string, size: number): { start: number; end: number } | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return null;
  let start: number;
  let end: number;
  if (m[1] === "") {
    const suffix = Number(m[2]);
    if (suffix === 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  return start <= end && start < size ? { start, end } : null;
}

/**
 * Streams the voice note of a visible post in a circle the caller belongs to (callers passed
 * `requireMember`). Honours byte ranges because iOS AVPlayer insists on them.
 */
export async function serveMedia(
  env: { APP_DB: D1Database; CIRCLE_MEDIA: R2Bucket },
  request: Request,
  viewerId: string,
  circleId: string,
  mediaId: string,
): Promise<Response> {
  const row = await env.APP_DB.prepare(
    `SELECT md.r2_key, md.mime, md.bytes FROM circle_media md
     JOIN circle_post p ON p.id = md.post_id
     WHERE md.id = ?2 AND md.circle_id = ?3 AND p.status = 'visible' AND ${NOT_BLOCKED("p.user_id")}`,
  )
    .bind(viewerId, mediaId, circleId)
    .first<{ r2_key: string; mime: string; bytes: number }>();
  if (!row) throw notFound();

  const headers = {
    "content-type": row.mime,
    "accept-ranges": "bytes",
    "cache-control": "private, no-store",
  };
  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    const range = parseRange(rangeHeader, row.bytes);
    if (!range) {
      return new Response(null, {
        status: 416,
        headers: { ...headers, "content-range": `bytes */${row.bytes}` },
      });
    }
    const object = await env.CIRCLE_MEDIA.get(row.r2_key, {
      range: { offset: range.start, length: range.end - range.start + 1 },
    });
    if (!object) throw notFound();
    return new Response(object.body, {
      status: 206,
      headers: {
        ...headers,
        "content-range": `bytes ${range.start}-${range.end}/${row.bytes}`,
        "content-length": String(range.end - range.start + 1),
      },
    });
  }
  const object = await env.CIRCLE_MEDIA.get(row.r2_key);
  if (!object) throw notFound();
  return new Response(object.body, {
    headers: { ...headers, "content-length": String(row.bytes) },
  });
}
