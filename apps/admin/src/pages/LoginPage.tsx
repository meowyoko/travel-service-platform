import { HeartHandshake } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";

import { useAdminData } from "../context/AdminDataContext";

export function LoginPage() {
  const { currentOperator, login } = useAdminData();
  const [error, setError] = useState("");

  if (currentOperator) {
    return <Navigate replace to="/" />;
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);

    try {
      await login(String(form.get("username")), String(form.get("password")));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "登录失败",
      );
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="brand__mark" aria-hidden="true">
            <HeartHandshake size={24} strokeWidth={1.8} />
          </div>
          <div>
            <strong>疗养服务管理</strong>
            <span>我方运营后台</span>
          </div>
        </div>
        <div>
          <h1>账号登录</h1>
          <p>使用我方运营账号访问已授权的后台功能。</p>
        </div>
        <form className="login-form" onSubmit={handleLogin}>
          <label className="field">
            <span>用户名</span>
            <input autoComplete="username" name="username" required />
          </label>
          <label className="field">
            <span>密码</span>
            <input
              autoComplete="current-password"
              name="password"
              required
              type="password"
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="button button--primary" type="submit">
            登录
          </button>
        </form>
        <div className="login-demo-note">
          原型演示：领导账号 leader / 123456，普通职工账号 operator /
          123456
        </div>
      </section>
    </main>
  );
}
