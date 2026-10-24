/** Fallback when location permission is refused: major Indonesian cities, one zone per city. */
export interface City {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  timeZone: "Asia/Jakarta" | "Asia/Makassar" | "Asia/Jayapura";
}

export const CITIES: readonly City[] = [
  {
    id: "jakarta",
    name: "Jakarta",
    latitude: -6.2088,
    longitude: 106.8456,
    timeZone: "Asia/Jakarta",
  },
  {
    id: "surabaya",
    name: "Surabaya",
    latitude: -7.2575,
    longitude: 112.7521,
    timeZone: "Asia/Jakarta",
  },
  {
    id: "bandung",
    name: "Bandung",
    latitude: -6.9175,
    longitude: 107.6191,
    timeZone: "Asia/Jakarta",
  },
  { id: "medan", name: "Medan", latitude: 3.5952, longitude: 98.6722, timeZone: "Asia/Jakarta" },
  {
    id: "semarang",
    name: "Semarang",
    latitude: -6.9667,
    longitude: 110.4167,
    timeZone: "Asia/Jakarta",
  },
  {
    id: "yogyakarta",
    name: "Yogyakarta",
    latitude: -7.7956,
    longitude: 110.3695,
    timeZone: "Asia/Jakarta",
  },
  {
    id: "malang",
    name: "Malang",
    latitude: -7.9666,
    longitude: 112.6326,
    timeZone: "Asia/Jakarta",
  },
  {
    id: "palembang",
    name: "Palembang",
    latitude: -2.9761,
    longitude: 104.7754,
    timeZone: "Asia/Jakarta",
  },
  {
    id: "makassar",
    name: "Makassar",
    latitude: -5.1477,
    longitude: 119.4327,
    timeZone: "Asia/Makassar",
  },
  {
    id: "denpasar",
    name: "Denpasar",
    latitude: -8.6705,
    longitude: 115.2126,
    timeZone: "Asia/Makassar",
  },
  {
    id: "banjarmasin",
    name: "Banjarmasin",
    latitude: -3.3194,
    longitude: 114.5908,
    timeZone: "Asia/Makassar",
  },
  {
    id: "jayapura",
    name: "Jayapura",
    latitude: -2.5337,
    longitude: 140.7181,
    timeZone: "Asia/Jayapura",
  },
];
