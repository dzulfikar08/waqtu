//
//  ModulesMenuSection.swift
//  waqtu
//
//  The menu bar's row of module buttons; each opens its own window (ModuleWindows). Halaqah only
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
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
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
}
