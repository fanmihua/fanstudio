# 生产部署指南

本文给出一套可复现的单机部署路径：Ubuntu、MySQL 8、PM2、Nginx 和本地持久化上传目录。使用容器平台或无状态平台时，需要把同样的数据库、密钥和文件持久化原则映射到对应服务。

当前公开仓库提供的是面向全新安装的数据库 baseline。由更早的内部版、私有版或其他 migration 历史创建的数据库，必须继续保留原迁移文件并单独设计升级路径，不能直接运行公开 baseline。

## 部署前确认

- Node.js `>= 20.9.0`
- MySQL `8.0+`
- Nginx 与 PM2
- 可用域名及 HTTPS
- 至少 2 GB 内存；在小内存机器上构建前准备 swap
- MySQL 和 `public/uploads/` 的备份与恢复方案

项目当前使用本地磁盘保存上传文件。直接部署到临时文件系统会丢失上传内容；需要挂载持久卷或自行改接对象存储。

## 1. 创建独立应用用户

不要使用 root 运行 Next.js：

```bash
sudo useradd --create-home --shell /bin/bash fanstudio
sudo install -d -o fanstudio -g fanstudio /srv/fanstudio
```

安装 Node.js、MySQL、Nginx 和 PM2 后，确认版本：

```bash
node --version
npm --version
mysql --version
pm2 --version
nginx -v
```

## 2. 获取代码

```bash
sudo -u fanstudio git clone https://github.com/fanmihua/fanstudio.git /srv/fanstudio/app
cd /srv/fanstudio/app
sudo -u fanstudio npm ci
```

`package-lock.json` 已提交，部署和 CI 使用 `npm ci` 保持依赖一致。

## 3. 创建数据库

使用 MySQL 管理账号执行：

```sql
CREATE DATABASE fanstudio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'fanstudio'@'localhost' IDENTIFIED BY '替换为随机数据库密码';
GRANT ALL PRIVILEGES ON fanstudio.* TO 'fanstudio'@'localhost';
FLUSH PRIVILEGES;
```

MySQL 仅监听本机或私有网络，不要向公网开放 3306。

## 4. 配置环境变量

```bash
cd /srv/fanstudio/app
sudo -u fanstudio cp .env.example .env
sudo chmod 600 .env
openssl rand -base64 32
```

编辑 `.env`，至少设置：

```env
DATABASE_URL="mysql://fanstudio:数据库密码@127.0.0.1:3306/fanstudio"
AUTH_SECRET="随机生成的签名密钥"
MEMBER_SESSION_SECRET="另一条随机签名密钥"
AUTH_URL="https://your-domain.com"
NEXT_PUBLIC_SITE_URL="https://your-domain.com"
NEXT_PUBLIC_SITE_DOMAIN="your-domain.com"
```

可选模块：

- SMTP：`SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASS`、`EMAIL_FROM`
- AI：`AI_ENABLED`、`AI_BASE_URL`、`AI_API_KEY`、模型名
- 微信支付：商户号、API v3 密钥、证书或私钥、HTTPS 回调地址
- 微信分享：`WECHAT_MP_APP_ID`、`WECHAT_APP_SECRET`

所有 AI、邮件、支付、数据库和 PEM 凭据都属于秘密。通过后台保存 AI Key 时，Key 会进入数据库，因此数据库备份同样需要加密和访问控制。

## 5. 初始化数据库与管理员

先应用仓库已有 migration：

```bash
cd /srv/fanstudio/app
sudo -u fanstudio npx prisma migrate deploy
```

生产环境禁止运行 `npm run db:seed`。该命令只为本地演示准备，会写入公开固定密码、演示设置和案例，并在重复执行时恢复这些数据。

使用一次性环境变量创建生产管理员：

```bash
cd /srv/fanstudio/app
sudo -u fanstudio env \
  ADMIN_EMAIL="owner@example.com" \
  ADMIN_PASSWORD="使用密码管理器生成的随机强密码" \
  ADMIN_NAME="站点管理员" \
  npm run db:bootstrap-admin
```

脚本要求密码至少 12 位并拒绝常见弱密码。执行后清除终端历史或其他可能保存 `ADMIN_PASSWORD` 的位置。

## 6. 持久化上传目录

```bash
sudo install -d -o fanstudio -g fanstudio /srv/fanstudio/data/uploads
sudo -u fanstudio mkdir -p /srv/fanstudio/app/public
sudo -u fanstudio ln -s /srv/fanstudio/data/uploads /srv/fanstudio/app/public/uploads
```

如果 `public/uploads` 已存在，先确认其中没有需要保留的文件，再迁移内容并创建软链接。应用用户必须对持久化目录有写权限。

默认上传大小为 50 MB，可用 `MEDIA_MAX_UPLOAD_MB` 调整。Nginx 的 `client_max_body_size` 应设置为相同或更大的值。

## 7. 构建并启动

```bash
cd /srv/fanstudio/app
sudo -u fanstudio npm run build
sudo -u fanstudio pm2 start ecosystem.config.cjs
sudo -u fanstudio pm2 save
```

仓库内的 `ecosystem.config.cjs` 将 Next.js 绑定到 `127.0.0.1:3000`。验证：

```bash
curl --fail http://127.0.0.1:3000/zh
sudo -u fanstudio pm2 status
sudo -u fanstudio pm2 logs fanstudio --lines 100
```

按照 `pm2 startup` 输出的命令配置开机启动，并确认该服务属于 `fanstudio` 用户。

## 8. 配置 Nginx

创建 `/etc/nginx/sites-available/fanstudio`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 50M;

    location /uploads/ {
        alias /srv/fanstudio/data/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        expires 365d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用并检查配置：

```bash
sudo ln -s /etc/nginx/sites-available/fanstudio /etc/nginx/sites-enabled/fanstudio
sudo nginx -t
sudo systemctl reload nginx
```

使用 Certbot、Caddy 或云负载均衡配置 HTTPS。生产环境中的 `AUTH_URL`、`NEXT_PUBLIC_SITE_URL` 和支付回调必须使用最终 HTTPS 域名。

## 9. 上线验收

至少验证：

- `/zh`、`/en`、作品详情、关于页与留言页可访问
- `/admin` 未登录时跳转登录页
- 生产管理员可以登录并立即修改密码
- 上传图片后文件写入持久化目录，重启应用后仍可访问
- SMTP、AI、微信支付未配置时，基础页面和后台仍可使用
- 已启用的邮件、AI、支付回调分别做一次真实测试
- Nginx 只向公网暴露 80 / 443，Next.js 和 MySQL 保持内网访问

## 更新流程

更新前先备份数据库和上传目录：

```bash
cd /srv/fanstudio/app
sudo -u fanstudio git fetch origin
sudo -u fanstudio git checkout main
sudo -u fanstudio git pull --ff-only origin main
sudo -u fanstudio npm ci
sudo -u fanstudio npx prisma migrate deploy
sudo -u fanstudio npm run build
sudo -u fanstudio pm2 restart fanstudio
curl --fail http://127.0.0.1:3000/zh
```

生产环境只使用 `prisma migrate deploy`。`prisma db push` 和 `prisma migrate dev` 用于开发，不适合作为生产迁移命令。

这一更新流程只适用于本仓库 baseline 创建的数据库。其他既有数据库应从自己的已部署提交升级，并先在数据副本上验证 migration。

## 备份与恢复

备份必须同时覆盖：

- MySQL 数据库
- `/srv/fanstudio/data/uploads/`
- `.env` 与支付证书的加密备份
- 备份校验值和恢复说明

可以使用 MySQL 的 `mysqldump --single-transaction` 与系统备份工具建立流程。数据库密码放在权限为 600 的 MySQL option file 或秘密管理服务中，不要把密码直接写进 cron 命令。

备份只有经过恢复验证才可靠。定期将备份恢复到隔离数据库和隔离上传目录，运行 migration、构建并检查代表性页面；同时保留异地副本。

## 安全清单

- 生产环境不运行 `db:seed`，不保留公开演示账号
- `AUTH_SECRET` 与 `MEMBER_SESSION_SECRET` 使用独立随机值
- `.env`、PEM、数据库备份权限最小化
- MySQL、Next.js 只监听本机或私有网络
- 管理后台使用强密码并限制可访问人员
- `figmaUrl` 只填写公开预览；私有交付地址放在受保护字段或外部系统
- 上传目录和数据库均有自动备份、异地副本与恢复演练
- 更新前检查 migration、依赖、安全公告和回滚方案
- `npm run media:cleanup` 会删除文件并修改数据库，执行前先备份
- `membership:cleanup-pending` 默认会写数据库，需要预览时显式加 `--dry-run`
- `npm run release:check` 不能替代人工检查 Git 历史、图片元数据和配置备份

## 常见问题

### 构建时数据库连接失败

`npm run build` 会在部分路由预渲染时读取数据库。确认 MySQL 可连接、`.env` 正确并已运行 `prisma migrate deploy`。

### 上传后图片消失

检查 `public/uploads` 是否正确指向持久化目录、应用用户是否有写权限，以及部署流程是否重建或覆盖了软链接。

### 端口 3000 被占用

修改 `ecosystem.config.cjs` 中的端口，并同步修改 Nginx `proxy_pass`，继续绑定 `127.0.0.1`。

### 微信支付回调失败

确认回调 URL 使用 HTTPS、商户配置完整、Nginx 传递 `X-Forwarded-Proto`，并检查 `pm2 logs fanstudio`。不要在日志中输出密钥或完整支付数据。
