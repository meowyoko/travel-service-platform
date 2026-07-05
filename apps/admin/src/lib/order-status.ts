import type { OrderStatus } from "@travel/domain";

export const orderStatusMeta = {
  pending_confirmation: { label: "待确认", tone: "warning" },
  confirmed: { label: "已确认", tone: "positive" },
  waiting_for_service: { label: "待出行", tone: "positive" },
  in_service: { label: "服务中", tone: "positive" },
  completed: { label: "已完成", tone: "muted" },
  cancelled: { label: "已取消", tone: "muted" },
} as const satisfies Record<
  OrderStatus,
  {
    label: string;
    tone: "warning" | "positive" | "muted";
  }
>;
