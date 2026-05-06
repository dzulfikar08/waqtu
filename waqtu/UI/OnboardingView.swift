import SwiftUI
import AppKit

// MARK: - Onboarding Window

final class OnboardingWindow: NSWindow {
    private var onComplete: (() -> Void)?

    init(onComplete: @escaping () -> Void) {
        self.onComplete = onComplete
        super.init(
            contentRect: NSRect(x: 0, y: 0, width: 460, height: 520),
            styleMask: [.titled, .closable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        self.isReleasedWhenClosed = false
        self.titlebarAppearsTransparent = true
        self.title = "Welcome to Waqtu"
        self.center()
        self.level = .floating

        let hostingView = NSHostingView(rootView: OnboardingView(
            onComplete: { [weak self] in
                self?.close()
                self?.onComplete?()
            },
            onQuit: {
                NSApplication.shared.terminate(nil)
            }
        ))
        self.contentView = hostingView
    }

    override var canBecomeKey: Bool { true }
}

// MARK: - Onboarding View

struct OnboardingView: View {
    let onComplete: () -> Void
    let onQuit: () -> Void

    @State private var currentStep = 0

    private let steps = [
        OnboardingStep(
            icon: "clock.badge",
            title: "Never Miss a Prayer",
            description: "Waqtu shows prayer times right in your Mac's menu bar, with countdown to the next prayer."
        ),
        OnboardingStep(
            icon: "calendar.badge.plus",
            title: "Calendar Protection",
            description: "Automatically block your calendar during prayer times so colleagues see you as busy in Outlook and Teams."
        ),
        OnboardingStep(
            icon: "location.fill",
            title: "Let Waqtu Know Where You Are",
            description: "We use your Mac's location to calculate accurate prayer times. Your location never leaves your device — no tracking, no servers."
        ),
        OnboardingStep(
            icon: "bell.badge.fill",
            title: "Gentle Reminders",
            description: "Full-screen reminders with Adhan audio when it's time to pray. Snooze if you need a few more minutes."
        )
    ]

    var body: some View {
        VStack(spacing: 0) {
            // Header
            VStack(spacing: 8) {
                Image("AppLogo")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 56, height: 56)
                Text("Waqtu")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundColor(.waqtuText)
            }
            .padding(.top, 28)
            .padding(.bottom, 16)

            // Step indicator
            HStack(spacing: 6) {
                ForEach(0..<steps.count, id: \.self) { i in
                    Circle()
                        .fill(i == currentStep ? Color.waqtuPrimary : Color.waqtuMuted.opacity(0.3))
                        .frame(width: 8, height: 8)
                }
            }
            .padding(.bottom, 24)

            // Step content
            VStack(spacing: 16) {
                Image(systemName: steps[currentStep].icon)
                    .font(.system(size: 40))
                    .foregroundColor(.waqtuPrimary)
                    .padding(.bottom, 8)

                Text(steps[currentStep].title)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(.waqtuText)

                Text(steps[currentStep].description)
                    .font(.system(size: 13))
                    .foregroundColor(.waqtuMuted)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 40)
            }
            .frame(maxHeight: .infinity)

            // Bottom buttons
            HStack(spacing: 12) {
                if currentStep > 0 {
                    Button("Back") {
                        withAnimation { currentStep -= 1 }
                    }
                    .buttonStyle(.bordered)
                    .tint(.waqtuMuted)
                }

                Spacer()

                if currentStep < steps.count - 1 {
                    Button("Next") {
                        withAnimation { currentStep += 1 }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.waqtuPrimary)
                } else {
                    Button("Get Started") {
                        onComplete()
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.waqtuPrimary)
                }
            }
            .padding(.horizontal, 28)
            .padding(.bottom, 24)

            // Quit option
            Button("Not now") {
                onQuit()
            }
            .font(.system(size: 12))
            .foregroundColor(.waqtuMuted)
            .buttonStyle(.plain)
            .padding(.bottom, 16)
        }
        .frame(width: 420, height: 460)
        .background(Color.waqtuBackground)
    }
}

// MARK: - Onboarding Step Model

private struct OnboardingStep {
    let icon: String
    let title: String
    let description: String
}
