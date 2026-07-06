import type { OrderStatus } from "@travel/domain";
import type { PersonalOrderDto } from "@travel/contracts";
import { CalendarDays, ChevronRight, MapPin } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { EmployeeBottomNav } from "../components/EmployeeBottomNav";
import { EmployeeSummaryHeader } from "../components/EmployeeSummaryHeader";
import { IntentOrderTabs } from "../components/IntentOrderTabs";
import { LoadMoreButton } from "../components/LoadMoreButton";
import { useEmployeeData } from "../context/EmployeeDataContext";
import { useLoadMore } from "../hooks/useLoadMore";
import { formatDate, formatQuota } from "../lib/format";

const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; tone: string }
> = {
  pending_confirmation: { label: "待确认", tone: "pending" },
  confirmed: { label: "已确认", tone: "confirmed" },
  waiting_for_service: { label: "待出行", tone: "waiting" },
  in_service: { label: "服务中", tone: "in-service" },
  completed: { label: "已完成", tone: "completed" },
  cancelled: { label: "已取消", tone: "muted" },
};

const ORDER_FILTERS = [
  { id: "all", label: "全部" },
  { id: "upcoming", label: "待出行" },
  { id: "in_service", label: "服务中" },
  { id: "completed", label: "已完成" },
  { id: "cancelled", label: "已取消" },
] as const;

type OrderFilter = (typeof ORDER_FILTERS)[number]["id"];

function getQuotaSummary(order: PersonalOrderDto): {
  label: string;
  value: number;
} {
  if (order.status === "pending_confirmation") {
    return { label: "预计额度", value: order.plannedQuotaDeduction };
  }
  if (["completed", "cancelled"].includes(order.status)) {
    return { label: "最终消耗", value: order.finalConsumedQuota };
  }
  return { label: "已扣额度", value: order.deductedQuota };
}

export function OrdersPage() {
  const navigate = useNavigate();
  const { personalOrders, personalReviews } = useEmployeeData();
  const [activeFilter, setActiveFilter] = useState<OrderFilter>("all");
  const {
    items: orders,
    hasMore,
    isLoading,
    loadMore,
  } = useLoadMore<PersonalOrderDto>(
    "/api/employee/orders",
    { status: activeFilter === "all" ? undefined : activeFilter },
    personalOrders,
  );

  return (
    <main className="orders-page">
      <EmployeeSummaryHeader />

      <section className="orders-content">
        <div className="orders-heading">
          <h1>我的订单</h1>
          <p>查看个人服务订单、行程安排和额度使用。</p>
        </div>
        <IntentOrderTabs active="orders" />

        <div className="order-filters" aria-label="订单状态筛选">
          {ORDER_FILTERS.map((filter) => (
            <button
              className={activeFilter === filter.id ? "active" : ""}
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>

        {orders.length ? (
          <div className="order-list">
            {orders.map((order) => {
              const status = ORDER_STATUS_META[order.status];
              const quota = getQuotaSummary(order);
              const reviewed = personalReviews.some(
                ({ orderId }) => orderId === order.id,
              );

              return (
                <article
                  className={`order-card ${
                    order.status === "cancelled"
                      ? "order-card-cancelled"
                      : ""
                  }`}
                  key={order.id}
                  onClick={() => navigate(`/orders/${order.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      navigate(`/orders/${order.id}`);
                    }
                  }}
                  role="link"
                  tabIndex={0}
                >
                  <div className="order-card-topline">
                    <span className={`order-status ${status.tone}`}>
                      {status.label}
                    </span>
                    <small>{order.orderNumber}</small>
                  </div>
                  <h2>{order.productSnapshot.name}</h2>
                  <div className="order-card-meta">
                    <span>
                      <CalendarDays size={15} />
                      {order.departureDate && order.returnDate
                        ? `${formatDate(order.departureDate)} - ${formatDate(
                            order.returnDate,
                          )}`
                        : "行程日期待确认"}
                    </span>
                    <span>
                      <MapPin size={15} />
                      {order.productSnapshot.travelDetails?.destination ??
                        "服务地点待确认"}
                    </span>
                  </div>
                  <div className="order-card-footer">
                    <span>
                      <small>{quota.label}</small>
                      <strong>{formatQuota(quota.value)}</strong>
                      {order.refundedQuota > 0 ? (
                        <em>
                          已退回 {formatQuota(order.refundedQuota)}
                        </em>
                      ) : null}
                    </span>
                    <span className="order-detail-link">
                      {order.status === "completed"
                        ? reviewed
                          ? "已评价"
                          : "可评价"
                        : "查看详情"}
                      <ChevronRight size={16} />
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-orders">
            <strong>当前筛选下没有订单</strong>
            <span>订单由工作人员与您沟通确认后生成。</span>
          </div>
        )}
        <LoadMoreButton
          hasMore={hasMore}
          isLoading={isLoading}
          onClick={loadMore}
        />
      </section>

      <EmployeeBottomNav active="intents" />
    </main>
  );
}
