import { Search } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Modal } from "../components/Modal";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminData } from "../context/AdminDataContext";
import {
  formatDate,
  formatQuota,
  formatTravelDuration,
} from "../lib/format";
import { orderStatusMeta } from "../lib/order-status";

export function OrdersPage() {
  const { currentOperator, data, execute, syncOrderStatuses } =
    useAdminData();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pageMessage, setPageMessage] = useState("");

  useEffect(() => {
    syncOrderStatuses();
  }, [syncOrderStatuses]);

  const orders = useMemo(
    () =>
      data.personalOrders.filter((order) => {
        const employee = data.employees.find(
          ({ id }) => id === order.employeeId,
        );
        const matchesQuery =
          order.orderNumber.includes(query.trim()) ||
          employee?.name.includes(query.trim()) ||
          order.productSnapshot.name.includes(query.trim());
        const matchesStatus =
          statusFilter === "all" || order.status === statusFilter;
        return matchesQuery && matchesStatus;
      }),
    [data.employees, data.personalOrders, query, statusFilter],
  );
  const editingOrder = data.personalOrders.find(
    ({ id }) => id === editingId,
  );

  function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!editingId) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const departureDate = String(form.get("departureDate") ?? "").trim();
    const returnDate = String(form.get("returnDate") ?? "").trim();
    const transport = String(form.get("transport") ?? "").trim();
    const accommodation = String(form.get("accommodation") ?? "").trim();
    const internalNote = String(form.get("internalNote") ?? "").trim();

    try {
      execute((service) =>
        service.updatePendingPersonalOrder({
          orderId: editingId,
          plannedQuotaDeduction: Number(
            form.get("plannedQuotaDeduction"),
          ),
          servicePlan: String(form.get("servicePlan")),
          departureDate,
          returnDate,
          ...(transport ? { transport } : {}),
          ...(accommodation ? { accommodation } : {}),
          ...(internalNote ? { internalNote } : {}),
        }),
      );
      setEditingId(null);
      setPageMessage("待确认订单内容已保存。");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "保存订单失败",
      );
    }
  }

  function confirmOrder(orderId: string) {
    setPageMessage("");

    try {
      execute((service) =>
        service.confirmPersonalOrder({
          orderId,
          operator: currentOperator?.username ?? "unknown",
        }),
      );
      setEditingId(null);
      setPageMessage("订单已确认并扣减额度，履约状态已按出行日期自动更新。");
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "确认订单失败";
      if (editingId) {
        setError(message);
      } else {
        setPageMessage(message);
      }
    }
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <h1>个人订单</h1>
          <p>待确认订单可继续调整；订单确认后才正式扣减员工额度。</p>
        </div>
      </section>

      {pageMessage ? <div className="page-message">{pageMessage}</div> : null}

      <section className="filter-card">
        <label className="search-field">
          <Search size={17} />
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索订单编号、员工或商品"
            value={query}
          />
        </label>
        <label className="select-field">
          <span>订单状态</span>
          <select
            onChange={(event) => setStatusFilter(event.target.value)}
            value={statusFilter}
          >
            <option value="all">全部状态</option>
            {Object.entries(orderStatusMeta).map(([value, status]) => (
              <option key={value} value={value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="content-card">
        <div className="content-card__header">
          <h2>订单列表</h2>
          <span className="record-count">共 {orders.length} 笔订单</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>订单编号</th>
                <th>员工 / 集团</th>
                <th>来源商品</th>
                <th>出行安排</th>
                <th>扣减 / 退回</th>
                <th>最终消耗</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const employee = data.employees.find(
                  ({ id }) => id === order.employeeId,
                );
                const group = data.groups.find(
                  ({ id }) => id === order.groupId,
                );
                const status = orderStatusMeta[order.status];

                return (
                  <tr key={order.id}>
                    <td>
                      <Link
                        className="product-link"
                        to={`/orders/${order.id}`}
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td>
                      <div className="primary-cell">
                        <strong>{employee?.name}</strong>
                        <span>{group?.name}</span>
                      </div>
                    </td>
                    <td>{order.productSnapshot.name}</td>
                    <td>
                      <div className="primary-cell">
                        <strong>
                          {order.departureDate && order.returnDate
                            ? `${formatDate(order.departureDate)} 至 ${formatDate(order.returnDate)}`
                            : "待确认"}
                        </strong>
                        <span>
                          {formatTravelDuration(
                            order.departureDate,
                            order.returnDate,
                          )}
                        </span>
                      </div>
                    </td>
                    <td>
                      {formatQuota(order.deductedQuota)} /{" "}
                      {formatQuota(order.refundedQuota)}
                    </td>
                    <td>
                      <strong className="quota-value">
                        {formatQuota(order.finalConsumedQuota)}
                      </strong>
                    </td>
                    <td>
                      <StatusBadge tone={status.tone}>
                        {status.label}
                      </StatusBadge>
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link
                          className="table-action"
                          to={`/orders/${order.id}`}
                        >
                          查看
                        </Link>
                        {order.status === "pending_confirmation" ? (
                          <>
                          <button
                            className="table-action"
                            onClick={() => {
                              setError("");
                              setEditingId(order.id);
                            }}
                            type="button"
                          >
                            调整
                          </button>
                          <button
                            className="table-action table-action--primary"
                            onClick={() => confirmOrder(order.id)}
                            type="button"
                          >
                            确认
                          </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        description="此阶段不会扣减额度，确认订单后才执行扣减。"
        footer={
          <>
            <button
              className="button button--secondary"
              onClick={() => setEditingId(null)}
              type="button"
            >
              取消
            </button>
            <button
              className="button button--secondary"
              onClick={() => editingId && confirmOrder(editingId)}
              type="button"
            >
              确认订单
            </button>
            <button
              className="button button--primary"
              form="update-order-form"
              type="submit"
            >
              保存调整
            </button>
          </>
        }
        onClose={() => setEditingId(null)}
        open={Boolean(editingOrder)}
        title="调整待确认订单"
      >
        <form
          className="form-grid"
          id="update-order-form"
          onSubmit={handleUpdate}
        >
          <div className="detail-summary field--wide">
            <strong>{editingOrder?.productSnapshot.name}</strong>
            <span>{editingOrder?.orderNumber}</span>
          </div>
          <label className="field">
            <span>计划扣减额度</span>
            <input
              defaultValue={editingOrder?.plannedQuotaDeduction}
              min="1"
              name="plannedQuotaDeduction"
              required
              type="number"
            />
          </label>
          <label className="field">
            <span>出行日期</span>
            <input
              defaultValue={editingOrder?.departureDate}
              name="departureDate"
              required
              type="date"
            />
          </label>
          <label className="field">
            <span>返程日期</span>
            <input
              defaultValue={editingOrder?.returnDate}
              name="returnDate"
              required
              type="date"
            />
          </label>
          <label className="field">
            <span>往返方式</span>
            <input
              defaultValue={editingOrder?.transport}
              name="transport"
            />
          </label>
          <label className="field field--wide">
            <span>住宿安排</span>
            <input
              defaultValue={editingOrder?.accommodation}
              name="accommodation"
            />
          </label>
          <label className="field field--wide">
            <span>订单专属方案</span>
            <textarea
              defaultValue={editingOrder?.servicePlan}
              name="servicePlan"
              required
              rows={5}
            />
          </label>
          <label className="field field--wide">
            <span>内部备注</span>
            <textarea
              defaultValue={editingOrder?.internalNote}
              name="internalNote"
              rows={3}
            />
          </label>
          {error ? <p className="form-error field--wide">{error}</p> : null}
        </form>
      </Modal>
    </>
  );
}
