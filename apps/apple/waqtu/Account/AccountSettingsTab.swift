//
//  AccountSettingsTab.swift
//  waqtu
//
//  Settings → Account: sign in with Apple or Google (plus email for store reviewers), sync status,
//  the opt-in cloud copy of the muhasabah journal, sign out and account deletion. The Waqtu
//  account also carries Waqtu Premium: a subscription bought on any device unlocks this Mac.
//

import SwiftUI
import AuthenticationServices

struct AccountSettingsTab: View {
    let account: WaqtuAccount
    let sync: MutabaahSyncController
    let muhasabah: MuhasabahCloudController
    @Bindable var settings: AppSettings

    @State private var appleNonce: String?
    @State private var confirmingDelete = false
    @State private var confirmingCloudDelete = false
    @State private var cloudDeleteFailed = false
    @State private var showingReviewerSignIn = false
    @State private var reviewerEmail = ""
    @State private var reviewerPassword = ""

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

            reviewerSignIn

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

    /// Email + password for store reviewers (App Store), behind a quiet link like on the phone: the
    /// server only accepts the reviewer accounts it was configured with, and nobody can sign up.
    @ViewBuilder
    private var reviewerSignIn: some View {
        if showingReviewerSignIn {
            TextField("Email", text: $reviewerEmail)
                .textContentType(.username)
                .autocorrectionDisabled()
            SecureField("Password", text: $reviewerPassword)
                .textContentType(.password)
                .onSubmit(submitReviewerSignIn)
            HStack {
                Button("Cancel") {
                    showingReviewerSignIn = false
                    reviewerPassword = ""
                }
                .disabled(account.isBusy)
                Spacer()
                Button("Sign in", action: submitReviewerSignIn)
                    .buttonStyle(.borderedProminent)
                    .tint(.waqtuPrimary)
                    .disabled(account.isBusy)
            }
        } else {
            Button {
                showingReviewerSignIn = true
            } label: {
                Text("App reviewer? Sign in with email")
                    .font(.caption)
                    .foregroundColor(.waqtuMuted)
                    .underline()
            }
            .buttonStyle(.plain)
        }
    }

    private func submitReviewerSignIn() {
        Task { @MainActor in
            if await account.signInWithEmail(email: reviewerEmail, password: reviewerPassword) {
                showingReviewerSignIn = false
                reviewerEmail = ""
                reviewerPassword = ""
            }
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
            Toggle("Sync muhasabah to the cloud", isOn: Binding(
                get: { muhasabah.isEnabled },
                set: { on in
                    muhasabah.setEnabled(on)
                    cloudDeleteFailed = false
                    if !on { confirmingCloudDelete = true }
                }
            ))
            Text("Off by default: your muhasabah notes stay on this Mac. When you turn this on they are stored on Waqtu's servers, tied to your account, so they sync with your iPhone or Android. Only you can read them.")
                .font(.caption)
                .foregroundColor(.waqtuMuted)
            if muhasabah.isEnabled {
                Text(muhasabahStatusText)
                    .font(.system(size: 12))
                    .foregroundColor(muhasabah.status == .failed ? .red.opacity(0.85) : .waqtuMuted)
            } else {
                Button("Delete cloud copy…") {
                    cloudDeleteFailed = false
                    confirmingCloudDelete = true
                }
            }
            if cloudDeleteFailed {
                Text("Could not delete the cloud copy. Check your connection and try again.")
                    .font(.caption)
                    .foregroundColor(.red.opacity(0.85))
            }
        } header: {
            Text("Muhasabah")
        }
        .confirmationDialog("Delete the muhasabah copy on Waqtu's servers?", isPresented: $confirmingCloudDelete) {
            Button("Delete cloud copy", role: .destructive) {
                Task { @MainActor in
                    let deleted = await muhasabah.deleteCloudCopy()
                    cloudDeleteFailed = !deleted
                }
            }
            Button("Keep cloud copy", role: .cancel) {}
        } message: {
            Text("Your notes on this Mac are not touched. Syncing is off, and your other devices keep their own copy.")
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
            Text("This deletes your account on our server: synced prayer checklist and settings, synced muhasabah notes, your Circles profile, posts and voice notes, and premium records linked to it. It cannot be undone. Data on this Mac stays, and so does any App Store subscription; cancel that in the App Store.")
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

    private var muhasabahStatusText: String {
        switch muhasabah.status {
        case .syncing:
            return String(localized: "Syncing…")
        case .failed:
            return String(localized: "Sync failed. Will retry.")
        case .idle, .ok:
            guard let at = muhasabah.lastSyncAt else { return String(localized: "Not synced yet") }
            return String(localized: "Synced \(at.formatted(.relative(presentation: .named)))")
        }
    }
}
