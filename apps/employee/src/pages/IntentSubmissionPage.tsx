import {
  ArrowLeft,
  BedDouble,
  BusFront,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Minus,
  Plane,
  Plus,
  Send,
  TrainFront,
  Users,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useEmployeeData } from "../context/EmployeeDataContext";
import { formatQuota, formatSuitableMonths } from "../lib/format";

function getTodayInShanghai(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function getSuggestedStayDays(value?: string): number {
  const firstNumber = value?.match(/\d+/)?.[0];
  return firstNumber ? Number(firstNumber) : 1;
}

const CONTACT_TIMES = [
  "随时",
  "上午（09:00-12:00）",
  "下午（14:00-18:00）",
  "晚上（18:00-21:00）",
];

const ACCOMMODATION_OPTIONS = ["无特别要求", "大床", "双床"];

export function IntentSubmissionPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const {
    currentEmployee,
    currentGroup,
    quotaAccount,
    submitPersonalIntent,
    visibleProducts,
  } = useEmployeeData();
  const product = visibleProducts.find(({ id }) => id === productId);
  const travel = product?.travelDetails;
  const today = useMemo(getTodayInShanghai, []);
  const transportOptions = travel?.transportOptions ?? [];
  const [expectedTravelDate, setExpectedTravelDate] = useState("");
  const [expectedStayDays, setExpectedStayDays] = useState(() =>
    getSuggestedStayDays(travel?.recommendedStayDays),
  );
  const [companionCount, setCompanionCount] = useState(0);
  const [preferredTransport, setPreferredTransport] = useState(
    transportOptions[0] ?? "",
  );
  const [accommodationPreference, setAccommodationPreference] =
    useState("无特别要求");
  const [needsPickup, setNeedsPickup] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [convenientContactTime, setConvenientContactTime] = useState("随时");
  const [pageError, setPageError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  if (!product || !currentEmployee || !currentGroup) {
    return (
      <main className="intent-page intent-unavailable">
        <strong>该服务商品当前无法提交意向</strong>
        <button onClick={() => navigate("/")} type="button">
          返回首页
        </button>
      </main>
    );
  }

  const selectedProductId = product.id;

  async function submitIntent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPageError("");

    const suitableMonths = travel?.suitableTravelMonths;
    const selectedMonth = Number(expectedTravelDate.slice(5, 7));
    if (
      suitableMonths?.length &&
      !suitableMonths.includes(selectedMonth)
    ) {
      setPageError(
        `请选择适宜月份：${formatSuitableMonths(suitableMonths)}`,
      );
      return;
    }

    try {
      await submitPersonalIntent({
        productId: selectedProductId,
        expectedTravelDate,
        expectedStayDays,
        companionCount,
        ...(preferredTransport ? { preferredTransport } : {}),
        needsPickup,
        ...(accommodationPreference !== "无特别要求"
          ? { accommodationPreference }
          : {}),
        ...(additionalNotes.trim()
          ? { additionalNotes: additionalNotes.trim() }
          : {}),
        ...(convenientContactTime
          ? { convenientContactTime }
          : {}),
      });
      setSubmitted(true);
    } catch (caughtError) {
      setPageError(
        caughtError instanceof Error
          ? caughtError.message
          : "提交意向失败，请稍后重试",
      );
    }
  }

  if (submitted) {
    return (
      <main className="intent-page intent-success">
        <CheckCircle2 size={42} />
        <h1>意向已提交</h1>
        <p>
          本次提交不会扣减额度。工作人员会在你选择的时间联系确认具体安排。
        </p>
        <div>
          <button
            onClick={() => navigate("/intents")}
            type="button"
          >
            查看我的意向
          </button>
          <button
            onClick={() => navigate(`/products/${selectedProductId}`)}
            type="button"
          >
            返回商品详情
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="intent-page">
      <header className="intent-topbar">
        <button
          aria-label="返回商品详情"
          onClick={() => navigate(`/products/${selectedProductId}`)}
          type="button"
        >
          <ArrowLeft size={19} />
          <span>返回</span>
        </button>
        <strong>提交意向</strong>
        <span aria-hidden="true" />
      </header>

      <form className="intent-form" onSubmit={submitIntent}>
        <section className="intent-summary">
          <div>
            <h1>{product.name}</h1>
            <p>
              {currentGroup.name} · {currentEmployee.name}
            </p>
          </div>
          <div>
            <span>当前可用额度</span>
            <strong>{formatQuota(quotaAccount?.availableBalance ?? 0)}</strong>
          </div>
        </section>

        <section className="intent-form-section">
          <h2>行程安排</h2>
          <label className="intent-field">
            <span>预计出行日期 <em>*</em></span>
            <div className="intent-input-with-icon">
              <CalendarDays size={17} />
              <input
                min={today}
                onChange={(event) =>
                  setExpectedTravelDate(event.target.value)
                }
                required
                type="date"
                value={expectedTravelDate}
              />
            </div>
            {travel?.suitableTravelMonths.length ? (
              <small>
                适宜月份：
                {formatSuitableMonths(travel.suitableTravelMonths)}
              </small>
            ) : null}
          </label>

          <div className="intent-field">
            <span>期望停留天数 <em>*</em></span>
            <div className="intent-stepper">
              <button
                aria-label="减少停留天数"
                disabled={expectedStayDays <= 1}
                onClick={() =>
                  setExpectedStayDays((value) => Math.max(1, value - 1))
                }
                type="button"
              >
                <Minus size={17} />
              </button>
              <input
                min="1"
                onChange={(event) =>
                  setExpectedStayDays(
                    Math.max(1, Number(event.target.value) || 1),
                  )
                }
                required
                type="number"
                value={expectedStayDays}
              />
              <button
                aria-label="增加停留天数"
                onClick={() => setExpectedStayDays((value) => value + 1)}
                type="button"
              >
                <Plus size={17} />
              </button>
            </div>
            {travel?.recommendedStayDays ? (
              <small>商品建议：{travel.recommendedStayDays}</small>
            ) : null}
          </div>

          <div className="intent-field">
            <span>同行人员数（不含本人）</span>
            <div className="intent-stepper">
              <button
                aria-label="减少同行人员"
                disabled={companionCount <= 0}
                onClick={() =>
                  setCompanionCount((value) => Math.max(0, value - 1))
                }
                type="button"
              >
                <Minus size={17} />
              </button>
              <div className="intent-stepper-value">
                <Users size={16} />
                {companionCount} 人
              </div>
              <button
                aria-label="增加同行人员"
                onClick={() => setCompanionCount((value) => value + 1)}
                type="button"
              >
                <Plus size={17} />
              </button>
            </div>
          </div>
        </section>

        <section className="intent-form-section">
          <h2>偏好设置</h2>
          {transportOptions.length ? (
            <div className="intent-field">
              <span>期望往返方式</span>
              <div className="intent-choice-grid">
                {transportOptions.map((option) => (
                  <label key={option}>
                    <input
                      checked={preferredTransport === option}
                      name="transport"
                      onChange={() => setPreferredTransport(option)}
                      type="radio"
                    />
                    {option === "飞机" ? (
                      <Plane size={19} />
                    ) : (
                      <TrainFront size={19} />
                    )}
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="intent-field">
            <span>住宿偏好</span>
            <div className="intent-choice-grid intent-choice-grid-three">
              {ACCOMMODATION_OPTIONS.map((option) => (
                <label key={option}>
                  <input
                    checked={accommodationPreference === option}
                    name="accommodation"
                    onChange={() => setAccommodationPreference(option)}
                    type="radio"
                  />
                  <BedDouble size={19} />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="intent-toggle">
            <span>
              <BusFront size={19} />
              <span>
                <strong>需要接送服务</strong>
                <small>由工作人员协调接站或送站</small>
              </span>
            </span>
            <input
              checked={needsPickup}
              onChange={(event) => setNeedsPickup(event.target.checked)}
              type="checkbox"
            />
          </label>
        </section>

        <section className="intent-form-section">
          <h2>其他信息</h2>
          <label className="intent-field">
            <span>补充说明</span>
            <textarea
              maxLength={300}
              onChange={(event) => setAdditionalNotes(event.target.value)}
              placeholder="例如：饮食禁忌、无障碍需求等"
              rows={4}
              value={additionalNotes}
            />
            <small>{additionalNotes.length}/300</small>
          </label>

          <label className="intent-field">
            <span>方便联系时间</span>
            <div className="intent-input-with-icon">
              <Clock3 size={17} />
              <select
                onChange={(event) =>
                  setConvenientContactTime(event.target.value)
                }
                value={convenientContactTime}
              >
                {CONTACT_TIMES.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
          </label>
        </section>

        <aside className="intent-tip">
          提交意向不代表服务确认成功，也不会立即扣减额度。工作人员将联系确认具体安排。
        </aside>

        {pageError ? (
          <p className="intent-error" role="alert">
            {pageError}
          </p>
        ) : null}

        <div className="intent-submit-bar">
          <span>
            <small>预估消耗额度</small>
            <strong>待确认</strong>
          </span>
          <button type="submit">
            提交意向
            <Send size={17} />
          </button>
        </div>
      </form>
    </main>
  );
}
