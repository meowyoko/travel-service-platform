import { ClipboardList, Home, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface EmployeeBottomNavProps {
  active: "home" | "intents" | "profile";
}

export function EmployeeBottomNav({ active }: EmployeeBottomNavProps) {
  const navigate = useNavigate();

  return (
    <nav className="employee-bottom-nav" aria-label="员工端主导航">
      <button
        className={active === "home" ? "active" : ""}
        onClick={() => navigate("/")}
        type="button"
      >
        <Home size={19} />
        <span>首页</span>
      </button>
      <button
        className={active === "intents" ? "active" : ""}
        onClick={() => navigate("/intents")}
        type="button"
      >
        <ClipboardList size={19} />
        <span>意向/订单</span>
      </button>
      <button
        className={active === "profile" ? "active" : ""}
        onClick={() => navigate("/profile")}
        type="button"
      >
        <UserRound size={19} />
        <span>我的</span>
      </button>
    </nav>
  );
}
