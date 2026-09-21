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
  const {
    hotelRoomDailyInventories,
    hotelRoomTypes,
    publishedReviews,
    visibleProducts,
  } = useEmployeeData();
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
  const hotel = product.hotelDetails;
  const roomTypes = hotel
    ? hotelRoomTypes.filter(
        ({ hotelProductId, status }) =>
          hotelProductId === product.id && status === "published",
      )
    : [];
  const linkedHotels = visibleProducts.filter(
    (item) =>
      item.type === "hotel" &&
      product.linkedHotelProductIds?.includes(item.id),
  );
  const reviews = publishedReviews.filter(
    ({ productId: reviewProductId }) => reviewProductId === product.id,
  );
  const galleryItems = (product.gallery ?? []).filter(
    ({ description }) => description.trim().length > 0,
  );
  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) /
        reviews.length
      : 0;
  const hotelFeatureItems = hotel?.facilities
    ? hotel.facilities
        .split(/[，、,]/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 4)
    : [];

  function getRoomPrice(roomTypeId: string): number | undefined {
    const prices = hotelRoomDailyInventories
      .filter(
        ({ roomTypeId: inventoryRoomTypeId, isAvailable }) =>
          inventoryRoomTypeId === roomTypeId && isAvailable,
      )
      .map(({ quotaPrice }) => quotaPrice);
    return prices.length > 0 ? Math.min(...prices) : undefined;
  }

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
          {travel?.destination ?? hotel?.city ?? "服务商品"}
        </div>
        <img
          alt={`${product.name}主图`}
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
          src={product.coverImage}
        />
        <span>{product.type === "hotel" ? "酒店" : "疗养旅游"}</span>
      </div>

      <section className="detail-summary-card">
        <h1>{product.name}</h1>
        <div className="detail-destination">
          <MapPin size={14} />
          <span>{travel?.destination ?? hotel?.city ?? "地点待确认"}</span>
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

      {travel ? (
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
            <span>接送协调</span>
            <strong>{travel?.pickupService || "按实际方案确认"}</strong>
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
        {linkedHotels.length > 0 ? (
          <div className="service-arrangements">
            <div>
              <BedDouble size={18} />
              <span>
                <strong>可选酒店</strong>
                <small>{linkedHotels.map(({ name }) => name).join(" / ")}</small>
              </span>
            </div>
          </div>
        ) : null}
      </section>
      ) : null}

      {hotel ? (
        <section className="detail-section">
          <h2>酒店信息</h2>
          {hotelFeatureItems.length > 0 ? (
            <div className="hotel-feature-row">
              {hotelFeatureItems.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          ) : null}
          <div className="travel-facts">
            <div>
              <MapPin size={18} />
              <span>城市/区域</span>
              <strong>{hotel.city}</strong>
            </div>
            <div>
              <BedDouble size={18} />
              <span>酒店定位</span>
              <strong>{hotel.starRating || "合作酒店"}</strong>
            </div>
          </div>
          {hotel.paidServices?.length ? (
            <section className="paid-service-section">
              <h3>付费项目</h3>
              <div className="paid-service-list">
                {hotel.paidServices.map((service) => (
                  <article key={`${service.title}-${service.description}`}>
                    <b aria-hidden="true">¥</b>
                    <span>
                      <strong>{service.title}</strong>
                      <small>{service.description}</small>
                    </span>
                  </article>
                ))}
                <p>付费服务价格以工作人员确认报价为准。</p>
              </div>
            </section>
          ) : null}
          <div className="detail-copy">
            <h3>酒店地址</h3>
            <p>{hotel.address}</p>
            {hotel.facilities ? (
              <>
                <h3>设施服务</h3>
                <p>{hotel.facilities}</p>
              </>
            ) : null}
            {hotel.trafficInfo ? (
              <>
                <h3>交通信息</h3>
                <p>{hotel.trafficInfo}</p>
              </>
            ) : null}
            {hotel.checkInPolicy ? (
              <>
                <h3>入住政策</h3>
                <p>{hotel.checkInPolicy}</p>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      {hotel && roomTypes.length > 0 ? (
        <section className="detail-section">
          <h2>房型与参考额度</h2>
          <div className="hotel-room-card-list">
            {roomTypes.map((room) => {
              const roomPrice = getRoomPrice(room.id);
              return (
                <article className="hotel-room-card" key={room.id}>
                  <div className="hotel-room-image">
                    <img
                      alt={`${room.name}房型图`}
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                      src={room.imageUrl ?? product.coverImage}
                    />
                  </div>
                  <div className="hotel-room-card-body">
                    <div>
                      <h3>{room.name}</h3>
                      <p>
                        {room.bedType || "床型待确认"} · 适合
                        {room.capacity}人
                        {room.breakfast ? ` · ${room.breakfast}` : ""}
                      </p>
                    </div>
                    <strong>
                      {roomPrice !== undefined || product.quotaReference?.min !== undefined
                        ? formatQuota(roomPrice ?? product.quotaReference!.min)
                        : "待确认"}
                      <span>积分/晚起</span>
                    </strong>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {galleryItems.length ? (
        <section className="detail-section">
          <h2>
            {product.type === "hotel"
              ? "酒店设施"
              : product.type === "travel"
                ? "项目介绍"
                : "图文介绍"}
          </h2>
          <div className="product-gallery-grid">
            {galleryItems.map((item, index) => (
              <article className="product-gallery-card" key={`${item.imageUrl}-${index}`}>
                <div className="product-gallery-card__image">
                  <img
                    alt={item.description}
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                    src={item.imageUrl}
                  />
                </div>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

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
