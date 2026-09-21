import {
  ArrowLeft,
  BedDouble,
  BusFront,
  CalendarDays,
  MapPin,
  Plane,
  Star,
  WalletCards,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useEmployeeData } from "../context/EmployeeDataContext";
import { formatDate, formatQuota } from "../lib/format";

const ORDER_STATUS_LABELS = {
  pending_confirmation: "待确认",
  confirmed: "已确认",
  waiting_for_service: "待出行",
  in_service: "服务中",
  completed: "已完成",
  cancelled: "已取消",
} as const;

export function OrderDetailPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { personalOrders, personalReviews, submitReview } = useEmployeeData();
  const [rating, setRating] = useState(0);
  const [reviewContent, setReviewContent] = useState("");
  const [confirmingReview, setConfirmingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const order = personalOrders.find(({ id }) => id === orderId);

  if (!order) {
    return (
      <main className="order-detail-page order-detail-unavailable">
        <strong>订单不存在或不属于当前员工</strong>
        <button onClick={() => navigate("/orders")} type="button">
          返回我的订单
        </button>
      </main>
    );
  }

  const snapshot = order.productSnapshot;
  const review = personalReviews.find(
    ({ orderId: reviewOrderId }) => reviewOrderId === order.id,
  );
  const reviewed = Boolean(review);

  function prepareReview() {
    const content = reviewContent.trim();
    if (rating < 1) {
      setReviewError("请选择 1 至 5 星评分");
      return;
    }
    if (!content) {
      setReviewError("请填写评价内容");
      return;
    }
    setReviewError("");
    setConfirmingReview(true);
  }

  async function confirmReview() {
    if (!order) return;
    setSubmittingReview(true);
    try {
      await submitReview(order.id, {
        rating,
        content: reviewContent.trim(),
      });
      setConfirmingReview(false);
      setReviewError("");
    } catch (caughtError) {
      setConfirmingReview(false);
      setReviewError(
        caughtError instanceof Error ? caughtError.message : "提交评价失败",
      );
    } finally {
      setSubmittingReview(false);
    }
  }

  return (
    <main className="order-detail-page">
      <header className="detail-topbar">
        <button
          aria-label="返回我的订单"
          onClick={() => navigate("/orders")}
          type="button"
        >
          <ArrowLeft size={20} />
        </button>
        <strong>订单详情</strong>
        <span aria-hidden="true" />
      </header>

      <section className="order-detail-summary">
        <div>
          <span className={`order-status ${order.status}`}>
            {ORDER_STATUS_LABELS[order.status]}
          </span>
          <small>{order.orderNumber}</small>
        </div>
        <h1>{snapshot.name}</h1>
        <p>{snapshot.summary}</p>
        <span>
          <MapPin size={15} />
          {snapshot.travelDetails?.destination ?? "服务地点待确认"}
        </span>
      </section>

      <section className="order-detail-section">
        <h2>行程安排</h2>
        <div className="order-arrangement-list">
          <div>
            <CalendarDays size={18} />
            <span>
              <small>确认出行时间</small>
              <strong>
                {order.departureDate && order.returnDate
                  ? `${formatDate(order.departureDate)} 至 ${formatDate(
                      order.returnDate,
                    )}`
                  : "待工作人员确认"}
              </strong>
            </span>
          </div>
          <div>
            <Plane size={18} />
            <span>
              <small>往返方式</small>
              <strong>{order.transport || "待确认"}</strong>
            </span>
          </div>
          <div>
            <BedDouble size={18} />
            <span>
              <small>住宿安排</small>
              <strong>
                {order.hotelAccommodation
                  ? `${order.hotelAccommodation.hotelName}${
                      order.hotelAccommodation.roomTypeName
                        ? ` / ${order.hotelAccommodation.roomTypeName}`
                        : ""
                    }`
                  : order.accommodation || "待确认"}
              </strong>
            </span>
          </div>
          <div>
            <BusFront size={18} />
            <span>
              <small>接送服务</small>
              <strong>{order.pickupService || "待确认"}</strong>
            </span>
          </div>
        </div>
        {order.hotelAccommodation ? (
          <p className="order-service-plan">
            入住：{formatDate(order.hotelAccommodation.checkInDate)} 至{" "}
            {formatDate(order.hotelAccommodation.checkOutDate)}
            ，共 {order.hotelAccommodation.nights} 晚
            {order.hotelAccommodation.totalQuota
              ? `，住宿额度 ${formatQuota(order.hotelAccommodation.totalQuota)}`
              : ""}
          </p>
        ) : null}
      </section>

      <section className="order-detail-section">
        <h2>专属服务方案</h2>
        <p className="order-service-plan">{order.servicePlan}</p>
        <div className="order-snapshot-copy">
          <h3>服务说明</h3>
          <p>{snapshot.serviceDescription}</p>
          <h3>注意事项</h3>
          <p>{snapshot.notes}</p>
        </div>
      </section>

      <section className="order-detail-section">
        <h2>额度明细</h2>
        <div className="order-quota-panel">
          <WalletCards size={20} />
          <dl>
            <div>
              <dt>预计额度</dt>
              <dd>{formatQuota(order.plannedQuotaDeduction)}</dd>
            </div>
            <div>
              <dt>已扣额度</dt>
              <dd>{formatQuota(order.deductedQuota)}</dd>
            </div>
            <div>
              <dt>已退回额度</dt>
              <dd>{formatQuota(order.refundedQuota)}</dd>
            </div>
            <div>
              <dt>最终消耗</dt>
              <dd>{formatQuota(order.finalConsumedQuota)}</dd>
            </div>
          </dl>
        </div>
      </section>

      {order.status === "completed" ? (
        <section className="order-review-panel">
          <div className="order-review-state">
            <Star size={18} />
            <span>
              <strong>{reviewed ? "该订单已评价" : "评价本次服务"}</strong>
              <small>
                {review
                  ? review.status === "pending_review"
                    ? "评价已提交，等待后台审核。"
                    : review.status === "published"
                      ? "评价已审核并展示。"
                      : "评价已审核，当前未公开展示。"
                  : "请根据本次实际体验提交评分和文字评价。"}
              </small>
            </span>
          </div>
          {review ? (
            <div className="submitted-review">
              <div aria-label={`${review.rating} 星`}>
                {Array.from({ length: 5 }, (_, index) => (
                  <Star
                    fill={index < review.rating ? "currentColor" : "none"}
                    key={index}
                    size={17}
                  />
                ))}
              </div>
              <p>{review.content}</p>
              <small>提交于 {formatDate(review.submittedAt)}</small>
            </div>
          ) : (
            <div className="review-form">
              <div aria-label="评价星级" className="review-stars">
                {Array.from({ length: 5 }, (_, index) => {
                  const value = index + 1;
                  return (
                    <button
                      aria-label={`${value} 星`}
                      className={rating >= value ? "active" : ""}
                      key={value}
                      onClick={() => setRating(value)}
                      type="button"
                    >
                      <Star
                        fill={rating >= value ? "currentColor" : "none"}
                        size={23}
                      />
                    </button>
                  );
                })}
              </div>
              <label>
                <span>评价内容</span>
                <textarea
                  maxLength={500}
                  onChange={(event) => setReviewContent(event.target.value)}
                  placeholder="说说本次服务体验"
                  rows={4}
                  value={reviewContent}
                />
                <small>{reviewContent.length} / 500</small>
              </label>
              {reviewError ? <p className="review-error">{reviewError}</p> : null}
              <button
                className="review-submit-button"
                onClick={prepareReview}
                type="button"
              >
                提交评价
              </button>
            </div>
          )}
        </section>
      ) : null}

      {confirmingReview ? (
        <div className="intent-confirm-backdrop" role="presentation">
          <section
            aria-labelledby="review-confirm-title"
            aria-modal="true"
            className="intent-confirm"
            role="dialog"
          >
            <h2 id="review-confirm-title">确认提交评价？</h2>
            <p>提交后不可再次修改，请确认评分和内容真实准确。</p>
            <div>
              <button
                disabled={submittingReview}
                onClick={() => setConfirmingReview(false)}
                type="button"
              >
                返回检查
              </button>
              <button
                disabled={submittingReview}
                onClick={() => void confirmReview()}
                type="button"
              >
                {submittingReview ? "提交中…" : "确认提交"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
