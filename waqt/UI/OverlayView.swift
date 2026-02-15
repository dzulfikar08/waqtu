import SwiftUI
import Combine

struct OverlayView: View {
    let prayerName: PrayerName
    let durationMinutes: Int
    let onDismiss: () -> Void

    @State private var countdown: Int
    @State private var currentTime: String = ""
    @State private var isDismissing = false
    @State private var timerCancellable: AnyCancellable?

    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    init(prayerName: PrayerName, durationMinutes: Int, onDismiss: @escaping () -> Void) {
        self.prayerName = prayerName
        self.durationMinutes = durationMinutes
        self.onDismiss = onDismiss
        self._countdown = State(initialValue: durationMinutes * 60)
    }

    var body: some View {
        ZStack {
            // Background gradient matching Mutabaah style
            LinearGradient(
                colors: [Color(red: 0.102, green: 0.18, blue: 0.145), Color(red: 0.176, green: 0.37, blue: 0.30)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 40) {
                Spacer()

                // Prayer name with accent
                Text(prayerName.displayName.uppercased())
                    .font(.system(size: 64, weight: .bold))
                    .foregroundStyle(Color(red: 0.91, green: 0.94, blue: 0.93))

                // Current time
                Text(currentTime)
                    .font(.system(size: 32, weight: .medium))
                    .foregroundStyle(Color(red: 0.66, green: 0.79, blue: 0.72))

                // Countdown with circular indicator
                VStack(spacing: 16) {
                    ZStack {
                        Circle()
                            .stroke(Color.white.opacity(0.15), lineWidth: 8)
                            .frame(width: 120, height: 120)

                        Circle()
                            .trim(from: 0, to: countdownProgress)
                            .stroke(
                                LinearGradient(
                                    colors: [Color(red: 0.29, green: 0.55, blue: 0.43), Color(red: 0.42, green: 0.66, blue: 0.53)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                style: StrokeStyle(lineWidth: 8, lineCap: .round)
                            )
                            .rotationEffect(.degrees(-90))
                            .frame(width: 120, height: 120)

                        Text(countdownText)
                            .font(.system(size: 28, weight: .bold, design: .monospaced))
                            .foregroundStyle(Color(red: 0.91, green: 0.94, blue: 0.93))
                    }

                    Text("Time remaining")
                        .font(.system(size: 14))
                        .foregroundStyle(Color(red: 0.66, green: 0.79, blue: 0.72))
                }

                Spacer()

                // Quranic quote with styling
                VStack(spacing: 12) {
                    Text(AppSettings.quranicQuote)
                        .font(.system(size: 18, weight: .medium))
                        .foregroundStyle(Color(red: 0.91, green: 0.94, blue: 0.93))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 40)

                    Text(AppSettings.quranicReference)
                        .font(.system(size: 14))
                        .foregroundStyle(Color(red: 0.83, green: 0.65, blue: 0.45))
                }
                .padding(.bottom, 40)

                // Dismiss button with Mutabaah style
                Button(action: {
                    guard !isDismissing else { return }
                    isDismissing = true
                    // Stop timer immediately before triggering close to prevent use-after-free
                    timerCancellable?.cancel()
                    timerCancellable = nil
                    onDismiss()
                }) {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 20))
                        Text("I am going to pray")
                            .font(.system(size: 18, weight: .semibold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 32)
                    .padding(.vertical, 16)
                    .background(
                        LinearGradient(
                            colors: [Color(red: 0.29, green: 0.55, blue: 0.43), Color(red: 0.42, green: 0.66, blue: 0.53)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .cornerRadius(12)
                }
                .buttonStyle(.plain)
                .padding(.bottom, 60)
            }
        }
        .onAppear {
            updateCurrentTime()
            timerCancellable = timer.sink(receiveValue: { _ in
                guard !isDismissing else { return }
                updateCurrentTime()
                updateCountdown()
            })
        }
        .onDisappear {
            timerCancellable?.cancel()
            timerCancellable = nil
        }
    }

    private var countdownText: String {
        let minutes = countdown / 60
        let seconds = countdown % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }

    private var countdownProgress: CGFloat {
        guard durationMinutes > 0 else { return 0 }
        let totalSeconds = durationMinutes * 60
        return CGFloat(countdown) / CGFloat(totalSeconds)
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
