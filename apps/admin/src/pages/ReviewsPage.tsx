import type { ReviewStatus } from "@travel/domain";
import { Search, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { StatusBadge } from "../components/StatusBadge";
import { useAdminData } from "../context/AdminDataContext";
import { formatDate } from "../lib/format";
import { reviewStatusMeta } from "../lib/review-status";

export function ReviewsPage() {
  const { currentOperator, data, execute } = useAdminData();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "all">(
    "all",
  );
  const [pageMessage, setPageMessage] = useState("");

  const reviews = useMemo(
    () =>
      data.serviceReviews.filter((review) => {
        const order = data.personalOrders.find(
          ({ id }) => id === review.orderId,
        );
        const employee = data.employees.find(
          ({ id }) => id === review.employeeId,
        );
        const normalizedQuery = query.trim();
        const matchesQuery =
          !normalizedQuery ||
          order?.orderNumber.includes(normalizedQuery) ||
          employee?.name.includes(normalizedQuery) ||
          order?.productSnapshot.name.includes(normalizedQuery);
        const matchesStatus =
          statusFilter === "all" || review.status === statusFilter;
        return matchesQuery && matchesStatus;
      }),
    [
      data.employees,
      data.personalOrders,
      data.serviceReviews,
      query,
      statusFilter,
    ],
  );

  function moderate(reviewId: string, status: "published" | "hidden") {
    if (!currentOperator) {
      return;
    }

    try {
      execute((service) =>
        service.moderateServiceReview({
          reviewId,
          actorAccountId: currentOperator.id,
          status,
        }),
      );
      setPageMessage(
        status === "published"
          ? "评价已设为客户端展示。"
          : "评价已隐藏，不会在客户端展示。",
      );
    } catch (caughtError) {
      setPageMessage(
        caughtError instanceof Error ? caughtError.message : "评价审核失败",
      );
    }
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <h1>评价管理</h1>
          <p>审核已完成订单的员工评价，只有“已展示”评价会进入客户端。</p>
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
          <span>评价状态</span>
          <select
            onChange={(event) =>
              setStatusFilter(event.target.value as ReviewStatus | "all")
            }
            value={statusFilter}
          >
            <option value="all">全部状态</option>
            {Object.entries(reviewStatusMeta).map(([value, status]) => (
              <option key={value} value={value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="content-card">
        <div className="content-card__header">
          <h2>评价列表</h2>
          <span className="record-count">共 {reviews.length} 条评价</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>订单 / 员工</th>
                <th>服务商品</th>
                <th>评分</th>
                <th>评价内容</th>
                <th>提交时间</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {reviews.length > 0 ? (
                reviews.map((review) => {
                  const order = data.personalOrders.find(
                    ({ id }) => id === review.orderId,
                  );
                  const employee = data.employees.find(
                    ({ id }) => id === review.employeeId,
                  );
                  const status = reviewStatusMeta[review.status];

                  return (
                    <tr key={review.id}>
                      <td>
                        <div className="primary-cell">
                          <Link
                            className="product-link"
                            to={`/orders/${review.orderId}`}
                          >
                            {order?.orderNumber ?? "订单已不存在"}
                          </Link>
                          <span>{employee?.name ?? "员工已不存在"}</span>
                        </div>
                      </td>
                      <td>{order?.productSnapshot.name ?? "商品已不存在"}</td>
                      <td>
                        <span
                          aria-label={`${review.rating} 星`}
                          className="review-rating"
                        >
                          <Star fill="currentColor" size={16} />
                          {review.rating}
                        </span>
                      </td>
                      <td className="review-content">{review.content}</td>
                      <td>{formatDate(review.submittedAt)}</td>
                      <td>
                        <StatusBadge tone={status.tone}>
                          {status.label}
                        </StatusBadge>
                      </td>
                      <td>
                        <div className="table-actions">
                          {review.status !== "published" ? (
                            <button
                              className="table-action table-action--primary"
                              onClick={() => moderate(review.id, "published")}
                              type="button"
                            >
                              {review.status === "hidden"
                                ? "重新展示"
                                : "通过展示"}
                            </button>
                          ) : null}
                          {review.status !== "hidden" ? (
                            <button
                              className="table-action"
                              onClick={() => moderate(review.id, "hidden")}
                              type="button"
                            >
                              隐藏
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="muted-text" colSpan={7}>
                    暂无符合条件的评价
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
