# Comet Admin Panel

完整的用户管理和授权系统，用于管理Comet RAT的用户、许可证和订阅。

## 功能特性

### 🎯 核心功能
- ✅ 用户管理系统
- ✅ 许可证生成和管理
- ✅ 订阅管理
- ✅ 活动日志记录
- ✅ 实时统计数据
- ✅ 双因素认证(2FA)
- ✅ JWT身份验证
- ✅ 速率限制
- ✅ 安全加密

### 📊 管理面板功能
- 用户CRUD操作
- 批量许可证生成
- 用户封禁/解封
- 密码重置
- 订阅到期提醒
- 导出许可证为CSV
- 实时活动监控

## 安装步骤

### 1. 安装依赖

```bash
cd AdminPanel
npm install
```

### 2. 配置环境变量

编辑 `.env` 文件:

```env
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@123456
```

⚠️ **重要**: 在生产环境中必须更改默认密码！

### 3. 初始化数据库

```bash
npm run init-db
```

### 4. 启动服务器

```bash
# 生产模式
npm start

# 开发模式（热重载）
npm run dev
```

服务器将运行在 `http://localhost:3000`

## 默认登录凭据

```
用户名: admin
密码: Admin@123456
```

## API端点

### 认证
- `POST /api/auth/login` - 管理员登录
- `POST /api/auth/change-password` - 修改密码
- `POST /api/auth/2fa/enable` - 启用2FA
- `POST /api/auth/2fa/verify` - 验证2FA
- `POST /api/auth/2fa/disable` - 禁用2FA

### 用户管理
- `GET /api/users` - 获取所有用户
- `GET /api/users/:id` - 获取单个用户
- `POST /api/users` - 创建用户
- `PUT /api/users/:id` - 更新用户
- `DELETE /api/users/:id` - 删除用户
- `POST /api/users/:id/ban` - 封禁/解封用户
- `POST /api/users/:id/reset-password` - 重置用户密码

### 许可证管理
- `GET /api/licenses` - 获取所有许可证
- `POST /api/licenses/generate` - 生成新许可证
- `DELETE /api/licenses/:id` - 删除许可证
- `GET /api/licenses/export/csv` - 导出为CSV

### 统计数据
- `GET /api/stats` - 获取仪表板统计

### 活动日志
- `GET /api/activity` - 获取活动日志
- `DELETE /api/activity/cleanup` - 清理旧日志

## 数据库架构

### users 表
- 用户账户信息
- HWID绑定
- 状态和封禁管理

### licenses 表
- 许可证密钥
- 订阅类型
- 有效期管理

### subscriptions 表
- 用户订阅关联
- 到期日期跟踪

### admins 表
- 管理员账户
- 2FA配置

### activity_logs 表
- 系统活动记录
- 审计跟踪

## 安全特性

1. **JWT认证** - 安全的令牌验证
2. **Bcrypt密码哈希** - 强加密存储
3. **速率限制** - 防止暴力攻击
4. **Helmet.js** - HTTP安全头
5. **CORS配置** - 跨域安全
6. **2FA支持** - 双因素认证
7. **活动日志** - 完整审计跟踪

## 与C#客户端集成

修改 `API.cs` 连接到你的面板:

```csharp
// 在API.cs中设置你的端点
private const string API_BASE_URL = "http://your-server:3000/api";

// 实现客户端认证逻辑
public async Task<bool> AuthenticateUser(string username, string password)
{
    var response = await HttpClient.PostAsync($"{API_BASE_URL}/auth/login", 
        new StringContent(JsonSerializer.Serialize(new { username, password })));
    return response.IsSuccessStatusCode;
}
```

## 许可证类型配置

在 `routes/licenses.js` 中自定义订阅类型:

```javascript
const SUBSCRIPTION_TYPES = {
    'Basic': { price: 10, features: ['基础功能'] },
    'Premium': { price: 30, features: ['高级功能', '优先支持'] },
    'Enterprise': { price: 100, features: ['所有功能', '专属支持'] }
};
```

## 生产部署

### 方式1：Railway（推荐 - 最简单）

1. **访问Railway**
   - 打开 https://railway.app
   - 使用GitHub账号登录

2. **创建新项目**
   ```bash
   # 在AdminPanel目录初始化git（如果还没有）
   cd AdminPanel
   git init
   git add .
   git commit -m "Initial commit"
   ```

3. **部署到Railway**
   - 点击 "New Project" → "Deploy from GitHub repo"
   - 选择你的仓库
   - Railway会自动检测Node.js项目并部署

4. **配置环境变量**
   - 在Railway项目设置中添加：
     - `JWT_SECRET=your-super-secret-key-change-this`
     - `ADMIN_PASSWORD=YourSecurePassword123!`
   - PORT会自动配置

5. **添加持久化存储（重要！）**
   - 在Railway项目中点击 "New" → "Volume"
   - Mount Path: `/app/database`
   - 这样数据库不会在重启后丢失

6. **获取访问地址**
   - Railway会自动生成域名：`your-app.railway.app`
   - 或绑定自定义域名

**价格：** $5/月（500小时运行时间） + 存储费用

---

### 方式2：Render

1. **访问Render**
   - 打开 https://render.com
   - 使用GitHub账号登录

2. **创建Web Service**
   - 点击 "New +" → "Web Service"
   - 连接GitHub仓库
   - 选择AdminPanel目录

3. **配置部署**
   ```
   Name: comet-admin
   Environment: Node
   Build Command: npm install
   Start Command: node server.js
   ```

4. **添加环境变量**
   ```
   JWT_SECRET=your-secret-key
   ADMIN_PASSWORD=YourPassword123!
   PORT=3000
   ```

5. **添加持久化磁盘**
   - 在设置中添加 "Disk"
   - Mount Path: `/app/database`
   - Size: 1GB（免费）

6. **部署**
   - 点击 "Create Web Service"
   - 等待部署完成（约3-5分钟）

**价格：** 免费版（有限制）或 $7/月

---

### 方式3：使用PM2（VPS部署）

```bash
npm install -g pm2
pm2 start server.js --name comet-admin
pm2 save
pm2 startup
```

### 方式4：使用Docker

```bash
docker build -t comet-admin-panel .
docker run -d -p 3000:3000 --name comet-panel comet-admin-panel
```

### Nginx反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 维护

### 备份数据库

```bash
cp database/users.db database/backup_$(date +%Y%m%d).db
```

### 清理旧日志

```bash
curl -X DELETE http://localhost:3000/api/activity/cleanup?days=30 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 故障排除

### 端口已被占用
```bash
# 查找占用端口的进程
lsof -i :3000
# 或更改 .env 中的端口
PORT=3001
```

### 数据库锁定
```bash
# 删除并重新初始化数据库
rm database/users.db
npm run init-db
```

## 许可证

MIT License

## 支持

如有问题或需要帮助，请联系开发团队。

---

**⚠️ 安全警告**: 此系统用于管理敏感用户数据。请确保:
- 使用强密码
- 启用HTTPS (生产环境)
- 定期备份数据库
- 限制管理员访问
- 监控异常活动
# keyauth
