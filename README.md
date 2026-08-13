# Fan's Studio

面向设计师与独立创作者的开源全栈个人网站。作品集、内容发布、数字资源、会员权益、AI 助手和管理后台共用一个 Next.js 工程。

[作者网站](https://fanstudio.cn/zh) · [快速开始](#快速开始) · [后台体验](#本地演示账号) · [部署指南](docs/DEPLOY.md) · [私有内容边界](docs/PRIVATE_CONTENT.md)

这个仓库是一套可以真实运行和继续开发的网站程序，适合作为以下项目的基础：

- 设计师、Design Engineer、开发者的个人主页与作品集
- 带文章、教程、关于页和留言板的内容网站
- 提供免费、开源或付费数字资源的独立站
- 需要产品、套餐、会员、优惠码和访问权益的轻量业务网站
- 需要站内知识检索与文字问答的 AI 个人网站

## 界面预览

| 前台首页 | 管理后台 |
|---|---|
| ![Fan's Studio 前台首页](docs/screenshots/前台首页.png) | ![Fan's Studio 管理后台](docs/screenshots/后台首页.png) |

| 作品展示 | 作品管理 |
|---|---|
| ![Fan's Studio 作品展示](docs/screenshots/前台作品展示.png) | ![Fan's Studio 作品管理](docs/screenshots/后台作品编辑.png) |

截图来自仓库当前的本地演示数据。

## 功能总览

### 前台网站

- 设计作品与开发作品分栏展示，支持分类、标签、点赞、开源标识和多版本
- 文章、视频教程、关于页、生活动态和访客留言板
- BlockNote / Tiptap 富文本内容、作品图集、在线 Demo 与公开 Figma 预览
- 中文、英文双语内容与 `/zh`、`/en` 路由
- 明暗主题、动态主题色、桌面侧栏、移动端导航和响应式布局
- 数据库驱动的站点信息、导航、页面文案、SEO 和 Sitemap

### 管理后台

- 仪表盘：内容、访问、互动、会员、订单和收入概览
- 内容管理：文章、设计作品、开发作品、教程、生活动态
- 站点管理：分类、标签、留言、导航、主题、页脚、社交链接和页面文案
- 资源订单：版本、定价、免费交付、赞助购买、订单查询和退款
- 产品权益：产品、月 / 季 / 年 / 永久套餐、会员、优惠码、人工授权和事件日志
- AI 管理：模型配置、助手文案、人工知识、站内知识源和索引重建
- `ADMIN` 完整管理权限与 `VIEWER` 只读体验权限

### 可选外部能力

这些模块未配置时不会影响作品集和内容管理的基本使用：

- OpenAI-compatible Chat Completions / Embeddings：站内文字助手与来源引用
- SMTP：验证码、资源交付和会员通知邮件
- 微信支付 Native：资源订单和会员套餐支付
- 微信公众号：网页分享签名

## 两套商业能力

项目保留通用业务功能，不预置任何具体收费产品或收费正文。

### 1. 作品资源与订单

适合 Figma 文件、模板、代码资源等单个作品：

- 免费、开源或付费定价
- 版本号、版本价格与升级价格
- 公开预览、资源交付、邮件查单和退款
- 可选微信扫码支付

`figmaUrl` 会在作品详情页作为公开预览嵌入。需要购买后才能获得的地址请放入 `deliveryUrl`、`fileUrl` 或外部私有交付系统，不要写入 `figmaUrl`。

### 2. 产品会员与访问权益

适合需要持续访问权限的独立产品：

- 多产品和独立落地路径
- 月、季、年、永久套餐
- 优惠码、赠送、续费、永久升级抵扣
- 会员会话、设备管理、权益有效期和事件审计
- 产品级订单隔离与退款后的权益重算

本地 seed 不会创建具体产品、会员或会员订单，商业模块初始化后为空。

## AI 助手

当前版本提供文字助手：

- 检索已发布文章、作品、公开教程、关于页和人工知识
- 支持关键词与向量检索、流式回答、来源链接和快捷问题
- 支持多个已启用模型以及访客模型切换
- 未配置模型时可返回基于站内内容的检索式结果
- 后台可配置模型、助手文案、知识条目并重建索引

AI 接口和 API Key 属于可选配置。通过后台保存模型配置时，密钥会进入数据库；数据库备份也应按敏感文件管理。

## 技术栈

| 层级 | 技术 |
|---|---|
| Web | Next.js 16、React 19、TypeScript |
| UI | Tailwind CSS 4、Radix UI、Framer Motion、next-themes |
| 内容编辑 | BlockNote、Tiptap |
| 数据 | MySQL 8、Prisma 6 |
| 登录权限 | NextAuth.js v5、Credentials、JWT |
| 数据可视化 | Recharts |
| 媒体 | Uppy、sharp、本地文件存储 |
| 邮件与支付 | Nodemailer SMTP、wechatpay-node-v3 |

运行要求：

- Node.js `>= 20.9.0`
- npm
- MySQL `8.0+`
- Docker 可选，仅用于快速启动本地 MySQL

## 快速开始

### 1. 获取代码并安装依赖

```bash
git clone https://github.com/fanmihua/fanstudio.git
cd fanstudio
npm ci
```

### 2. 准备 MySQL

已有 MySQL 8 时，创建一个 `utf8mb4` 数据库和独立应用用户即可。

也可以用 Docker 启动本地数据库：

```bash
docker run -d \
  --name fanstudio-mysql \
  --restart unless-stopped \
  -p 127.0.0.1:3306:3306 \
  -e MYSQL_DATABASE=fanstudio \
  -e MYSQL_USER=fanstudio \
  -e MYSQL_PASSWORD=local-dev-only-change-me \
  -e MYSQL_ROOT_PASSWORD=local-root-only-change-me \
  -v fanstudio_mysql_data:/var/lib/mysql \
  mysql:8
```

等待容器进入可用状态后继续。

### 3. 配置环境变量

```bash
cp .env.example .env
openssl rand -base64 32
```

将随机结果写入 `.env` 的 `AUTH_SECRET`，并至少确认以下配置：

```env
DATABASE_URL="mysql://fanstudio:local-dev-only-change-me@127.0.0.1:3306/fanstudio"
AUTH_SECRET="粘贴刚生成的随机值"
AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

`.env` 已被 Git 忽略，不要提交真实值。

### 4. 初始化本地演示数据

```bash
npx prisma migrate deploy
npm run db:seed
```

`db:seed` 仅用于本地或隔离测试库，会写入固定演示账号、站点设置和两个公开案例；重复执行会把这些演示数据恢复到 seed 中的状态。

### 5. 启动网站

```bash
npm run dev
```

- 前台：<http://localhost:3000/zh>
- 英文前台：<http://localhost:3000/en>
- 后台：<http://localhost:3000/admin>

## 本地演示账号

| 权限 | 邮箱 | 密码 | 用途 |
|---|---|---|---|
| 管理员 | `owner@local.test` | `ChangeMeAdmin123!` | 本地完整功能调试 |
| 只读体验 | `viewer@local.test` | `ChangeMeViewer123!` | 浏览后台且无法修改数据 |

这些账号和密码是公开信息，只能用于本地演示。任何可从公网访问的环境都不能使用它们。

seed 同时提供两个经过精简的已公开真实案例：

- `AI 组件库`：设计作品，带公开 Figma Community 预览
- `个人建站工具`：开发作品，带公开在线体验地址

对应封面位于 `public/demo/works/`。你可以先查看完整页面，再替换成自己的作品。

## 换成你自己的网站

1. 使用管理员账号进入 `/admin/settings`，修改站点名、导航、首页、关于页、主题、页脚和社交链接。
2. 在作品、文章和教程后台删除演示内容，上传自己的封面和正文。
3. 修改管理员密码；正式环境使用下文的生产初始化方式。
4. 需要 AI、SMTP 或支付时，再填写对应环境变量和后台配置。
5. 发布前替换演示图片、头像、签名和品牌文案，并运行 `npm run release:check`。

上传文件保存在 `public/uploads/`。生产部署必须给这个目录配置持久卷或改接对象存储；无状态部署平台的临时文件系统会导致上传内容丢失。

## 环境变量

完整模板见 [`.env.example`](.env.example)。

### 必填

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | MySQL 连接串 |
| `AUTH_SECRET` | 后台登录签名密钥，使用随机强值 |
| `AUTH_URL` | 网站完整地址 |
| `NEXT_PUBLIC_SITE_URL` | 前台公开地址 |

### 常用可选项

| 能力 | 变量 |
|---|---|
| 会员会话 | `MEMBER_SESSION_SECRET`；留空时回退到 `AUTH_SECRET` |
| 邮件 | `SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASS`、`EMAIL_FROM`、`SUPPORT_WECHAT` |
| AI | `AI_ENABLED`、`AI_BASE_URL`、`AI_API_KEY`、`AI_CHAT_MODEL`、`AI_EMBEDDING_MODEL` |
| 微信支付 | `WECHAT_PAY_MCH_ID`、`WECHAT_PAY_API_KEY`、证书或私钥配置、回调地址 |
| 微信分享 | `WECHAT_MP_APP_ID`、`WECHAT_APP_SECRET` |
| 媒体 | `MEDIA_MAX_UPLOAD_MB` |

## 生产部署

生产环境只执行 migration，不运行本地演示 seed：

```bash
npm ci
npx prisma migrate deploy

ADMIN_EMAIL="owner@example.com" \
ADMIN_PASSWORD="使用密码管理器生成的随机强密码" \
ADMIN_NAME="站点管理员" \
npm run db:bootstrap-admin

npm run build
pm2 start ecosystem.config.cjs
```

`db:bootstrap-admin` 只创建或更新指定管理员，不写入演示案例和体验账号。命令结束后清除 shell 历史或环境中的 `ADMIN_PASSWORD`。

生产环境还需要：

- 让 Next.js 与 MySQL 只监听内网或 loopback 地址
- 使用 Nginx / Caddy 终止 HTTPS 并反向代理到 `127.0.0.1:3000`
- 持久化并备份 MySQL 与 `public/uploads/`
- 保护 `.env`、AI / SMTP / 支付凭据、PEM 文件和数据库备份
- 上线前验证登录、上传、邮件、支付回调和恢复流程

完整步骤见 [`docs/DEPLOY.md`](docs/DEPLOY.md)。

## 公开代码与私有内容边界

公开仓库保留通用网站、后台、订单、会员、支付、权益和 AI 功能。以下数据应始终留在生产数据库、对象存储、外部内容服务或独立私有仓库：

| 可以公开 | 必须保持私有 |
|---|---|
| 前台、后台和 API 源代码 | 未公开或收费的正文、图片、附件和内容清单 |
| 通用数据库结构与全新安装 baseline | 真实用户、会员、订单、支付与访问日志 |
| 无真实值的环境变量模板 | 下载地址、交付链接、授权文件和数据库备份 |
| 已公开案例的精简展示快照 | 服务器地址、内部运维资料、证书、私钥和 API Key |
| 通用产品、套餐、优惠码和权益逻辑 | 客服记录、供应商资料和运营配置 |

不要先提交私有内容再删除，Git 历史仍可能保留旧版本。详细规则见 [`docs/PRIVATE_CONTENT.md`](docs/PRIVATE_CONTENT.md)。

发布前运行：

```bash
npm run release:check
git status --short
git diff --check
```

公开仓库中的 baseline 面向全新安装。已有数据库必须继续保留并使用自己的 migration 历史，不能直接切换到公开 baseline。

`release:check` 只覆盖已知私有路径、本机绝对路径和高置信密钥。它不能替代对完整 Git 历史、图片元数据、数据库导出和人工提交差异的检查。

## 常用命令

| 命令 | 作用 | 注意事项 |
|---|---|---|
| `npm run dev` | 启动开发环境 | 默认端口 3000 |
| `npm run build` | Prisma generate + Next.js 生产构建 | 构建时需要可连接的数据库 |
| `npm run start` | 启动生产构建 | 直接执行默认监听所有网卡；生产推荐 PM2 配置 |
| `npm run db:seed` | 写入本地演示数据 | 禁止用于生产库 |
| `npm run db:bootstrap-admin` | 用环境变量创建生产管理员 | 至少 12 位随机强密码 |
| `npm run db:migrate` | 创建开发 migration | 只用于开发环境 |
| `npx prisma migrate deploy` | 应用已有 migration | 生产部署使用 |
| `npm run db:studio` | 打开 Prisma Studio | 会直接读写数据库 |
| `npm test` | 运行不依赖数据库的回归测试 | 提交前建议执行 |
| `MEMBERSHIP_TEST_ALLOW_WRITE=1 npm run test:membership` | 运行会员集成测试 | 会写入数据，仅限隔离测试库 |
| `npm run release:check` | 扫描公开发布边界 | 仍需人工复查 |
| `npm run media:cleanup` | 清理过期未引用媒体 | 会修改数据库并删除文件 |
| `npm run membership:cleanup-pending -- --dry-run` | 预览待清理会员订单 | 去掉 `--dry-run` 会写数据库 |

## 项目结构

```text
fanstudio/
├── src/
│   ├── app/
│   │   ├── (frontend)/        # 无语言前缀的共享前台实现
│   │   ├── [locale]/          # /zh 与 /en 前台路由
│   │   ├── admin/             # 管理后台
│   │   ├── member/            # 会员登录、账户与购买流程
│   │   └── api/               # 业务 API
│   ├── components/            # 前台、后台和通用 UI
│   ├── lib/
│   │   └── ai/                # AI provider、检索与知识索引
│   ├── hooks/                 # React hooks
│   └── locales/               # 中英文界面文案
├── prisma/
│   ├── schema.prisma          # MySQL 数据模型
│   ├── migrations/            # 全新安装 baseline
│   └── seed.ts                # 仅限本地演示的 seed
├── public/
│   ├── demo/                  # 两个公开案例快照
│   └── uploads/               # 运行时上传目录，不进入 Git
├── scripts/                   # 初始化、检查与维护脚本
├── tests/                     # 自动化回归与隔离集成测试
├── docs/                      # 部署、边界与项目文档
├── .env.example               # 无真实凭据的配置模板
└── package.json
```

## 验证建议

提交功能改动前至少运行：

```bash
npx tsc --noEmit
npm test
npm run lint -- --quiet
npm run build
npm run release:check
```

涉及数据库时，在空 MySQL 数据库中执行 `npx prisma migrate deploy`；涉及 seed 时连续执行两次，确认结果幂等。

## License 与素材说明

源代码使用 [MIT License](LICENSE)。

`public/demo/`、`docs/screenshots/`、`public/avatar.png`、`public/signature.png` 中的案例、截图和品牌素材不随 MIT 许可证授权再利用或商用。它们用于说明本项目的内容结构和界面效果；公开部署自己的站点前请替换为你拥有权利的素材。完整说明见 [`docs/ASSET_LICENSE.md`](docs/ASSET_LICENSE.md)。

欢迎通过 Issue 反馈问题或讨论改进方向。
