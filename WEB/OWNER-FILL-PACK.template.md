# 业主回填包

> 复制本文件为 `OWNER-FILL-PACK.md` 后填写。  
> 规则：**有把握才填**；不填或写 `暂不填` = 网站继续显示「待补充」。  
> 禁止：准确率百分比、价格、部署台数、医疗级/诊断/治疗/疗效/注册证（产品）、凯健写成已交付。  
> 场景标签建议与解决方案五场景对齐：`养老机构` `社区居家养老` `医疗卫生` `大健康美业` `适老化改造`（可改，但需前后一致）。

- 填写人：
- 日期：
- 批次说明：（例如「先填联系方式，产品下批」）

---

## B1-4 联系方式 → `src/data/company.ts`

| 字段 | 值（空=暂不填） |
|---|---|
| phone | |
| email | |
| icp | |

---

## B1-1 产品 10/11 型号与正式名 → `src/data/products.ts`

| slug | model | officialName |
|---|---|---|
| smart-switch | | |
| platform | | |

---

## B1-2 / B4 产品 scenes · customers · spec（及 3–11 的 tagline/features）

> `zq-sh100` / `zq-d100` 的 tagline、features 已有，勿改除非业主要修订。  
> `features` 多条用 ` \| ` 分隔。`scenes` 多标签用 ` \| ` 分隔。

| slug | scenes | customers | spec | tagline（仅 3–11） | features（仅 3–11，\| 分隔） |
|---|---|---|---|---|---|
| zq-sh100 | | | | — | — |
| zq-d100 | | | | — | — |
| za100 | | | | | |
| zq50 | | | | | |
| zq-bh100 | | | | | |
| zq-gj100 | | | | | |
| zq-zh100 | | | | | |
| zqkfc100 | | | | | |
| zq-w100 | | | | | |
| smart-switch | | | | | |
| platform | | | | | |

B4 决策（勾选一）：

- [ ] 按上表写入 customers/scenes
- [ ] 本期不做「适用客户 / 适用场景」区块（执行方从详情页移除对应 UI，需业主明确勾选）

---

## B1-2 / B3 解决方案 devices · value → `src/data/solutions.ts`

| anchor | 场景名 | devices（推荐设备组合） | value（交付价值） |
|---|---|---|---|
| institution | 养老机构 | | |
| community | 社区居家养老 | | |
| medical | 医疗卫生机构 | | |
| wellness | 大健康 · 美业 | | |
| retrofit | 装修 · 适老化改造 | | |

> retrofit 面向装企/经销商，禁止「为您家老人选购」等 C 端用语。

---

## B1-3 关于我们

| 项 | 可公开？ | 文案（可公开才填） |
|---|---|---|
| 团队 | 是 / 否 / 暂不填 | |
| 发展历程 | 是 / 否 / 暂不填 | |

---

## B1-5 新闻 → `src/data/news.ts`

| slug | date (YYYY-MM-DD) | body（正文，可多段） |
|---|---|---|
| guangzhou-aging-industry-expo-2026 | | |
| yangtze-delta-health-forum-2026 | | |
| smart-care-demo-floor | | |

> `smart-care-demo-floor` 正文必须含「建设阶段」或「建设中」，禁止已交付/已采购/成功案例/客户见证。

---

## F10 措辞决策（必须二选一，禁止留空「以后再说」若本批要定稿）

### F10-1 首页招商引流条

现状：`完整赋能培训体系 · 区域政策 · 产品矩阵支持`（SPEC §5.1）

- [ ] A 保持现状（仅提政策存在，不披露规则）
- [ ] B 改为：______________________________

### F10-2 retrofit 场景 buyer

现状：`装企 / 经销商`（省略了 SPEC §5.4 括号内「终端为有老人的家庭」）

- [ ] A 保持省略（避免 C 端指向）
- [ ] B 补回：`装企 / 经销商（终端为有老人的家庭）`
- [ ] C 改为：______________________________

---

## 本批明确不做（可选）

列出本批明确跳过的区块，执行方不得催填、不得代写：

-
