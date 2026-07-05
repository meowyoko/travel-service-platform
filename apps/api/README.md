# API 本地开发

后端使用 Fastify、Drizzle 和 PostgreSQL。当前第一轮已完成数据库、种子数据和双端 Session 认证，业务页面仍使用原有 Mock。

## 1. 启动 PostgreSQL

```powershell
docker compose -f .\compose.dev.yml up -d postgres
docker compose -f .\compose.dev.yml ps
```

容器只监听 `127.0.0.1:5432`，并创建：

```text
travel
travel_test
```

## 2. 准备环境变量

```powershell
Copy-Item .\apps\api\.env.example .\apps\api\.env
```

`.env` 不进入 Git。生产环境必须替换数据库账号、密码并启用安全 Cookie。

## 3. 初始化主库

```powershell
pnpm db:migrate
pnpm db:seed
```

`db:seed` 仅用于空库，发现已有运营账号时会拒绝重复初始化。

## 4. 启动 API

```powershell
pnpm dev:api
```

健康检查：

```text
GET http://127.0.0.1:3000/api/health
```

## 5. 验证

```powershell
pnpm test:api
pnpm typecheck
pnpm test
pnpm build
pnpm verify:mock
```

API 测试只允许连接本机且数据库名以 `_test` 结尾，测试开始时会重建该测试库的 Schema。
