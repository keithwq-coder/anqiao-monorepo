# 测试你的第三方 AI 中转站

## 🚀 快速测试脚本（3 分钟搞定）

### 方式 1: Python 直接调用（推荐）

```python
# test_ai_middleware.py - 测试第三方 AI 中转站

import requests
import json
import time
from datetime import datetime

# =====================配置区域=====================

# 【必填】替换为你的中转站信息
MIDDLEWARE_CONFIG = {
    "endpoint": "http://your-middleware-domain.com/api/v1/chat/completions",
    "api_key": "your_api_key_here",
    "test_model": "gpt-4-turbo",  # 或 "claude-3"、"qwen-max"等
}

# ================================================

def test_basic_connection():
    """测试 1: 基础连接"""
    print(f"[{datetime.now()}] 测试 1: 基础连接...")
    
    try:
        response = requests.get(MIDDLEWARE_CONFIG["endpoint"].replace("/chat/completions", "/health"), timeout=5)
        if response.status_code == 200:
            print("✅ 中转站连接正常\n")
            return True
        else:
            print(f"❌ 连接失败：HTTP {response.status_code}\n")
            return False
    except Exception as e:
        print(f"❌ 连接错误：{e}\n")
        return False

def test_chat_completion(test_message):
    """测试 2: 实际对话功能"""
    print(f"[{datetime.now()}] 测试 2: 对话功能测试...")
    print(f"📝 测试消息：{test_message}\n")
    
    start_time = time.time()
    
    payload = {
        "model": MIDDLEWARE_CONFIG["test_model"],
        "messages": [
            {
                "role": "system",
                "content": "你是一个专业的销售数据分析师，请简短回答用户问题。"
            },
            {
                "role": "user",
                "content": test_message
            }
        ],
        "temperature": 0.7,
        "max_tokens": 500
    }
    
    headers = {
        "Authorization": f"Bearer {MIDDLEWARE_CONFIG['api_key']}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(
            MIDDLEWARE_CONFIG["endpoint"],
            headers=headers,
            json=payload,
            timeout=30
        )
        
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            result = response.json()
            content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            print(f"⏱️  响应时间：{elapsed:.2f}秒")
            print(f"\n💬 AI 回复:")
            print("-" * 60)
            print(content[:500] + "..." if len(content) > 500 else content)
            print("-" * 60)
            print("✅ 测试通过!\n")
            return True
            
        else:
            print(f"❌ 请求失败：HTTP {response.status_code}")
            print(f"错误信息：{response.text}")
            print()
            return False
    
    except Exception as e:
        print(f"❌ 错误：{e}\n")
        return False

def run_performance_test():
    """测试 3: 性能测试（多次调用）"""
    print(f"[{datetime.now()}] 测试 3: 性能测试...\n")
    
    messages = [
        "你好",
        "分析本季度销售业绩",
        "查找银行客户的跟进记录",
        "生成日报总结",
        "赢单策略建议"
    ]
    
    latencies = []
    
    for i, msg in enumerate(messages, 1):
        print(f"{i}/{len(messages)}: 发送测试消息...")
        
        payload = {
            "model": MIDDLEWARE_CONFIG["test_model"],
            "messages": [{"role": "user", "content": msg}],
            "temperature": 0.7
        }
        
        headers = {
            "Authorization": f"Bearer {MIDDLEWARE_CONFIG['api_key']}",
            "Content-Type": "application/json"
        }
        
        start = time.time()
        try:
            response = requests.post(
                MIDDLEWARE_CONFIG["endpoint"],
                headers=headers,
                json=payload,
                timeout=30
            )
            elapsed = time.time() - start
            latencies.append(elapsed)
            
            if response.status_code == 200:
                print(f"   ✅ 成功！耗时：{elapsed:.2f}秒\n")
            else:
                print(f"   ❌ 失败：HTTP {response.status_code}\n")
                
        except Exception as e:
            print(f"   ❌ 异常：{e}\n")
    
    if latencies:
        avg_latency = sum(latencies) / len(latencies)
        max_latency = max(latencies)
        min_latency = min(latencies)
        
        print("📊 性能统计:")
        print(f"   平均响应时间：{avg_latency:.2f}秒")
        print(f"   最慢响应：{max_latency:.2f}秒")
        print(f"   最快响应：{min_latency:.2f}秒")
        print()

def test_crm_specific_prompts():
    """测试 4: CRM 特定场景"""
    print(f"[{datetime.now()}] 测试 4: CRM 业务场景测试...\n")
    
    prompts = [
        "本周有哪些客户需要跟进？",
        "Top10 销售额是哪个行业贡献的？",
        "我的日报怎么写？",
        "XX 公司的赢单策略是什么？"
    ]
    
    for i, prompt in enumerate(prompts, 1):
        print(f"{i}. 问题：{prompt}")
        
        payload = {
            "model": MIDDLEWARE_CONFIG["test_model"],
            "messages": [
                {"role": "system", "content": "你是一名专业的 CRM 数据分析助手"},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7
        }
        
        headers = {
            "Authorization": f"Bearer {MIDDLEWARE_CONFIG['api_key']}",
            "Content-Type": "application/json"
        }
        
        try:
            response = requests.post(
                MIDDLEWARE_CONFIG["endpoint"],
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                content = response.json()["choices"][0]["message"]["content"]
                print(f"   ✅ 回答正常")
                # 打印前 100 字预览
                preview = content[:100].replace("\n", " ")
                print(f"      预览：{preview}...")
            else:
                print(f"   ❌ 失败：HTTP {response.status_code}")
            
            print()
            
        except Exception as e:
            print(f"   ❌ 异常：{e}\n")

def main():
    """主函数"""
    print("=" * 60)
    print("🧪 第三方 AI 中转站测试工具")
    print("=" * 60)
    print()
    
    # 检查配置
    if MIDDLEWARE_CONFIG["endpoint"] == "http://your-middleware-domain.com/api/v1/chat/completions":
        print("⚠️  警告：请先修改配置中的 endpoint 和 api_key!")
        print()
        print("当前配置:")
        print(f"   Endpoint: {MIDDLEWARE_CONFIG['endpoint']}")
        print(f"   Model: {MIDDLEWARE_CONFIG['test_model']}")
        print()
        print("请按以下步骤操作:")
        print("1. 打开这个文件")
        print("2. 找到第 10-15 行的配置区域")
        print("3. 替换为你的真实中转站地址和 API Key")
        print("4. 保存后重新运行此脚本")
        print()
        input("按回车键继续测试（如果已配置）...")
        print()
    
    # 开始测试
    print("=" * 60)
    print("开始测试...\n")
    
    # 测试 1: 基础连接
    if not test_basic_connection():
        print("❌ 基本连接测试失败，后续测试将跳过")
        return
    
    # 测试 2: 对话功能
    test_chat_completion("你好，我是中科安樵的销售助理，请简单介绍一下自己。")
    
    # 测试 3: 性能测试（可选，取消注释启用）
    # run_performance_test()
    
    # 测试 4: CRM 场景
    test_crm_specific_prompts()
    
    print("=" * 60)
    print("✅ 所有测试完成!")
    print("=" * 60)

if __name__ == "__main__":
    main()
```

---

## 📝 使用方法

### Step 1: 准备配置

1. **打开脚本** - 找到 `MIDDLEWARE_CONFIG` 配置区域
2. **替换信息** - 填入你的中转站地址和 API Key

示例：
```python
MIDDLEWARE_CONFIG = {
    "endpoint": "https://api.your-company.com/v1/chat/completions",
    "api_key": "sk-your-secret-key-123456",
    "test_model": "gpt-4-turbo",
}
```

---

### Step 2: 运行测试

```bash
# 安装依赖
pip install requests

# 运行测试脚本
python test_ai_middleware.py
```

---

### Step 3: 查看结果

脚本会自动执行以下测试并输出结果：

✅ **基础连接** - 确认中转站可访问  
✅ **对话功能** - 测试实际问答能力  
✅ **性能指标** - 响应时间统计  
✅ **CRM 场景** - 验证业务适配性  

---

## 🔧 常见问题排查

### 问题 1: "Connection refused" 或超时

**原因：** 网络连接问题  
**解决方案：**
```bash
# 测试网络连通性
ping your-middleware-domain.com

# 检查端口是否开放
telnet your-middleware-domain.com 443

# 如果是本地测试，确保服务已启动
python server.py  # 启动你的中转站服务
```

---

### 问题 2: "Invalid API Key" 错误

**原因：** API Key 无效或过期  
**解决方案：**
```python
# 重新获取 API Key
# 在你的中转站管理后台找到 API Keys -> Generate New Key

# 或者测试旧 Key 是否仍然有效
curl -X POST https://your-domain.com/health \
  -H "Authorization: Bearer your_old_key"
```

---

### 问题 3: 响应速度慢（>10 秒）

**原因：** 模型复杂度高或服务器负载大  
**解决方案：**
```python
# 方案 1: 切换到更快的模型
MIDDLEWARE_CONFIG["test_model"] = "gpt-4-turbo-preview"  # 比完整版快

# 方案 2: 减少 token 数量
payload["max_tokens"] = 256  # 从 500 降低到 256

# 方案 3: 使用缓存机制（如果频繁问相同问题）
```

---

### 问题 4: 部分测试失败但其他通过

**原因：** 特定场景适配问题  
**解决方案：**
```markdown
1. 查看具体的错误信息
2. 调整提示词（prompt）格式
3. 增加必要的上下文信息
4. 联系中转站技术支持
```

---

## 🎯 下一步行动

### 如果测试全部通过 ✅

恭喜你！可以开始正式集成到你的飞书 CRM 系统：

1. **部署代理服务器** - 按照 `飞书_CRM_AI_第三方集成.md` 的 Step 3-5
2. **配置飞书机器人** - 注册自建应用并设置 Webhook
3. **迁移现有 AI 配置** - 替换掉飞书自带的 AI 调用逻辑
4. **全面测试** - 在飞书内验证各项功能

---

### 如果遇到失败 ❌

请先解决以下问题：

1. **检查中转站状态** - 确认服务正常运行
2. **验证 API Key** - 确保密钥有效且权限正确
3. **查看日志** - 中转站服务端应该有详细的错误日志
4. **简化测试** - 先用最简单的"你好"消息测试，逐步增加复杂度

---

## 💡 优化建议

### 提升响应速度

```python
# 添加响应缓存（针对相同问题）
from functools import lru_cache

@lru_cache(maxsize=128)
def get_ai_response_cached(question_hash):
    # 调用 AI 的逻辑
    pass

# 批量处理
# 对于相似的问题合并处理
```

### 降低成本

```python
# 优先使用便宜的模型
MIDDLEWARE_CONFIG = {
    "primary_model": "qwen-max",  # 便宜
    "fallback_model": "gpt-4-turbo",  # 高质量
    "cost_optimized": True
}

# 动态选择模型（根据问题类型）
def smart_model_selector(question):
    if "简单" in question or "你好" in question:
        return "cheap-model"
    else:
        return "premium-model"
```

---

## 📞 技术支持

如果你在测试过程中遇到任何问题：

1. **检查中间站文档** - 大多数服务商都有详细的 API 说明
2. **查看错误日志** - 找出具体失败原因
3. **对比示例代码** - 参考官方提供的 SDK 示例
4. **联系服务商支持** - 提交工单或咨询客服

祝你测试顺利！🚀