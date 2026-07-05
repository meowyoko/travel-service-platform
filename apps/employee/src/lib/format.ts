export function formatQuota(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatSuitableMonths(months: number[]): string {
  const sorted = [...new Set(months)].sort((left, right) => left - right);
  const ranges: Array<[number, number]> = [];

  for (const month of sorted) {
    const lastRange = ranges.at(-1);
    if (lastRange && month === lastRange[1] + 1) {
      lastRange[1] = month;
    } else {
      ranges.push([month, month]);
    }
  }

  if (
    ranges.length > 1 &&
    ranges[0]?.[0] === 1 &&
    ranges.at(-1)?.[1] === 12
  ) {
    const first = ranges.shift();
    const last = ranges.pop();
    if (first && last) {
      ranges.unshift([last[0], first[1] + 12]);
    }
  }

  return ranges
    .map(([start, end]) => {
      if (end > 12) {
        return `${start}月-次年${end - 12}月`;
      }
      return start === end ? `${start}月` : `${start}-${end}月`;
    })
    .join("、");
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
