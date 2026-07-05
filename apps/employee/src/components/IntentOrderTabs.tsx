import { useNavigate } from "react-router-dom";

interface IntentOrderTabsProps {
  active: "intents" | "orders";
}

export function IntentOrderTabs({ active }: IntentOrderTabsProps) {
  const navigate = useNavigate();

  return (
    <nav className="intent-order-tabs" aria-label="意向与订单切换">
      <button
        className={active === "intents" ? "active" : ""}
        onClick={() => navigate("/intents")}
        type="button"
      >
        我的意向
      </button>
      <button
        className={active === "orders" ? "active" : ""}
        onClick={() => navigate("/orders")}
        type="button"
      >
        我的订单
      </button>
    </nav>
  );
}
