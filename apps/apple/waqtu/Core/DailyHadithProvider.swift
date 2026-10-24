//
//  DailyHadithProvider.swift
//  waqtu
//
//  Provides a rotating collection of hadith and duas for the prayer overlay.
//  Cycles through 30 entries (one per day of the month). Offline, no API.
//

import Foundation

struct DailyHadith {
    let text: String
    let source: String
}

final class DailyHadithProvider {
    private let hadiths: [DailyHadith] = [
        DailyHadith(text: "The most beloved of deeds to Allah are those that are consistent, even if they are few.", source: "Sahih al-Bukhari 6464"),
        DailyHadith(text: "Prayer is the pillar of the religion. Whoever establishes it has established the religion.", source: "Sunan al-Kubra"),
        DailyHadith(text: "Between a man and shirk and kufr is the abandonment of prayer.", source: "Sahih Muslim 82"),
        DailyHadith(text: "The first matter that the slave will be brought to account for on the Day of Judgment is the prayer.", source: "Sunan an-Nasa'i 3991"),
        DailyHadith(text: "When you stand for prayer, pray as if it is your last prayer.", source: "Ibn Majah"),
        DailyHadith(text: "Whoever guards his five daily prayers, they will be a light and a proof for him on the Day of Resurrection.", source: "Musnad Ahmad"),
        DailyHadith(text: "The coolness of my eyes is in prayer.", source: "Sunan an-Nasa'i 3939"),
        DailyHadith(text: "Indeed, prayer prohibits immorality and wrongdoing.", source: "Quran 29:45"),
        DailyHadith(text: "And seek help through patience and prayer.", source: "Quran 2:45"),
        DailyHadith(text: "Verily, in the remembrance of Allah do hearts find rest.", source: "Quran 13:28"),
        DailyHadith(text: "Whoever prays Fajr is under the protection of Allah.", source: "Sahih Muslim 657"),
        DailyHadith(text: "The two sunnah rak'ahs of Fajr are better than the world and all it contains.", source: "Sahih Muslim 725"),
        DailyHadith(text: "Whoever prays the two cool prayers (Fajr and Asr) will enter Paradise.", source: "Sahih al-Bukhari 574"),
        DailyHadith(text: "No prayer is heavier upon the hypocrites than Fajr and Isha.", source: "Sahih al-Bukhari 657"),
        DailyHadith(text: "Your Lord says: Call upon Me; I will respond to you.", source: "Quran 40:60"),
        DailyHadith(text: "And when My servants ask you concerning Me, indeed I am near.", source: "Quran 2:186"),
        DailyHadith(text: "Say: Indeed, my prayer, my sacrifice, my living and my dying are for Allah, Lord of the worlds.", source: "Quran 6:162"),
        DailyHadith(text: "So remember Me; I will remember you.", source: "Quran 2:152"),
        DailyHadith(text: "O you who have believed, seek help through patience and prayer. Indeed, Allah is with the patient.", source: "Quran 2:153"),
        DailyHadith(text: "The closest a servant is to his Lord is when he is prostrating.", source: "Sahih Muslim 482"),
        DailyHadith(text: "A man's prayer in congregation is twenty-seven times superior to his prayer alone.", source: "Sahih al-Bukhari 645"),
        DailyHadith(text: "If they only knew the reward in calling the adhan and being in the first row, they would draw lots for it.", source: "Sahih al-Bukhari 615"),
        DailyHadith(text: "The best of you are those who learn the Quran and teach it.", source: "Sahih al-Bukhari 5027"),
        DailyHadith(text: "Allah does not look at your bodies or your faces, but He looks at your hearts and your deeds.", source: "Sahih Muslim 2564"),
        DailyHadith(text: "Whoever relieves a believer's distress, Allah will relieve his distress on the Day of Resurrection.", source: "Sahih Muslim 2699"),
        DailyHadith(text: "The strong believer is better and more beloved to Allah than the weak believer.", source: "Sahih Muslim 2664"),
        DailyHadith(text: "Be in this world as if you were a stranger or a traveler.", source: "Sahih al-Bukhari 6416"),
        DailyHadith(text: "None of you truly believes until he loves for his brother what he loves for himself.", source: "Sahih al-Bukhari 13"),
        DailyHadith(text: "Make things easy and do not make things difficult. Give glad tidings and do not repel people.", source: "Sahih al-Bukhari 69"),
        DailyHadith(text: "Allah is gentle and loves gentleness in all matters.", source: "Sahih al-Bukhari 6024"),
    ]

    /// Get the hadith for today (cycles by day of month).
    func today() -> DailyHadith {
        let day = Calendar.current.component(.day, from: Date())
        let index = (day - 1) % hadiths.count
        return hadiths[index]
    }

    /// Get a random hadith (e.g., for variety).
    func random() -> DailyHadith {
        hadiths.randomElement() ?? hadiths[0]
    }
}
