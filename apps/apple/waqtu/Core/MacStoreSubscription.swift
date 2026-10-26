//
//  MacStoreSubscription.swift
//  waqtu
//
//  Mac App Store build only: Waqtu Premium as auto-renewable subscriptions (StoreKit 2). The
//  direct-download build sells nothing; its premium comes from the signed-in Waqtu account.
//  Every verified transaction is also handed to `onSignedTransaction` so the account gets premium
//  on the server (POST /v1/billing/apple) and the phone apps unlock too.
//

#if MAS
import Foundation
import StoreKit

@Observable
final class MacStoreSubscription: @unchecked Sendable {
    /// "Waqtu Premium" subscription group of the Mac app (bundle dat.waqtu). Must match
    /// services/api/src/billing/apple.ts `APPLE_MAC_APP` and WaqtuProducts.storekit.
    static let monthlyProductID = "dat.waqtu.mac.premium.monthly"
    static let yearlyProductID = "dat.waqtu.mac.premium.yearly"
    static let productIDs: Set<String> = [monthlyProductID, yearlyProductID]

    /// True while this Apple ID holds an active (not expired, not refunded) Mac subscription.
    private(set) var isActive = false
    /// Monthly first, then yearly; empty until the App Store answered.
    private(set) var products: [Product] = []

    /// What the purchase buttons show, in the storefront's currency.
    struct Offer: Identifiable, Equatable {
        let id: String
        let displayPrice: String
        var isYearly: Bool { id == MacStoreSubscription.yearlyProductID }
    }

    var offers: [Offer] {
        #if DEBUG
        if let demoOffers { return demoOffers }
        #endif
        return products.map { Offer(id: $0.id, displayPrice: $0.displayPrice) }
    }

    #if DEBUG
    /// Screenshot mode only (Screenshots/ScreenshotMode.swift): what the buttons show when the App
    /// Store cannot answer (unsigned CI build).
    @ObservationIgnored var demoOffers: [Offer]?
    #endif

    /// Receives the JWS of every verified subscription transaction (purchase, renewal, restore,
    /// launch). Set by the owner to link the subscription to the Waqtu account.
    @ObservationIgnored var onSignedTransaction: ((String) -> Void)?

    @ObservationIgnored private var transactionListener: Task<Void, Never>?

    init() {
        transactionListener = listenForTransactions()
        Task { await loadProducts() }
    }

    deinit { transactionListener?.cancel() }

    @MainActor
    func loadProducts() async {
        guard products.isEmpty else { return }
        let loaded = (try? await Product.products(for: Self.productIDs)) ?? []
        products = loaded.sorted { lhs, rhs in lhs.id == Self.monthlyProductID && rhs.id != Self.monthlyProductID }
    }

    /// Presents the App Store purchase sheet. `appAccountToken` ties the purchase to the signed-in
    /// Waqtu account (see `AppleAccountToken`); nil when signed out.
    @MainActor
    func purchase(productID: String, appAccountToken: UUID?) async -> Result<Void, SubscriptionPurchaseError> {
        guard let product = products.first(where: { $0.id == productID }) else {
            return .failure(.message("Purchase unavailable right now."))
        }
        do {
            var options: Set<Product.PurchaseOption> = []
            if let appAccountToken { options.insert(.appAccountToken(appAccountToken)) }
            switch try await product.purchase(options: options) {
            case .success(let verification):
                guard case .verified(let transaction) = verification else {
                    return .failure(.message("The App Store could not verify this purchase."))
                }
                // refresh() also hands the new transaction to onSignedTransaction.
                await transaction.finish()
                await refresh()
                return .success(())
            case .userCancelled:
                return .failure(.cancelled)
            case .pending:
                return .failure(.message("Purchase pending approval."))
            @unknown default:
                return .failure(.message("Unknown purchase result."))
            }
        } catch {
            return .failure(.message(error.localizedDescription))
        }
    }

    /// Restores purchases made with this Apple ID ("Restore Purchases").
    @MainActor
    func restore() async {
        try? await AppStore.sync()
        await refresh()
    }

    /// Re-reads the current entitlements (launch, restore, after a purchase) and hands every active
    /// subscription's transaction to `onSignedTransaction`.
    @MainActor
    func refresh() async {
        var active = false
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result, Self.isCurrent(transaction) else { continue }
            active = true
            onSignedTransaction?(result.jwsRepresentation)
        }
        isActive = active
    }

    private static func isCurrent(_ transaction: Transaction) -> Bool {
        guard productIDs.contains(transaction.productID), transaction.revocationDate == nil else { return false }
        guard let expires = transaction.expirationDate else { return false }
        return expires > Date()
    }

    /// Renewals, refunds and purchases made outside the app (another Mac, Ask to Buy).
    private func listenForTransactions() -> Task<Void, Never> {
        Task.detached { [weak self] in
            for await result in Transaction.updates {
                guard let self, case .verified(let transaction) = result,
                      Self.productIDs.contains(transaction.productID) else { continue }
                await transaction.finish()
                await self.refresh()
            }
        }
    }
}

enum SubscriptionPurchaseError: Error, Equatable {
    case cancelled
    case message(String)
}
#endif
