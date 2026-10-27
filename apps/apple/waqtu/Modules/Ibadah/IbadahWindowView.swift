//
//  IbadahWindowView.swift
//  waqtu
//
//  The Ibadah window: the tools of the phone's Ibadah tab (qibla, Al-Ma'tsurat, dzikir, doa,
//  tasbih, muhasabah) in a branded sidebar, the chosen tool on the right under its own opaque
//  header. Everything works offline. The window runs up behind a transparent title bar
//  (ModuleWindows `unifiedTitlebar`): the traffic lights sit over the sidebar, and the sidebar
//  leaves room for them.
//
//  The sidebar is a column of plain buttons, not a `List(selection:)`: the old list tagged its rows
//  with `Optional(tool)` while a `List` over an optional selection matches non-optional tags, so no
//  row ever matched the selection and a click changed nothing.
//

import AppKit
import SwiftUI

struct IbadahWindowView: View {
    @State var model: IbadahModel

    /// Room above the sidebar for the traffic lights.
    static let titlebarInset: CGFloat = 46
    static let sidebarWidth: CGFloat = 244

    var body: some View {
        HStack(spacing: 0) {
            IbadahSidebar(model: model)
                .frame(width: Self.sidebarWidth)
            Rectangle().fill(Color.wqStroke).frame(width: 1)
            detail
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.wqCanvas)
        }
        .frame(minWidth: 780, minHeight: 540)
        .background(Color.wqCanvas)
        .ignoresSafeArea()
        .onAppear { model.refresh() }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            model.refresh()
        }
    }

    @ViewBuilder
    private var detail: some View {
        switch model.selectedTool {
        case .qibla:
            QiblaView(viewModel: model.viewModel, locationManager: model.viewModel.locationManager)
        case .matsurat:
            MatsuratReaderView(model: model)
        case .dzikir:
            DzikirReaderView(model: model)
        case .doa:
            DoaView(model: model)
        case .tasbih:
            TasbihView(model: model)
        case .muhasabah:
            MuhasabahView(model: model)
        }
    }
}

// MARK: - Sidebar

private struct IbadahSidebar: View {
    let model: IbadahModel

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            brand
                .padding(.top, IbadahWindowView.titlebarInset)
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    IbadahTodayCard(model: model)
                    VStack(alignment: .leading, spacing: 2) {
                        WQLabel(text: istr("ibadah.tools"))
                            .padding(.horizontal, 10)
                            .padding(.bottom, 4)
                        ForEach(Array(IbadahModel.Tool.allCases.enumerated()), id: \.element) { index, tool in
                            IbadahSidebarRow(
                                tool: tool,
                                shortcut: index + 1,
                                selected: model.selectedTool == tool
                            ) {
                                model.selectedTool = tool
                            }
                        }
                    }
                }
                .padding(.horizontal, 12)
                .padding(.bottom, 16)
            }
        }
        .frame(maxHeight: .infinity, alignment: .top)
        .background(Color.wqSidebar)
    }

    private var brand: some View {
        HStack(spacing: 10) {
            Image(systemName: "moon.stars.fill")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.white)
                .frame(width: 30, height: 30)
                .background(RoundedRectangle(cornerRadius: WQ.controlRadius, style: .continuous).fill(Color.wqAccentFill))
                .accessibilityHidden(true)
            Text(istr("ibadah.window"))
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Color.wqInk)
        }
    }
}

/// One tool in the sidebar: green and filled when selected, a faint wash on hover.
private struct IbadahSidebarRow: View {
    let tool: IbadahModel.Tool
    let shortcut: Int
    let selected: Bool
    let action: () -> Void
    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: selected ? tool.selectedImage : tool.systemImage)
                    .font(.system(size: 14, weight: .medium))
                    .frame(width: 22)
                Text(tool.title)
                    .font(.system(size: 13.5, weight: selected ? .semibold : .medium))
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            .foregroundStyle(selected ? Color.wqAccent : Color.wqInk)
            .padding(.horizontal, 10)
            .frame(height: 36)
            .background(
                RoundedRectangle(cornerRadius: WQ.controlRadius, style: .continuous)
                    .fill(selected ? Color.wqAccent.opacity(0.16) : (hovering ? Color.wqInk.opacity(0.06) : Color.clear)))
            .contentShape(RoundedRectangle(cornerRadius: WQ.controlRadius, style: .continuous))
        }
        .buttonStyle(WQPressStyle(scale: 0.98))
        .onHover { hovering = $0 }
        .keyboardShortcut(KeyEquivalent(Character("\(shortcut)")), modifiers: .command)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

/// The part of the day and whether its dzikir is already in the mutabaah, with a shortcut to it: a
/// gold callout while there is something to read, green once it is recorded.
private struct IbadahTodayCard: View {
    let model: IbadahModel

    var body: some View {
        // Reading the revision redraws this when the checklist changes (the replica itself is not observable).
        let _ = model.sync.revision
        let time = model.suggestedTime
        let done = model.isTicked(time)
        let timeWord = time == .pagi ? istr("ibadah.time.pagi") : istr("ibadah.time.petang")
        let tint = done ? Color.wqAccent : Color.wqGold
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: done ? "checkmark.circle.fill" : (time == .pagi ? "sun.max.fill" : "moon.fill"))
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(tint)
                    .accessibilityHidden(true)
                Text(time == .pagi ? istr("ibadah.heroPagi") : istr("ibadah.heroPetang"))
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(Color.wqInk)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Text(done ? istr("ibadah.heroDone \(timeWord)") : istr("ibadah.heroBody"))
                .font(.system(size: 12))
                .foregroundStyle(Color.wqInkMuted)
                .fixedSize(horizontal: false, vertical: true)
            VStack(spacing: 6) {
                Button(istr("ibadah.matsurat.title")) { open(.matsurat, time: time) }
                Button(time == .pagi ? istr("ibadah.timeTitle.pagi") : istr("ibadah.timeTitle.petang")) {
                    open(.dzikir, time: time)
                }
            }
            .buttonStyle(WQTintedButtonStyle(tint: tint, fillsWidth: true))
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: WQ.cardRadius, style: .continuous).fill(tint.opacity(0.11)))
        .overlay(RoundedRectangle(cornerRadius: WQ.cardRadius, style: .continuous).strokeBorder(tint.opacity(0.28), lineWidth: 1))
    }

    private func open(_ tool: IbadahModel.Tool, time: ReaderTime) {
        model.navigation.openReader(tool, time: time)
    }
}

// MARK: - A tool's page

/// The page of one tool: an opaque header (title, subtitle, whatever the tool puts on the right), an
/// optional row of controls, and the content under them. The content scrolls below the header, never
/// behind it. `progress` draws a thin bar along the header's lower edge.
struct IbadahScreen<Content: View>: View {
    let title: String
    var subtitle: String?
    var progress: Double?
    var trailing: AnyView?
    var controls: AnyView?
    @ViewBuilder let content: Content

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 0) {
                WQHeader(title: title, subtitle: subtitle) {
                    if let trailing { trailing }
                }
                .padding(.horizontal, 28)
                .padding(.top, 18)
                .padding(.bottom, controls == nil ? 14 : 12)
                if let controls {
                    controls
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 28)
                        .padding(.bottom, 12)
                }
                rule
            }
            .background(Color.wqCanvas)
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private var rule: some View {
        ZStack(alignment: .leading) {
            Rectangle().fill(Color.wqStroke).frame(height: 1)
            if let progress {
                GeometryReader { proxy in
                    Rectangle()
                        .fill(Color.wqAccent)
                        .frame(width: proxy.size.width * max(0, min(1, progress)), height: 2)
                        .animation(.easeOut(duration: 0.25), value: progress)
                }
                .frame(height: 2)
            }
        }
        .frame(height: progress == nil ? 1 : 2)
    }
}
