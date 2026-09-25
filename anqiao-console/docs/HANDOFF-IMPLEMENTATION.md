# 实现交接提示词（粘贴到新会话 · mimo v2.6 flash）

> 用法：全选下方代码块内容，粘贴到**新开对话**作为首条消息。工作区：`D:\Project\中科安樵`。

```text
【角色】
你是中科安樵「三位一体」项目的实现工程师。Spec 已在上一会话收口完毕，本会话只做实现，不再重开 Spec 框架。

【工作区与仓库边界】（唯一来源：anqiao-console/docs/INTEGRATION-SPEC.md）
- 路径：D:\Project\中科安樵
- anqiao-console  = 唯一业务后端（server/）+ 管理控制台前端 + 全部 Spec（docs/）
- anqiao-dashboard = 大屏纯前端（VITE_PROJECT=kaijian|suqian 双项目构建），禁止自带 server、禁止静默 mock 回退
- suqian-dashboard = 待归档分叉（ARCHIVE.md 8 项已合回 dashboard）；阶段三窗口 D 验收前只读，不接受功能开发

【必读文档（按序，改代码前先读）】
1. anqiao-console/docs/INTEGRATION-SPEC.md   仓库拓扑/端口/窗口/回滚/删除清单
2. anqiao-console/docs/API-CONTRACT.md       v0.3 接口契约唯一来源（§3.1 状态索引、§3.2–3.4 新路由）
3. anqiao-console/docs/PLATFORM-SPEC.md      权限/工作台/阶段验收 + §13 末「实现状态快照」与「已知实现缺口」
4. anqiao-console/docs/LTC-INSURANCE-SPEC.md 长护险执行细节（流程/状态机/反欺诈门禁）
5. anqiao-console/docs/ACCOUNT-MATRIX.md · DOMAIN-GLOSSARY.md

【硬性红线（违反即返工）】
1. Spec 先行：先改 docs 再改代码；代码与 Spec 不一致视为缺陷，不得改 Spec 迁就代码。
2. 唯一后端：业务数据只经 /v1；前端禁止硬编码凭据/假数据兜底；vendor/platform 禁止 mock 回退。
3. 日间 06:00–23:00 禁止任何生产中断性操作（nginx/systemd/端口切换/下线）；夜间窗口严格按 runbook，先备份、可回滚、一窗一事。
4. 监测证据 conclusion 恒 null；设备数据不得自动定级/定待遇；suqian 云扫描只比对不写回；在册设备恒 3 台（ASH01086/ASH01078/ASH01092）。
5. 越权读他人数据 404，无权限动作 403；授权只在后端 authorize()；前端隐藏按钮不构成授权。
6. 不得提交密钥/明文口令/生产 SSH 密码；TOKEN_SECRET 与 SEED_ACCOUNT_PASSWORD 未注入拒绝启动。

【当前代码状态（接手起点）】
- anqiao-console 有大量未提交但测试全绿的 PLATFORM 阶段 2–5 实现：
  server/auth.js（authorize + ROLE_* + 九工作台映射）、server/ltc.js（长护险全链）、server/seed.js 扩写、
  src/views/console/WorkspaceShell.vue + workspaces/*（9 工作台）、品牌资产 public/ + src/assets/logo*。
- 验证基线（本地）：TOKEN_SECRET / SEED_ACCOUNT_PASSWORD 注入后
  node server/test-account-matrix.mjs  → 7/7
  node server/test-device-ltc.mjs      → 12/12
  node server/test-ltc.mjs             → 17/17
  npm run build                        → 通过
- anqiao-dashboard 工作区含未提交删除：shots/ 与 x2_extracted.txt（工作区清扫产物）。
- suqian-dashboard 含未提交本地改动（合回已完成），勿在该仓继续功能开发。

【本会话任务（按优先级，做完一项再下一项）】
P0 固化现状
  1) 在 anqiao-console 提交未提交的 PLATFORM 工作（可拆：docs / server auth+ltc / workspaces UI / assets）。
  2) 在 anqiao-dashboard 提交 shots/ 与 x2_extracted.txt 的删除（chore: 清扫验收截图与临时提取文件）。
  3) 跑通上述 3 个测试 + npm run build 作为提交门禁。

P1 补齐契约 ⏳ 路由（API-CONTRACT §3.1/§3.2–3.3）
  4) 实现 GET /v1/project/config（字段严格按 API-CONTRACT §3.3；suqian cloudScanMode=compare_only、devices 恒 3 台）。
  5) 实现 GET /v1/floors、/v1/wards、/v1/beds、/v1/stats/demographics、/v1/stats/rankings（字段按 API-CONTRACT §3；数据源用现有 seed 内存态，不编造）。
  6) 大屏侧：client.ts 对应函数改为接上述真接口；仍缺的用显式 VITE_MOCK=1，禁止静默回退。

P2 修已知实现缺口（PLATFORM-SPEC §13 末）
  7) authorize() 增加 data_scope=channel 分支（partner_* 仅本渠道组织客户/线索/设备，不见客户数据正文）；用测试锁住。
  8) 回归 test-account-matrix / test-device-ltc / test-ltc，补 project/config 与 floors/stats 的最小用例。

P3 阶段四数据层生产化（INTEGRATION-SPEC §8 阶段四，可开分支）
  9) console 落 sqlite（映射现有内存模型：租户/账号/告警/处置/长护险状态）；重启数据不丢；可回滚至种子模式。
  10) 密码哈希 scrypt 固定 salt → argon2id + 随机 salt。
  11) 硬件云凭据服务端化（API-CONTRACT §5 目标态）；前端删除任何直连硬件云凭据。

P4 生产窗口（仅当用户明确要求且处于 23:00–06:00）
  12) 严格按 anqiao-console/deploy/WINDOW-A-runbook.md 及后续窗口文档执行；日间只允许只读验证与新增式静态预发。

【验收口径】
- 每完成一项：相关测试全绿 + 与 API-CONTRACT/PLATFORM-SPEC/LTC-INSURANCE-SPEC 逐条对照无偏差。
- 不确定口径查 docs，不查则问用户；禁止发明字段或放宽门禁。
- 结束时汇报：改了哪些文件、测试结果、与 Spec 的对照结论、剩余 ⏳ 项。

【现在开始】
先读 INTEGRATION-SPEC + API-CONTRACT v0.3 + PLATFORM-SPEC §13 实现状态快照，然后执行 P0。
```
