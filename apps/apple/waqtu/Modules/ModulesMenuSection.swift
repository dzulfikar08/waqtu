//
//  ModulesMenuSection.swift
//  waqtu
//
//  The menu bar's one row of module buttons (Hafalan, Circles, Worship; Halaqah too where its
//  content may be released); each opens its own window (ModuleWindows).
//

import AppKit
import SwiftUI

struct ModulesMenuSection: View {
    let viewModel: AppViewModel

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 6) {
                if HalaqahModel.isAvailable {
                    moduleButton(mstr("modules.halaqah"), systemImage: "play.rectangle", action: openHalaqah)
                }
                moduleButton(mstr("modules.hafalan"), systemImage: "book", action: openHafalan)
                moduleButton(mstr("modules.circles"), systemImage: "person.3", action: openCircles)
                moduleButton(istr("ibadah.window"), systemImage: "moon.stars", action: openIbadah)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            Divider()
        }
    }

    private func moduleButton(_ title: String, systemImage: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 3) {
                Image(systemName: systemImage)
                    .font(.system(size: 14))
                    .foregroundColor(.waqtuLight)
                Text(title)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(.waqtuText)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(ModuleTileStyle())
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
        ModuleWindows.shared.open(
            .ibadah, title: istr("ibadah.window"), size: NSSize(width: 1000, height: 740),
            minSize: NSSize(width: 780, height: 540), unifiedTitlebar: true
        ) {
            IbadahWindowView(model: IbadahModel(
                viewModel: viewModel,
                store: IbadahStore(fileURL: IbadahStore.defaultFileURL()),
                journal: viewModel.muhasabahCloud.store))
        }
    }

    private func openCircles() {
        let account = viewModel.account
        ModuleWindows.shared.open(.circles, title: mstr("modules.circles"), size: NSSize(width: 980, height: 720)) {
            CirclesWindowView(model: CirclesModel(account: account))
        }
    }
}

/// Equal-width tile behind a module button's icon and name.
private struct ModuleTileStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.waqtuPrimary.opacity(configuration.isPressed ? 0.30 : 0.16))
            )
            .contentShape(RoundedRectangle(cornerRadius: 8))
    }
}
