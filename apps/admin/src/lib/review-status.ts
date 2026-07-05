import type { ReviewStatus } from "@travel/domain";

export const reviewStatusMeta = {
  pending_review: { label: "待审核", tone: "warning" },
  published: { label: "已展示", tone: "positive" },
  hidden: { label: "已隐藏", tone: "muted" },
} as const satisfies Record<
  ReviewStatus,
  { label: string; tone: "warning" | "positive" | "muted" }
>;
