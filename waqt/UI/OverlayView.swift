import SwiftUI

struct OverlayView: View {
    let prayerName: PrayerName
    let durationMinutes: Int
    let onDismiss: () -> Void

    @State private var countdown: Int
    @State private var currentTime: String = ""

    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    init(prayerName: PrayerName, durationMinutes: Int, onDismiss: @escaping () -> Void) {
        self.prayerName = prayerName
        self.durationMinutes = durationMinutes
        self.onDismiss = onDismiss
        self._countdown = State(initialValue: durationMinutes * 60)
    }

    var body: some View {
        ZStack {
            Color(red: 0.1, green: 0.1, blue: 0.1).ignoresSafeArea()
            VStack(spacing: 40) {
                Spacer()
                Text(prayerName.displayName)
                    .font(.system(size: 72, weight: .bold))
                    .foregroundStyle(.white)
                Text(currentTime)
                    .font(.system(size: 36, weight: .medium))
                    .foregroundStyle(.secondary)
                VStack(spacing: 8) {
                    Text("Overlay auto-dismisses in:")
                        .font(.title3)
                        .foregroundStyle(.secondary)
                    Text(countdownText)
                        .font(.system(size: 48, weight: .bold, design: .monospaced))
                        .foregroundStyle(.red)
                }
                Spacer()
                VStack(spacing: 12) {
                    Text(AppSettings.quranicQuote)
                        .font(.title2)
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                    Text(AppSettings.quranicReference)
                        .font(.title3)
                        .foregroundStyle(.secondary)
                }
                .padding(.bottom, 40)
                Button(action: onDismiss) {
                    Text("I am going to pray")
                        .font(.title2)
                        .fontWeight(.semibold)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 40)
                        .padding(.vertical, 16)
                        .background(Color.green)
                        .cornerRadius(12)
                }
                .buttonStyle(.plain)
                .padding(.bottom, 60)
            }
        }
        .onReceive(timer) { _ in
            updateCurrentTime()
            updateCountdown()
        }
        .onAppear {
            updateCurrentTime()
        }
    }

    private var countdownText: String {
        let minutes = countdown / 60
        let seconds = countdown % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }

    private func updateCurrentTime() {
        let formatter = DateFormatter()
        formatter.timeStyle = .medium
        currentTime = formatter.string(from: Date())
    }

    private func updateCountdown() {
        if countdown > 0 { countdown -= 1 }
    }
}
