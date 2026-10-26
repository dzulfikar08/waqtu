//
//  AccountSettingsTab.swift
//  waqtu
//
//  Settings → Account: sign in with Apple or Google, sync status, sign out and account deletion. The Waqtu account
//  also carries Waqtu Premium: a subscription bought on any device unlocks this Mac.
//

import SwiftUI
import AuthenticationServices

struct AccountSettingsTab: View {
    let account: WaqtuAccount
    let sync: MutabaahSyncController
    @Bindable var settings: AppSettings

    @State private var appleNonce: String?
    @State private var confirmingDelete = false

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
            Text("Sign in to sync your prayer checklist and prayer settings with Waqtu on your iPhone or Android, and to use the Waqtu Premium you subscribed to there. Your location is never uploaded.")
                .font(.caption)
                .foregroundColor(.waqtuMuted)
            // Native Sign in with Apple needs the entitlement, which Apple grants to Mac App Store
            // profiles only (not Developer ID); the direct-download build offers Google instead.
            #if MAS
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
            #endif

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
                    Text(user.name?.isEmpty == false ? (user.name ?? "") : String(localized: "Waqtu account"))
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

        Section {
            if account.serverPremium {
                Label("Waqtu Premium is active on this account.", systemImage: "checkmark.seal.fill")
                    .font(.system(size: 12))
                    .foregroundColor(.waqtuPrimary)
            } else {
                Text("No Waqtu Premium on this account yet. A subscription bought in Waqtu on your iPhone or Android unlocks this Mac too.")
                    .font(.caption)
                    .foregroundColor(.waqtuMuted)
                Button("Check again") {
                    Task { @MainActor in await account.refreshEntitlement() }
                }
            }
        } header: {
            Text("Waqtu Premium")
        }

        Section {
            Button("Delete account…", role: .destructive) {
                confirmingDelete = true
            }
            .disabled(account.isBusy)
            if account.isBusy {
                ProgressView().controlSize(.small)
            }
            if let message = account.errorMessage {
                Text(message)
                    .font(.caption)
                    .foregroundColor(.red.opacity(0.85))
            }
        }
        .confirmationDialog("Delete your account?", isPresented: $confirmingDelete) {
            Button("Delete account", role: .destructive) {
                Task { @MainActor in await account.deleteAccount() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This deletes your account on our server: synced prayer checklist and settings, your Circles profile, posts and voice notes, and premium records linked to it. It cannot be undone. Data on this Mac stays, and so does any App Store subscription; cancel that in the App Store.")
        }
    }

    private var syncStatusText: String {
        switch sync.status {
        case .idle:
            return sync.lastSyncAt == nil ? String(localized: "Not synced yet") : lastSyncText
        case .syncing:
            return String(localized: "Syncing…")
        case .ok:
            return lastSyncText
        case .failed:
            return String(localized: "Sync failed. Will retry.")
        }
    }

    private var lastSyncText: String {
        guard let at = sync.lastSyncAt else { return String(localized: "Not synced yet") }
        return String(localized: "Synced \(at.formatted(.relative(presentation: .named)))")
    }
}
