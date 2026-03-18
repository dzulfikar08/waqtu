import SwiftUI
import Combine
import AppKit

struct OverlayView: View {
    let prayerName: PrayerName
    let durationMinutes: Int
    let playAdhanSound: Bool
    let onDismiss: () -> Void
    let onSnooze: (Int) -> Void

    @State private var countdown: Int
    @State private var currentTime: String = ""
    @State private var isDismissing = false
    @State private var timerCancellable: AnyCancellable?
    @State private var adhanSound: NSSound?

    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    init(prayerName: PrayerName, durationMinutes: Int, playAdhanSound: Bool = false, onDismiss: @escaping () -> Void, onSnooze: @escaping (Int) -> Void) {
        self.prayerName = prayerName
        self.durationMinutes = durationMinutes
        self.playAdhanSound = playAdhanSound
        self.onDismiss = onDismiss
        self.onSnooze = onSnooze
        self._countdown = State(initialValue: durationMinutes * 60)
    }

    var body: some View {
        ZStack {
            // Enhanced animated background
            AnimatedGradientBackground()
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

                // Snooze and Dismiss buttons
                HStack(spacing: 16) {
                    Menu {
                        Button("15 minutes") { handleSnooze(15) }
                        Button("10 minutes") { handleSnooze(10) }
                        Button("5 minutes") { handleSnooze(5) }
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "bell.badge")
                                .font(.system(size: 18))
                            Text("Snooze")
                                .font(.system(size: 16, weight: .semibold))
                        }
                        .foregroundStyle(Color(red: 0.91, green: 0.94, blue: 0.93))
                        .padding(.horizontal, 24)
                        .padding(.vertical, 14)
                        .background(Color.white.opacity(0.12))
                        .cornerRadius(12)
                    }
                    .menuStyle(.borderlessButton)
                    .fixedSize()

                    // Dismiss button with Mutabaah style
                    Button(action: {
                    guard !isDismissing else { return }
                    isDismissing = true
                    stopAdhanSound()
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
                }
                .padding(.bottom, 60)
            }
        }
        .onAppear {
            updateCurrentTime()
            if playAdhanSound {
                let resourceName: String
                switch prayerName {
                case .fajr:
                    resourceName = "adhan"   // Fajr adhan
                default:
                    resourceName = "azan1"   // Other prayers
                }

                if let url = Bundle.main.url(forResource: resourceName, withExtension: "mp3") {
                    let sound = NSSound(contentsOf: url, byReference: false)
                    adhanSound = sound
                    sound?.play()
                }
            }
            timerCancellable = timer.sink(receiveValue: { _ in
                guard !isDismissing else { return }
                updateCurrentTime()
                updateCountdown()
            })
        }
        .onDisappear {
            stopAdhanSound()
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

    private func stopAdhanSound() {
        adhanSound?.stop()
        adhanSound = nil
    }

    private func handleSnooze(_ minutes: Int) {
        guard !isDismissing else { return }
        isDismissing = true
        stopAdhanSound()
        timerCancellable?.cancel()
        timerCancellable = nil
        onSnooze(minutes)
    }
}

struct AnimatedGradientBackground: View {
    @State private var animationPhase: CGFloat = 0
    
    var body: some View {
        ZStack {
            // Base gradient with multiple color stops
            MeshGradientBackground(phase: animationPhase)
            
            // Radial glow effects for depth
            RadialGradient(
                colors: [
                    Color(red: 0.29, green: 0.55, blue: 0.43).opacity(0.3),
                    Color.clear
                ],
                center: UnitPoint(x: 0.3 + animationPhase * 0.1, y: 0.2),
                startRadius: 0,
                endRadius: 400
            )
            
            RadialGradient(
                colors: [
                    Color(red: 0.42, green: 0.66, blue: 0.53).opacity(0.2),
                    Color.clear
                ],
                center: UnitPoint(x: 0.7 - animationPhase * 0.1, y: 0.8),
                startRadius: 0,
                endRadius: 350
            )
            
            // Subtle animated particles
            ParticleField()
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 8).repeatForever(autoreverses: true)) {
                animationPhase = 1.0
            }
        }
    }
}

struct MeshGradientBackground: View {
    let phase: CGFloat
    
    var body: some View {
        LinearGradient(
            stops: [
                .init(color: Color(red: 0.08, green: 0.15, blue: 0.12), location: 0.0),
                .init(color: Color(red: 0.102 + phase * 0.02, green: 0.18 + phase * 0.03, blue: 0.145 + phase * 0.02), location: 0.3),
                .init(color: Color(red: 0.14, green: 0.28, blue: 0.22), location: 0.5),
                .init(color: Color(red: 0.176 - phase * 0.02, green: 0.37 - phase * 0.03, blue: 0.30 - phase * 0.02), location: 0.7),
                .init(color: Color(red: 0.22, green: 0.42, blue: 0.35), location: 1.0)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}

struct ParticleField: View {
    @State private var particles: [Particle] = []
    
    struct Particle: Identifiable {
        let id = UUID()
        let x: CGFloat
        let y: CGFloat
        let size: CGFloat
        let opacity: Double
        let duration: Double
    }
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                ForEach(particles) { particle in
                    Circle()
                        .fill(Color.white.opacity(particle.opacity))
                        .frame(width: particle.size, height: particle.size)
                        .position(x: particle.x * geometry.size.width, y: particle.y * geometry.size.height)
                        .blur(radius: particle.size / 2)
                }
            }
            .onAppear {
                generateParticles()
            }
        }
    }
    
    private func generateParticles() {
        particles = (0..<30).map { _ in
            Particle(
                x: CGFloat.random(in: 0...1),
                y: CGFloat.random(in: 0...1),
                size: CGFloat.random(in: 1...3),
                opacity: Double.random(in: 0.1...0.3),
                duration: Double.random(in: 3...6)
            )
        }
    }
}
