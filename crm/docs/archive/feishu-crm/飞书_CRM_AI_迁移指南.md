# 飞书 CRM - AI 智能体快速迁移指南（第三方中转站版）

## 🎯 核心优势对比

| 特性 | 飞书自带 AI | **你的第三方中转站** ✅ |
|------|-----------|---------------------|
| **调用额度** | 每日 100 次限制 | ✅ **无限/按需分配** |
| **模型选择** | ❌ 仅飞书模型 | ✅ **GPT、Claude、通义千问等任意模型** |
| **成本控制** | ⚠️ 超额需付费 | ✅ **可按需切换性价比更高的模型** |
| **数据隐私** | ⚠️ 云端处理 | ✅ **完全可控/可私有化部署** |
| **定制能力** | ❌ 无法自定义 | ✅ **完全自由定制 Prompt 和业务逻辑** |
| **多模型测试** | ❌ 不支持 | ✅ **A/B 测试最优模型** |

---

## 📋 完整实施步骤

### Step 1: 验证你的中转站（5 分钟）

#### 1.1 运行测试脚本

```bash
cd d:\Project\中科安樵
python test_ai_middleware.py
```

如果提示"请先修改配置"，请按以下步骤操作：

#### 1.2 配置中转站信息

打开 `test_ai_middleware.py`，找到第 8-13 行，替换为你的真实配置：

```python
MIDDLEWARE_CONFIG = {
    "endpoint": "https://your-middleware-domain.com/api/v1/chat/completions",
    "api_key": "sk-your-secret-key-here",
    "test_model": "gpt-4-turbo",  # 或 "claude-3"、"qwen-max"等
}
```

**常见中转站示例：**

| 服务商 | endpoint 示例 | 备注 |
|--------|-------------|------|
| Moonshot API | `https://api.moonshot.cn/v1/chat/completions` | 国产，支持多种模型 |
| DeepInfra | `https://api.deepinfra.com/v1/openai/chat/completions` | 价格极低 |
| Together AI | `https://api.together.ai/v1/chat/completions` | 开源模型丰富 |
| 自建 Ollama | `http://localhost:11434/api/generate` | 本地部署 |

重新运行测试脚本，确保一切正常后再继续。

---

### Step 2: 部署 AI 代理服务器（15 分钟）

#### 2.1 创建 Flask 代理服务

参考以下简化版代码（根据实际中转站调整）：

```python
# ai_proxy.py
from flask import Flask, request, jsonify
import requests
import os

app = Flask(__name__)

# 从中转站配置读取
AI_ENDPOINT = os.getenv("AI_ENDPOINT", "https://your-middleware-domain.com/api/v1/chat/completions")
AI_API_KEY = os.getenv("AI_API_KEY", "sk-your-key")

@app.route('/feishu/webhook', methods=['POST'])
def handle_feishu_webhook():
    try:
        data = request.json
        user_message = data.get("content", {}).get("text", "")
        
        # 构建对话上下文
        messages = [
            {"role": "system", "content": get_system_prompt()},
            {"role": "user", "content": user_message}
        ]
        
        # 调用你的中转站
        response = call_ai_backend(messages)
        
        return jsonify({
            "code": 0,
            "msg": "success",
            "data": {"content": format_response(response)}
        })
    
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

def get_system_prompt():
    return """你是一名专业的 CRM 销售数据分析助手，专注于银行、电信、保险行业。
请简短回答用户问题，格式清晰，不超过 300 字。"""

def call_ai_backend(messages):
    headers = {
        "Authorization": f"Bearer {AI_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "gpt-4-turbo",
        "messages": messages,
        "temperature": 0.7
    }
    
    response = requests.post(AI_ENDPOINT, headers=headers, json=payload, timeout=30)
    return response.json()

def format_response(ai_data):
    content = ai_data.get("choices", [{}])[0].get("message", {}).get("content", "")
    return content[:500]  # 截断过长回复

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

#### 2.2 保存并安装依赖

```bash
# 创建项目目录
mkdir ai-proxy
cd ai-proxy

# 保存 ai_proxy.py 到该目录
touch ai_proxy.py

# 安装依赖
pip install flask requests flask-cors

# 测试运行
python ai_proxy.py
```

看到"Flask running on http://0.0.0.0:5000"即成功。

---

### Step 3: 暴露本地服务到公网（可选但推荐）

如果你想在飞书中使用，需要让飞书能够访问到你的代理服务器：

#### 方式 A: ngrok 快速 tunnel（适合测试）

```bash
# 安装 ngrok
npm install -g ngrok

# 启动 tunnel（将 5000 端口暴露到公网）
ngrok http 5000

# 复制生成的 URL（如 https://abc123.ngrok.io），后续配置 webhook 用
```

#### 方式 B: 云服务器部署（正式环境）

如果你有云服务器：

```bash
# SSH 登录到你的服务器
ssh user@your-server-ip

# 上传 ai_proxy.py
scp ai_proxy.py user@your-server-ip:/opt/

# 在服务器上运行
ssh user@your-server-ip
cd /opt
nohup python ai_proxy.py > server.log 2>&1 &

# 查看运行状态
tail -f server.log
```

---

### Step 4: 配置飞书自建应用

#### 4.1 创建应用

1. 访问：https://open.feishu.cn/app
2. 点击"创建应用" → "自定义应用"
3. 填写信息并提交

#### 4.2 设置 Webhook 接收端

```markdown
1. 进入应用详情 → 「开发设置」→ 「事件与授权」
2. 点击「事件订阅」→ 添加事件
   ✓ IM 消息已读
   ✓ 聊天消息及回复
3. 配置接收消息的 URL:
   
   🔗 URL: https://your-ngrok-url.ngrok.io/feishu/webhook
   🔒 安全模式：签名验证（可选）
4. 保存后，飞书会发送验证请求

注意：如果是 ngrok 临时 URL，建议先固定会话再配置
```

#### 4.3 获取 AppID 和 AppSecret

在应用详情页底部可以找到：
```
APP_ID: cli_xxxxxxxxxxxxxx
APP_SECRET: xxxxxxxxxxxxxxxxxxxxxx
```

将这些值保存到环境变量：

```bash
export FEISHU_APP_ID="cli_xxx"
export FEISHU_APP_SECRET="xxx"
```

---

### Step 5: 集成到飞书机器人

#### 5.1 创建机器人

```markdown
1. 飞书 PC 端 → 工作台 → 搜索"机器人"
2. 点击"+ 添加机器人" → 自定义机器人
3. 按引导完成配置：
   - 名称：中科安樵 AI 助手
   - 描述：基于第三方 AI 模型的智能分析助手
   - 头像：选择商务风格图标
```

#### 5.2 添加 Webhook 关键字

```markdown
在机器人设置中配置"快捷指令"：

- 快捷名称：你好
- 触发关键字：hello、嗨、开始
- 响应内容：{{webhook_url}}

或者直接在全局范围内启用机器人即可
```

---

### Step 6: 测试与优化

#### 基础测试清单

在飞书中与机器人对话，验证以下内容：

| 测试项 | 操作 | 预期结果 |
|--------|------|---------|
| 基础问候 | 输入"你好" | AI 正常回复 |
| 客户查询 | "查找 XX 公司的联系人" | 返回结构化信息 |
| 数据分析 | "本周有哪些客户要跟进？" | 列出待跟进列表 |
| 日报生成 | "我的日报" | 自动生成工作总结 |
| 语音转文字 | 长按麦克风说话 | AI 识别并响应 |

#### 性能监控

如果响应速度慢（>5 秒），可以尝试：

```python
# 方案 1: 切换到更快的模型
"MIDDLEWARE_CONFIG["test_model"]" = "gpt-3.5-turbo"

# 方案 2: 减少 token 数量
"max_tokens": 256  # 从 500 降低

# 方案 3: 使用缓存机制
from functools import lru_cache

@lru_cache(maxsize=100)
def get_cached_ai_response(question_hash):
    # 调用逻辑...
```

---

## 💰 成本优化建议

### 动态模型选择策略

根据你的需求"支持变更"，可以设计灵活的模型切换：

```python
# config/models.json
{
  "default": "gpt-4-turbo",
  "fallbacks": ["claude-3-opus", "qwen-max"],
  "cheapest": "gpt-3.5-turbo",
  "smart_routing": {
    "简单问题": "cheapest",      # 节省成本
    "复杂分析": "default",       # 保证质量
    "特殊场景": "fallback[0]"   # 兜底方案
  }
}
```

### 成本控制技巧

1. **优先级路由** - 简单问答用便宜模型，深度分析用高质量模型
2. **批量处理** - 相似问题合并一次调用
3. **缓存命中率** - 对常见问题建立本地缓存
4. **限额保护** - 设置每日最大调用次数防止误用

---

## 🔄 无缝迁移 Checklist

### 迁移前准备（30 分钟）

- [ ] 确认你的中转站 API 正常工作（运行 test_ai_middleware.py）
- [ ] 准备好 AppID 和 API Key
- [ ] 确定目标模型（GPT/Claude/Qwen 等）
- [ ] 备份现有飞书 AI 配置（如有）

### 实施阶段（1 小时）

- [ ] 创建飞书自建应用
- [ ] 部署 AI 代理服务器
- [ ] 配置 Webhook 接收端
- [ ] 设置飞书机器人权限
- [ ] 测试基础功能

### 验证阶段（15 分钟）

- [ ] 在飞书内测试基本问答
- [ ] 验证数据查询准确性
- [ ] 检查响应速度（延迟 < 5 秒理想）
- [ ] 确认无错误日志

### 正式上线

- [ ] 通知团队成员新系统上线
- [ ] 观察首日使用情况
- [ ] 收集反馈并调优

---

## 📞 常见问题 FAQ

**Q1: 我的中转站已经准备好了，可以直接开始吗？**  
A: 是的！只需按照 Step 2-5 的顺序部署代理服务器并配置飞书机器人即可。

**Q2: 迁移过程中会影响正常使用吗？**  
A: 不会。建议先在测试账号上验证，确认无误后再切换到正式环境。

**Q3: 切换后成本会增加吗？**  
A: 取决于你的使用量和选择的模型。一般来说，使用第三方中转站反而更省钱（因为可以选择性价比更高的模型）。

**Q4: 如何回退到飞书自带 AI？**  
A: 非常简单——停止 AI 代理服务器，取消相关 Webhook 配置即可恢复原状。

**Q5: 支持同时使用多个模型吗？**  
A: 完全支持！可以按照上述代码实现动态路由，根据问题类型自动选择最优模型。

---

## 🚀 下一步行动

### 立即开始

```bash
# Step 1: 测试你的中转站
cd d:\Project\中科安樵
python test_ai_middleware.py

# Step 2: 部署代理服务（复制下方命令）
echo "正在准备 Flask 代理服务..."
# 创建 ai_proxy.py 文件（参考上方代码）
# pip install flask requests
# python ai_proxy.py
```

### 需要帮助？

如果在任何步骤遇到问题：

1. **检查中转站状态** - 确保服务正常运行
2. **查看详细日志** - 找出具体失败原因
3. **参考官方文档** - 对照 API 文档排查
4. **随时问我** - 我会协助解决具体问题

---

**祝你迁移顺利！** 🎉

**预计总耗时：** 1-2 小时  
**风险等级：** 低（可随时回退）  
**预期收益：** 无限调用额度 + 更多模型选择 + 更高灵活性
