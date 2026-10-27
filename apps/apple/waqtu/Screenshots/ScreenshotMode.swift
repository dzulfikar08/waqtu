//
//  ScreenshotMode.swift
//  waqtu
//
//  DEBUG-only Mac App Store screenshots (.github/workflows/mas-screenshots.yml). When the
//  environment variable WAQTU_SCREENSHOTS_DIR is set, the app starts on demo data (Jakarta,
//  Kemenag RI, a checked mutabaah with a streak, full access as a subscriber has it, and on the
//  Upgrade pane the subscriptions with their one-week free trial), renders its real views in
//  offscreen windows, writes the store canvases as PNGs into that directory and quits.
//
//  The moment shown is the process clock: CI fixes it to a Ramadan afternoon with
//  apps/apple/scripts/screenshots/fake-clock.c and checks it with WAQTU_SCREENSHOTS_EXPECT_DAY.
//  The language is the process language (-AppleLanguages "(id)" or "(en)").
//  Demo settings and checklist entries are written into this Mac's Waqtu data: run it on a
//  throwaway machine (the CI runner), not on a Mac you use.
//

#if DEBUG
import AppKit
import ImageIO
import SwiftUI
import UniformTypeIdentifiers

enum ScreenshotMode {
    static let outputDirectory: URL? = {
        guard let path = ProcessInfo.processInfo.environment["WAQTU_SCREENSHOTS_DIR"], !path.isEmpty else { return nil }
        return URL(fileURLWithPath: path, isDirectory: true)
    }()

    static var isActive: Bool { outputDirectory != nil }

    /// The app's model in screenshot mode, built on the demo data before any view exists.
    private static var viewModel: AppViewModel?

    /// Pixels per point the views are drawn at; canvases scale them down from here.
    fileprivate static let renderScale: CGFloat = 3

    static func makeViewModelIfActive() -> AppViewModel? {
        guard isActive else { return nil }
        if let viewModel { return viewModel }
        seedSettings()
        let model = AppViewModel()
        // The app as a subscriber sees it, without a trial banner; the Upgrade pane still shows the offer.
        model.screenshotAccess = true
        #if MAS
        let freeWeek = SubscriptionTerm(value: 1, unit: .week)
        model.storeSubscription.demoOffers = [
            MacStoreSubscription.Offer(id: MacStoreSubscription.monthlyProductID, displayPrice: "Rp 29.000", freeTrial: freeWeek),
            MacStoreSubscription.Offer(id: MacStoreSubscription.yearlyProductID, displayPrice: "Rp 249.000", freeTrial: freeWeek),
        ]
        #endif
        seedMutabaah(model.syncController)
        model.calculatePrayers()
        viewModel = model
        return model
    }

    /// Renders every screen, writes the PNGs, then quits (exit 1 on failure, 3 on timeout).
    static func run() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 240) {
            NSLog("[screenshots] timed out")
            exit(3)
        }
        Task { @MainActor in
            do {
                try await renderAll()
                NSLog("[screenshots] done")
                exit(0)
            } catch {
                NSLog("[screenshots] failed: %@", String(describing: error))
                exit(1)
            }
        }
    }

    // MARK: - Demo data

    private static func seedSettings() {
        let values: [String: Any] = [
            "settingsInitialized": true,
            "hasCompletedOnboarding": true,
            "overlayEnabled": true,
            "overlayDuration": 10,
            "overlayTheme": "dark",
            "overlayPlayAdhanSound": false,
            // No notification or location prompts on the runner.
            "reminderNotificationEnabled": false,
            "reminderMinutesBefore": 5,
            "autoDetectLocation": false,
            "manualLatitude": -6.2088,
            "manualLongitude": 106.8456,
            "calculationMethod": "kemenag",
            "madhab": "shafi",
            "highLatitudeRule": "auto",
            "adjustmentFajr": 0,
            "adjustmentSunrise": 0,
            "adjustmentDhuhr": 0,
            "adjustmentAsr": 0,
            "adjustmentMaghrib": 0,
            "adjustmentIsha": 0,
            "showFastingCountdown": true,
            "calendarProtectionEnabled": false,
            "slackEnabled": false,
            "launchAtLogin": false,
        ]
        for (key, value) in values {
            UserDefaults.standard.set(value, forKey: key)
        }
    }

    /// Four weeks of kept checklists and today up to Asr. Idempotent: the id and en runs share it.
    private static func seedMutabaah(_ sync: MutabaahSyncController) {
        let today = sync.today
        for back in 1...27 {
            let day = DayKeys.addDays(today, -back)
            for fardh in Fardh.allCases {
                mark(fardh, jamaah: fardh != .isha && back % 2 == 0, day: day, sync: sync)
            }
            check(["rawatib", "dzikir_pagi", "tahajjud"], day: day, sync: sync)
            if back % 3 != 0 { check(["dzikir_petang", "dhuha"], day: day, sync: sync) }
            sync.setCount(back % 2 == 0 ? 10 : 6, itemId: "tilawah", date: day)
        }
        mark(.fajr, jamaah: true, day: today, sync: sync)
        mark(.dhuhr, jamaah: true, day: today, sync: sync)
        mark(.asr, jamaah: false, day: today, sync: sync)
        check(["rawatib", "dhuha", "tahajjud", "dzikir_pagi", "sedekah"], day: today, sync: sync)
        sync.setCount(8, itemId: "tilawah", date: today)
    }

    private static func mark(_ fardh: Fardh, jamaah: Bool, day: String, sync: MutabaahSyncController) {
        guard sync.value(date: day, itemId: fardh.rawValue) & FardhFlag.done == 0 else { return }
        sync.applyFardh(jamaah ? .jamaah : .done, fardh: fardh, date: day)
    }

    private static func check(_ ids: [String], day: String, sync: MutabaahSyncController) {
        for id in ids where sync.value(date: day, itemId: id) == 0 {
            sync.toggleCheck(itemId: id, date: day)
        }
    }

    // MARK: - Screens

    private enum Language: String {
        case id, en
    }

    private struct Caption {
        let title: String
        let subtitle: String
    }

    private struct ScreenshotError: Error, CustomStringConvertible {
        let description: String
    }

    @MainActor
    private static func renderAll() async throws {
        guard let directory = outputDirectory, let model = viewModel else {
            throw ScreenshotError(description: "no demo model")
        }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

        let language: Language = Bundle.main.preferredLocalizations.first?.hasPrefix("id") == true ? .id : .en
        let today = FardhMapping.dayKey(for: Date())
        NSLog("[screenshots] language %@, day %@, now %@ (%@), screen scale %.1f", language.rawValue, today,
              Date().description, TimeZone.current.identifier, NSScreen.main?.backingScaleFactor ?? 0)
        if let expected = ProcessInfo.processInfo.environment["WAQTU_SCREENSHOTS_EXPECT_DAY"], expected != today {
            throw ScreenshotError(description: "clock shows \(today), expected \(expected) (fake clock not loaded?)")
        }
        guard model.hasAccess else { throw ScreenshotError(description: "no access") }

        // Let the timers set the countdown and the menu bar title, and the geocoder answer.
        try await Task.sleep(nanoseconds: 2_000_000_000)
        model.calculatePrayers()
        model.locationDisplay = "Jakarta, Indonesia"

        // The Ibadah window set (.github/workflows/mac-ibadah-screenshots.yml) replaces the store canvases.
        if ProcessInfo.processInfo.environment["WAQTU_SCREENSHOTS_SET"] == "ibadah" {
            try await renderIbadah(model, language, directory)
            return
        }

        let menuBarLabel = try await capture(MenuBarLabel(title: model.fastingTitle))

        // 1. Menu bar popover, whole: next prayer, today's times, the prayer chips, modules, Pomodoro.
        let popover = try await capture(MenuBarView(viewModel: model))
        try write(
            Canvas.store(caption: caption(1, language), ui: popover, layout: .menuBar(label: menuBarLabel)),
            "\(language.rawValue)-01-prayer-times", in: directory
        )

        // 2. Mutabaah checklist and the streak report, opened.
        let mutabaah = try await capture(
            VStack(spacing: 0) {
                MutabaahChecklistView(sync: model.syncController, alwaysExpanded: true)
                Divider()
                StreakReportView(sync: model.syncController, isExpanded: true)
            }
            .frame(width: 320)
            .background(Color.waqtuBackground)
        )
        try write(Canvas.store(caption: caption(2, language), ui: mutabaah, layout: .panel), "\(language.rawValue)-02-mutabaah", in: directory)

        // 3. Imsakiyah window for the whole of Ramadan.
        let imsakiyah = try await capture(
            WindowChrome(title: String(localized: "Imsakiyah")) {
                ImsakiyahView(viewModel: model).frame(width: 560, height: 830)
            }
        )
        try write(Canvas.store(caption: caption(3, language), ui: imsakiyah, layout: .panel), "\(language.rawValue)-03-imsakiyah", in: directory)

        // 4. Settings, Prayer Times pane, tall enough for every correction.
        let settings = try await capture(
            WindowChrome(title: String(localized: "Prayer Times")) {
                PrayerTimesSettingsTab(settings: model.settings, viewModel: model).frame(width: 520, height: 700)
            }
        )
        try write(Canvas.store(caption: caption(4, language), ui: settings, layout: .panel), "\(language.rawValue)-04-settings", in: directory)

        // 5 and App Review: the Upgrade pane (Waqtu Premium), subscriptions, restore, terms and privacy.
        let upgrade = try await capture(
            WindowChrome(title: String(localized: "Upgrade")) {
                PremiumOfferView(viewModel: model)
                    .frame(width: 472, alignment: .leading)
                    .padding(24)
            }
        )
        try write(Canvas.store(caption: caption(5, language), ui: upgrade, layout: .panel), "\(language.rawValue)-05-premium", in: directory)
        try write(Canvas.review(caption: reviewCaption(language), ui: upgrade), "review-premium-\(language.rawValue)", in: directory)
    }

    // MARK: - Ibadah window (dark and light), Settings tabs

    /// The Worship window screen by screen, each in the dark and the light appearance, and the Settings
    /// window on the Upgrade and About tabs: `ibadah-<dark|light>-<lang>-<n>-<screen>.png`.
    @MainActor
    private static func renderIbadah(_ app: AppViewModel, _ language: Language, _ directory: URL) async throws {
        let ibadahFile = FileManager.default.temporaryDirectory.appendingPathComponent("waqtu-ibadah-shots-\(UUID().uuidString).json")
        let model = IbadahModel(viewModel: app, store: IbadahStore(fileURL: ibadahFile), journal: app.muhasabahCloud.store)
        seedIbadah(model)

        let screens: [(name: String, tool: IbadahModel.Tool, height: CGFloat)] = [
            ("01-qibla", .qibla, 740),
            ("02-matsurat", .matsurat, 1500),
            ("03-dzikir", .dzikir, 2200),
            ("04-doa", .doa, 740),
            ("05-tasbih", .tasbih, 960),
            ("06-muhasabah", .muhasabah, 900),
        ]
        for light in [false, true] {
            for screen in screens {
                model.selectedTool = screen.tool
                let image = try await capture(IbadahShot(model: model, height: screen.height), light: light)
                try write(image, "ibadah-\(light ? "light" : "dark")-\(language.rawValue)-\(screen.name)", in: directory)
            }
        }

        // Settings: the tab strip with every tab, on the two panes that did not respond.
        for pane in [SettingsView.Pane.upgrade, SettingsView.Pane.about] {
            SettingsView.requestedPane = pane
            let image = try await capture(
                WindowChrome(title: String(localized: "Settings")) {
                    SettingsView(settings: app.settings, viewModel: app)
                })
            try write(image, "settings-\(pane)-\(language.rawValue)", in: directory)
        }
    }

    /// Today's reading half done, a few favourites, a tasbih count and a month of muhasabah.
    @MainActor
    private static func seedIbadah(_ model: IbadahModel) {
        model.dzikirTime = .pagi
        model.matsuratTime = .pagi
        // (session, texts finished, one more text started with this many recitations).
        let progress: [(ReaderSessionID, Int, Int)] = [(.dzikirPagi, 3, 37), (.matsuratSughroPagi, 2, 0)]
        for (id, finished, started) in progress {
            guard let session = IbadahLibrary.session(id) else { continue }
            for index in 0..<finished {
                for _ in 0..<session.items[index].repeatCount { _ = model.tap(session, index: index) }
            }
            if session.items.indices.contains(finished) {
                for _ in 0..<min(started, session.items[finished].repeatCount - 1) { _ = model.tap(session, index: finished) }
            }
        }
        for category in IbadahLibrary.duas.prefix(2) {
            if let first = category.duas.first { model.toggleFavourite(first.id) }
        }
        model.tasbihChoose(.afterPrayer)
        for _ in 0..<19 { model.tasbihTap() }

        let today = model.today
        for back in 0..<14 where back % 3 != 2 {
            var entry = MuhasabahEntry(date: DayKeys.addDays(today, -back))
            entry.set(.taqwa, 6 + (back * 3) % 4)
            entry.set(.gratitude, 7 + (back * 5) % 3)
            entry.set(.energy, 5 + (back * 2) % 4)
            entry.set(.willingness, 6 + back % 3)
            if back == 0 {
                entry.set(.feelings, "Grateful for a quiet morning.")
                entry.set(.continueTomorrow, "Dhikr after Fajr.")
            }
            model.saveJournal(entry)
        }
    }

    /// The Worship window at a fixed size with the traffic lights a real window has over its sidebar.
    private struct IbadahShot: View {
        let model: IbadahModel
        let height: CGFloat

        var body: some View {
            IbadahWindowView(model: model)
                .frame(width: 1000, height: height)
                .overlay(alignment: .topLeading) {
                    HStack(spacing: 8) {
                        ForEach(["#FF5F57", "#FEBC2E", "#28C840"], id: \.self) { hex in
                            Circle().fill(Color(hex: hex)).frame(width: 12, height: 12)
                        }
                    }
                    .padding(.leading, 20)
                    .padding(.top, 17)
                }
        }
    }

    private static func caption(_ screen: Int, _ language: Language) -> Caption {
        switch (screen, language) {
        case (1, .en): return Caption(title: "Every prayer time, one click away", subtitle: "A live countdown to the next prayer, right in your menu bar")
        case (1, .id): return Caption(title: "Jadwal sholat, cukup sekali klik", subtitle: "Hitung mundur ke sholat berikutnya, langsung di menu bar")
        case (2, .en): return Caption(title: "Keep your daily ibadah on track", subtitle: "Mutabaah checklist with a gentle consistency streak")
        case (2, .id): return Caption(title: "Jaga ibadah harian tetap istiqamah", subtitle: "Checklist mutabaah dengan catatan konsistensi harian")
        case (3, .en): return Caption(title: "Ramadan timetable for your city", subtitle: "Imsak, iftar and every prayer time for the whole month")
        case (3, .id): return Caption(title: "Jadwal imsakiyah Ramadan di kotamu", subtitle: "Imsak, berbuka, dan semua waktu sholat sebulan penuh")
        case (4, .en): return Caption(title: "Calculated the way your mosque does", subtitle: "Kemenag RI, Muslim World League, Umm al-Qura and more")
        case (4, .id): return Caption(title: "Sesuai metode perhitungan masjidmu", subtitle: "Kemenag RI, Muslim World League, Umm al-Qura, dan lainnya")
        case (_, .en): return Caption(title: "One subscription for Mac, iPhone and Android", subtitle: "Waqtu Premium, with sync across your devices")
        case (_, .id): return Caption(title: "Satu langganan untuk Mac, iPhone, dan Android", subtitle: "Waqtu Premium, tersinkron di semua perangkatmu")
        }
    }

    private static func reviewCaption(_ language: Language) -> Caption {
        switch language {
        case .en: return Caption(title: "Waqtu Premium", subtitle: "Auto-renewing subscription, monthly or yearly, with a 1-week free trial")
        case .id: return Caption(title: "Waqtu Premium", subtitle: "Langganan perpanjangan otomatis, bulanan atau tahunan, dengan uji coba gratis 1 minggu")
        }
    }

    // MARK: - Rendering

    /// The menu bar item as the app draws it: the symbol and, in Ramadan, the iftar countdown.
    private struct MenuBarLabel: View {
        let title: String?

        var body: some View {
            HStack(spacing: 4) {
                if let icon = NSImage(named: "MutabaahSymbol") {
                    Image(nsImage: icon)
                        .renderingMode(.template)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 16, height: 16)
                }
                if let title {
                    Text(verbatim: title)
                        .font(.system(size: 13, weight: .medium))
                        .monospacedDigit()
                        .fixedSize()
                }
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Color.white.opacity(0.22), in: RoundedRectangle(cornerRadius: 5))
            .padding(2)
        }
    }

    /// A plain macOS title bar over a window's content (the windows are drawn without their frame).
    private struct WindowChrome<Content: View>: View {
        let title: String
        @ViewBuilder let content: Content

        var body: some View {
            VStack(spacing: 0) {
                ZStack {
                    HStack(spacing: 8) {
                        ForEach(["#FF5F57", "#FEBC2E", "#28C840"], id: \.self) { hex in
                            Circle().fill(Color(hex: hex)).frame(width: 12, height: 12)
                        }
                        Spacer()
                    }
                    .padding(.horizontal, 12)
                    Text(verbatim: title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.waqtuText.opacity(0.85))
                }
                .frame(height: 30)
                .background(Color(hex: "#21382E"))
                Rectangle().fill(Color.black.opacity(0.35)).frame(height: 1)
                content
            }
            .background(Color.waqtuBackground)
        }
    }

    /// Offscreen window drawn at `renderScale` whatever the runner's display is, made key so the
    /// controls have their active look (tinted prominent buttons).
    private final class RenderWindow: NSWindow {
        override var backingScaleFactor: CGFloat { ScreenshotMode.renderScale }
        override var canBecomeKey: Bool { true }
        override var canBecomeMain: Bool { true }
    }

    /// Draws `view` at its fitting size in an offscreen window and returns its pixels.
    @MainActor
    private static func capture<V: View>(_ view: V, light: Bool = false) async throws -> CGImage {
        let hosting = NSHostingView(rootView: view
            .environment(\.colorScheme, light ? .light : .dark)
            .environment(\.controlActiveState, .key))
        let size = hosting.fittingSize
        guard size.width >= 1, size.height >= 1 else { throw ScreenshotError(description: "empty view") }
        let window = RenderWindow(
            contentRect: CGRect(x: -20_000, y: -20_000, width: size.width, height: size.height),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        window.isReleasedWhenClosed = false
        window.appearance = NSAppearance(named: light ? .aqua : .darkAqua)
        window.backgroundColor = light ? NSColor(Color.wqCanvas) : NSColor(Color.waqtuBackground)
        hosting.frame = CGRect(origin: .zero, size: size)
        window.contentView = hosting
        NSApp.activate(ignoringOtherApps: true)
        window.makeKeyAndOrderFront(nil)
        // SwiftUI lays out, runs onAppear/task and settles its first animations.
        try await Task.sleep(nanoseconds: 1_500_000_000)
        hosting.layoutSubtreeIfNeeded()
        hosting.displayIfNeeded()

        let bounds = hosting.bounds
        guard let rep = NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: Int((bounds.width * renderScale).rounded()),
            pixelsHigh: Int((bounds.height * renderScale).rounded()),
            bitsPerSample: 8,
            samplesPerPixel: 4,
            hasAlpha: true,
            isPlanar: false,
            colorSpaceName: .deviceRGB,
            bytesPerRow: 0,
            bitsPerPixel: 0
        ) else { throw ScreenshotError(description: "bitmap") }
        rep.size = bounds.size
        hosting.cacheDisplay(in: bounds, to: rep)
        window.orderOut(nil)
        window.contentView = nil
        guard let image = rep.cgImage else { throw ScreenshotError(description: "cgImage") }
        NSLog("[screenshots] captured %@ %.0fx%.0f pt -> %ldx%ld px", String(String(describing: V.self).prefix(40)),
              size.width, size.height, image.width, image.height)
        return image
    }

    private static func write(_ image: CGImage, _ name: String, in directory: URL) throws {
        let url = directory.appendingPathComponent("\(name).png")
        guard let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
            throw ScreenshotError(description: "cannot write \(url.path)")
        }
        CGImageDestinationAddImage(destination, image, nil)
        guard CGImageDestinationFinalize(destination) else { throw ScreenshotError(description: "cannot write \(url.path)") }
        NSLog("[screenshots] wrote %@", url.lastPathComponent)
    }

    // MARK: - Canvas

    /// Store canvases: brand background, caption on top, the app UI large below it. Opaque RGB.
    private enum Canvas {
        enum Layout {
            /// The popover hanging under its menu bar item, running off the bottom edge.
            case menuBar(label: CGImage)
            /// A window or panel, fitted below the caption.
            case panel
        }

        static let background = NSColor(srgbRed: 0x1A / 255, green: 0x2E / 255, blue: 0x25 / 255, alpha: 1)
        static let dark = NSColor(srgbRed: 0x2D / 255, green: 0x5F / 255, blue: 0x4C / 255, alpha: 1)
        static let primary = NSColor(srgbRed: 0x4A / 255, green: 0x8B / 255, blue: 0x6F / 255, alpha: 1)
        static let text = NSColor(srgbRed: 0xE8 / 255, green: 0xF0 / 255, blue: 0xED / 255, alpha: 1)
        static let gold = NSColor(srgbRed: 0xD4 / 255, green: 0xA5 / 255, blue: 0x74 / 255, alpha: 1)

        /// 2880×1800, the largest Mac App Store size.
        static func store(caption: Caption, ui: CGImage, layout: Layout) throws -> CGImage {
            let size = CGSize(width: 2880, height: 1800)
            let context = try makeContext(size)
            drawBackground(context, size)
            let captionBottom = drawCaption(caption, context, size, top: 120, titleSize: 112, subtitleSize: 54)
            let uiPoints = CGSize(width: CGFloat(ui.width) / renderScale, height: CGFloat(ui.height) / renderScale)

            switch layout {
            case .menuBar(let label):
                let scale: CGFloat = 2.6
                let barTop = captionBottom + 90
                let barHeight = 24 * scale
                // Menu bar strip across the canvas, the item centred above the popover.
                context.setFillColor(NSColor.black.withAlphaComponent(0.28).cgColor)
                context.fill(flip(CGRect(x: 0, y: barTop, width: size.width, height: barHeight), size))
                let labelSize = CGSize(width: CGFloat(label.width) / renderScale * scale, height: CGFloat(label.height) / renderScale * scale)
                let labelRect = CGRect(
                    x: (size.width - labelSize.width) / 2,
                    y: barTop + (barHeight - labelSize.height) / 2,
                    width: labelSize.width,
                    height: labelSize.height
                )
                context.interpolationQuality = .high
                context.draw(label, in: flip(labelRect, size))
                let panel = CGRect(
                    x: (size.width - uiPoints.width * scale) / 2,
                    y: barTop + barHeight + 6 * scale,
                    width: uiPoints.width * scale,
                    height: uiPoints.height * scale
                )
                drawPanel(ui, in: panel, radius: 10 * scale, context, size)
            case .panel:
                let top = captionBottom + 90
                let bottom: CGFloat = 110
                let available = CGSize(width: size.width - 320, height: size.height - top - bottom)
                let scale = min(available.width / uiPoints.width, available.height / uiPoints.height, 3)
                let panelSize = CGSize(width: uiPoints.width * scale, height: uiPoints.height * scale)
                let panel = CGRect(
                    x: (size.width - panelSize.width) / 2,
                    y: top + (available.height - panelSize.height) / 2,
                    width: panelSize.width,
                    height: panelSize.height
                )
                drawPanel(ui, in: panel, radius: 10 * scale, context, size)
            }
            guard let image = context.makeImage() else { throw ScreenshotError(description: "canvas") }
            return image
        }

        /// 2560×1600 App Review screenshot of the subscription offer.
        static func review(caption: Caption, ui: CGImage) throws -> CGImage {
            let size = CGSize(width: 2560, height: 1600)
            let context = try makeContext(size)
            drawBackground(context, size)
            let captionBottom = drawCaption(caption, context, size, top: 90, titleSize: 84, subtitleSize: 44)
            let uiPoints = CGSize(width: CGFloat(ui.width) / renderScale, height: CGFloat(ui.height) / renderScale)
            let top = captionBottom + 70
            let available = CGSize(width: size.width - 240, height: size.height - top - 80)
            let scale = min(available.width / uiPoints.width, available.height / uiPoints.height, 3)
            let panel = CGRect(
                x: (size.width - uiPoints.width * scale) / 2,
                y: top + (available.height - uiPoints.height * scale) / 2,
                width: uiPoints.width * scale,
                height: uiPoints.height * scale
            )
            drawPanel(ui, in: panel, radius: 10 * scale, context, size)
            guard let image = context.makeImage() else { throw ScreenshotError(description: "canvas") }
            return image
        }

        private static func makeContext(_ size: CGSize) throws -> CGContext {
            guard let space = CGColorSpace(name: CGColorSpace.sRGB),
                  let context = CGContext(
                      data: nil,
                      width: Int(size.width),
                      height: Int(size.height),
                      bitsPerComponent: 8,
                      bytesPerRow: 0,
                      space: space,
                      bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
                  )
            else { throw ScreenshotError(description: "context") }
            return context
        }

        /// Top-left based rect → Core Graphics' bottom-left space.
        private static func flip(_ rect: CGRect, _ size: CGSize) -> CGRect {
            CGRect(x: rect.minX, y: size.height - rect.maxY, width: rect.width, height: rect.height)
        }

        private static func drawBackground(_ context: CGContext, _ size: CGSize) {
            context.setFillColor(background.cgColor)
            context.fill(CGRect(origin: .zero, size: size))
            let space = CGColorSpace(name: CGColorSpace.sRGB)
            if let linear = CGGradient(
                colorsSpace: space,
                colors: [dark.cgColor, background.cgColor] as CFArray,
                locations: [0, 1]
            ) {
                context.drawLinearGradient(
                    linear,
                    start: CGPoint(x: 0, y: size.height),
                    end: CGPoint(x: size.width * 0.55, y: 0),
                    options: [.drawsAfterEndLocation]
                )
            }
            if let glow = CGGradient(
                colorsSpace: space,
                colors: [primary.withAlphaComponent(0.38).cgColor, primary.withAlphaComponent(0).cgColor] as CFArray,
                locations: [0, 1]
            ) {
                let center = CGPoint(x: size.width * 0.5, y: size.height * 0.28)
                context.drawRadialGradient(glow, startCenter: center, startRadius: 0, endCenter: center, endRadius: size.width * 0.48, options: [])
            }
        }

        /// Centred title and subtitle from `top`; returns the bottom of the subtitle (top-left based).
        private static func drawCaption(
            _ caption: Caption, _ context: CGContext, _ size: CGSize,
            top: CGFloat, titleSize: CGFloat, subtitleSize: CGFloat
        ) -> CGFloat {
            let previous = NSGraphicsContext.current
            NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
            defer { NSGraphicsContext.current = previous }

            let maxWidth = size.width - 240
            let title = fitted(caption.title, size: titleSize, weight: .bold, color: text, maxWidth: maxWidth)
            let subtitle = fitted(caption.subtitle, size: subtitleSize, weight: .medium, color: gold, maxWidth: maxWidth)
            let titleBounds = title.size()
            let subtitleBounds = subtitle.size()
            title.draw(at: CGPoint(x: (size.width - titleBounds.width) / 2, y: size.height - top - titleBounds.height))
            let subtitleTop = top + titleBounds.height + subtitleSize * 0.45
            subtitle.draw(at: CGPoint(x: (size.width - subtitleBounds.width) / 2, y: size.height - subtitleTop - subtitleBounds.height))
            return subtitleTop + subtitleBounds.height
        }

        /// One line at `size`, shrunk until it fits `maxWidth`.
        private static func fitted(_ string: String, size: CGFloat, weight: NSFont.Weight, color: NSColor, maxWidth: CGFloat) -> NSAttributedString {
            var pointSize = size
            while true {
                let attributed = NSAttributedString(string: string, attributes: [
                    .font: NSFont.systemFont(ofSize: pointSize, weight: weight),
                    .foregroundColor: color,
                    .kern: -pointSize * 0.01,
                ])
                if attributed.size().width <= maxWidth || pointSize < 24 { return attributed }
                pointSize -= 2
            }
        }

        /// The UI with rounded corners, a soft shadow and a hairline border.
        private static func drawPanel(_ image: CGImage, in rect: CGRect, radius: CGFloat, _ context: CGContext, _ size: CGSize) {
            let frame = flip(rect, size)
            let path = CGPath(roundedRect: frame, cornerWidth: radius, cornerHeight: radius, transform: nil)
            context.saveGState()
            context.setShadow(offset: CGSize(width: 0, height: -24), blur: 90, color: NSColor.black.withAlphaComponent(0.55).cgColor)
            context.addPath(path)
            context.setFillColor(background.cgColor)
            context.fillPath()
            context.restoreGState()

            context.saveGState()
            context.addPath(path)
            context.clip()
            context.interpolationQuality = .high
            context.draw(image, in: frame)
            context.restoreGState()

            context.saveGState()
            context.addPath(path)
            context.setStrokeColor(NSColor.white.withAlphaComponent(0.14).cgColor)
            context.setLineWidth(3)
            context.strokePath()
            context.restoreGState()
        }
    }
}
#endif
