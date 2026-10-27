//
//  ModulesMenuSection.swift
//  waqtu
//
//  The menu bar's rows of module buttons; each opens its own window (ModuleWindows). Halaqah only
//  shows when its content may be released in this build.
//

import AppKit
import SwiftUI

struct ModulesMenuSection: View {
    let viewModel: AppViewModel

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                if HalaqahModel.isAvailable {
                    moduleButton(mstr("modules.halaqah"), systemImage: "play.rectangle", action: openHalaqah)
                }
                moduleButton(mstr("modules.hafalan"), systemImage: "book", action: openHafalan)
                moduleButton(mstr("modules.circles"), systemImage: "person.3", action: openCircles)
            }
            .padding(.horizontal, 16)
            .padding(.top, 10)
            HStack(spacing: 8) {
                moduleButton(istr("ibadah.window"), systemImage: "moon.stars", action: openIbadah)
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 10)
            Divider()
        }
    }

    private func moduleButton(_ title: String, systemImage: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.system(size: 12, weight: .medium))
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(.bordered)
        .tint(.waqtuPrimary)
        .foregroundColor(.waqtuText)
    }

    private func openHalaqah() {
        guard let program = HalaqahModel.bundled else { return }
        let sync = viewModel.syncController
        ModuleWindows.shared.open(.halaqah, title: mstr("modules.halaqah"), size: NSSize(width: 1000, height: 720)) {
            HalaqahWindowView(model: HalaqahModel(
                program: program,
                store: HalaqahStore(fileURL: HalaqahStore.defaultFileURL()),
                sync: sync))
        }
    }

    private func openHafalan() {
        guard let text = HafalanModel.bundledText else { return }
        ModuleWindows.shared.open(.hafalan, title: mstr("modules.hafalan"), size: NSSize(width: 1000, height: 760)) {
            HafalanWindowView(model: HafalanModel(
                text: text,
                store: HafalanPlanStore(fileURL: HafalanPlanStore.defaultFileURL())))
        }
    }

    private func openIbadah() {
        ModuleWindows.shared.open(.ibadah, title: istr("ibadah.window"), size: NSSize(width: 980, height: 720)) {
            IbadahWindowView(model: IbadahModel(
                viewModel: viewModel,
                store: IbadahStore(fileURL: IbadahStore.defaultFileURL()),
                journal: MuhasabahStore(fileURL: MuhasabahStore.defaultFileURL())))
        }
    }

    private func openCircles() {
        let account = viewModel.account
        ModuleWindows.shared.open(.circles, title: mstr("modules.circles"), size: NSSize(width: 980, height: 720)) {
            CirclesWindowView(model: CirclesModel(account: account))
        }
    }
}
