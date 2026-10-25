//
//  CirclesModel.swift
//  waqtu
//
//  The circles window's state, driven by the same /v1/circles calls as the phone
//  (apps/mobile/src/app/(tabs)/circles.tsx and circle/[id].tsx). Circles are Premium: while the
//  server's `requiresPremium` switch is on, an account without premium sees the premium gate, like
//  the phone's PremiumGate. Joining circles and setting up the circle profile stay on the phone.
//

import AVFoundation
import Foundation
import Observation

@MainActor
@Observable
final class CirclesModel {
    enum Phase: Equatable {
        case signedOut
        case loading
        case failed(String)
        case gated
        case noProfile
        case suspended
        case ready
    }

    private(set) var phase: Phase = .loading
    private(set) var config: CirclesConfig?
    private(set) var circles: [CircleInfo] = []
    var selectedId: String?

    // Feed of the selected circle.
    private(set) var circle: CircleInfo?
    private(set) var posts: [CirclePost] = []
    private(set) var nextBefore: String?
    private(set) var feedLoading = false
    private(set) var feedError: String?
    var notice: String?
    private(set) var posting = false

    // Voice playback (one note at a time).
    private(set) var playingMediaId: String?
    private(set) var loadingMediaId: String?
    private(set) var failedMediaId: String?
    @ObservationIgnored private var player: AVAudioPlayer?
    @ObservationIgnored private var playerDelegate: PlayerDelegate?

    @ObservationIgnored private let account: WaqtuAccount
    @ObservationIgnored private var feedRun = 0

    init(account: WaqtuAccount) {
        self.account = account
    }

    private func client() -> CirclesClient? {
        guard account.isSignedIn, let token = account.token else { return nil }
        return CirclesClient(baseURL: account.api.baseURL, token: token)
    }

    static func message(for error: Error) -> String {
        let key = (error as? CirclesError)?.key ?? "generic"
        return mstr(String.LocalizationValue("circles.errors." + key))
    }

    private func handle(_ error: Error) -> String {
        if (error as? CirclesError)?.isUnauthorized == true {
            account.sessionExpired()
            phase = .signedOut
        }
        return Self.message(for: error)
    }

    // MARK: - Home

    /// Config, profile and circles, as the phone's circles tab loads them.
    func reload() async {
        guard let api = client() else {
            phase = .signedOut
            return
        }
        if phase != .ready { phase = .loading }
        do {
            let config = try await api.config()
            self.config = config
            if config.requiresPremium && !account.serverPremium {
                // The account may have bought premium on the phone since the last check.
                await account.refreshEntitlement()
                if !account.serverPremium {
                    phase = .gated
                    return
                }
            }
            guard let profile = try await api.profile() else {
                phase = .noProfile
                return
            }
            if profile.suspended {
                phase = .suspended
                return
            }
            circles = try await api.list()
            phase = .ready
            if let selectedId, !circles.contains(where: { $0.id == selectedId }) { self.selectedId = nil }
            if selectedId == nil { selectedId = circles.first?.id }
        } catch {
            let message = handle(error)
            if phase != .signedOut { phase = .failed(message) }
        }
    }

    // MARK: - Feed

    func loadFeed() async {
        guard let id = selectedId, let api = client() else { return }
        feedRun += 1
        let run = feedRun
        feedLoading = true
        defer { if run == feedRun { feedLoading = false } }
        do {
            let c = try await api.circle(id)
            let f = try await api.feed(id)
            guard run == feedRun else { return }
            self.circle = c
            posts = CirclesFeedMerge.refresh(posts, first: f.posts)
            if nextBefore == nil || f.nextBefore == nil { nextBefore = f.nextBefore }
            feedError = nil
        } catch {
            guard run == feedRun else { return }
            feedError = handle(error)
        }
    }

    /// Clears the previous circle's feed when another circle is picked.
    func selectionChanged() {
        stopPlayback()
        circle = nil
        posts = []
        nextBefore = nil
        feedError = nil
        notice = nil
    }

    func loadOlder() async {
        guard let id = selectedId, let before = nextBefore, let api = client() else { return }
        do {
            let page = try await api.feed(id, before: before)
            posts = CirclesFeedMerge.appendPage(posts, page.posts)
            nextBefore = page.nextBefore
        } catch {
            notice = handle(error)
        }
    }

    /// Posts a text reflection; returns true when it was sent.
    func post(_ text: String) async -> Bool {
        let body = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty, let id = selectedId, let api = client() else { return false }
        posting = true
        defer { posting = false }
        do {
            let post = try await api.post(id, text: body)
            posts = [post] + posts.filter { $0.id != post.id }
            notice = nil
            return true
        } catch {
            notice = handle(error)
            return false
        }
    }

    func react(_ post: CirclePost, emoji: String) async {
        guard let id = selectedId, let api = client() else { return }
        do {
            let next = try await api.react(id, postId: post.id, emoji: post.myReaction == emoji ? nil : emoji)
            if let i = posts.firstIndex(where: { $0.id == post.id }) {
                posts[i].reactions = next.reactions
                posts[i].myReaction = next.myReaction
            }
        } catch {
            notice = handle(error)
        }
    }

    func report(_ post: CirclePost, target: String, reason: CircleReportReason) async {
        guard let id = selectedId, let api = client() else { return }
        do {
            try await api.report(id, postId: post.id, target: target, reason: reason)
            notice = mstr("circles.post.reportDone")
        } catch {
            notice = handle(error)
        }
    }

    func block(_ post: CirclePost) async {
        guard let id = selectedId, let api = client() else { return }
        do {
            try await api.block(id, postId: post.id)
            posts.removeAll { $0.handle == post.handle }
            notice = mstr("circles.post.blockDone")
        } catch {
            notice = handle(error)
        }
    }

    func delete(_ post: CirclePost) async {
        guard let id = selectedId, let api = client() else { return }
        do {
            try await api.deletePost(id, postId: post.id)
            posts.removeAll { $0.id == post.id }
        } catch {
            notice = handle(error)
        }
    }

    /// Pause, resume or leave the selected circle; silent for everyone else.
    func change(_ change: String) async {
        guard let id = selectedId, let api = client() else { return }
        do {
            try await api.changeState(id, change)
            if change == "leave" {
                selectedId = nil
                selectionChanged()
                await reload()
            } else {
                await reload()
                await loadFeed()
            }
        } catch {
            notice = handle(error)
        }
    }

    // MARK: - Voice notes (playback only)

    func togglePlayback(_ media: PostMedia) async {
        if playingMediaId == media.id {
            stopPlayback()
            return
        }
        stopPlayback()
        guard let id = selectedId, let api = client() else { return }
        loadingMediaId = media.id
        failedMediaId = nil
        defer { if loadingMediaId == media.id { loadingMediaId = nil } }
        do {
            let audio = try await api.media(id, mediaId: media.id)
            guard loadingMediaId == media.id else { return }
            let player = try AVAudioPlayer(data: audio)
            let delegate = PlayerDelegate { [weak self] in
                Task { @MainActor in self?.stopPlayback() }
            }
            player.delegate = delegate
            guard player.play() else { throw CirclesError(status: nil, code: nil) }
            self.player = player
            playerDelegate = delegate
            playingMediaId = media.id
        } catch {
            if (error as? CirclesError)?.isUnauthorized == true { _ = handle(error) }
            failedMediaId = media.id
        }
    }

    func stopPlayback() {
        player?.stop()
        player = nil
        playerDelegate = nil
        playingMediaId = nil
        loadingMediaId = nil
    }

    private final class PlayerDelegate: NSObject, AVAudioPlayerDelegate {
        let onFinish: () -> Void
        init(onFinish: @escaping () -> Void) { self.onFinish = onFinish }
        func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) { onFinish() }
        func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) { onFinish() }
    }
}
