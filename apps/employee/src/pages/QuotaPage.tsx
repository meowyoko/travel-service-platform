import type { QuotaTransactionType } from "@travel/domain";
import { ChevronRight, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { EmployeeBottomNav } from "../components/EmployeeBottomNav";
import { EmployeeSummaryHeader } from "../components/EmployeeSummaryHeader";
import { useEmployeeData } from "../context/EmployeeDataContext";
import { formatDateTime, formatQuota } from "../lib/format";

const TRANSACTION_META: Record<
  QuotaTransactionType,
  { label: string; tone: string }
> = {
  grant: { label: "发放", tone: "grant" },
  deduction: { label: "扣减", tone: "deduction" },
  refund: { label: "退回", tone: "refund" },
  adjustment: { label: "调整", tone: "adjustment" },
};

const TRANSACTION_FILTERS = [
  { id: "all", label: "全部" },
  { id: "grant", label: "发放" },
  { id: "deduction", label: "扣减" },
  { id: "refund", label: "退回" },
  { id: "adjustment", label: "调整" },
] as const;

type TransactionFilter = (typeof TRANSACTION_FILTERS)[number]["id"];

function formatSignedQuota(value: number): string {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${formatQuota(Math.abs(value))}`;
}

export function QuotaPage() {
  const navigate = useNavigate();
  const {
    personalOrders,
    personalQuotaTransactions,
    quotaAccount,
  } = useEmployeeData();
  const [activeFilter, setActiveFilter] =
    useState<TransactionFilter>("all");
  const transactions = useMemo(
    () =>
      [...personalQuotaTransactions]
        .filter(
          ({ type }) => activeFilter === "all" || type === activeFilter,
        )
        .sort((left, right) =>
          right.occurredAt.localeCompare(left.occurredAt),
        ),
    [activeFilter, personalQuotaTransactions],
  );
  const totalConsumed = Math.max(
    0,
    (quotaAccount?.totalDeducted ?? 0) -
      (quotaAccount?.totalRefunded ?? 0),
  );

  return (
    <main className="quota-page">
      <EmployeeSummaryHeader />

      <section className="quota-content">
        <section className="quota-overview">
          <span>当前可用额度</span>
          <strong>{formatQuota(quotaAccount?.availableBalance ?? 0)}</strong>
          <div>
            <span>
              <small>累计发放</small>
              <strong>{formatQuota(quotaAccount?.totalGranted ?? 0)}</strong>
            </span>
            <span>
              <small>已消耗</small>
              <strong>{formatQuota(totalConsumed)}</strong>
            </span>
            <span>
              <small>已退回</small>
              <strong>
                {formatQuota(quotaAccount?.totalRefunded ?? 0)}
              </strong>
            </span>
          </div>
        </section>

        <div className="quota-heading">
          <span>
            <h1>额度明细</h1>
            <p>查看每一次额度发放、扣减、退回和调整。</p>
          </span>
          <SlidersHorizontal size={18} />
        </div>

        <div className="quota-filters" aria-label="额度流水类型筛选">
          {TRANSACTION_FILTERS.map((filter) => (
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

        {transactions.length ? (
          <div className="quota-transaction-list">
            {transactions.map((transaction) => {
              const meta = TRANSACTION_META[transaction.type];
              const relatedOrder = personalOrders.find(
                ({ id }) => id === transaction.relatedOrderId,
              );

              return (
                <article
                  className="quota-transaction"
                  key={transaction.id}
                >
                  <div className="quota-transaction-topline">
                    <span className={`quota-type ${meta.tone}`}>
                      {meta.label}
                    </span>
                    <time>{formatDateTime(transaction.occurredAt)}</time>
                  </div>
                  <p>{transaction.reason}</p>
                  <div className="quota-transaction-result">
                    <span>
                      <small>变动后余额</small>
                      <strong>
                        {formatQuota(transaction.balanceAfter)}
                      </strong>
                    </span>
                    <strong
                      className={
                        transaction.amount < 0 ? "negative" : "positive"
                      }
                    >
                      {formatSignedQuota(transaction.amount)}
                    </strong>
                  </div>
                  {relatedOrder ? (
                    <button
                      className="quota-related-order"
                      onClick={() => navigate(`/orders/${relatedOrder.id}`)}
                      type="button"
                    >
                      关联订单 {relatedOrder.orderNumber}
                      <ChevronRight size={15} />
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-quota-transactions">
            <strong>当前筛选下没有额度记录</strong>
            <span>额度发生变化后，会在这里留下完整记录。</span>
          </div>
        )}
      </section>

      <EmployeeBottomNav active="profile" />
    </main>
  );
}
