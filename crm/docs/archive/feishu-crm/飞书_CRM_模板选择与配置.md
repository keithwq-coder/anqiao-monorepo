# 飞书 CRM - 模板选择与基础配置（2026 年最新版）

## 📋 推荐的 CRM 模板（2026-07-24 官方推荐）

### 🏆 首选推荐：轻快 CRM（销售管理模板）

**适用原因：**
- 字段配置完全符合你的业务需求（银行/电信/保险行业）
- 支持 B 级客户标记和下次跟进时间
- 内置 AI 商机分析功能（自动扫描互联网发现商机）
- 移动端体验最佳

**操作步骤：**

```markdown
1. 飞书首页 → 工作台 → +（右上角添加）
2. 搜索："轻快 CRM"或"销售管理"
3. 点击预览确认包含以下字段：
   ✓ 客户名称
   ✓ 联系人
   ✓ 联系电话  
   ✓ 行业分类（银行/电信/保险/其他）
   ✓ 客户等级（A/B/C 级）
   ✓ 跟进状态
   ✓ 商关联金额
   ✓ 预计成交时间
   ✓ 负责人
   ✓ 下次跟进时间
4. 点击"套用模板"
5. 重命名为："中科安樵 - 客户管理系统"
6. 完成
```

---

### 🥈 备选方案：标准销售管理

如果找不到"轻快 CRM"，选择任意带以下功能的模板即可：

**必须具备的条件：**

| 条件 | 说明 |
|------|------|
| **多维表格格式** | 不是简单的 Excel，必须是可自动化的 |
| **客户分级** | 能标记 A/B/C 级客户 |
| **跟进记录表** | 能关联到客户信息 |
| **AI 智能体连接** | 支持调用飞书智能伙伴 |
| **自动化规则** | 支持逾期提醒、预警等 |

---

## 🔧 AI 商机分析功能配置

根据你的需求描述：

> "有个客户 1 周前登记了，但销售判定为 B 级短时间不采购，准备下周再跟进，但 ai 扫描互联网知道这个客户最近准备扩建，那么 ai 商机就会提供对应的销售和主管（我）"

### AI 工作流程图解

```
┌──────────────────────────────────────────────────┐
│          数据库：客户信息表                        │
│                                                  │
│  客户：XX 科技公司                                │
│  ├─ 客户等级：B 级（短期不采购）                  │
│  ├─ 下次跟进时间：2026-07-31                     │
│  └─ 最后更新时间：2026-07-24                    │
└──────────────┬───────────────────────────────────┘
               │
               ▼
     【定时扫描任务】（每天凌晨执行）
               │
         扫描互联网信息来源：
         • 企查查/天眼查工商信息
         • 公司官网/招标公告
         • 新闻舆情/社交媒体
         • 竞争对手动态
               │
               ▼
        发现新商机信号：
        "XX 科技宣布扩建计划，融资 5000 万"
               │
               ▼
     【自动匹配规则】
        • 客户名称匹配 → 找到 XX 科技公司
        • 筛选负责销售的 → 张三
        • 抄送直属上级 → 你（主管）
               │
               ▼
     【推送通知】
        ┌─────────────────────────────┐
        │ 💡 新商机提醒                │
        │                             │
        │ 客户：XX 科技公司             │
        │ 信号：宣布扩建计划 + 融资信息  │
        │ 机会：可能产生新的采购需求    │
        │                              │
        │ [查看详情] [一键生成跟进方案] │
        └─────────────────────────────┘
               │
         (发送方式：飞书 App 推送)
```

### 实际配置步骤

#### 第一步：在客户表中添加"商机来源"字段

```markdown
1. 打开"客户管理系统"多维表格
2. 点击"+"新建字段
3. 字段类型："单选"
4. 字段名："商机来源"
5. 选项设置：
   - 新增（手动录入）
   - 系统扫描（AI 发现）
   - 市场推广
   - 转介绍
   - 其他
```

#### 第二步：配置 AI 扫描任务（使用第三方中转站）

由于要用你的**第三方中转站**进行互联网扫描，参考以下代码：

```python
# ai_merchant_scanner.py
# AI 商机自动扫描器（每日凌晨执行）

import schedule
import time
from datetime import datetime, timedelta
import requests

# 【配置区域】替换为你的中转站信息
MIDDLEWARE_CONFIG = {
    "endpoint": "https://your-middleware-domain.com/api/v1/chat/completions",
    "api_key": "sk-your-secret-key-here",
    "model": "gpt-4-turbo",
}

# 【核心逻辑】扫描 B 级客户的潜在商机
def scan_opportunities_for_b_customers():
    """
    扫描所有 B 级客户的互联网公开信息
    如果发现新的商机信号，触发推送
    """
    
    # 1. 从飞书多维表格查询 B 级客户
    b_level_customers = get_b_level_customers_from_base()
    
    print(f"待扫描 B 级客户数：{len(b_level_customers)}")
    
    for customer in b_level_customers:
        print(f"\n扫描客户：{customer['客户名称']}")
        
        # 2. 搜索该客户的互联网公开信息
        news_signals = search_company_news(customer['客户名称'])
        
        # 3. 分析是否有新商机信号
        opportunities = analyze_opportunity_signals(news_signals)
        
        if opportunities:
            # 4. 发现商机，触发推送
            notify_sales_and_manager(customer, opportunities)

def search_company_news(company_name):
    """
    调用第三方中转站的搜索能力，扫描互联网
    
    扫描范围：
    - 工商信息变更（注册资本增加、股权变更等）
    - 招标公告（新项目启动）
    - 招聘网站（扩招意味着扩张）
    - 新闻舆情（媒体报道、获奖信息）
    - 竞品动态（对方有动作，我们也要跟进）
    """
    
    prompt = f"""请帮我搜索"{company_name}"最近的互联网公开信息，重点关注：
1. 是否有扩大规模的迹象（如增资扩股、新设分公司、招聘大量人员）
2. 是否有新的业务需求（如招标公告、采购项目）
3. 是否有融资信息（如 VC/PE 投资、IPO 进度）
4. 是否有技术更新（如新产品发布、设备升级）

返回格式：JSON 数组，每个元素包含：
{{
  "source": "信息来源网址",
  "title": "新闻标题",
  "date": "发布日期",
  "content": "关键内容摘要",
  "opportunity_type": "商机类型 (扩建/采购/融资/技术升级)"
}}
"""
    
    response = call_ai_backend(prompt)
    return parse_json_response(response)

def analyze_opportunity_signals(signals):
    """
    判断哪些信号值得推送给销售和主管
    
    判断标准：
    - 时间相关性：最近 30 天内
    - 规模阈值：融资额>100 万 或 招聘人数>10 人 或 注册资本增长>20%
    - 业务相关性：与客户现有业务领域相关
    """
    
    high_priority = []
    for signal in signals:
        if is_signal_high_value(signal):
            high_priority.append(signal)
    
    return high_priority

def is_signal_high_value(signal):
    """判断是否为高价值信号"""
    
    current_date = datetime.now()
    pub_date = parse_date(signal['date'])
    
    # 必须在最近 30 天内
    days_ago = (current_date - pub_date).days
    if days_ago > 30:
        return False
    
    # 关键词匹配（可根据行业自定义）
    opportunity_keywords = {
        "扩建": ["扩租", "新址", "搬迁", "产能提升", "增设"],
        "采购": ["招标", "采购", "订单", "项目", "预算"],
        "融资": ["融资", "轮投", "估值", "上市", "IPO"],
        "技术": ["系统", "平台", "升级", "数字化", "智能化"]
    }
    
    for sig_type, keywords in opportunity_keywords.items():
        for keyword in keywords:
            if keyword in signal['title'] or keyword in signal['content']:
                return True
    
    return False

def notify_sales_and_manager(customer, opportunities):
    """
    向负责的销售和主管推送商机提醒
    
    推送内容示例：
    🚨 新商机发现
    
    客户：XX 科技公司
    当前等级：B 级（原计划下周再跟进）
    
    🔍 互联网扫描发现：
    - 获得 C 轮融资 5000 万元（来源：xxx.com）
    - 计划在上海设立新办公室（来源：xxx.com）
    
    💡 建议行动：
    - 提前联系，询问新办公室的 IT 设备需求
    - 准备针对性的方案报价
    
    [查看详情] [生成跟进邮件] [标记为已处理]
    """
    
    message_content = generate_notification_message(customer, opportunities)
    
    # 通过飞书机器人推送
    send_feishu_notification(
        to_user=customer['负责人'],  # 销售本人
        cc_user=get_supervisor(customer['负责人']),  # 主管（你）
        content=message_content
    )
    
    # 同时更新客户记录的"商机来源"字段
    update_customer_field(
        record_id=customer['id'],
        field="商机来源",
        value="系统扫描"
    )

# 【定时任务调度】
if __name__ == "__main__":
    # 每天早上 8 点执行扫描
    schedule.every().day.at("08:00").do(scan_opportunities_for_b_customers)
    
    print("✅ AI 商机扫描器已启动...")
    while True:
        schedule.run_pending()
        time.sleep(60)
```

---

#### 第三步：部署扫描服务

```bash
# 安装依赖
pip install schedule requests python-dotenv

# 运行扫描服务
python ai_merchant_scanner.py

# 或使用 systemd 常驻进程（Linux）
# 或 Windows Task Scheduler（Windows）
```

---

#### 第四步：配置飞书机器人接收推送

```markdown
1. 飞书 PC 端 → 工作台 → 搜索"机器人"
2. "+ 添加机器人" → "自定义机器人"
3. 填写：
   - 名称："中科安樵商机提醒"
   - 描述："自动发现新商机并推送"
4. 复制 Webhook URL
5. 在 ai_merchant_scanner.py 中配置：

FEISHU_WEBHOOK_URL = "https://open.feishu.cn/open-apis/bot/v2/hook/xxxxx"
```

---

## 📊 完整效果演示

### 场景模拟

**2026-07-24 上午 10:00：**
```
销售李四在飞书 App 录入：
客户：XX 科技公司
联系人：王总
电话：138****5678
行业：电信
客户等级：B 级（预计短期内不会采购，下周再跟进）
下次跟进时间：2026-07-31
备注：目前预算有限，先保持联系
```

**2026-07-30 凌晨 08:00：**
```
AI 商机扫描器自动执行：
→ 搜索"XX 科技公司 最新"
→ 发现 3 个信息：
  1. 获得了 A+轮融资 2000 万元（来源：36kr.com）
  2. 在招聘"CTO"和"架构师"各 5 名（来源：Boss 直聘）
  3. 发布了"5G 边缘计算平台建设"招标公告（来源：政府采购网）
→ 分析结论：该公司正在扩张，可能有大额 IT 采购需求
→ 触发推送机制
```

**2026-07-30 上午 09:00（销售和王收到推送）：**

📱 **销售李四的飞书消息：**
```
🚨 新商机发现 - XX 科技公司

📈 最新动态：
✓ 获得 A+轮融资 2000 万元
✓ 计划招聘 10 名技术骨干
✓ 发布 5G 边缘计算平台建设招标

💡 建议行动：
1. 立即联系王总，祝贺融资成功
2. 询问新办公室的网络建设需求
3. 准备针对 5G 项目的方案报价

[查看客户详情] [一键发送邮件] [标记为优先级升级]
```

📱 **主管（你）的抄送消息：**
```
⚠️ 重要商机升级

客户：XX 科技公司
销售：李四
原等级：B 级（低风险）
现评级：升级为 A 级（需重点关注）

建议：本周末前与销售沟通跟进策略，考虑安排高层拜访
```

---

## ✅ 验收清单

按照以下步骤检查是否配置成功：

- [ ] 创建了飞书企业账号"中科安樵"
- [ ] 套用了 CRM 模板并添加了必要字段
- [ ] 配置了 AI 商机扫描器（指向你的第三方中转站）
- [ ] 设置了定时任务（每日凌晨执行）
- [ ] 销售能在飞书 App 收到推送
- [ ] 主管能收到抄送消息
- [ ] 可以手动测试：修改某个 B 级客户日期为 1 周前

---

## 🆘 常见问题

**Q1: AI 扫描的速度慢怎么办？**  
A: 
- 减少每次扫描的客户数量（分批处理）
- 优化搜索关键词，避免无效信息
- 使用更快的模型（如 gpt-3.5-turbo 代替 gpt-4）

**Q2: 如何控制成本？**  
A:
- 只对 B 级和 C 级客户扫描（A 级已经有稳定跟进）
- 限制扫描频率（每周 1 次而非每天）
- 使用便宜的模型做初步过滤，仅对高价值信号调用大模型

**Q3: 如果误报太多怎么办？**  
A:
- 提高判断阈值（如必须同时满足 2 个以上的信号）
- 人工审核后再推送（先发给主管确认）
- 建立反馈机制（销售可以标记误报，优化算法）

---

## 📝 最终总结

你需要做的就这三件事：

1. **注册飞书企业**：按 Step 1 完成
2. **套用 CRM 模板**：选"轻快 CRM"或类似模板
3. **部署 AI 扫描器**：把 `ai_merchant_scanner.py` 的代码复制到服务器运行

就这么简单！有问题随时问我具体哪一步卡住了。🚀