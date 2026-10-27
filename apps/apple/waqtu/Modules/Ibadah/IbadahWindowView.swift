//
//  IbadahWindowView.swift
//  waqtu
//
//  The Ibadah window: the tools of the phone's Ibadah tab (qibla, Al-Ma'tsurat, dzikir, doa,
//  tasbih, muhasabah) in a sidebar, the chosen tool on the right. Everything works offline.
//

import AppKit
import SwiftUI

struct IbadahWindowView: View {
    @State var model: IbadahModel

    var body: some View {
        NavigationSplitView {
            List(selection: $model.selectedTool) {
                Section {
                    IbadahTodayView(model: model)
                }
                Section(istr("ibadah.tools")) {
                    ForEach(IbadahModel.Tool.allCases) { tool in
                        Label(tool.title, systemImage: tool.systemImage)
                            .tag(Optional(tool))
                    }
                }
            }
            .navigationSplitViewColumnWidth(min: 220, ideal: 250)
        } detail: {
            detail
        }
        .frame(minWidth: 760, minHeight: 520)
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
        case nil:
            Text(istr("ibadah.hubSubtitle"))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(40)
        }
    }
}

/// The part of the day and whether its dzikir is already in the mutabaah, with a shortcut to it.
private struct IbadahTodayView: View {
    let model: IbadahModel

    var body: some View {
        // Reading the revision redraws this when the checklist changes (the replica itself is not observable).
        let _ = model.sync.revision
        let time = model.suggestedTime
        let done = model.isTicked(time)
        let timeWord = time == .pagi ? istr("ibadah.time.pagi") : istr("ibadah.time.petang")
        VStack(alignment: .leading, spacing: 6) {
            Label(time == .pagi ? istr("ibadah.heroPagi") : istr("ibadah.heroPetang"),
                  systemImage: time == .pagi ? "sun.max" : "moon")
                .font(.headline)
            Text(done ? istr("ibadah.heroDone \(timeWord)") : istr("ibadah.heroBody"))
                .font(.callout)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 8) {
                Button(istr("ibadah.matsurat.title")) { open(.matsurat, time: time) }
                Button(time == .pagi ? istr("ibadah.timeTitle.pagi") : istr("ibadah.timeTitle.petang")) {
                    open(.dzikir, time: time)
                }
            }
            .buttonStyle(.link)
        }
        .padding(.vertical, 4)
    }

    private func open(_ tool: IbadahModel.Tool, time: ReaderTime) {
        if tool == .matsurat { model.matsuratTime = time } else { model.dzikirTime = time }
        model.selectedTool = tool
    }
}
