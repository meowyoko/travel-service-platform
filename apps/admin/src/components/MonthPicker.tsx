const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

interface MonthPickerProps {
  disabled?: boolean;
  onChange: (months: number[]) => void;
  value: number[];
}

export function MonthPicker({
  disabled = false,
  onChange,
  value,
}: MonthPickerProps) {
  function toggleMonth(month: number) {
    onChange(
      value.includes(month)
        ? value.filter((selectedMonth) => selectedMonth !== month)
        : [...value, month].sort((left, right) => left - right),
    );
  }

  return (
    <fieldset
      aria-label="适宜月份"
      className="month-picker field--wide"
      disabled={disabled}
    >
      <div className="month-picker__header">
        <span>适宜月份</span>
        <button
          className="month-picker__clear"
          disabled={disabled || value.length === 0}
          onClick={() => onChange([])}
          type="button"
        >
          清空当前选择
        </button>
      </div>
      <div className="month-picker__options">
        {MONTHS.map((month) => (
          <label key={month}>
            <input
              checked={value.includes(month)}
              onChange={() => toggleMonth(month)}
              type="checkbox"
              value={month}
            />
            <span>{month} 月</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
