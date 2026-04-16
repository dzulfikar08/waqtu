import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

// Polar API configuration
const POLAR_API_BASE = "https://api.polar.sh";
const POLAR_ACCESS_TOKEN = process.env.POLAR_ACCESS_TOKEN || "";
const CLIENT_URL =
	process.env.NEXT_PUBLIC_CLIENT_URL ||
	(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

// Validation schema for checkout request
interface CheckoutRequest {
	productId: string;
	email?: string;
}

// Verify Polar webhook signature
function verifyPolarSignature(
	body: string,
	signature: string,
	secret: string,
): boolean {
	if (!secret || !signature) {
		return false;
	}

	try {
		const expectedSignature = createHmac("sha256", secret)
			.update(body)
			.digest("hex");

		const expectedBuffer = Buffer.from(expectedSignature, "hex");
		const receivedBuffer = Buffer.from(signature, "hex");

		if (expectedBuffer.length !== receivedBuffer.length) {
			return false;
		}

		return timingSafeEqual(expectedBuffer, receivedBuffer);
	} catch (error) {
		console.error("Error verifying webhook signature:", error);
		return false;
	}
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { productId, email } = body as CheckoutRequest;

		if (!productId) {
			return NextResponse.json(
				{ error: "Product ID is required" },
				{ status: 400 },
			);
		}

		if (!POLAR_ACCESS_TOKEN) {
			console.error("POLAR_ACCESS_TOKEN is not configured");
			return NextResponse.json(
				{ error: "Payment service not configured" },
				{ status: 500 },
			);
		}

		// Get origin from request headers for proper redirect URLs
		const origin =
			request.headers.get("origin") ||
			request.headers.get("referer")?.split("/")[2] ||
			CLIENT_URL.replace(/^https?:\/\//, "");

		const baseUrl = origin.startsWith("http") ? origin : `https://${origin}`;

		// Create checkout session using Polar API v1
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
			return NextResponse.json(
				{ error: "Failed to create checkout session" },
				{ status: 500 },
			);
		}

		const checkout = (await response.json()) as { url?: string };

		if (!checkout.url) {
			return NextResponse.json(
				{ error: "Failed to create checkout session" },
				{ status: 500 },
			);
		}

		return NextResponse.json({ url: checkout.url });
	} catch (error) {
		console.error("Error creating checkout session:", error);
		return NextResponse.json(
			{ error: "Failed to create checkout session" },
			{ status: 500 },
		);
	}
}
