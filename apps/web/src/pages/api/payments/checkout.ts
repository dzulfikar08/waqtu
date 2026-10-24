import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

// Opt out of prerendering — this runs on the Cloudflare Worker at request time.
export const prerender = false;

const POLAR_API_BASE = "https://api.polar.sh";

interface CheckoutRequest {
  tier?: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { tier } = body as CheckoutRequest;

    // Product IDs live in Cloudflare vars so they can change without a rebuild.
    const productId =
      tier === "PRO_MONTHLY" ? env.POLAR_PRODUCT_PRO_MONTHLY : env.POLAR_PRODUCT_PRO_LIFETIME;

    if (!productId) {
      console.error("POLAR_PRODUCT_PRO_LIFETIME is not configured");
      return new Response(JSON.stringify({ error: "Product not configured" }), { status: 500 });
    }

    const POLAR_ACCESS_TOKEN = env.POLAR_ACCESS_TOKEN ?? "";
    const CLIENT_URL =
      env.PUBLIC_CLIENT_URL ?? env.NEXT_PUBLIC_CLIENT_URL ?? "https://getwaqtu.com";

    if (!POLAR_ACCESS_TOKEN) {
      console.error("POLAR_ACCESS_TOKEN is not configured");
      return new Response(JSON.stringify({ error: "Payment service not configured" }), {
        status: 500,
      });
    }

    // Resolve the public origin for Polar success/return URLs.
    const origin =
      request.headers.get("origin") ||
      request.headers.get("referer")?.split("/")[2] ||
      CLIENT_URL.replace(/^https?:\/\//, "");
    const baseUrl = origin.startsWith("http") ? origin : `https://${origin}`;

    const response = await fetch(`${POLAR_API_BASE}/v1/checkouts/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${POLAR_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        products: [productId],
        success_url: `${baseUrl}/?checkout=success`,
        return_url: `${baseUrl}/?checkout=canceled`,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Polar API error:", error);
      return new Response(JSON.stringify({ error: "Failed to create checkout session" }), {
        status: 500,
      });
    }

    const checkout = (await response.json()) as { url?: string };
    if (!checkout.url) {
      return new Response(JSON.stringify({ error: "Failed to create checkout session" }), {
        status: 500,
      });
    }

    return new Response(JSON.stringify({ url: checkout.url }), { status: 200 });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return new Response(JSON.stringify({ error: "Failed to create checkout session" }), {
      status: 500,
    });
  }
};
