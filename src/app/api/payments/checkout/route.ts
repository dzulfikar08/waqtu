import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

// Polar API configuration
const POLAR_API_BASE = "https://api.polar.sh/v1";
const POLAR_ACCESS_TOKEN = process.env.POLAR_ACCESS_TOKEN || "";
const CLIENT_URL = process.env.NEXT_PUBLIC_CLIENT_URL || process.env.VERCEL_URL
	? `https://${process.env.VERCEL_URL}`
	: process.env.NODE_ENV === "production"
		? "https://your-domain.com"
		: "http://localhost:3000";

// Validation schema for checkout request
interface CheckoutRequest {
	productId: string;
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
		const { productId } = body as CheckoutRequest;

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

		// Get user email from request (for now, using a query param or header)
		// In a real app, this would come from the authenticated session
		const email = (request.headers.get("x-user-email") ||
			(body as CheckoutRequest & { email?: string }).email ||
			"user@example.com") as string;

		// Create checkout session using Polar API
		const response = await fetch(`${POLAR_API_BASE}/checkouts`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${POLAR_ACCESS_TOKEN}`,
			},
			body: JSON.stringify({
				product_id: productId,
				customer_email: email,
				success_url: `${CLIENT_URL}/?checkout=success`,
				cancel_url: `${CLIENT_URL}/?checkout=canceled`,
				metadata: {
					// Store any relevant metadata
					source: "waqtu-web",
				},
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
