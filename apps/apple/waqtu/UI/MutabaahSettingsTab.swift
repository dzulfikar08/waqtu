//
//  MutabaahSettingsTab.swift
//  waqtu
//
//  Settings → Mutabaah: which practices are on the checklist (the phone's item manager,
//  apps/mobile/src/app/items.tsx). The list is the account's `items` setting, so changes made
//  here show up on the phone after the next sync, and the other way round.
//

import SwiftUI

struct MutabaahSettingsTab: View {
    let sync: MutabaahSyncController

    @State private var name = ""
    @State private var kind: ItemKind = .check

    var body: some View {
        let _ = sync.revision
        let items = sync.items
        let missing = MutabaahItems.missingBuiltins(items)

        Form {
            Section {
                ForEach(items, id: \.id) { item in
                    HStack {
                        Text(MutabaahItemLabel.text(item))
                        if item.kind == .count {
                            Text("Counter")
                                .font(.caption)
                                .foregroundColor(.waqtuMuted)
                        }
                        Spacer()
                        Button {
                            sync.setItems(MutabaahItems.removeItem(items, id: item.id))
                        } label: {
                            Image(systemName: "minus.circle.fill").foregroundColor(.red.opacity(0.8))
                        }
                        .buttonStyle(.plain)
                        .help(String(localized: "Remove \(MutabaahItemLabel.text(item))"))
                    }
                }
            } header: {
                Text("My list")
            } footer: {
                Text("Every practice, including the five daily prayers, can be hidden and restored any time.")
            }

            if !missing.isEmpty {
                Section {
                    ForEach(missing, id: \.id) { item in
                        HStack {
                            Text(MutabaahItemLabel.text(item))
                            Spacer()
                            Button {
                                sync.setItems(MutabaahItems.addBuiltinItem(items, id: item.id))
                            } label: {
                                Image(systemName: "plus.circle.fill").foregroundColor(.waqtuPrimary)
                            }
                            .buttonStyle(.plain)
                            .help(String(localized: "Add \(MutabaahItemLabel.text(item))"))
                        }
                    }
                } header: {
                    Text("Available to add back")
                }
            }

            Section {
                TextField("Practice name, e.g. Read Al-Mulk", text: $name)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit { addCustom(items) }
                Picker("Type", selection: $kind) {
                    Text("Checkbox").tag(ItemKind.check)
                    Text("Counter").tag(ItemKind.count)
                }
                .pickerStyle(.segmented)
                Button("Add") { addCustom(items) }
                    .buttonStyle(.borderedProminent)
                    .tint(.waqtuPrimary)
                    .disabled(MutabaahItems.jsTrim(name).isEmpty)
            } header: {
                Text("Your own practice")
            }
        }
        .formStyle(.grouped)
        .scrollContentBackground(.hidden)
        .background(Color.waqtuBackground)
        .padding()
    }

    private func addCustom(_ items: [ItemDef]) {
        let next = MutabaahItems.addCustomItem(items, label: name, kind: kind, random: MutabaahChecklist.randomToken)
        guard next.count != items.count else { return }
        sync.setItems(next)
        name = ""
    }
}
