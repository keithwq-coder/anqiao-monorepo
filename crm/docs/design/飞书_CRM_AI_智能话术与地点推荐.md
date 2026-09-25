# 飞书 CRM - AI 商机扫描与智能话术配置方案

## 🎯 AI 三大核心能力

根据你的需求，AI 需要具备：

### 1️⃣ 智能地点发现（地理围栏）

```
场景：你在 A 区拜访客户 → AI 扫描 B 区的客户列表
→ 发现 B 区有 5 个客户最近有新动向
→ 虽然这些客户属于其他同事
→ 但因为你正好路过该区域 → 自动推送提醒："是否需要去拜访？"
→ 销售可以发起协商请求："我想顺便拜访 XX 客户的客户李四，他最近有新动向"
```

### 2️⃣ 智能话术生成（个性化推荐）

```
场景：销售张三要联系 B 级客户"XX 科技公司"
AI 分析：
├─ 客户等级：B 级（短期不采购）
├─ 最后跟进：7 天前
├─ 互联网信号：获得 C 轮融资 1000 万
└─ 历史偏好：喜欢简洁直接的风格

生成话术：
📞 电话开场白：
"王总您好，我是中科安樵的张三。恭喜贵公司刚刚完成 C 轮融资，
我们这边刚好看到新闻，不知道有没有机会聊聊新的 IT 设备采购计划？"

💬 微信消息模板：
【祝贺】王总好，刚看到贵公司融资成功的消息，恭喜！🎉
我是中科安樵的小张，如果您那边有网络建设的新需求，随时找我~

📧 邮件主题：
"贺喜 XX 科技获 1000 万融资 | 中科安樵可提供边缘计算解决方案"
```

### 3️⃣ 跨销售协作机制

```
场景：销售 A 发现了属于销售 B 的客户的新商机
→ AI 先判断：这个客户是否正在活跃跟进中？
   ├─ 是 → 提醒 A："客户 B 已在跟进，建议先与 B 沟通"
   └─ 否 → 提醒 A："客户 B 已有新信号，你可以尝试接手或合作"
   
协商流程：
销售 A 发起请求 → 销售 B 收到通知 → 
选择：接受合作 / 拒绝 / 转交
→ 确认后双方都收到确认消息
```

---

## 🔧 技术实现方案

### Step 1: 在多维表格中添加位置字段

```markdown
打开"客户信息表" → 新建字段

字段名称："客户地址"
类型：文本或地址（支持地图定位）
必填：可选
```

### Step 2: 配置 AI 地点扫描器

```python
# ai_location_scanner.py
# AI 智能地点扫描器（每日执行）

import os
import json
from datetime import datetime, timedelta
import requests
from geopy.distance import great_circle
from geopy.geocoders import Nominatim

# 【配置区域】
API_CONFIG = {
    "feishu_webhook": "https://open.feishu.cn/open-apis/bot/v2/hook/xxx",
    "ai_middleware_endpoint": "https://your-middleware.com/api/v1/chat/completions",
    "api_key": "sk-your-key",
}

# 【核心逻辑】扫描所有客户，发现可能值得拜访的线索
def scan_all_customers_for_opportunities():
    """
    扫描全量客户数据库，包括：
    1. 本销售负责的客户中有新动向
    2. 他人负责但地理位置接近且有新动向
    3. 未分配的销售线索
    """
    
    # 1. 从飞书多维表格获取所有客户数据
    all_customers = get_all_customers_from_base()
    
    # 2. 按区域分组
    customers_by_region = group_by_region(all_customers)
    
    # 3. 对每个区域的客户进行深度扫描
    for region, customers in customers_by_region.items():
        print(f"\n扫描区域：{region}")
        
        # 4. 调用 AI 扫描该区域的互联网公开信息
        opportunities = scan_region_internet_signals(region, customers)
        
        # 5. 分析并推送
        for opp in opportunities:
            notify_sales_team(opp)

def scan_region_internet_signals(region, customers):
    """
    扫描某个区域的客户是否有新动向
    
    方法：
    - 批量搜索区域内企业的工商信息变更
    - 招标公告更新
    - 招聘活动（扩招意味着扩张）
    - 新闻舆情
    """
    
    prompt = f"""请在以下客户列表中，找出最近 30 天内有以下迹象的公司：
1. 注册资本变化（增资 > 10%）
2. 新增分支机构
3. 发布招标公告
4. 招聘规模扩大（同一岗位招聘≥3 人）
5. 获得融资/投资
6. 产品/业务线扩张

客户列表（区域：{region}）:
{json.dumps([{'name': c['客户名称'], 'contact': c['联系人']} for c in customers], ensure_ascii=False, indent=2)}

返回格式：JSON 数组，每个元素包含：
{{
  "customer_id": "客户 ID",
  "customer_name": "客户名称",
  "owner": "当前负责人",
  "signals": ["信号 1", "信号 2"],
  "confidence_score": 0-1 之间的分数,
  "source_url": "信息来源 URL"
}}
"""
    
    response = call_ai_backend(prompt)
    return parse_json_response(response)

def calculate_route_efficiency(my_clients, nearby_clients, my_current_location):
    """
    计算拜访效率评分
    
    逻辑：
    1. 如果我已经有 A 计划要去拜访某客户
    2. 顺便拜访附近的其他销售客户是否能形成顺路路线
    3. 时间成本 vs 潜在收益比
    """
    
    from route_optimizer import RouteOptimizer
    
    optimizer = RouteOptimizer(my_current_location)
    
    # 添加我的必访客户
    essential_stops = [c['地址'] for c in my_clients if c['需要今天拜访']]
    
    # 添加候选的顺便拜访客户
    candidate_stops = [c['地址'] for c in nearby_clients]
    
    # 计算最优路线
    result = optimizer.find_optimal_route(
        start=my_current_location,
        must_visit=essential_stops,
        optional=candidate_stops
    )
    
    efficiency_score = result['score']  # 效率评分（0-100）
    time_saving = result['time_saved']   # 节省的时间（分钟）
    
    return {
        'efficiency_score': efficiency_score,
        'time_saving': time_saving,
        'suggested_order': result['route']
    }

def generate_smart_script(customer, signals, confidence_score):
    """
    生成智能话术
    
    根据：
    - 客户等级（A/B/C 级）
    - 最新信号（融资/招标/扩招等）
    - 历史沟通风格偏好
    - 上次跟进时间和方式
    
    生成针对性的开场白
    """
    
    prompt = f"""你是一名专业的销售顾问，请为客户"XXX"生成合适的沟通话术。

【客户背景】
- 客户名称：{customer['客户名称']}
- 联系人：{customer['联系人']}
- 客户等级：{customer['客户等级']} 级
- 预计成交周期：{customer.get('成交周期', '未知')}
- 上次跟进：{customer['last_followup_date']} 天前

【新发现的信号】
{chr(10).join(signals)}

【历史沟通偏好】
- 喜欢电话沟通还是微信：{customer.get('preferred_channel', '电话')}
- 沟通风格：{customer.get('style_preference', '正式')}.

【要求】
1. 生成 3 个版本的开场白：
   - 版本 1：简短直接型（适合 B 级/C 级客户）
   - 版本 2：详细专业型（适合 A 级客户）
   - 版本 3：轻松友好型（适合老客户回访）
   
2. 每个版本控制在 50 字以内
   
3. 融入新信号作为切入点
   
4. 提供跟进建议和下一步行动

返回 JSON 格式：
{{
  "scripts": {{
    "short_formal": "简短正式版...",
    "detailed_professional": "详细专业版...",
    "friendly_casual": "轻松友好版..."
  }},
  "followup_suggestion": "建议的跟进策略...",
  "next_steps": ["步骤 1", "步骤 2", "步骤 3"]
}}
"""
    
    response = call_ai_backend(prompt)
    return json.loads(response)

def notify_sales_and_cooperate(customer, script_info, is_colleague_customer):
    """
    向销售发送通知
    
    如果是自己的客户：直接推送话术建议
    如果是同事的客户：发起协作请求，等待协商结果
    """
    
    if not is_colleague_customer:
        # 自己的客户
        message = generate_personal_notification(customer, script_info)
    else:
        # 同事的客户 - 需要协商
        message = generate_cooperation_request(customer, script_info)
    
    send_feishu_notification(message)

def generate_personal_notification(customer, script_info):
    """个人客户的通知模板"""
    
    customer_name = customer['客户名称']
    contact = customer['联系人']
    scripts = script_info['scripts']
    
    notification = f"""🎯 智能话术推荐 - {customer_name}

【客户概况】
• 联系人：{contact}
• 客户等级：{customer['客户等级']} 级
• 上次跟进：{customer['last_followup_date']} 天前
• 状态：{customer['跟进状态']}

【新发现的信号】
{chr(10).join([f"• {signal}" for signal in script_info['signals']])}

【推荐话术】
──────────────────
📞 电话版本：
{scripts['short_formal']}

💬 微信版本：
{scripts['friendly_casual']}

📧 邮件主题：
"{customer_name}合作机会探讨 - 中科安樵"

【建议行动】
{chr(10).join([f"• {step}" for step in script_info['next_steps']])}

[拨打第一个版本电话] [复制微信消息] [查看详细方案]
"""
    
    return notification

def generate_cooperation_request(customer, script_info):
    """跨销售协作请求模板"""
    
    current_owner = customer['负责人']
    opportunity_type = "新商机发现"
    
    request = f"""🤝 协作邀请 - {opportunity_type}

【客户信息】
• 客户名称：{customer['客户名称']}
• 当前负责人：@{current_owner}
• 联系人：{customer['联系人']}
• 客户等级：{customer['客户等级']} 级

【我发现的机会】
{chr(10).join([f"• {signal}" for signal in script_info['signals'][:3]])}

【我的情况】
• 我现在计划在 [日期] 前往 [区域]
• 您的客户正好在该区域，且有新动向
• 我可以顺便拜访，为您节省约 {script_info.get('time_saved', 30)}分钟交通时间

【话术建议】
{scripts['short_formal'][:50]}...

【请求您】
请选择：
[同意协作] [暂时不需要] [转交给我处理]

*如果 24 小时内无响应，系统将自动取消此邀请*"
    
    return request

# 【定时任务】
if __name__ == "__main__":
    schedule.every().day.at("09:00").do(scan_all_customers_for_opportunities)
    
    print("✅ AI 地点 + 话术扫描器已启动")
    while True:
        schedule.run_pending()
        time.sleep(60)
```

---

## 📊 完整效果演示

### 场景 1：智能地点推荐

**用户行程：**
- 今天计划：上午在苏州工业园区拜访客户 A
- AI 扫描发现：同区域有客户 B（属于销售李四），最近获得融资
- 计算结果：顺路距离仅 3 公里，可节省 45 分钟车程

**AI 推送给销售张三：**

```
🗺️ 顺路拜访建议 - 苏州工业园区

客户：XX 科技公司（李四负责）
距离你的行程：3km，顺路
新信号：获得 A+轮融资 800 万元
时机：可能产生新的 IT 设备需求

💡 建议：
1. 可以先和李四确认客户状态
2. 如果合适，可以尝试协作拜访
3. 预计额外节省 45 分钟路程

[与李四发起协商] [查看客户详情] [跳过本次]
```

---

### 场景 2：智能话术生成

**用户准备联系：** B 级客户"YY 科技有限公司"

**AI 分析后推送：**

```
🎯 智能话术推荐 - YY 科技有限公司

【客户概况】
• 联系人：王总
• 客户等级：B 级（短期不采购）
• 上次跟进：14 天前
• 最终跟进内容：讨论了预算问题，客户表示资金紧张

【新信号】
✓ 获得了 C 轮融资 500 万元（来源：IT 时报）
✓ 发布了"数字化转型专项小组"招聘信息

【推荐话术】
──────────────────
📞 电话版本：
"王总您好，我是中科安樵的小张。恭喜贵公司刚完成 C 轮融资！
我们注意到您最近在组建数字化团队，针对这部分的 IT 设备投入，
我们可以提供一些性价比高的方案，方便的话我周三下午过来跟您详细汇报？"

💬 微信版本：
王总好！刚看到 YY 科技融资成功的消息，恭喜恭喜 🎉
听说贵司在组建数字化团队，如果我们这边有一些成熟的数字化转型案例和资源，
不知道有没有机会分享一下供您参考？😊

【建议行动】
1. 今天下午联系王总，祝贺融资成功
2. 询问新团队的 IT 设备规划
3. 准备针对中型企业的优化方案报价单
4. 建议下周安排面对面会议

[拨打电话] [发送微信] [查看详细方案]
```

---

## ✅ 配置清单

### 必需字段

| 字段名 | 类型 | 用途 | 是否必填 |
|--------|------|------|---------|
| 客户地址 | 文本/地址 | 用于地理围栏计算 | ⭐⭐⭐ 强烈建议 |
| 负责人 | 成员 | 标识客户归属 | ✅ 必填 |
| 客户等级 | 单选 | 决定话术风格 | ✅ 必填 |
| 上次跟进时间 | 日期 | 判断活跃度 | ✅ 必填 |
| 沟通偏好 | 单选 | 选择话术语气 | 推荐 |

### AI 提示词优化

在 `飞书_CRM_AI_提示词.md` 的基础上，增加：

```markdown
【地理围栏优先规则】
当检测到销售靠近某个区域时：
1. 扫描区域内所有客户（不限归属）
2. 识别有新动向的客户
3. 计算顺路效率评分
4. 推送提醒和建议话术

【跨销售协商规则】
对于非本人负责的客户：
1. 必须先与现任负责人协商
2. 协商期间原负责人仍为主要责任人
3. 协商成功后记录协作历史
4. 若 30 天内未成交则归还原始负责人
```

---

## 💡 实施步骤

### 第一步：完善客户数据结构

```markdown
在"客户信息表"中添加字段：
- 客户地址（文本，支持地图定位）
- 最后跟进时间（自动记录）
- 沟通偏好（单选：电话/微信/邮件）
- 行业标签（多选：银行/电信/保险/其他）
```

### 第二步：部署智能扫描服务

```bash
# 安装依赖
pip install schedule requests geopy python-dotenv

# 修改配置文件
# 填入你的飞书 Webhook URL 和 AI 中转站 API Key

# 运行服务
python ai_location_script_generator.py --start

# 或使用 systemd（Linux）
sudo systemctl enable ai-location-scanner
sudo systemctl start ai-location-scanner
```

### 第三步：配置通知机器人

```markdown
1. 飞书 PC 端 → 工作台 → 机器人 → 添加自定义机器人
2. 填写：
   - 名称："中科安樵 - 智能商机提醒"
   - 描述："自动发现商机并推送话术建议"
3. 复制 Webhook URL 到配置文件中
```

### 第四步：测试验证

```bash
# 手动触发一次扫描测试
python ai_location_script_generator.py --test

# 检查是否收到通知
# - 应该收到地点推荐消息
# - 收到智能话术建议
# - 跨销售协作请求（如果有）
```

---

## 🆘 常见问题 FAQ

**Q1: 如何避免侵犯其他销售的客户资源？**  
A: 
- 必须经过协商才能拜访他人负责的客户
- 协商期间原负责人仍然是主要责任人
- 成交后按照协作协议分配业绩
- 恶意抢单会被系统标记

**Q2: 如何防止过度打扰同事？**  
A:
- 同一客户 7 天内最多发起 1 次协作邀请
- 如果对方拒绝 2 次，系统自动冷却 30 天
- 主管可以看到所有协作历史并监督

**Q3: 话术会不会太像机器人？**  
A:
- AI 会根据历史回复不断优化
- 销售可以标记"不满意"让 AI 重新生成
- 建立最佳话术库供参考学习

**Q4: 地理位置隐私如何保护？**  
A:
- 只显示大致区域，不显示精确坐标
- 只有必要时才显示具体地址
- 可以设置"私密模式"隐藏自己的位置

---

## 🚀 总结

这套系统实现了：

✅ **智能地点发现** - 不管客户归谁，发现附近的商机就提醒  
✅ **智能话术生成** - 根据客户特点自动生成最佳沟通话术  
✅ **跨销售协作** - 灵活协作机制，最大化利用每次拜访机会  

**核心价值：**
- 减少无效拜访，提高路线效率
- 提升首次沟通成功率（精准话术）
- 促进团队协作而非恶性竞争

立即开始部署吧！有问题随时问我具体的某一步。🎯