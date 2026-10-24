import SwiftUI

/// Browse curated murattal / dzikr / sholawat audio, download, and pick one as
/// the Pomodoro break sound. Presented as a sheet from Settings → Pomodoro.
struct AudioBrowserView: View {
    @Bindable var settings: AppSettings
    @Bindable var audioLibrary: AudioLibraryManager
    @State private var category: AudioCategory = .murattal
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Break Audio")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(.waqtuText)
                Spacer()
                Button("Done") { dismiss() }
                    .buttonStyle(.bordered)
                    .tint(.waqtuPrimary)
            }
            .padding(12)

            Picker("Category", selection: $category) {
                ForEach(AudioCategory.allCases) { c in
                    Label(c.displayName, systemImage: c.symbolName).tag(c)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 12)
            .padding(.bottom, 8)

            List {
                ForEach(audioLibrary.items(in: category)) { item in
                    AudioRow(
                        item: item,
                        audioLibrary: audioLibrary,
                        isSelected: isSelected(item),
                        onSelect: { select(item) }
                    )
                    .listRowBackground(Color.clear)
                    .listRowSeparatorTint(Color.waqtuDark.opacity(0.4))
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
        }
        .background(Color.waqtuBackground)
        .frame(width: 460, height: 520)
    }

    private func isSelected(_ item: AudioItem) -> Bool {
        settings.breakAudio == "downloaded" && settings.downloadedAudioId == item.id
    }

    private func select(_ item: AudioItem) {
        settings.breakAudio = "downloaded"
        settings.downloadedAudioId = item.id
        dismiss()
    }
}

private struct AudioRow: View {
    let item: AudioItem
    @Bindable var audioLibrary: AudioLibraryManager
    let isSelected: Bool
    let onSelect: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(.waqtuText)
                Text(item.subtitle)
                    .font(.system(size: 11))
                    .foregroundColor(.waqtuMuted)
                Text(item.attribution)
                    .font(.system(size: 10))
                    .foregroundColor(.waqtuMuted)
                    .opacity(0.7)
            }
            Spacer()
            statusView
        }
        .padding(.vertical, 6)
    }

    @ViewBuilder
    private var statusView: some View {
        switch audioLibrary.status(for: item.id) {
        case .notStarted:
            Button { audioLibrary.download(item) } label: {
                Image(systemName: "arrow.down.circle")
            }
            .buttonStyle(.borderless)
            .tint(.waqtuPrimary)
        case .downloading:
            ProgressView().controlSize(.small)
        case .downloaded:
            HStack(spacing: 6) {
                if isSelected {
                    Image(systemName: "checkmark.circle.fill").foregroundColor(.waqtuPrimary)
                }
                Button("Select", action: onSelect)
                    .buttonStyle(.bordered)
                    .tint(.waqtuPrimary)
                    .controlSize(.small)
                Button { audioLibrary.remove(item) } label: {
                    Image(systemName: "trash")
                }
                .buttonStyle(.borderless)
                .tint(.waqtuMuted)
            }
        case .failed:
            Button { audioLibrary.download(item) } label: {
                Image(systemName: "exclamationmark.arrow.circlepath")
            }
            .buttonStyle(.borderless)
            .tint(.waqtuSecondary)
            .help("Download failed — tap to retry")
        }
    }
}
