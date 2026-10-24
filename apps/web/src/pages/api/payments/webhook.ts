import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

const POLAR_API_BASE = "https://api.polar.sh/v1";

/** Encode an ArrayBuffer to a base64 string (no Node `Buffer`). */
function base64Encode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** Constant-time string comparison. */
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verify a Polar webhook signature using the Standard Webhooks format
 * (webhook-id, webhook-signature, webhook-timestamp headers) via the native
 * Web Crypto API — no Node polyfills required on the Cloudflare Worker.
 */
async function verifyPolarSignature(
  body: string,
  webhookId: string | null,
  webhookSignature: string | null,
  webhookTimestamp: string | null,
  secret: string,
): Promise<boolean> {
  if (!secret || !webhookId || !webhookSignature || !webhookTimestamp) return false;

  try {
    const timestamp = parseInt(webhookTimestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > 300) return false; // reject >5 min old

    const enc = new TextEncoder();
    // HMAC key = raw secret bytes (matches the original's no-op utf8↔base64 round-trip).
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signedContent = `${webhookId}.${webhookTimestamp}.${body}`;
    const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(signedContent));
    const expected = base64Encode(sigBuf);

    // Polar sends multiple signatures (space-separated), each "v1,{sig}".
    for (const sig of webhookSignature.split(" ")) {
      const rawSig = sig.startsWith("v1,") ? sig.slice(3) : sig;
      if (timingSafeEqualStr(rawSig, expected)) return true;
    }
    return false;
  } catch (error) {
    console.error("Error verifying webhook signature:", error);
    return false;
  }
}

function ok() {
  return new Response(JSON.stringify({ received: true }), { status: 200 });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.text();
    if (!body)
      return new Response(JSON.stringify({ error: "Invalid webhook request" }), { status: 400 });

    const POLAR_ACCESS_TOKEN = env.POLAR_ACCESS_TOKEN ?? "";
    const POLAR_WEBHOOK_SECRET = env.POLAR_WEBHOOK_SECRET ?? "";

    const webhookId = request.headers.get("webhook-id");
    const webhookSignature = request.headers.get("webhook-signature");
    const webhookTimestamp = request.headers.get("webhook-timestamp");

    if (POLAR_WEBHOOK_SECRET) {
      if (!webhookId || !webhookSignature || !webhookTimestamp) {
        return new Response(JSON.stringify({ error: "Missing signature headers" }), {
          status: 401,
        });
      }
      const isValid = await verifyPolarSignature(
        body,
        webhookId,
        webhookSignature,
        webhookTimestamp,
        POLAR_WEBHOOK_SECRET,
      );
      if (!isValid)
        return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
    } else {
      console.warn(
        "[WEBHOOK] POLAR_WEBHOOK_SECRET not configured - accepting all webhooks (dev only)",
      );
      if (process.env.NODE_ENV === "production") {
        return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
          status: 500,
        });
      }
    }

    const event = JSON.parse(body) as { type: string; data: unknown };
    console.log("Received webhook event:", event.type);

    switch (event.type) {
      case "checkout.created":
        return ok();

      case "checkout.updated": {
        const checkout = event.data as {
          id: string;
          status?: string;
          product_id?: string;
          customer_email?: string;
        };
        if (checkout.status === "completed" || checkout.status === "paid") {
          if (checkout.product_id) {
            try {
              const productResponse = await fetch(
                `${POLAR_API_BASE}/products/${checkout.product_id}`,
                {
                  headers: { Authorization: `Bearer ${POLAR_ACCESS_TOKEN}` },
                },
              );
              if (productResponse.ok) {
                const product = (await productResponse.json()) as { type?: string };
                if (product.type === "one_time") {
                  // One-time product: grant lifetime access here (update your store).
                  return ok();
                }
              }
            } catch (error) {
              console.error("Error fetching product info:", error);
            }
          }
        }
        return ok();
      }

      case "subscription.created":
      case "subscription.updated": {
        const subscription = event.data as {
          id: string;
          status: string;
          customer?: { email?: string };
        };
        console.log(
          "Subscription",
          event.type,
          subscription.status,
          "for:",
          subscription.customer?.email,
        );
        return ok();
      }

      case "order.paid": {
        const order = event.data as { id: string; product_id?: string; customer_email?: string };
        console.log(
          "Order paid:",
          order.id,
          "for product:",
          order.product_id,
          "by:",
          order.customer_email,
        );
        return ok();
      }

      case "subscription.canceled": {
        const subscription = event.data as {
          id: string;
          current_period_end?: number;
          customer?: { email?: string };
        };
        console.log(
          "Subscription canceled:",
          subscription.id,
          "expires at:",
          subscription.current_period_end,
        );
        return ok();
      }

      default:
        console.log("Unhandled webhook event type:", event.type);
        return ok();
    }
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), { status: 500 });
  }
};
