import { BedDouble, CalendarDays, MapPin, Search } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ServiceProductDto } from "@travel/contracts";

import { EmployeeBottomNav } from "../components/EmployeeBottomNav";
import { EmployeeSummaryHeader } from "../components/EmployeeSummaryHeader";
import { LoadMoreButton } from "../components/LoadMoreButton";
import { useEmployeeData } from "../context/EmployeeDataContext";
import { useLoadMore } from "../hooks/useLoadMore";
import { formatQuota, formatSuitableMonths } from "../lib/format";

export function HomePage() {
  const navigate = useNavigate();
  const { visibleProducts } = useEmployeeData();
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState<"travel" | "hotel">("travel");
  const {
    items: products,
    pagination,
    hasMore,
    isLoading,
    loadMore,
  } = useLoadMore<ServiceProductDto>(
    "/api/employee/products",
    { query: query.trim() || undefined, type: activeType },
    visibleProducts,
  );
  const activeTitle =
    activeType === "hotel" ? "精选疗养酒店" : "精选疗养服务";
  const activeSubtitle =
    activeType === "hotel"
      ? "从合作酒店中选择合适的休养住宿"
      : "专属定制，自然松弛，重塑身心平衡";

  return (
    <main className="home-page">
      <EmployeeSummaryHeader />

      <section className="home-content">
        <label className="product-search">
          <Search size={17} />
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索目的地、疗养主题或商品"
            value={query}
          />
        </label>

        <div className="product-type-tabs" aria-label="商品分类">
          <button
            className={activeType === "travel" ? "active" : ""}
            onClick={() => setActiveType("travel")}
            type="button"
          >
            疗养项目
          </button>
          <button
            className={activeType === "hotel" ? "active" : ""}
            onClick={() => setActiveType("hotel")}
            type="button"
          >
            酒店
          </button>
        </div>

        <div className="section-heading">
          <div>
            <h1>{activeTitle}</h1>
            <p>{activeSubtitle}</p>
          </div>
          <span>{pagination.total} 项</span>
        </div>

        <div className={activeType === "hotel" ? "hotel-list" : "product-list"}>
          {products.length > 0 ? (
            products.map((product) => {
              const travel = product.travelDetails;
              const hotel = product.hotelDetails;
              if (product.type === "hotel") {
                return (
                  <article className="hotel-product-card" key={product.id}>
                    <div className="hotel-product-image">
                      <div className="product-image-fallback">
                        {hotel?.city ?? "合作酒店"}
                      </div>
                      <img
                        alt={`${product.name}主图`}
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                        src={product.coverImage}
                      />
                      <span>{hotel?.starRating || "合作酒店"}</span>
                    </div>
                    <div className="hotel-product-body">
                      <h2>{product.name}</h2>
                      <span className="hotel-product-location">
                        <MapPin size={14} />
                        {hotel?.city ?? "地点待确认"}
                      </span>
                      <p>{product.summary}</p>
                      <div className="hotel-product-meta">
                        <span>
                          <BedDouble size={14} />
                          房型与房态以详情为准
                        </span>
                        <strong>
                          {product.quotaReference
                            ? `${formatQuota(product.quotaReference.min)} 起`
                            : "待确认"}
                        </strong>
                      </div>
                      <button
                        className="hotel-product-action"
                        onClick={() => navigate(`/products/${product.id}`)}
                        type="button"
                      >
                        查看详情
                      </button>
                    </div>
                  </article>
                );
              }
              return (
                <article className="product-card" key={product.id}>
                  <div className="product-image">
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
                    <span>疗养旅游</span>
                  </div>
                  <div className="product-body">
                    <h2>{product.name}</h2>
                    <p>{product.summary}</p>
                    <div className="product-meta">
                      <span>
                        <CalendarDays size={14} />
                        {travel
                          ? formatSuitableMonths(
                              travel.suitableTravelMonths,
                            )
                          : hotel?.city ?? "全年可咨询"}
                      </span>
                      <strong>
                        参考额度{" "}
                        {product.quotaReference
                          ? `${formatQuota(product.quotaReference.min)} 起`
                          : "待确认"}
                      </strong>
                    </div>
                    <button
                      className="product-action"
                      onClick={() => navigate(`/products/${product.id}`)}
                      type="button"
                    >
                      查看详情
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="empty-products">
              <strong>
                没有找到匹配的{activeType === "hotel" ? "酒店" : "服务商品"}
              </strong>
              <span>换一个目的地或关键词试试</span>
            </div>
          )}
        </div>
        <LoadMoreButton
          hasMore={hasMore}
          isLoading={isLoading}
          onClick={loadMore}
        />
      </section>

      <EmployeeBottomNav active="home" />
    </main>
  );
}
