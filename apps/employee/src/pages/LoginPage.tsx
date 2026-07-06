import { HeartHandshake, LockKeyhole, Phone, ShieldCheck } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useEmployeeData } from "../context/EmployeeDataContext";

export function LoginPage() {
  const navigate = useNavigate();
  const { currentEmployee, login } = useEmployeeData();
  const [error, setError] = useState("");

  if (currentEmployee) {
    return <Navigate replace to="/" />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);

    try {
      await login(String(form.get("phone")), String(form.get("password")));
      navigate("/", { replace: true });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "登录失败",
      );
    }
  }

  return (
    <main className="login-page">
      <section className="login-hero">
        <div className="brand-mark" aria-hidden="true">
          <HeartHandshake size={30} strokeWidth={1.6} />
        </div>
        <span className="eyebrow">企业员工疗养服务</span>
        <h1>让每一次休养，都从安心开始</h1>
        <p>登录后查看所属集团可用服务、个人额度与行程进度。</p>
      </section>

      <section className="login-card">
        <div>
          <h2>员工登录</h2>
          <p>请使用后台为您创建的员工账号</p>
        </div>
        <form onSubmit={handleSubmit}>
          <label className="login-field">
            <span>手机号</span>
            <div>
              <Phone size={19} />
              <input
                autoComplete="tel"
                inputMode="tel"
                name="phone"
                placeholder="请输入手机号"
                required
              />
            </div>
          </label>
          <label className="login-field">
            <span>密码</span>
            <div>
              <LockKeyhole size={19} />
              <input
                autoComplete="current-password"
                minLength={6}
                name="password"
                placeholder="请输入登录密码"
                required
                type="password"
              />
            </div>
          </label>
          {error ? <p className="login-error">{error}</p> : null}
          <button className="primary-button" type="submit">
            登录
          </button>
        </form>
        <div className="login-note">
          <ShieldCheck size={17} />
          <span>账号由所属集团统一开通，如无法登录请联系工作人员。</span>
        </div>
        <p className="demo-account">原型演示：13900002001 / 123456</p>
      </section>
    </main>
  );
}
