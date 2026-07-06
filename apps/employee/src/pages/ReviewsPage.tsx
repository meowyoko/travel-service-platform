import type { ServiceReviewDto } from "@travel/contracts";
import { ArrowLeft, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { EmployeeBottomNav } from "../components/EmployeeBottomNav";
import { LoadMoreButton } from "../components/LoadMoreButton";
import { useEmployeeData } from "../context/EmployeeDataContext";
import { useLoadMore } from "../hooks/useLoadMore";
import { formatDate } from "../lib/format";

const REVIEW_STATUS_LABELS = {
  pending_review: "待审核",
  published: "已展示",
  hidden: "未展示",
} as const;

export function ReviewsPage() {
  const navigate = useNavigate();
  const { personalOrders, personalReviews } = useEmployeeData();
  const {
    items: reviews,
    hasMore,
    isLoading,
    loadMore,
  } = useLoadMore<ServiceReviewDto>(
    "/api/employee/reviews",
    {},
    personalReviews,
  );

  return (
    <main className="my-reviews-page">
      <header className="detail-topbar">
        <button
          aria-label="返回我的"
          onClick={() => navigate("/profile")}
          type="button"
        >
          <ArrowLeft size={20} />
        </button>
        <strong>我的评价</strong>
        <span aria-hidden="true" />
      </header>

      <section className="my-reviews-content">
        <div className="my-reviews-heading">
          <h1>我的评价</h1>
          <p>查看已提交的服务评分和审核状态。</p>
        </div>

        {reviews.length > 0 ? (
          <div className="my-review-list">
            {reviews.map((review) => {
              const order = personalOrders.find(
                ({ id }) => id === review.orderId,
              );
              return (
                <article key={review.id}>
                  <div className="my-review-title">
                    <span>
                      <strong>{order?.productSnapshot.name ?? "服务商品"}</strong>
                      <small>{order?.orderNumber ?? "历史订单"}</small>
                    </span>
                    <em className={`review-status ${review.status}`}>
                      {REVIEW_STATUS_LABELS[review.status]}
                    </em>
                  </div>
                  <div
                    aria-label={`${review.rating} 星`}
                    className="my-review-stars"
                  >
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star
                        fill={index < review.rating ? "currentColor" : "none"}
                        key={index}
                        size={16}
                      />
                    ))}
                  </div>
                  <p>{review.content}</p>
                  <time>{formatDate(review.submittedAt)}</time>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-orders">
            <strong>还没有提交过评价</strong>
            <span>已完成订单可在订单详情中评价。</span>
          </div>
        )}
        <LoadMoreButton
          hasMore={hasMore}
          isLoading={isLoading}
          onClick={loadMore}
        />
      </section>
      <EmployeeBottomNav active="profile" />
    </main>
  );
}
