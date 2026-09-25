# 飞书 CRM - AI 智能体第三方集成方案

## 🎯 核心优势

相比飞书自带 AI，使用**第三方中转站**的优势：

| 对比项 | 飞书自带 AI | 第三方中转站 | 说明 |
|--------|------------|-------------|------|
| **API 额度** | 有限制（免费版更少） | ✅ 无限制/更高配额 | 可随时切换模型 |
| **成本控制** | ⚠️ 超额需付费 | ✅ 按需分配 | 可自定义用量 |
| **模型选择** | ❌ 仅支持飞书模型 | ✅ 任意模型可选 | GPT、Claude、通义千问等 |
| **私有化部署** | ❌ 不支持 | ✅ 完全可控 | 数据安全自掌握 |
| **多模型切换** | ❌ 固定 | ✅ 灵活配置 | A/B 测试最优模型 |
| **日志审计** | ⚠️ 基础功能 | ✅ 完整记录 | 便于问题追溯 |

---

## 🏗️ 系统架构设计

### 总体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        前端交互层                            │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│   │ 飞书 App  │  │ 手机浏览器│  │ PC 网页版 │                 │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘                 │
└────────┼────────────┼────────────┼─────────────────────────┘
         │            │            │
         └────────────┴────┬───────┘
                           │ Webhook/API
┌──────────────────────────▼────────────────────────────────┐
│                    AI 路由层                                │
│   ┌────────────────────────────────────────────────────┐  │
│   │              你的中转站 (Custom Middleware)          │  │
│   │  - API Key 管理                                      │  │
│   │  - 模型负载均衡                                      │  │
│   │  - 流量控制                                          │  │
│   │  - 日志记录                                          │  │
│   └────────────┬───────────────────────────────────────┘  │
└────────────────┼──────────────────────────────────────────┘
                 │
    ┌────────────┼────────────┬────────────────┬────────────┐
    ▼            ▼            ▼                ▼            ▼
┌────────┐  ┌────────┐  ┌────────┐      ┌────────┐  ┌─────────┐
│GPT-4   │  │ Claude │  │ 文心   │  ... │ Qwen   │  │本地模型 │
│ OpenAI│  │ Anthropic│ │ One    │      │ 千问   │  │ Ollama │
└────────┘  └────────┘  └────────┘      └────────┘  └─────────┘
```

---

## 🔧 实施步骤详解

### Step 1: 准备你的中转站环境

#### 1.1 确认中转站类型

根据你的描述"常用第三方中转站"，可能是以下几种之一：

##### 方案 A: ChatGLM / FastChat / Lingyiwanwu 等开源项目
```bash
# 如果你有自己的服务器，可以部署这些开源中转
git clone https://github.com/chatchat-space/Langchain-Chatchat.git
cd Langchain-Chatchat
pip install -r requirements.txt
python app.py
```

##### 方案 B: API 聚合平台（如 openai 兼容接口）
- **示例：** Moonshot API、DeepInfra、Together AI
- **优势：** 开箱即用，无需维护服务器

##### 方案 C: 自建代理服务（Node.js/Python）
```python
# 简单示例：你的中转站代码
from fastapi import FastAPI, HTTPException
import os
import httpx

app = FastAPI()

# 支持的模型列表（可根据需要扩展）
MODELS = {
    "gpt-4": {"url": os.getenv("GPT_URL"), "key": os.getenv("GPT_KEY")},
    "claude-3": {"url": os.getenv("CLAUDE_URL"), "key": os.getenv("CLAUDE_KEY")},
    "qwen-max": {"url": os.getenv("QWEN_URL"), "key": os.getenv("QWEN_KEY")},
}

@app.post("/chat/completions")
async def chat_completions(request):
    model = request.model
    messages = request.messages
    
    if model not in MODELS:
        raise HTTPException(status_code=400, detail="Unsupported model")
    
    # 转发请求到对应模型服务商
    async with httpx.AsyncClient() as client:
        response = await client.post(
            MODELS[model]["url"],
            json=request.dict(),
            headers={"Authorization": f"Bearer {MODELS[model]['key']}"},
        )
    
    return response.json()
```

---

### Step 2: 配置飞书机器人调用你的中转站

#### 2.1 创建飞书自建应用

```markdown
1. 访问：https://open.feishu.cn/app
2. 点击"创建应用" → "自定义应用"
3. 填写应用信息：
   - 名称：中科安樵 - AI 客服助手
   - 描述：基于第三方 AI 模型的 CRM 分析助手
   - 头像：商务风格图标
4. 提交审核（企业自建应用可跳过审核）
```

#### 2.2 获取 AppID 和 AppSecret

```markdown
在应用详情页找到：
- APP_ID: cli_xxxxxxxxxxxxx
- APP_SECRET: xxxxxxxxxxxxxxxxxxxxx
```

---

### Step 3: 实现 AI 代理服务

#### 3.1 创建 Flask/FastAPI 代理服务器

```python
# ai_proxy.py
from flask import Flask, request, jsonify
import requests
import os
from datetime import datetime
import json

app = Flask(__name__)

# 你的中转站配置（根据实际调整）
AI_CONFIG = {
    "endpoint": "http://your-middleware-domain.com/api/v1/chat/completions",
    "api_key": os.getenv("MIDDLEWARE_API_KEY", "your_api_key_here"),
    "models": ["gpt-4-turbo", "claude-3-opus", "qwen-max"],
    "default_model": "gpt-4-turbo",
    "temperature": 0.7,
}

# 飞书 OAuth 验证
def verify_feishu_request():
    """验证请求来自飞书"""
    timestamp = request.headers.get('X-Lark-Timestamp', '0')
    sign = request.headers.get('X-Lark-Signature', '')
    # TODO: 添加签名验证逻辑
    return True

# AI 对话处理
@app.route('/feishu/webhook', methods=['POST'])
def handle_feishu_webhook():
    try:
        # 验证飞书请求
        if not verify_feishu_request():
            return jsonify({"error": "Invalid request"}), 401
        
        data = request.json
        
        # 解析用户消息
        user_message = data.get("content", {}).get("text", "")
        
        # 构建上下文（从多维表格查询相关信息）
        context = build_context(data.get("user_id"))
        
        # 调用你的中转站
        ai_response = call_ai_middleware(
            message=user_message,
            context=context,
            model=AI_CONFIG["default_model"]
        )
        
        # 格式化响应
        response_text = format_response(ai_response)
        
        return jsonify({
            "code": 0,
            "msg": "success",
            "data": {
                "content": response_text,
                "type": "text"
            }
        })
    
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

# 调用第三方中转站
def call_ai_middleware(message, context, model=None):
    """
    调用你的中转站 API
    根据实际情况调整请求参数
    """
    headers = {
        "Authorization": f"Bearer {AI_CONFIG['api_key']}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": model or AI_CONFIG["default_model"],
        "messages": [
            {
                "role": "system",
                "content": """你是一名专业的 CRM 销售数据分析助手，负责帮助销售人员分析商机、查询客户信息和生成工作报表。
                
【可用数据】
- 客户信息表：包含客户基本信息、等级、状态
- 跟进记录表：历史记录、下次跟进时间
- 商机关联表：金额、预计成交时间

【回答规则】
1. 对于数据查询类问题，先总结关键发现再用结构化表格展示
2. 对于趋势分析问题，提供原因分析和改进建议
3. 所有结论必须基于真实数据，不确定时明确标注"""
            },
            {
                "role": "user",
                "content": f"{context}\n用户问题：{message}"
            }
        ],
        "temperature": AI_CONFIG["temperature"],
        "stream": False
    }
    
    try:
        response = requests.post(
            AI_CONFIG["endpoint"],
            headers=headers,
            json=payload,
            timeout=30
        )
        response.raise_for_status()
        return response.json()
    
    except requests.exceptions.RequestException as e:
        print(f"API Error: {e}")
        return {
            "choices": [{
                "message": {
                    "content": f"抱歉，AI 服务暂时不可用：{str(e)}"
                }
            }]
        }

# 构建上下文信息
def build_context(user_id):
    """
    从飞书多维表格查询相关客户数据
    这里需要根据实际 API 调整
    """
    # 示例：查询该用户负责的客户
    customer_data = get_customer_data_from_base(user_id)
    
    return f"当前用户 ID: {user_id}\n负责的客户数量：{len(customer_data)}\n重点关注客户：{customer_data[:3]}"

def get_customer_data_from_base(user_id):
    """
    通过飞书 Base API 查询客户数据
    """
    # TODO: 实现实际的 API 调用
    # 参考：https://open.feishu.cn/document/server-docs/base/read-v4
    return []

# 格式化 AI 响应
def format_response(ai_data):
    """
    将 AI 返回的结果转换为友好的文本格式
    """
    content = ai_data.get("choices", [{}])[0].get("message", {}).get("content", "")
    return content

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

---

### Step 4: 配置飞书机器人 Webhook

#### 4.1 开启「事件订阅」

```markdown
1. 在飞书应用后台 → 「开发设置」→ 「事件与授权」
2. 勾选以下事件：
   - IM 消息已读
   - 聊天消息及回复
   - 子应用被打开
3. 输入接收消息的 URL（你的代理服务器地址）：
   https://your-server.com/ai-proxy/feishu/webhook
4. 订阅事件后，飞书会发送验证请求，你的服务器需要返回：
   {"challenge": "xxx"}
```

#### 4.2 配置消息推送权限

```markdown
1. 权限管理 → 申请以下权限：
   - contacts.read (读取联系人)
   - im.message.send (发送消息)
   - drive.file.read (读取附件)
2. 等待管理员审批
```

---

### Step 5: 部署代理服务

#### 5.1 服务器要求

| 配置项 | 最低要求 | 推荐配置 |
|--------|---------|---------|
| CPU | 1 核 | 2 核+ |
| 内存 | 512MB | 1GB+ |
| 存储 | 10GB | 20GB+ |
| 带宽 | 10Mbps | 50Mbps+ |
| 操作系统 | Ubuntu 18.04+ | Ubuntu 20.04+ LTS |

#### 5.2 部署脚本（Linux）

```bash
#!/bin/bash
# deploy.sh - 一键部署 AI 代理服务器

set -e

echo "🚀 开始部署飞书 AI 代理服务器..."

# 安装依赖
sudo apt update
sudo apt install -y python3-pip python3-venv nginx git curl

# 创建项目目录
PROJECT_DIR=/opt/feishu-ai-proxy
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

# 克隆代码
git clone https://github.com/your-repo/feishu-crm-ai.git .

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 创建系统服务
cat > /etc/systemd/system/feishu-ai.service <<EOF
[Unit]
Description=Feishu CRM AI Proxy
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=$PROJECT_DIR
Environment="PATH=$PROJECT_DIR/venv/bin"
Environment="FLASK_APP=ai_proxy.py"
ExecStart=$PROJECT_DIR/venv/bin/flask run --host=0.0.0.0 --port=5000
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# 启用并启动服务
sudo systemctl daemon-reload
sudo systemctl enable feishu-ai
sudo systemctl start feishu-ai

# 配置 Nginx
cat > /etc/nginx/sites-available/feishu-ai <<EOF
server {
    listen 80;
    server_name your-domain.com;

    location /ai-proxy/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # 超时设置（AI 可能响应较慢）
        proxy_connect_timeout 60;
        proxy_send_timeout 120;
        proxy_read_timeout 120;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/feishu-ai /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

echo "✅ 部署完成！"
echo "Webhook URL: https://your-domain.com/ai-proxy/feishu/webhook"
```

---

### Step 6: 配置 AI 提示词（适配第三方模型）

由于使用了第三方中转站，我们需要对提示词进行一些优化：

#### 6.1 通用型提示词模板（适配大多数模型）

```markdown
# 角色设定
你是一个专业的 CRM 销售数据分析助手，专注于银行、电信、保险行业的客户关系管理。

# 任务范围
1. 客户信息查询（姓名、电话、状态等）
2. 商机趋势分析（成交率、行业分布、金额预测）
3. 跟进提醒服务（即将到期任务）
4. 工作报告生成（日报、周报、月度总结）
5. 赢单策略建议（基于历史案例）

# 回答规则

## 数据查询类问题
- 格式：简洁文字 + 结构化表格
- 示例：
  用户："查找 XX 银行的联系人"
  回答：
  ```
  📞 XX 银行 - 张经理
  
  | 姓名   | 职位 | 联系电话   | 邮箱                  |
  |--------|------|-----------|---------------------|
  | 张经理 | 经理 | 138xxxx | zhang@xxbank.com    |
  
  💡 当前商机：金额 50 万元，预计成交时间 2026-08-15
  ```

## 趋势分析问题
- 格式：结论先行 → 数据支撑 → 原因分析 → 改进建议
- 示例：
  用户："分析本月未成交原因"
  回答：
  ```
  📊 本月未成交客户分析
  
  ## 主要发现
  - 样本数：15 家
  - 主要原因：价格因素占 60%，竞品影响占 30%
  
  ## 建议
  1. 针对价格敏感客户推出阶梯报价
  2. 整理竞品对比资料包
  ```

## 日常汇报类问题
- 格式：分模块结构化输出
- 示例：
  用户："我的日报"
  回答：
  ```
  📝 今日工作总结
  
  ## ✅ 今日成果
  - 完成 3 次客户拜访
  - 新增商机 2 个，金额合计 85 万
  
  ## ⚡ 进行中
  - XX 银行（谈判中，待合同审批）
  - 中国电信（方案演示阶段）
  
  ## 🎯 明日计划
  1. 上午：拜访 YY 保险公司
  2. 下午：准备 AA 证券方案材料
  ```

# 注意事项
- 保持专业友好的语气
- 避免过度使用 emoji（每条消息不超过 5 个）
- 对于不确定的数据要明确标注"暂无数据"
- 复杂分析要分步骤解释
```

---

### Step 7: 测试与验证

#### 7.1 基础功能测试

```bash
# 1. 测试飞书 Webhook 连通性
curl -X POST https://your-domain.com/ai-proxy/feishu/webhook \
  -H "Content-Type: application/json" \
  -d '{"content": {"text": "测试消息"}}'

# 预期结果：应收到 AI 响应
```

#### 7.2 飞书内测试清单

| 测试项 | 操作方式 | 预期结果 |
|--------|---------|---------|
| 基础问答 | 在对话框输入"你好" | AI 正常回复 |
| 客户查询 | "查找 XX 公司的联系人" | 返回正确信息 |
| 数据分析 | "本周有哪些客户需要跟进？" | 列出待跟进列表 |
| 日报生成 | "我的日报" | 生成完整报告 |
| 语音转文字 | 长按麦克风说话 | AI 识别并响应 |

---

## 🔒 安全加固措施

### 必备安全措施

#### 1. 身份验证

```python
# auth.py - 添加身份验证中间件
from functools import wraps
from flask import request, jsonify
import hmac
import hashlib

def require_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        signature = request.headers.get('X-Custom-Signature', '')
        
        # 计算期望签名
        raw_data = request.get_data(as_text=True)
        expected_signature = hmac.new(
            SECRET_KEY.encode(),
            raw_data.encode(),
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(signature, expected_signature):
            return jsonify({"error": "Unauthorized"}), 401
        
        return f(*args, **kwargs)
    
    return decorated_function
```

#### 2. 限流保护

```python
# rate_limiter.py
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["100 per hour"]
)

@app.route('/feishu/webhook', methods=['POST'])
@limiter.limit("30 per minute")
def handle_feishu_webhook():
    # ... existing code
```

#### 3. 环境变量隔离

```bash
# .env - 敏感信息集中管理
MIDDLEWARE_API_KEY=your_secret_api_key_here
SECRET_KEY=random_secure_key_12345
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
DATABASE_URL=sqlite:///crm.db
FLASK_ENV=production
```

---

## 💰 成本对比分析

### 飞书自带 vs 第三方中转站

| 项目 | 飞书自带 AI | 第三方中转站（示例） | 差异 |
|------|-----------|------------------|------|
| **免费额度** | 每日 100 次 | 每月数千次/不限 | 显著提升 |
| **单次调用成本** | ¥0.05~0.1 | ¥0.01~0.03 | 降低 50-70% |
| **超出费用** | ¥0.2/次 | 套餐制更便宜 | 大额更划算 |
| **模型灵活性** | ❌ 固定 | ✅ 可选多种 | 性能优化空间大 |
| **定制能力** | ❌ 无法定制 | ✅ 可微调 Prompt | 效果更佳 |
| **数据隐私** | 云端处理 | ✅ 可控/可本地化 | 安全性更好 |

**建议：** 如果你的日均调用超过 200 次，强烈建议使用第三方中转站。

---

## 🔄 模型切换指南

### 如何平滑切换不同的 AI 模型

#### 1. 配置文件驱动

```json
// config/models.json
{
  "current": "gpt-4-turbo",
  "available": [
    {
      "id": "gpt-4-turbo",
      "name": "GPT-4 Turbo",
      "cost_per_1k_tokens": 0.01,
      "speed": "fast",
      "quality": "excellent"
    },
    {
      "id": "claude-3-opus",
      "name": "Claude 3 Opus",
      "cost_per_1k_tokens": 0.015,
      "speed": "medium",
      "quality": "best"
    },
    {
      "id": "qwen-max",
      "name": "通义千问 Max",
      "cost_per_1k_tokens": 0.008,
      "speed": "fast",
      "quality": "good"
    }
  ]
}
```

#### 2. 自动熔断机制

```python
# circuit_breaker.py
class CircuitBreaker:
    def __init__(self, failure_threshold=5, recovery_time=300):
        self.failure_count = 0
        self.threshold = failure_threshold
        self.last_failure_time = None
        self.recovery_time = recovery_time
        self.state = "closed"  # closed, open, half-open
    
    def can_execute(self):
        if self.state == "open":
            if time.time() - self.last_failure_time > self.recovery_time:
                self.state = "half-open"
                return True
            return False
        return True
    
    def record_success(self):
        self.failure_count = 0
        self.state = "closed"
    
    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.threshold:
            self.state = "open"

# 使用示例
circuit_breakers = {
    "gpt-4-turbo": CircuitBreaker(),
    "claude-3-opus": CircuitBreaker(),
}

def call_model_with_fallback(messages, preferred_model="gpt-4-turbo"):
    for model in [preferred_model, *alternatives]:
        if circuit_breakers[model].can_execute():
            try:
                result = call_ai_model(model, messages)
                circuit_breakers[model].record_success()
                return result
            except Exception as e:
                circuit_breakers[model].record_failure()
                continue
    raise Exception("All models failed")
```

---

## 📋 快速迁移 Checklist

### 迁移前准备

- [ ] 确认第三方中转站可用性
- [ ] 准备好 API Key 和端点地址
- [ ] 确认模型配额充足
- [ ] 备份现有 AI 配置

### 迁移实施

- [ ] 部署代理服务器（Step 3）
- [ ] 配置飞书应用权限（Step 2）
- [ ] 更新 Webhook 地址（Step 4）
- [ ] 调整 AI 提示词适配新模型（Step 6）

### 迁移后验证

- [ ] 测试基础问答功能
- [ ] 验证数据查询准确性
- [ ] 检查响应速度（延迟 < 5 秒）
- [ ] 监控错误率和成功率

### 监控告警

- [ ] 设置 API 调用量监控
- [ ] 配置异常响应告警
- [ ] 定期生成成本报告

---

## 🆘 常见问题 FAQ

**Q1: 如何选择合适的第三方中转站？**  
A: 优先选择符合以下条件的服务商：
- ✅ 支持多种主流模型（GPT/Claude/Qwen 等）
- ✅ 价格透明，无隐藏费用
- ✅ 提供完善的 API 文档
- ✅ 良好的技术支持和社区口碑

**Q2: 迁移过程中会影响正常使用吗？**  
A: 如果采用双轨运行（新旧系统并行），可以保证无缝切换。建议先在小范围测试。

**Q3: 成本会增加吗？**  
A: 取决于你的使用量和选择的模型。一般来说，第三方中转站在大规模使用时反而更省钱（因为可以选择性价比更高的模型）。

**Q4: 数据安全有保障吗？**  
A: 可以通过以下方式确保：
- 使用 HTTPS 加密传输
- 添加身份验证和限流
- 选择可信的服务商或自建私有化部署

---

## 🚀 下一步行动

1. **评估中转站选项** - 根据你的需求和技术栈选择合适的方案
2. **部署代理服务器** - 按照上述步骤配置
3. **测试验证** - 确保功能正常后再全面上线
4. **持续优化** - 根据实际使用情况调整模型和配置

有任何问题随时问我！祝你迁移顺利！🎉