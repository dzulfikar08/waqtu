import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

// Polar API configuration
const POLAR_API_BASE = "https://api.polar.sh/v1";
const POLAR_ACCESS_TOKEN = process.env.POLAR_ACCESS_TOKEN || "";
const POLAR_WEBHOOK_SECRET = process.env.POLAR_WEBHOOK_SECRET || "";

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
		const body = await request.text();

		if (!body) {
			return NextResponse.json(
				{ error: "Invalid webhook request" },
				{ status: 400 },
			);
		}

		// Verify webhook signature
		const signature = request.headers.get("x-polar-signature") || "";
		if (POLAR_WEBHOOK_SECRET) {
			if (!verifyPolarSignature(body, signature, POLAR_WEBHOOK_SECRET)) {
				console.error("Invalid webhook signature");
				return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
			}
		} else {
			console.warn(
				"POLAR_WEBHOOK_SECRET not configured - webhook signature verification disabled",
			);
		}

		const event = JSON.parse(body) as {
			type: string;
			data: unknown;
		};

		console.log("Received webhook event:", event.type);

		// Handle different event types
		switch (event.type) {
			case "checkout.created": {
				// Checkout created - wait for checkout.updated or subscription events
				console.log("Checkout created:", event.data);
				return NextResponse.json({ received: true }, { status: 200 });
			}

			case "checkout.updated": {
				const checkout = event.data as {
					id: string;
					status?: string;
					product_id?: string;
					metadata?: {
						userId?: string;
					};
					customer_email?: string;
				};

				console.log(
					"checkout.updated event:",
					JSON.stringify({
						id: checkout.id,
						status: checkout.status,
						product_id: checkout.product_id,
						has_metadata: !!checkout.metadata,
						customer_email: checkout.customer_email,
					}),
				);

				// Only process if checkout is completed/paid
				if (checkout.status === "completed" || checkout.status === "paid") {
					// Check if this is a one-time product (lifetime) or subscription
					// For one-time products, update immediately
					// For subscriptions, wait for subscription.created event
					if (checkout.product_id) {
						try {
							const productResponse = await fetch(
								`${POLAR_API_BASE}/products/${checkout.product_id}`,
								{
									headers: {
										Authorization: `Bearer ${POLAR_ACCESS_TOKEN}`,
									},
								},
							);

							if (productResponse.ok) {
								const product = (await productResponse.json()) as {
									type?: string;
								};

								// If it's a one-time product, handle immediately
								if (product.type === "one_time") {
									console.log(
										"One-time product checkout completed:",
										checkout.id,
										"for product:",
										checkout.product_id,
									);
									// Here you would update your database
									// For now, we'll just log it
									return NextResponse.json({ received: true });
								}
							}
						} catch (error) {
							console.error("Error fetching product info:", error);
							// Continue - will wait for subscription.created event
						}
					}

					// For subscription products, wait for subscription.created event
					console.log(
						"Checkout updated to completed (subscription product):",
						checkout.id,
					);
					return NextResponse.json({ received: true });
				}

				return NextResponse.json({ received: true });
			}

			case "subscription.created":
			case "subscription.updated": {
				const subscription = event.data as {
					id: string;
					status: string;
					current_period_end?: number;
					current_period_start?: number;
					user_id?: string;
					customer?: {
						email?: string;
					};
					metadata?: {
						userId?: string;
					};
					product_id?: string;
				};

				console.log(
					"Subscription event:",
					event.type,
					"ID:",
					subscription.id,
					"Status:",
					subscription.status,
				);

				// Here you would update your database with the subscription status
				// For now, we'll just log it
				console.log(
					"Subscription",
					subscription.status,
					"for customer:",
					subscription.customer?.email,
				);

				return NextResponse.json({ received: true });
			}

			case "order.paid": {
				// Handle order.paid event for one-time products (lifetime)
				const order = event.data as {
					id: string;
					product_id?: string;
					customer_email?: string;
					checkout_id?: string;
					metadata?: {
						userId?: string;
					};
				};

				console.log(
					"Order paid:",
					order.id,
					"for product:",
					order.product_id,
					"by:",
					order.customer_email,
				);

				// Here you would grant lifetime access to the user
				// For now, we'll just log it

				return NextResponse.json({ received: true });
			}

			case "subscription.canceled": {
				const subscription = event.data as {
					id: string;
					current_period_end?: number;
					customer?: {
						email?: string;
					};
				};

				console.log(
					"Subscription canceled:",
					subscription.id,
					"expires at:",
					subscription.current_period_end,
				);

				// Here you would update your database to expire the subscription
				// For now, we'll just log it

				return NextResponse.json({ received: true });
			}

			default:
				console.log("Unhandled webhook event type:", event.type);
				return NextResponse.json({ received: true });
		}
	} catch (error) {
		console.error("Error processing webhook:", error);
		return NextResponse.json(
			{ error: "Webhook processing failed" },
			{ status: 500 },
		);
	}
}
