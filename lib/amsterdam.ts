const TIME_ZONE = "Europe/Amsterdam";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type AmsterdamParts = {
  dayOfWeek: number;
  year: number;
  month: number;
  day: number;
  hour: number;
  dateKey: string;
};

function partsInTimeZone(date: Date, timeZone: string) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
}

export function amsterdamParts(date = new Date()): AmsterdamParts {
  const parts = partsInTimeZone(date, TIME_ZONE);
  const month = parts.month ?? "01";
  const day = parts.day ?? "01";

  return {
    dayOfWeek: WEEKDAYS.indexOf(parts.weekday ?? ""),
    year: Number(parts.year),
    month: Number(month),
    day: Number(day),
    hour: Number(parts.hour),
    dateKey: `${parts.year}-${month}-${day}`,
  };
}

function offsetMs(date: Date, timeZone: string) {
  const parts = partsInTimeZone(date, timeZone);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - date.getTime();
}

export function amsterdamStartOfMonth(date = new Date()) {
  const { year, month } = amsterdamParts(date);
  let utc = Date.UTC(year, month - 1, 1, 0, 0, 0);
  for (let i = 0; i < 3; i++) {
    utc = Date.UTC(year, month - 1, 1, 0, 0, 0) - offsetMs(new Date(utc), TIME_ZONE);
  }
  return new Date(utc);
}

export function formatAmsterdamDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
  }).format(typeof value === "string" ? new Date(value) : value);
}
