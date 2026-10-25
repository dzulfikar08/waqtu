//
//  YouTubeEmbedView.swift
//  waqtu
//
//  The day's talk as a YouTube embed (youtube-nocookie, no autoplay), never downloaded. The top
//  frame may only show the embed (HalaqahEmbed.isEmbedNavigation); links the player opens go to the
//  default browser.
//

import AppKit
import SwiftUI
import WebKit

struct YouTubeEmbedView: NSViewRepresentable {
    let youtubeId: String

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.mediaTypesRequiringUserActionForPlayback = .all
        config.preferences.isElementFullscreenEnabled = true
        // No cookies or storage outlive the window.
        config.websiteDataStore = .nonPersistent()
        let view = WKWebView(frame: .zero, configuration: config)
        view.navigationDelegate = context.coordinator
        view.uiDelegate = context.coordinator
        load(view, coordinator: context.coordinator)
        return view
    }

    func updateNSView(_ view: WKWebView, context: Context) {
        if context.coordinator.loadedId != youtubeId { load(view, coordinator: context.coordinator) }
    }

    static func dismantleNSView(_ view: WKWebView, coordinator: Coordinator) {
        view.stopLoading()
        view.loadHTMLString("", baseURL: nil)
    }

    private func load(_ view: WKWebView, coordinator: Coordinator) {
        coordinator.loadedId = youtubeId
        guard let html = HalaqahEmbed.embedHTML(youtubeId) else { return }
        view.loadHTMLString(html, baseURL: URL(string: HalaqahEmbed.origin))
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        var loadedId: String?

        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
            let url = action.request.url?.absoluteString ?? "about:blank"
            let isTopFrame = action.targetFrame?.isMainFrame ?? true
            if HalaqahEmbed.isEmbedNavigation(url, isTopFrame: isTopFrame) { return .allow }
            openExternally(action.request.url, userInitiated: action.navigationType == .linkActivated)
            return .cancel
        }

        /// "Watch on YouTube" and similar links ask for a new window: open them in the browser.
        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for action: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            openExternally(action.request.url, userInitiated: true)
            return nil
        }

        private func openExternally(_ url: URL?, userInitiated: Bool) {
            guard userInitiated, let url, url.scheme == "https" else { return }
            NSWorkspace.shared.open(url)
        }
    }
}
