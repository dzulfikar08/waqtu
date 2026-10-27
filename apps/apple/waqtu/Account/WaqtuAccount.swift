//
//  WaqtuAccount.swift
//  waqtu
//
//  The Waqtu account on the Mac: Sign in with Apple (native identity token), Google (system
//  browser session) and, for store reviewer accounts only, email + password, with the better-auth
//  bearer token kept in the Keychain.
//  State is only touched on the main thread; the async entry points are main-actor.
//

import Foundation
import AppKit
import AuthenticationServices
import CryptoKit

@Observable
final class WaqtuAccount {
    private(set) var user: AccountUser?
    private(set) var isBusy = false
    private(set) var errorMessage: String?
    /// Bearer session token; nil when signed out.
    private(set) var token: String?
    /// Premium the account holds on the server (e.g. an App Store or Play subscription made on the
    /// phone). Cached so it holds offline; refreshed on sign-in, launch and every sync (see
    /// `MutabaahSyncController`), cleared on sign-out.
    private(set) var serverPremium = false

    /// Called after sign-in, sign-out and when the server rejects the session.
    @ObservationIgnored var onSessionChange: (() -> Void)?
    /// Latest App Store subscription transaction this Mac holds (Mac App Store build); submitted to
    /// the account whenever someone is signed in so premium follows the account to the phone.
    @ObservationIgnored private var appStoreTransaction: String?
    /// Transactions this session already linked; launch and foreground refreshes repeat them.
    @ObservationIgnored private var linkedTransactions: Set<String> = []

    let api: WaqtuAPIClient
    private let keychain: KeychainStore
    private static let tokenAccount = "sessionToken"
    private static let userAccount = "user"
    private static let serverPremiumKey = "account.serverPremium"

    var isSignedIn: Bool { token != nil && user != nil }

    init(api: WaqtuAPIClient = WaqtuAPIClient(), keychain: KeychainStore = KeychainStore()) {
        self.api = api
        self.keychain = keychain
        if let stored = keychain.read(Self.tokenAccount),
           let json = keychain.read(Self.userAccount)?.data(using: .utf8),
           let user = try? JSONDecoder().decode(AccountUser.self, from: json) {
            self.token = stored
            self.user = user
            self.serverPremium = UserDefaults.standard.bool(forKey: Self.serverPremiumKey)
        }
    }

    // MARK: - Apple

    /// Random nonce for one Apple sign-in; the hash goes to Apple, the raw value to the server.
    static func makeNonce() -> (raw: String, hashed: String) {
        var bytes = [UInt8](repeating: 0, count: 32)
        let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        let raw = status == errSecSuccess
            ? bytes.map { String(format: "%02x", $0) }.joined()
            : UUID().uuidString
        let hashed = SHA256.hash(data: Data(raw.utf8)).map { String(format: "%02x", $0) }.joined()
        return (raw, hashed)
    }

    @MainActor
    func completeAppleSignIn(_ result: Result<ASAuthorization, Error>, rawNonce: String?) async {
        guard !isBusy else { return }
        errorMessage = nil
        switch result {
        case .failure(let error):
            if (error as? ASAuthorizationError)?.code != .canceled {
                errorMessage = error.localizedDescription
            }
        case .success(let authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = credential.identityToken,
                  let idToken = String(data: tokenData, encoding: .utf8),
                  let rawNonce else {
                errorMessage = "Apple did not return an identity token."
                return
            }
            isBusy = true
            defer { isBusy = false }
            do {
                let session = try await api.signInWithApple(
                    idToken: idToken,
                    nonce: rawNonce,
                    givenName: credential.fullName?.givenName,
                    familyName: credential.fullName?.familyName
                )
                try await finishSignIn(token: session)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    // MARK: - Google

    @MainActor
    func signInWithGoogle() async {
        guard !isBusy else { return }
        errorMessage = nil
        isBusy = true
        defer { isBusy = false }
        do {
            let start = try await api.startGoogleSignIn()
            let runner = WebAuthRunner()
            let callback = try await runner.run(url: start, callbackScheme: WaqtuAPI.callbackScheme)
            let session = try WaqtuAPIClient.sessionToken(fromCallback: callback)
            try await finishSignIn(token: session)
        } catch is CancellationError {
            // The browser sheet was closed.
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Email (store reviewers)

    /// Email + password sign-in, which the server only accepts for store reviewer accounts. Returns
    /// true once signed in.
    @MainActor
    @discardableResult
    func signInWithEmail(email: String, password: String) async -> Bool {
        guard !isBusy else { return false }
        errorMessage = nil
        isBusy = true
        defer { isBusy = false }
        do {
            let session = try await api.signInWithEmail(email: email, password: password)
            try await finishSignIn(token: session)
            return true
        } catch let problem as EmailSignInProblem {
            errorMessage = problem.localizedDescription
        } catch {
            errorMessage = EmailSignInProblem.failed.localizedDescription
        }
        return false
    }

    // MARK: - Session

    @MainActor
    private func finishSignIn(token: String) async throws {
        let user = try await api.me(token: token)
        keychain.write(Self.tokenAccount, value: token)
        if let data = try? JSONEncoder().encode(user), let json = String(data: data, encoding: .utf8) {
            keychain.write(Self.userAccount, value: json)
        }
        self.token = token
        self.user = user
        onSessionChange?()
        await refreshEntitlement()
        await linkAppStoreTransaction()
    }

    /// Hands an App Store subscription transaction (JWS) to the account. Signed out, it waits for
    /// the next sign-in. A subscription already linked to another Waqtu account stays there (409)
    /// and still unlocks this Mac through StoreKit.
    @MainActor
    func submitAppStoreTransaction(_ signedTransaction: String) async {
        appStoreTransaction = signedTransaction
        await linkAppStoreTransaction()
    }

    @MainActor
    private func linkAppStoreTransaction() async {
        guard let token, let signed = appStoreTransaction, !linkedTransactions.contains(signed) else { return }
        do {
            let entitlement = try await api.submitAppleTransaction(token: token, signedTransaction: signed)
            guard self.token == token else { return }
            linkedTransactions.insert(signed)
            setServerPremium(entitlement.premium)
        } catch {
            if isUnauthorized(error), self.token == token { sessionExpired() }
        }
    }

    /// Re-reads the account's premium status. Network failures keep the cached value; a rejected
    /// session ends the sign-in.
    @MainActor
    func refreshEntitlement() async {
        guard let token else { return }
        do {
            let entitlement = try await api.entitlement(token: token)
            guard self.token == token else { return }
            setServerPremium(entitlement.premium)
        } catch {
            if isUnauthorized(error), self.token == token { sessionExpired() }
        }
    }

    private func setServerPremium(_ premium: Bool) {
        serverPremium = premium
        if premium {
            UserDefaults.standard.set(true, forKey: Self.serverPremiumKey)
        } else {
            UserDefaults.standard.removeObject(forKey: Self.serverPremiumKey)
        }
    }

    @MainActor
    func signOut() async {
        let current = token
        forgetSession()
        errorMessage = nil
        onSessionChange?()
        if let current { await api.signOut(token: current) }
    }

    /// Deletes the account and its server data, then forgets the session like a sign-out.
    @MainActor
    func deleteAccount() async {
        guard let current = token, !isBusy else { return }
        errorMessage = nil
        isBusy = true
        defer { isBusy = false }
        do {
            try await api.deleteAccount(token: current)
            guard token == current else { return }
            forgetSession()
            onSessionChange?()
        } catch WaqtuAPIError.sessionStale {
            errorMessage = String(localized: "For safety, sign out, sign in again, then delete the account.")
        } catch {
            if isUnauthorized(error), token == current {
                sessionExpired()
            } else {
                errorMessage = String(localized: "Could not delete the account. Check your connection and try again.")
            }
        }
    }

    /// The server rejected the token: drop it and ask for a new sign-in.
    func sessionExpired() {
        guard token != nil else { return }
        forgetSession()
        errorMessage = "Your session expired. Sign in again to keep syncing."
        onSessionChange?()
    }

    private func forgetSession() {
        keychain.delete(Self.tokenAccount)
        keychain.delete(Self.userAccount)
        token = nil
        user = nil
        setServerPremium(false)
        linkedTransactions.removeAll()
    }
}

/// Runs one `ASWebAuthenticationSession` and returns the URL it was redirected to.
final class WebAuthRunner: NSObject, ASWebAuthenticationPresentationContextProviding {
    private var session: ASWebAuthenticationSession?

    @MainActor
    func run(url: URL, callbackScheme: String) async throws -> URL {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<URL, Error>) in
            let auth = ASWebAuthenticationSession(url: url, callbackURLScheme: callbackScheme) { [weak self] callback, error in
                self?.session = nil
                if let callback {
                    continuation.resume(returning: callback)
                } else if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
                    continuation.resume(throwing: CancellationError())
                } else {
                    continuation.resume(throwing: error ?? WaqtuAPIError.invalidResponse)
                }
            }
            auth.presentationContextProvider = self
            auth.prefersEphemeralWebBrowserSession = false
            session = auth
            if !auth.start() {
                session = nil
                continuation.resume(throwing: WaqtuAPIError.invalidResponse)
            }
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        NSApp.keyWindow ?? NSApp.windows.first ?? ASPresentationAnchor()
    }
}
