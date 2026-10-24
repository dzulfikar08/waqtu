/** Keys in the shared `settings` table that belong to the Ramadhan features. */
export const KEYS = {
  liveCountdown: "ramadhan.liveCountdown",
  liveActivityId: "ramadhan.liveActivityId",
  zakatReminder: "ramadhan.zakatReminder",
  zakatMembers: "ramadhan.zakat.members",
  zakatMode: "ramadhan.zakat.mode",
  zakatPrice: "ramadhan.zakat.pricePerKg",
  zakatCash: "ramadhan.zakat.cashPerPerson",
  fidyahMode: "ramadhan.fidyah.mode",
  fidyahPrice: "ramadhan.fidyah.pricePerKg",
  fidyahCash: "ramadhan.fidyah.cashPerDay",
  fidyahKg: "ramadhan.fidyah.kg",
} as const;
