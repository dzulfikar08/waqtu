// Custom error class for API errors
export class ApiError extends Error {
	constructor(
		message: string,
		public status: number,
		public data?: unknown,
	) {
		super(message);
		this.name = "ApiError";
	}
}

export interface CheckoutResponse {
	url: string;
}

export interface CheckoutRequest {
	productId: string;
	email?: string;
}

const API_BASE = "/api/payments";

// Create checkout session
export async function createCheckout(
	request: CheckoutRequest,
): Promise<CheckoutResponse> {
	const response = await fetch(`${API_BASE}/checkout`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
		body: JSON.stringify(request),
	});

	if (!response.ok) {
		const error = await response
			.json()
			.catch(() => ({ error: "Failed to create checkout session" }));
		throw new ApiError(
			(error as { error?: string }).error ||
				"Failed to create checkout session",
			response.status,
			error,
		);
	}

	return response.json();
}

// Polar product IDs (should be configured in environment variables)
export const POLAR_PRODUCTS = {
	PRO_MONTHLY: process.env.NEXT_PUBLIC_POLAR_PRODUCT_PRO_MONTHLY || "",
	PRO_LIFETIME: process.env.NEXT_PUBLIC_POLAR_PRODUCT_PRO_LIFETIME || "",
} as const;

export type ProductTier = keyof typeof POLAR_PRODUCTS;

// Helper to get product ID for tier
export function getProductIdForTier(tier: ProductTier): string {
	return POLAR_PRODUCTS[tier];
}

// Check if a tier is available
export function isTierAvailable(tier: ProductTier): boolean {
	return !!POLAR_PRODUCTS[tier];
}
