import {
  ArrowLeft,
  BedDouble,
  BusFront,
  CalendarDays,
  Clock3,
  MapPin,
  Plane,
  ShieldCheck,
  Star,
  Utensils,
} from "lucide-react";
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useEmployeeData } from "../context/EmployeeDataContext";
import { formatQuota, formatSuitableMonths } from "../lib/format";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function ProductDetailPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { publishedReviews, visibleProducts } = useEmployeeData();
  const product = visibleProducts.find(({ id }) => id === productId);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [productId]);

  if (!product) {
    return (
      <main className="product-detail-page product-not-found">
        <strong>该服务商品不存在、未上架或对当前集团不可见</strong>
        <button onClick={() => navigate("/")} type="button">
          返回首页
        </button>
      </main>
    );
  }

  const travel = product.travelDetails;
  const reviews = publishedReviews.filter(
    ({ productId: reviewProductId }) => reviewProductId === product.id,
  );
  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) /
        reviews.length
      : 0;

  return (
    <main className="product-detail-page">
      <header className="detail-topbar">
        <button
          aria-label="返回首页"
          onClick={() => navigate("/")}
          type="button"
        >
          <ArrowLeft size={20} />
        </button>
        <strong>商品详情</strong>
        <span aria-hidden="true" />
      </header>

      <div className="detail-hero">
        <div className="product-image-fallback">
          {travel?.destination ?? "疗养服务"}
        </div>
        <img
          alt={`${product.name}主图`}
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
          src={product.coverImage}
        />
        <span>疗养旅游</span>
      </div>

      <section className="detail-summary-card">
        <h1>{product.name}</h1>
        <div className="detail-destination">
          <MapPin size={14} />
          <span>{travel?.destination ?? "目的地待确认"}</span>
        </div>
        <div className="detail-quota">
          <span>参考额度</span>
          <strong>
            {product.quotaReference
              ? `${formatQuota(product.quotaReference.min)} 额度/人起`
              : "待确认"}
          </strong>
        </div>
      </section>

      <section className="detail-section">
        <h2>疗养信息</h2>
        <div className="travel-facts">
          <div>
            <CalendarDays size={18} />
            <span>适宜月份</span>
            <strong>
              {travel
                ? formatSuitableMonths(travel.suitableTravelMonths)
                : "全年可咨询"}
            </strong>
          </div>
          <div>
            <Clock3 size={18} />
            <span>建议停留</span>
            <strong>{travel?.recommendedStayDays ?? "待确认"}</strong>
          </div>
          <div>
            <Plane size={18} />
            <span>往返方式</span>
            <strong>
              {travel?.transportOptions?.join(" / ") || "线下确认"}
            </strong>
          </div>
          <div>
            <BusFront size={18} />
            <span>接送服务</span>
            <strong>{travel?.pickupService || "可按需协调"}</strong>
          </div>
        </div>

        <div className="service-arrangements">
          <div>
            <BedDouble size={18} />
            <span>
              <strong>住宿安排</strong>
              <small>{travel?.accommodation || "根据订单线下确认"}</small>
            </span>
          </div>
          <div>
            <Utensils size={18} />
            <span>
              <strong>餐饮安排</strong>
              <small>{travel?.dining || "根据实际套餐协调"}</small>
            </span>
          </div>
        </div>
      </section>

      <section className="detail-section">
        <h2>详细介绍</h2>
        <div className="detail-copy">
          <h3>商品简介</h3>
          <p>{product.summary}</p>
          {travel?.destinationHighlights ? (
            <>
              <h3>目的地特色</h3>
              <p>{travel.destinationHighlights}</p>
            </>
          ) : null}
          <h3>服务说明</h3>
          <p>{product.serviceDescription}</p>
          {travel?.serviceScope ? (
            <div className="service-guarantee">
              <ShieldCheck size={18} />
              <span>{travel.serviceScope}</span>
            </div>
          ) : null}
          <h3>注意事项</h3>
          <p>{product.notes}</p>
        </div>
      </section>

      <section className="detail-section">
        <div className="review-heading">
          <h2>员工评价</h2>
          {reviews.length > 0 ? (
            <span>
              <Star fill="currentColor" size={15} />
              {averageRating.toFixed(1)} · {reviews.length} 条
            </span>
          ) : null}
        </div>
        {reviews.length > 0 ? (
          <div className="public-review-list">
            {reviews.map((review) => (
              <article key={review.id}>
                <div>
                  <strong>{"★".repeat(review.rating)}</strong>
                  <span>{formatDate(review.submittedAt)}</span>
                </div>
                <p>{review.content}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-reviews">暂无公开评价，完成服务后可分享体验。</p>
        )}
      </section>

      <div className="detail-action-bar">
        <button
          onClick={() => navigate(`/products/${product.id}/intent`)}
          type="button"
        >
          提交意向
        </button>
      </div>
    </main>
  );
}
