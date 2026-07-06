# API 本地开发

后端使用 Fastify、Drizzle 和 PostgreSQL。当前已完成数据库、种子数据、双端 Session 认证和一期核心业务 API，管理端与员工端页面均已接入。

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

## 6. 当前核心接口

管理端读取：

```text
GET /api/admin/context
GET /api/admin/operators
GET /api/admin/operator-accounts
GET /api/admin/groups
GET /api/admin/employees
GET /api/admin/quota-accounts
GET /api/admin/quota-transactions
GET /api/admin/products
GET /api/admin/intents
GET /api/admin/orders
GET /api/admin/reviews
```

管理端写入：

```text
POST  /api/admin/groups
POST  /api/admin/employees
POST  /api/admin/quota-grants
POST  /api/admin/products
POST  /api/admin/products/:productId/publish
PATCH /api/admin/intents/:intentId/follow-up
POST  /api/admin/intents/:intentId/orders
POST  /api/admin/orders/:orderId/confirm
```

员工端：

```text
GET  /api/employee/context
GET  /api/employee/products
GET  /api/employee/intents
POST /api/employee/intents
POST /api/employee/intents/:intentId/withdraw
GET  /api/employee/orders
GET  /api/employee/quota
```

管理端接口按页面权限校验。员工 ID 和操作人均从服务端 Session 获取，不接受前端冒充。订单确认与额度扣减使用同一 PostgreSQL 事务和行级锁。

管理端和员工端 Vite 开发服务器会将 `/api` 代理到 `http://127.0.0.1:3000`，因此本地联调必须同时启动 PostgreSQL、API 和对应前端。
