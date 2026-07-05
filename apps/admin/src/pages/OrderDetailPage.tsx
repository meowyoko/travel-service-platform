import type { OrderStatus } from "@travel/domain";
import { ArrowLeft, Star } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Modal } from "../components/Modal";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminData } from "../context/AdminDataContext";
import {
  formatDate,
  formatQuota,
  formatTravelDuration,
} from "../lib/format";
import { orderStatusMeta } from "../lib/order-status";
import { reviewStatusMeta } from "../lib/review-status";

type StatusActionTarget = "confirmed" | "cancelled";

interface StatusAction {
  target: StatusActionTarget;
  label: string;
  danger?: boolean;
}

function getStatusActions(status: OrderStatus): StatusAction[] {
  switch (status) {
    case "pending_confirmation":
      return [
        { target: "confirmed", label: "确认订单" },
        { target: "cancelled", label: "取消订单", danger: true },
      ];
    case "confirmed":
    case "waiting_for_service":
    case "in_service":
      return [{ target: "cancelled", label: "取消订单", danger: true }];
    default:
      return [];
  }
}

export function OrderDetailPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const {
    currentOperator,
    data,
    execute,
    hasPermission,
    syncOrderStatuses,
  } = useAdminData();
  const [pendingAction, setPendingAction] = useState<StatusAction | null>(
    null,
  );
  const [pageMessage, setPageMessage] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assigneeDraft, setAssigneeDraft] = useState("");
  const [editingTravelDates, setEditingTravelDates] = useState(false);
  const [travelDateError, setTravelDateError] = useState("");

  useEffect(() => {
    syncOrderStatuses();
  }, [syncOrderStatuses]);

  const order = data.personalOrders.find(({ id }) => id === orderId);

  if (!order) {
    return (
      <section className="empty-selection">
        <strong>未找到该个人订单</strong>
        <button
          className="button button--secondary"
          onClick={() => navigate("/orders")}
          type="button"
        >
          返回订单列表
        </button>
      </section>
    );
  }
  const selectedOrder = order;

  const employee = data.employees.find(({ id }) => id === order.employeeId);
  const group = data.groups.find(({ id }) => id === order.groupId);
  const sourceIntent = data.personalIntents.find(
    ({ id }) => id === order.sourceIntentId,
  );
  const relatedTransactions = data.quotaTransactions.filter(
    ({ relatedOrderId }) => relatedOrderId === order.id,
  );
  const review = data.serviceReviews.find(
    ({ orderId: reviewOrderId }) => reviewOrderId === order.id,
  );
  const status = orderStatusMeta[order.status];
  const statusActions = getStatusActions(order.status);
  const travel = order.productSnapshot.travelDetails;
  const outstandingQuota = order.deductedQuota - order.refundedQuota;
  const assignee = data.operatorAccounts.find(
    ({ id }) => id === order.assigneeAccountId,
  );
  const activeOperators = data.operatorAccounts.filter(
    ({ status }) => status === "active",
  );

  function executeStatusAction() {
    const action = pendingAction;
    if (!action) {
      return;
    }

    try {
      const target = action.target;
      if (target === "confirmed") {
        execute((service) =>
          service.confirmPersonalOrder({
            orderId: selectedOrder.id,
            operator: currentOperator?.username ?? "unknown",
          }),
        );
        setPageMessage(
          "订单已确认并扣减额度，履约状态已按出行日期自动更新。",
        );
      } else {
        execute((service) =>
          service.updatePersonalOrderStatus({
            orderId: selectedOrder.id,
            status: target,
          }),
        );
        setPageMessage(
          "订单已取消。额度不会自动退回，请按线下确认结果处理退回。",
        );
      }
      setPendingAction(null);
    } catch (caughtError) {
      setPageMessage(
        caughtError instanceof Error ? caughtError.message : "订单操作失败",
      );
      setPendingAction(null);
    }
  }

  function updateTravelDates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTravelDateError("");
    const form = new FormData(event.currentTarget);

    try {
      execute((service) =>
        service.updatePersonalOrderTravelDates({
          orderId: selectedOrder.id,
          departureDate: String(form.get("departureDate") ?? ""),
          returnDate: String(form.get("returnDate") ?? ""),
        }),
      );
      setEditingTravelDates(false);
      setPageMessage("出行日期已更新，订单状态已重新计算。");
    } catch (caughtError) {
      setTravelDateError(
        caughtError instanceof Error
          ? caughtError.message
          : "更新出行日期失败",
      );
    }
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <button
            className="back-link"
            onClick={() => navigate("/orders")}
            type="button"
          >
            <ArrowLeft size={16} />
            个人订单
          </button>
          <h1>{order.orderNumber}</h1>
          <p>查看订单专属方案、额度变化及当前履约状态。</p>
        </div>
        <div className="page-actions">
          {[
            "pending_confirmation",
            "confirmed",
            "waiting_for_service",
          ].includes(order.status) ? (
            <button
              className="button button--secondary"
              onClick={() => {
                setTravelDateError("");
                setEditingTravelDates(true);
              }}
              type="button"
            >
              调整出行日期
            </button>
          ) : null}
          <button
            className="button button--secondary"
            onClick={() => {
              setAssigneeDraft(
                order.assigneeAccountId ?? currentOperator?.id ?? "",
              );
              setAssigning(true);
            }}
            type="button"
          >
            变更负责人
          </button>
          {outstandingQuota > 0 && hasPermission("quotas") ? (
            <Link
              className="button button--secondary"
              to={`/quotas?groupId=${order.groupId}&employeeId=${order.employeeId}&orderId=${order.id}&action=refund`}
            >
              办理额度退回
            </Link>
          ) : null}
          {statusActions.map((action) => (
            <button
              className={
                action.danger
                  ? "button button--danger-ghost"
                  : "button button--primary"
              }
              key={action.target}
              onClick={() => {
                setPageMessage("");
                setPendingAction(action);
              }}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>

      {pageMessage ? <div className="page-message">{pageMessage}</div> : null}
      {order.status === "cancelled" && outstandingQuota > 0 ? (
        <div className="warning-panel order-refund-warning">
          该订单已取消，当前仍有 {formatQuota(outstandingQuota)} 额度计入最终消耗。
          如需退回，请在后续额度退回功能中按线下确认结果处理。
        </div>
      ) : null}

      <section className="product-detail-grid">
        <div className="content-card product-detail-main">
          <div className="content-card__header">
            <h2>订单信息</h2>
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          </div>
          <div className="detail-list">
            <div>
              <span>员工</span>
              <strong>{employee?.name ?? "员工已不存在"}</strong>
            </div>
            <div>
              <span>所属集团</span>
              <strong>{group?.name ?? "集团已不存在"}</strong>
            </div>
            <div>
              <span>联系电话</span>
              <strong>{employee?.phone ?? "—"}</strong>
            </div>
            <div>
              <span>来源意向</span>
              <strong>{sourceIntent ? "个人意向转入" : "后台创建"}</strong>
            </div>
            <div>
              <span>订单负责人</span>
              <strong>{assignee?.displayName ?? "未指派"}</strong>
            </div>
            <div>
              <span>创建时间</span>
              <strong>{formatDate(order.createdAt)}</strong>
            </div>
            <div>
              <span>确认时间</span>
              <strong>{order.confirmedAt ? formatDate(order.confirmedAt) : "尚未确认"}</strong>
            </div>
            <div className="detail-list__wide">
              <span>订单专属方案</span>
              <p>{order.servicePlan}</p>
            </div>
            <div className="detail-list__wide">
              <span>内部备注</span>
              <p>{order.internalNote || "暂无内部备注"}</p>
            </div>
          </div>
        </div>

        <aside className="content-card">
          <div className="content-card__header">
            <h2>额度信息</h2>
          </div>
          <div className="detail-list detail-list--single">
            <div>
              <span>计划扣减</span>
              <strong>{formatQuota(order.plannedQuotaDeduction)}</strong>
            </div>
            <div>
              <span>原扣减额度</span>
              <strong>{formatQuota(order.deductedQuota)}</strong>
            </div>
            <div>
              <span>已退回额度</span>
              <strong>{formatQuota(order.refundedQuota)}</strong>
            </div>
            <div>
              <span>最终消耗额度</span>
              <strong className="quota-value">
                {formatQuota(order.finalConsumedQuota)}
              </strong>
            </div>
          </div>
        </aside>
      </section>

      <section className="content-card">
        <div className="content-card__header">
          <h2>确认服务安排</h2>
        </div>
        <div className="detail-list">
          <div>
            <span>出行日期</span>
            <strong>
              {order.departureDate
                ? formatDate(order.departureDate)
                : "待确认"}
            </strong>
          </div>
          <div>
            <span>返程日期</span>
            <strong>
              {order.returnDate ? formatDate(order.returnDate) : "待确认"}
            </strong>
          </div>
          <div>
            <span>行程时长</span>
            <strong>
              {formatTravelDuration(order.departureDate, order.returnDate)}
            </strong>
          </div>
          <div>
            <span>往返方式</span>
            <strong>{order.transport || "待确认"}</strong>
          </div>
          <div>
            <span>接送服务</span>
            <strong>{order.pickupService || "待确认"}</strong>
          </div>
          <div className="detail-list__wide">
            <span>住宿安排</span>
            <p>{order.accommodation || "待确认"}</p>
          </div>
        </div>
      </section>

      <section className="content-card">
        <div className="content-card__header">
          <h2>员工评价</h2>
          {review ? (
            <StatusBadge tone={reviewStatusMeta[review.status].tone}>
              {reviewStatusMeta[review.status].label}
            </StatusBadge>
          ) : null}
        </div>
        {review ? (
          <div className="detail-list">
            <div>
              <span>整体评分</span>
              <strong className="review-rating">
                <Star fill="currentColor" size={17} />
                {review.rating} 星
              </strong>
            </div>
            <div>
              <span>提交时间</span>
              <strong>{formatDate(review.submittedAt)}</strong>
            </div>
            <div className="detail-list__wide">
              <span>评价内容</span>
              <p>{review.content}</p>
            </div>
          </div>
        ) : (
          <p className="muted-text">
            {order.status === "completed"
              ? "该订单尚未提交评价"
              : "订单完成后员工方可提交评价"}
          </p>
        )}
      </section>

      <section className="content-card">
        <div className="content-card__header">
          <h2>订单商品快照</h2>
          <span className="record-count">不受商品后续修改影响</span>
        </div>
        <div className="detail-list">
          <div>
            <span>服务商品</span>
            <strong>{order.productSnapshot.name}</strong>
          </div>
          <div>
            <span>目的地</span>
            <strong>{travel?.destination || "—"}</strong>
          </div>
          <div className="detail-list__wide">
            <span>商品简介</span>
            <p>{order.productSnapshot.summary}</p>
          </div>
          <div className="detail-list__wide">
            <span>服务说明</span>
            <p>{order.productSnapshot.serviceDescription}</p>
          </div>
          <div className="detail-list__wide">
            <span>注意事项</span>
            <p>{order.productSnapshot.notes}</p>
          </div>
        </div>
      </section>

      <section className="content-card">
        <div className="content-card__header">
          <h2>关联额度流水</h2>
          <span className="record-count">共 {relatedTransactions.length} 条</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>类型</th>
                <th>变动额度</th>
                <th>变动后余额</th>
                <th>原因</th>
                <th>操作人</th>
                <th>发生时间</th>
              </tr>
            </thead>
            <tbody>
              {relatedTransactions.length > 0 ? (
                relatedTransactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{transaction.type === "deduction" ? "扣减" : "退回"}</td>
                    <td>{formatQuota(transaction.amount)}</td>
                    <td>{formatQuota(transaction.balanceAfter)}</td>
                    <td>
                      <div className="primary-cell">
                        <strong>{transaction.reason}</strong>
                        {transaction.internalNote ? (
                          <span>{transaction.internalNote}</span>
                        ) : null}
                      </div>
                    </td>
                    <td>{transaction.operator}</td>
                    <td>{formatDate(transaction.occurredAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="muted-text" colSpan={6}>
                    订单尚未产生额度流水
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        description="返程日期包含行程最后一天；保存后会立即按北京时间重新计算订单状态。"
        footer={
          <>
            <button
              className="button button--secondary"
              onClick={() => setEditingTravelDates(false)}
              type="button"
            >
              取消
            </button>
            <button
              className="button button--primary"
              form="update-travel-dates-form"
              type="submit"
            >
              保存日期
            </button>
          </>
        }
        onClose={() => setEditingTravelDates(false)}
        open={editingTravelDates}
        title="调整出行日期"
      >
        <form
          className="form-grid"
          id="update-travel-dates-form"
          onSubmit={updateTravelDates}
        >
          <label className="field">
            <span>出行日期</span>
            <input
              defaultValue={order.departureDate}
              name="departureDate"
              required
              type="date"
            />
          </label>
          <label className="field">
            <span>返程日期</span>
            <input
              defaultValue={order.returnDate}
              name="returnDate"
              required
              type="date"
            />
          </label>
          {travelDateError ? (
            <p className="form-error field--wide">{travelDateError}</p>
          ) : null}
        </form>
      </Modal>

      <Modal
        description="负责人只能选择当前启用中的我方运营账号。"
        footer={
          <>
            <button
              className="button button--secondary"
              onClick={() => setAssigning(false)}
              type="button"
            >
              取消
            </button>
            <button
              className="button button--primary"
              disabled={!assigneeDraft}
              onClick={() => {
                try {
                  execute((service) =>
                    service.assignPersonalOrder({
                      orderId: order.id,
                      assigneeAccountId: assigneeDraft,
                    }),
                  );
                  setAssigning(false);
                  setPageMessage("订单负责人已更新。");
                } catch (caughtError) {
                  setPageMessage(
                    caughtError instanceof Error
                      ? caughtError.message
                      : "更新负责人失败",
                  );
                }
              }}
              type="button"
            >
              保存负责人
            </button>
          </>
        }
        onClose={() => setAssigning(false)}
        open={assigning}
        title="变更订单负责人"
      >
        <label className="field">
          <span>订单负责人</span>
          <select
            onChange={(event) => setAssigneeDraft(event.target.value)}
            value={assigneeDraft}
          >
            <option value="">请选择负责人</option>
            {activeOperators.map((account) => (
              <option key={account.id} value={account.id}>
                {account.displayName}（{account.username}）
              </option>
            ))}
          </select>
        </label>
      </Modal>

      <Modal
        description={
          pendingAction?.target === "cancelled"
            ? "取消订单不会自动退回额度，退回需由后台按线下确认结果另行操作。"
            : "确认订单后将扣减额度，并按出行日期自动计算履约状态。"
        }
        footer={
          <>
            <button
              className="button button--secondary"
              onClick={() => setPendingAction(null)}
              type="button"
            >
              返回
            </button>
            <button
              className={
                pendingAction?.danger
                  ? "button button--danger"
                  : "button button--primary"
              }
              onClick={executeStatusAction}
              type="button"
            >
              确认{pendingAction?.label}
            </button>
          </>
        }
        onClose={() => setPendingAction(null)}
        open={Boolean(pendingAction)}
        title={pendingAction?.label ?? "更新订单状态"}
      >
        {pendingAction?.target === "confirmed" ? (
          <div className="warning-panel">
            确认后将扣减员工 {formatQuota(order.plannedQuotaDeduction)} 额度并生成额度流水。
          </div>
        ) : outstandingQuota > 0 ? (
          <div className="warning-panel">
            当前订单已扣减 {formatQuota(order.deductedQuota)} 额度、已退回{" "}
            {formatQuota(order.refundedQuota)} 额度。取消后剩余额度不会自动退回。
          </div>
        ) : null}
      </Modal>
    </>
  );
}
