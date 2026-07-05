import type { IntentStatus } from "@travel/domain";
import { CalendarDays, Clock3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { EmployeeBottomNav } from "../components/EmployeeBottomNav";
import { EmployeeSummaryHeader } from "../components/EmployeeSummaryHeader";
import { IntentOrderTabs } from "../components/IntentOrderTabs";
import { useEmployeeData } from "../context/EmployeeDataContext";
import { formatDate, formatDateTime } from "../lib/format";

const STATUS_META: Record<
  IntentStatus,
  { label: string; tone: string }
> = {
  pending_follow_up: { label: "待跟进", tone: "pending" },
  communicating: { label: "沟通中", tone: "communicating" },
  converted_to_order: { label: "已转订单", tone: "converted" },
  withdrawn_by_employee: { label: "用户已撤销", tone: "muted" },
  closed: { label: "已关闭", tone: "muted" },
};

export function IntentsPage() {
  const navigate = useNavigate();
  const {
    intentProducts,
    personalIntents,
    personalOrders,
    withdrawPersonalIntent,
  } = useEmployeeData();
  const [notice, setNotice] = useState("");
  const [withdrawTargetId, setWithdrawTargetId] = useState<string | null>(
    null,
  );
  const intents = useMemo(
    () =>
      [...personalIntents].sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt),
      ),
    [personalIntents],
  );
  const withdrawTarget = personalIntents.find(
    ({ id }) => id === withdrawTargetId,
  );
  const withdrawTargetProduct = intentProducts.find(
    ({ id }) => id === withdrawTarget?.productId,
  );

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  function confirmWithdrawal() {
    if (!withdrawTargetId) {
      return;
    }

    try {
      withdrawPersonalIntent({ intentId: withdrawTargetId });
      setNotice("意向已撤销。");
    } catch (caughtError) {
      setNotice(
        caughtError instanceof Error
          ? caughtError.message
          : "撤销意向失败，请稍后重试",
      );
    } finally {
      setWithdrawTargetId(null);
    }
  }

  return (
    <main className="intents-page">
      <EmployeeSummaryHeader />

      <section className="intents-content">
        <div className="intents-heading">
          <h1>我的意向</h1>
          <p>查看和管理已经提交的个人服务意向。</p>
        </div>
        <IntentOrderTabs active="intents" />

        {notice ? <div className="home-notice">{notice}</div> : null}

        {intents.length ? (
          <div className="intent-list">
            {intents.map((intent) => {
              const product = intentProducts.find(
                ({ id }) => id === intent.productId,
              );
              const status = STATUS_META[intent.status];
              const withdrawable = [
                "pending_follow_up",
                "communicating",
              ].includes(intent.status);
              const linkedOrder = personalOrders.find(
                ({ sourceIntentId }) => sourceIntentId === intent.id,
              );

              return (
                <article
                  className={`intent-list-card ${
                    withdrawable ? "" : "intent-list-card-finished"
                  }`}
                  key={intent.id}
                >
                  <div className="intent-list-title">
                    <h2>{product?.name ?? "服务商品信息已调整"}</h2>
                    <span className={`intent-status ${status.tone}`}>
                      {status.label}
                    </span>
                  </div>
                  <div className="intent-list-meta">
                    <span>
                      <CalendarDays size={15} />
                      预计出行：{formatDate(intent.expectedTravelDate)}
                    </span>
                    <span>
                      <Clock3 size={15} />
                      提交时间：{formatDateTime(intent.createdAt)}
                    </span>
                  </div>
                  <div className="intent-list-footer">
                    <span>期望停留 {intent.expectedStayDays} 天</span>
                    {withdrawable ? (
                      <button
                        onClick={() => setWithdrawTargetId(intent.id)}
                        type="button"
                      >
                        撤销意向
                      </button>
                    ) : linkedOrder ? (
                      <button
                        className="intent-order-link"
                        onClick={() => navigate(`/orders/${linkedOrder.id}`)}
                        type="button"
                      >
                        查看订单
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-intents">
            <strong>还没有提交过个人意向</strong>
            <span>浏览服务商品，找到适合自己的疗养安排。</span>
            <button onClick={() => navigate("/")} type="button">
              去看看服务商品
            </button>
          </div>
        )}
      </section>

      {withdrawTarget ? (
        <div className="intent-confirm-backdrop" role="presentation">
          <section
            aria-labelledby="withdraw-confirm-title"
            aria-modal="true"
            className="intent-confirm"
            role="dialog"
          >
            <h2 id="withdraw-confirm-title">确认撤销意向？</h2>
            <p>
              “{withdrawTargetProduct?.name ?? "该服务商品"}”撤销后不可恢复，
              但不会影响你的可用额度。
            </p>
            <div>
              <button
                onClick={() => setWithdrawTargetId(null)}
                type="button"
              >
                暂不撤销
              </button>
              <button onClick={confirmWithdrawal} type="button">
                确认撤销
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <EmployeeBottomNav active="intents" />
    </main>
  );
}
