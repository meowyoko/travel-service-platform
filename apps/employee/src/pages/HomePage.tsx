import { CalendarDays, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { EmployeeBottomNav } from "../components/EmployeeBottomNav";
import { EmployeeSummaryHeader } from "../components/EmployeeSummaryHeader";
import { useEmployeeData } from "../context/EmployeeDataContext";
import { formatQuota, formatSuitableMonths } from "../lib/format";

export function HomePage() {
  const navigate = useNavigate();
  const { visibleProducts } = useEmployeeData();
  const [query, setQuery] = useState("");
  const products = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return visibleProducts
      .filter((product) => {
        if (!normalizedQuery) {
          return true;
        }
        return [
          product.name,
          product.summary,
          product.travelDetails?.destination,
        ].some((value) => value?.toLowerCase().includes(normalizedQuery));
      })
      .sort(
        (left, right) =>
          Number(Boolean(right.recommended)) -
            Number(Boolean(left.recommended)) ||
          (left.sortOrder ?? 0) - (right.sortOrder ?? 0),
      );
  }, [query, visibleProducts]);

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

        <div className="section-heading">
          <div>
            <h1>精选疗养服务</h1>
            <p>专属定制，自然松弛，重塑身心平衡</p>
          </div>
          <span>{products.length} 项</span>
        </div>

        <div className="product-list">
          {products.length > 0 ? (
            products.map((product) => {
              const travel = product.travelDetails;
              return (
                <article className="product-card" key={product.id}>
                  <div className="product-image">
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
                          : "全年可咨询"}
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
              <strong>没有找到匹配的服务商品</strong>
              <span>换一个目的地或关键词试试</span>
            </div>
          )}
        </div>
      </section>

      <EmployeeBottomNav active="home" />
    </main>
  );
}
