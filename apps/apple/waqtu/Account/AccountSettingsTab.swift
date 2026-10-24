//
//  AccountSettingsTab.swift
//  waqtu
//
//  Settings → Account: sign in with Apple or Google, sync status, sign out, and (direct-download
//  build) linking the Polar license to the account.
//

import SwiftUI
import AuthenticationServices

#if !MAS
private enum LicenseLinkState: Equatable {
    case idle
    case linking
    case linked
    case failed(String)
    /// The server has no link endpoint yet: the button is hidden.
    case unavailable
}
#endif

struct AccountSettingsTab: View {
    let account: WaqtuAccount
    let sync: MutabaahSyncController
    let licenseManager: LicenseManager
    @Bindable var settings: AppSettings

    @State private var appleNonce: String?
    #if !MAS
    @State private var linkState: LicenseLinkState = .idle
    #endif

    var body: some View {
        Form {
            if let user = account.user, account.isSignedIn {
                signedInSections(user)
            } else {
                signInSection
            }

            Section {
                Toggle("Show iftar / imsak countdown during Ramadhan", isOn: $settings.showFastingCountdown)
                Text("Replaces the menu bar icon with the time left until iftar or imsak while it is Ramadhan.")
                    .font(.caption)
                    .foregroundColor(.waqtuMuted)
            } header: {
                Text("Ramadhan")
            }
        }
        .formStyle(.grouped)
        .scrollContentBackground(.hidden)
        .background(Color.waqtuBackground)
        .padding()
    }

    // MARK: - Signed out

    private var signInSection: some View {
        Section {
            Text("Sign in to sync your prayer checklist and prayer settings with Waqtu on your iPhone or Android. Your location is never uploaded.")
                .font(.caption)
                .foregroundColor(.waqtuMuted)

            SignInWithAppleButton(.signIn) { request in
                let nonce = WaqtuAccount.makeNonce()
                appleNonce = nonce.raw
                request.requestedScopes = [.fullName, .email]
                request.nonce = nonce.hashed
            } onCompletion: { result in
                let nonce = appleNonce
                Task { @MainActor in
                    await account.completeAppleSignIn(result, rawNonce: nonce)
                }
            }
            .signInWithAppleButtonStyle(.white)
            .frame(height: 32)
            .disabled(account.isBusy)

            Button {
                Task { @MainActor in await account.signInWithGoogle() }
            } label: {
                HStack {
                    Image(systemName: "globe")
                    Text("Sign in with Google")
                }
                .frame(maxWidth: .infinity)
            }
            .controlSize(.large)
            .disabled(account.isBusy)

            if account.isBusy {
                ProgressView().controlSize(.small)
            }
            if let message = account.errorMessage {
                Text(message)
                    .font(.caption)
                    .foregroundColor(.red.opacity(0.85))
            }
        } header: {
            Text("Waqtu account")
        }
    }

    // MARK: - Signed in

    @ViewBuilder
    private func signedInSections(_ user: AccountUser) -> some View {
        Section {
            HStack {
                Image(systemName: "person.crop.circle.fill")
                    .foregroundColor(.waqtuPrimary)
                VStack(alignment: .leading, spacing: 2) {
                    Text(user.name?.isEmpty == false ? (user.name ?? "") : "Waqtu account")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.waqtuText)
                    if let email = user.email, !email.isEmpty {
                        Text(email)
                            .font(.caption)
                            .foregroundColor(.waqtuMuted)
                    }
                }
                Spacer()
                Button("Sign out") {
                    Task { @MainActor in await account.signOut() }
                }
            }
        } header: {
            Text("Waqtu account")
        }

        Section {
            HStack {
                Text(syncStatusText)
                    .font(.system(size: 12))
                    .foregroundColor(sync.status == .failed ? .red.opacity(0.85) : .waqtuMuted)
                Spacer()
                Button("Sync now") {
                    Task { @MainActor in await sync.syncNow(force: true) }
                }
                .disabled(sync.status == .syncing)
            }
            Text("Synced: today's prayer checklist and history, calculation method, madhab and time adjustments.")
                .font(.caption)
                .foregroundColor(.waqtuMuted)
        } header: {
            Text("Sync")
        }

        #if !MAS
        licenseSection
        #endif
    }

    private var syncStatusText: String {
        switch sync.status {
        case .idle:
            return sync.lastSyncAt == nil ? "Not synced yet" : lastSyncText
        case .syncing:
            return "Syncing…"
        case .ok:
            return lastSyncText
        case .failed:
            return "Sync failed. Will retry."
        }
    }

    private var lastSyncText: String {
        guard let at = sync.lastSyncAt else { return "Not synced yet" }
        return "Synced \(at.formatted(.relative(presentation: .named)))"
    }

    // MARK: - License

    #if !MAS
    @ViewBuilder
    private var licenseSection: some View {
        if licenseManager.isLicensed, let key = licenseManager.licenseKey, linkState != .unavailable {
            Section {
                switch linkState {
                case .linked:
                    Label("License linked. Premium is active on this account.", systemImage: "checkmark.seal.fill")
                        .font(.system(size: 12))
                        .foregroundColor(.waqtuPrimary)
                default:
                    Button(linkState == .linking ? "Linking…" : "Link license to account") {
                        link(key: key)
                    }
                    .disabled(linkState == .linking)
                    if case .failed(let message) = linkState {
                        Text(message)
                            .font(.caption)
                            .foregroundColor(.red.opacity(0.85))
                    }
                    Text("Unlocks premium on your phone with the license you bought for this Mac.")
                        .font(.caption)
                        .foregroundColor(.waqtuMuted)
                }
            } header: {
                Text("License")
            }
        }
    }

    private func link(key: String) {
        guard let token = account.token else { return }
        linkState = .linking
        Task { @MainActor in
            do {
                let premium = try await account.api.linkLicense(token: token, key: key)
                linkState = premium ? .linked : .failed("The server did not activate premium for this license.")
            } catch WaqtuAPIError.notAvailable {
                linkState = .unavailable
            } catch {
                if isUnauthorized(error) { account.sessionExpired() }
                linkState = .failed(error.localizedDescription)
            }
        }
    }
    #endif
}
