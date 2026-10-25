//
//  CirclesWindowView.swift
//  waqtu
//
//  The circles window: my circles on the left, the chosen circle's feed on the right with text
//  posting, reactions, report/block, pause/resume/leave and voice note playback
//  (apps/mobile/src/circles/components, circle/[id].tsx). Recording voice notes stays on the phone.
//

import AppKit
import SwiftUI

struct CirclesWindowView: View {
    @State var model: CirclesModel

    var body: some View {
        Group {
            switch model.phase {
            case .ready:
                ready
            case .loading:
                ProgressView(mstr("circles.loading"))
            case .signedOut:
                notice(title: mstr("circles.signIn.title"), body: mstr("circles.signIn.body"),
                       action: mstr("circles.openSettings"), perform: Self.openSettings)
            case .gated:
                notice(title: mstr("circles.premium.locked"), body: mstr("circles.premium.lockedBody"),
                       action: mstr("circles.premium.see"), perform: Self.openSettings)
            case .noProfile:
                notice(title: mstr("circles.title"), body: mstr("circles.setUpOnPhone"),
                       action: mstr("circles.retry"), perform: { Task { await model.reload() } })
            case .suspended:
                notice(title: mstr("circles.title"), body: mstr("circles.errors.suspended"), action: nil, perform: {})
            case .failed(let message):
                notice(title: mstr("circles.title"), body: message,
                       action: mstr("circles.retry"), perform: { Task { await model.reload() } })
            }
        }
        .frame(minWidth: 760, minHeight: 520)
        .task { await model.reload() }
        .onDisappear { model.stopPlayback() }
    }

    /// The Mac's Settings window, where the account and Premium live.
    static func openSettings() {
        NSApp.activate(ignoringOtherApps: true)
        NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil)
    }

    private func notice(title: String, body: String, action: String?, perform: @escaping () -> Void) -> some View {
        VStack(spacing: 12) {
            Text(title).font(.title3.bold())
            Text(body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            if let action {
                Button(action, action: perform)
                    .buttonStyle(.borderedProminent)
                    .tint(.waqtuPrimary)
            }
        }
        .frame(maxWidth: 420)
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var ready: some View {
        NavigationSplitView {
            List(selection: $model.selectedId) {
                Section {
                    Text(mstr("circles.intro"))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Section(mstr("circles.myCircles")) {
                    if model.circles.isEmpty {
                        Text(mstr("circles.noCircle"))
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    ForEach(model.circles) { circle in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(Self.title(circle))
                            Text(Self.describe(circle))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .tag(Optional(circle.id))
                    }
                }
            }
            .navigationSplitViewColumnWidth(min: 220, ideal: 260)
        } detail: {
            if model.selectedId != nil {
                CircleFeedView(model: model)
            } else {
                Text(mstr("circles.selectCircle")).foregroundStyle(.secondary)
            }
        }
        .onChange(of: model.selectedId) { _, _ in
            model.selectionChanged()
            Task { await model.loadFeed() }
        }
        .task { await model.loadFeed() }
    }

    static func title(_ circle: CircleInfo) -> String {
        circle.name ?? (circle.kind == "private" ? mstr("circles.privateTitle") : mstr("circles.defaultName"))
    }

    static func describe(_ circle: CircleInfo) -> String {
        [
            mstr("circles.members \(circle.memberCount)"),
            circle.ready ? nil : mstr("circles.waiting"),
            circle.myStatus == .paused ? mstr("circles.pausedBadge") : nil,
        ]
        .compactMap { $0 }
        .joined(separator: " · ")
    }
}

private struct CircleFeedView: View {
    let model: CirclesModel
    @State private var draft = ""
    @State private var confirmLeave = false

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    header
                    if model.posts.isEmpty && !model.feedLoading {
                        Text(mstr("circles.empty")).foregroundStyle(.secondary)
                    }
                    ForEach(model.posts) { post in
                        CirclePostView(model: model, post: post, canReact: model.circle?.canPost == true)
                    }
                    if model.nextBefore != nil {
                        Button(mstr("circles.loadOlder")) { Task { await model.loadOlder() } }
                            .buttonStyle(.link)
                    }
                }
                .padding(20)
                .frame(maxWidth: 720, alignment: .leading)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            if model.circle?.canPost == true, let config = model.config {
                Divider()
                composer(maxLength: config.maxTextLength)
            }
        }
        .navigationTitle(model.circle.map(CirclesWindowView.title) ?? mstr("circles.title"))
        .toolbar {
            ToolbarItem {
                Button {
                    Task { await model.loadFeed() }
                } label: {
                    Label(mstr("circles.refresh"), systemImage: "arrow.clockwise")
                }
                .disabled(model.feedLoading)
            }
            ToolbarItem {
                Menu {
                    if model.circle?.myStatus == .paused {
                        Button(mstr("circles.menu.resume")) { Task { await model.change("resume") } }
                    } else {
                        Button(mstr("circles.menu.pause")) { Task { await model.change("pause") } }
                    }
                    Button(mstr("circles.menu.leave"), role: .destructive) { confirmLeave = true }
                } label: {
                    Label(mstr("circles.menu.title"), systemImage: "ellipsis.circle")
                }
                .disabled(model.circle == nil)
            }
        }
        .confirmationDialog(mstr("circles.menu.leave"), isPresented: $confirmLeave) {
            Button(mstr("circles.menu.leaveConfirm"), role: .destructive) { Task { await model.change("leave") } }
            Button(mstr("circles.cancel"), role: .cancel) {}
        } message: {
            Text(mstr("circles.menu.leaveBody"))
        }
    }

    @ViewBuilder
    private var header: some View {
        if let circle = model.circle {
            Text(CirclesWindowView.describe(circle))
                .font(.caption)
                .foregroundStyle(.secondary)
            if circle.myStatus == .paused {
                Text(mstr("circles.menu.pausedBanner")).foregroundStyle(.secondary)
            } else {
                Text(mstr("circles.menu.pauseBody"))
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        if let error = model.feedError {
            HStack {
                Text(error)
                Button(mstr("circles.retry")) { Task { await model.loadFeed() } }
            }
        }
        if let notice = model.notice {
            Text(notice).foregroundStyle(Color.waqtuPrimary)
        }
    }

    private func composer(maxLength: Int) -> some View {
        HStack(alignment: .bottom, spacing: 8) {
            ZStack(alignment: .topLeading) {
                TextEditor(text: $draft)
                    .font(.body)
                    .frame(minHeight: 44, maxHeight: 120)
                    .scrollContentBackground(.hidden)
                    .padding(4)
                    .background(RoundedRectangle(cornerRadius: 8).stroke(Color.secondary.opacity(0.4)))
                if draft.isEmpty {
                    Text(mstr("circles.write"))
                        .foregroundStyle(.tertiary)
                        .padding(.horizontal, 9)
                        .padding(.vertical, 4)
                        .allowsHitTesting(false)
                }
            }
            .onChange(of: draft) { _, next in
                if next.count > maxLength { draft = String(next.prefix(maxLength)) }
            }
            Button(model.posting ? mstr("circles.posting") : mstr("circles.send")) {
                Task {
                    if await model.post(draft) { draft = "" }
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(.waqtuPrimary)
            .keyboardShortcut(.return, modifiers: .command)
            .disabled(model.posting || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .padding(12)
    }
}

private struct CirclePostView: View {
    let model: CirclesModel
    let post: CirclePost
    let canReact: Bool
    @State private var confirmBlock = false
    @State private var confirmDelete = false

    private var time: String {
        Date(timeIntervalSince1970: post.createdAt / 1000)
            .formatted(.dateTime.day().month(.abbreviated).hour().minute())
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text(post.mine ? "\(post.handle) · \(mstr("circles.mine"))" : post.handle).fontWeight(.bold)
                Spacer()
                Text(time).font(.caption).foregroundStyle(.secondary)
                optionsMenu
            }
            if let ref = post.halaqahDayId {
                Text(halaqahLine(ref))
                    .font(.caption)
                    .foregroundStyle(Color.waqtuSecondary)
            }
            if let text = post.text {
                Text(text)
                    .textSelection(.enabled)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let media = post.media {
                voiceNote(media)
            }
            if let summary = post.summary {
                VStack(alignment: .leading, spacing: 2) {
                    Text(mstr("circles.summary.title")).fontWeight(.bold)
                    Text(mstr("circles.summary.days \(summary.countedDays)"))
                    Text(mstr("circles.summary.fardh \(summary.fardhOnTime) \(summary.fardhJamaah)"))
                    if summary.pages > 0 {
                        Text(mstr("circles.summary.pages \(summary.pages)"))
                    }
                }
                .padding(8)
                .background(RoundedRectangle(cornerRadius: 8).stroke(Color.secondary.opacity(0.3)))
            }
            reactions
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 10).fill(Color.secondary.opacity(0.07)))
        .confirmationDialog(mstr("circles.post.blockConfirm \(post.handle)"), isPresented: $confirmBlock) {
            Button(mstr("circles.post.block"), role: .destructive) { Task { await model.block(post) } }
            Button(mstr("circles.cancel"), role: .cancel) {}
        }
        .confirmationDialog(mstr("circles.deleteConfirm"), isPresented: $confirmDelete) {
            Button(mstr("circles.delete"), role: .destructive) { Task { await model.delete(post) } }
            Button(mstr("circles.cancel"), role: .cancel) {}
        }
    }

    private func halaqahLine(_ ref: String) -> String {
        // `<programId>:<day>` (HalaqahRef on the phone); other references are shown as they are.
        let parts = ref.split(separator: ":")
        if parts.count == 2, let day = Int(parts[1]), day >= 1 {
            return mstr("circles.halaqahDay \(day)")
        }
        return mstr("circles.halaqahLinked \(ref)")
    }

    private var optionsMenu: some View {
        Menu {
            if post.mine {
                Button(mstr("circles.delete"), role: .destructive) { confirmDelete = true }
            } else {
                Menu(mstr("circles.post.report")) {
                    reasonButtons(target: "post")
                }
                Menu(mstr("circles.post.reportUser")) {
                    reasonButtons(target: "user")
                }
                Button(mstr("circles.post.block"), role: .destructive) { confirmBlock = true }
            }
        } label: {
            Image(systemName: "ellipsis")
        }
        .menuStyle(.button)
        .buttonStyle(.borderless)
        .menuIndicator(.hidden)
        .fixedSize()
        .accessibilityLabel(mstr("circles.post.more"))
    }

    @ViewBuilder
    private func reasonButtons(target: String) -> some View {
        Section(mstr("circles.post.reportTitle")) {
            ForEach(CircleReportReason.allCases, id: \.self) { reason in
                Button(mstr(String.LocalizationValue("circles.reasons." + reason.rawValue))) {
                    Task { await model.report(post, target: target, reason: reason) }
                }
            }
        }
    }

    private func voiceNote(_ media: PostMedia) -> some View {
        HStack(spacing: 8) {
            Button {
                Task { await model.togglePlayback(media) }
            } label: {
                Label(
                    model.playingMediaId == media.id ? mstr("circles.pausePlayback") : mstr("circles.play"),
                    systemImage: model.playingMediaId == media.id ? "stop.fill" : "play.fill")
            }
            .disabled(model.loadingMediaId == media.id)
            Text(CirclesFeedMerge.duration(media.durationSeconds))
                .monospacedDigit()
                .foregroundStyle(.secondary)
            if model.failedMediaId == media.id {
                Text(mstr("circles.playFailed")).font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    private var reactions: some View {
        HStack(spacing: 6) {
            ForEach(model.config?.reactions ?? [], id: \.self) { emoji in
                let selected = post.myReaction == emoji
                let count = post.reactions[emoji] ?? 0
                Button {
                    Task { await model.react(post, emoji: emoji) }
                } label: {
                    Text(count > 0 ? "\(emoji) \(count)" : emoji)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(
                            Capsule().stroke(selected ? Color.waqtuPrimary : Color.secondary.opacity(0.4), lineWidth: selected ? 2 : 1))
                }
                .buttonStyle(.plain)
                .disabled(!canReact)
                .opacity(canReact ? 1 : 0.5)
                .accessibilityLabel(mstr("circles.reactionLabel \(emoji)"))
            }
        }
    }
}
