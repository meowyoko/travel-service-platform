import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { PersonalOrderDto } from "@travel/contracts";

import { Pagination } from "../components/Pagination";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminData } from "../context/AdminDataContext";
import { usePaginatedList } from "../hooks/usePaginatedList";
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
  const [pageMessage, setPageMessage] = useState("");

  useEffect(() => {
    void syncOrderStatuses();
  }, [syncOrderStatuses]);

  const {
    items: orders,
    pagination,
    setPage,
  } = usePaginatedList<PersonalOrderDto>(
    "/api/admin/orders",
    {
      query: query.trim() || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
    },
    data,
  );
  async function confirmOrder(orderId: string) {
    setPageMessage("");

    try {
      await execute((service) =>
        service.confirmPersonalOrder({
          orderId,
          operator: currentOperator?.username ?? "unknown",
        }),
      );
      setPageMessage("订单已确认并扣减额度，履约状态已按出行日期自动更新。");
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "确认订单失败";
      setPageMessage(message);
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
          <span className="record-count">共 {pagination.total} 笔订单</span>
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
                          <button
                            className="table-action table-action--primary"
                            onClick={() => confirmOrder(order.id)}
                            type="button"
                          >
                            确认
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination meta={pagination} onChange={setPage} />
      </section>

    </>
  );
}
