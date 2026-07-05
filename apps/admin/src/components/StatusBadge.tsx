interface StatusBadgeProps {
  tone: "positive" | "muted" | "warning";
  children: string;
}

export function StatusBadge({ tone, children }: StatusBadgeProps) {
  return <span className={`status-badge status-badge--${tone}`}>{children}</span>;
}
