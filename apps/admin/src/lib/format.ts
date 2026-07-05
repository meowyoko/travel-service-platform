export function formatQuota(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value?: string): string {
  if (!value) {
    return "长期";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function parseDateParts(value: string): [number, number, number] {
  const [year, month, day] = value.split("-").map(Number);
  return [year ?? 0, month ?? 0, day ?? 0];
}

export function addCalendarDays(value: string, days: number): string {
  const [year, month, day] = parseDateParts(value);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function formatTravelDuration(
  departureDate?: string,
  returnDate?: string,
): string {
  if (!departureDate || !returnDate) {
    return "待确认";
  }

  const [departureYear, departureMonth, departureDay] =
    parseDateParts(departureDate);
  const [returnYear, returnMonth, returnDay] = parseDateParts(returnDate);
  const calendarDays =
    Math.round(
      (Date.UTC(returnYear, returnMonth - 1, returnDay) -
        Date.UTC(departureYear, departureMonth - 1, departureDay)) /
        86_400_000,
    ) + 1;

  return calendarDays === 1
    ? "1天"
    : `${calendarDays}天${calendarDays - 1}晚`;
}
