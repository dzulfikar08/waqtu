import type { CivilDate, RamadhanSpan } from "@waqtu/core";

/** What every Ramadhan card needs to know about "now". */
export interface RamadhanContext {
  /** Moon-sighting correction in days. */
  hijriOffset: number;
  /** IANA zone of the user's location, or the phone's while no location is set. */
  timeZone: string;
  /** Civil date in `timeZone`. */
  today: CivilDate;
  /** `today` as "YYYY-MM-DD". */
  todayIso: string;
  /** The Ramadhan containing today, or the next one. */
  span: RamadhanSpan;
}
