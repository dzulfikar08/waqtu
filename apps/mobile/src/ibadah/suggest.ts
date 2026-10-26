import type { PrayerSettings } from "../prayer/config";
import { periodAt, periodForHour } from "../prayer/period";

import type { ReaderTime } from "./content";
import { suggestedTime } from "./reader";

/** Morning or evening adhkar for `now`: by the prayer times where a location is set, else by the phone's clock. */
export function suggestTimeAt(settings: PrayerSettings | null, now: Date): ReaderTime {
  const location = settings?.location ?? null;
  const span = settings && location ? periodAt(settings, location, now) : null;
  return suggestedTime(span?.period ?? periodForHour(now.getHours()));
}
