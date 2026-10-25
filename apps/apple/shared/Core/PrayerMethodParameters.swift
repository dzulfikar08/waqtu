import Foundation
#if canImport(Adhan)
import Adhan

/// Builds Adhan calculation parameters for a stored method id. Shared by the Mac/iOS
/// calculators and the parity harness (apps/apple/parity), so the app's own numbers are
/// what CI compares against @waqtu/core.
public enum PrayerMethodParameters {
    /// Kemenag RI ihtiyat as method adjustments. MUST match `KEMENAG_IHTIYAT` in
    /// packages/core/src/prayer.ts (calibrated against the published Bimas Islam tables).
    public static let kemenagIhtiyat = PrayerAdjustments(fajr: 2, sunrise: -4, dhuhr: 3, asr: 2, maghrib: 3, isha: 2)

    /// Kemenag RI: Fajr 20°, Isha 18°, ihtiyat, rounding up (mirrors `baseParams("kemenag")`
    /// in packages/core/src/prayer.ts). Adhan-Swift keeps `methodAdjustments` internal, so the
    /// ihtiyat lives in `adjustments`; `make` adds user offsets on top of it.
    public static var kemenag: CalculationParameters {
        var p = CalculationMethod.other.params
        p.fajrAngle = 20
        p.ishaAngle = 18
        p.adjustments = kemenagIhtiyat
        p.rounding = .up
        return p
    }

    /// Method parameters for an id (`"kemenag"` or an `Adhan.CalculationMethod` raw value;
    /// unknown ids fall back to MWL). User offsets are applied separately via `adjustments`.
    public static func base(for method: String) -> CalculationParameters {
        if method == "kemenag" { return kemenag }
        return (CalculationMethod(rawValue: method) ?? .muslimWorldLeague).params
    }

    /// Full parameters: method base + madhab + high-latitude rule + user offsets.
    public static func make(
        method: String,
        madhab: String,
        highLatitudeRule: String,
        adjustments: PrayerAdjustmentsData
    ) -> CalculationParameters {
        var params = base(for: method)
        params.madhab = madhab == "hanafi" ? .hanafi : .shafi
        if highLatitudeRule != "auto", let rule = HighLatitudeRule(rawValue: highLatitudeRule) {
            params.highLatitudeRule = rule
        } else {
            params.highLatitudeRule = nil
        }
        let base = params.adjustments
        params.adjustments = PrayerAdjustments(
            fajr: base.fajr + adjustments.fajr,
            sunrise: base.sunrise + adjustments.sunrise,
            dhuhr: base.dhuhr + adjustments.dhuhr,
            asr: base.asr + adjustments.asr,
            maghrib: base.maghrib + adjustments.maghrib,
            isha: base.isha + adjustments.isha
        )
        return params
    }
}
#endif
