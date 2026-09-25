# SPEC-0012: 云部署、运维、安全与验收

- Spec ID: SPEC-0012
- Version: 0.2.0
- Status: APPROVED
- Product owner: User
- Prepared by: Claude Code / Opus 4.8
- Last updated: 2026-07-27
- Supersedes: none

## 1. Problem

这套多人 CRM 需要被部署，使团队（包括外勤销售）能随时随地安全访问，具备
可靠的备份与恢复，并在投入真实使用前有明确的验收关口。部署目标为云环境。

本 SPEC 定义部署、运维、安全与验收的工程行为合同，不在本文件锁定具体云
服务商或登录技术。法律、合规与数据落地由产品负责人负责，不在本 SPEC 范围
内。本 SPEC 目前是草稿；批准与实施/部署授权都是独立步骤，均未发生。

## 2. Verified context

- [VERIFIED] `DEC-0040` 确认部署目标为云、支持随时随地访问；具体服务商/
  登录/预算属工程提案 + 负责人授权。
- [VERIFIED] `SPEC-0002`：多人身份、角色、权限；登录提供方尚未选定。
- [VERIFIED] `SPEC-0011`：留存、受控永久删除，且删除须在有界过程内传播到
  备份。
- [VERIFIED] `DEC-0037`：法务/合规与数据落地由产品负责人负责，不写入 SPEC。
- [VERIFIED] `DEC-0028`：CRM 不做第三方业务集成；云托管是"应用运行于何处"，
  与业务集成是两回事。
- [VERIFIED] `AGENTS.md` 第 8 节：绝不在代码或文档中存放密钥；外部账号、
  付费、部署等需产品负责人确认。
- [VERIFIED] `DEC-0041`：部署到既有腾讯云轻量应用服务器，主域名 `aibrain.wiki`，
  新建子域名 `crm.aibrain.wiki`，nginx + HTTPS，SSH 推送部署；TLS 证书/私钥为
  运行时机密，不入库；CRM 是服务端应用（非静态站）。
- [UNKNOWN] 具体登录机制（服务端方案，AI 提案）与上线时机（负责人授权）。

## 3. Goal and success measure

CRM 运行在云环境，授权用户可从任何地方访问；每次访问都需 `SPEC-0002` 认证
身份；数据有备份且可恢复；`SPEC-0011` 的永久删除会传播到云备份；在投入真实
使用前，由产品负责人完成验收。

非技术人员可以这样判断成功：销售在外面用手机登录就能用；服务器出问题时
数据能恢复；从任何地方访问看到的脱敏与权限和本地一致；上线前你亲自确认
"可以了"。

## 4. Non-goals

- 锁定具体后端技术栈（由 AI 在实现任务中提案）；
- 具体服务端登录技术细节（`OD-002`）；
- 把业务数据交给浏览器的纯静态站方案（`DEC-0041` 已排除）；
- 法律、合规、数据落地/跨境判断（负责人负责，`DEC-0037`）；
- 超出内部 CRM 的扩容、商业化或营销能力。

## 5. Users and permissions

沿用 `SPEC-0002` 身份与权限。

- [VERIFIED] **管理员**：管理部署、发布、配置、备份与恢复；这些操作留痕。
- [VERIFIED] **所有授权用户**：可从任何地方访问，但一切脱敏、权限与审计
  规则不变（页面/搜索/接口一致）。
- [VERIFIED] **未授权主体**：不能访问。

## 6. Required behavior

- R-001: CRM 部署在云环境，授权用户可从任何地方访问。
- R-002: 每次访问都需 `SPEC-0002` 认证身份；随时随地访问不得削弱脱敏、
  权限或审计——与本地行为一致。
- R-003: 传输中的数据受保护；密钥、令牌、口令绝不存入代码或文档，运行时
  经环境/密钥库提供。
- R-004: 存在定期备份，且恢复流程经过验证；数据丢失后可按既定流程恢复。
- R-005: `SPEC-0011` 的永久删除必须在有界、可验证的窗口内传播到云备份，
  使被删除的个人信息不在备份中无限期留存。
- R-006: 部署、发布与配置变更是受控且可回滚的；在授权前不使用真实数据、
  不产生外部副作用。
- R-007: 投入真实使用前，产品负责人进行业务/可视化验收；仅自动化检查通过
  不等于验收通过。
- R-008: 具体云服务商与任何付费账号由 AI 提案、需产品负责人明确授权，并由
  负责人本人完成开户/付费；AI 不创建账号、不输入支付信息（安全边界）。
- R-009: 访问控制遵循最小权限；管理员的部署、恢复、配置等操作可审计。
- R-010: CRM 部署为服务端应用（后端 + 数据存储），不得做成把业务数据交给
  浏览器的静态站；脱敏、权限、审计在服务端强制执行（`DEC-0041`）。
- R-011: TLS 证书与私钥、SSH 凭据等机密仅在部署时置于服务器/密钥库，绝不
  进入代码库；AI 不复制、打印或经手这些机密（`AGENTS.md` 第 8 节、`DEC-0041`）。

## 7. Data and integrations

### Data concepts

- **部署配置**：非密钥的环境与发布配置。
- **备份/恢复记录**：备份时间、范围、恢复演练结果、删除传播状态。
- **访问与运维审计**：登录、管理员部署/恢复/配置操作的留痕。

### Minimum data contract

| 对象 | 必需信息 | 系统维护信息 |
|---|---|---|
| 备份/恢复记录 | 备份范围、时间 | 恢复演练结果、`SPEC-0011` 删除传播状态 |
| 运维审计 | 操作者、动作、目标、结果 | 时间、前后状态（不含密钥/秘密） |

- 密钥经运行时密钥库提供，绝不入库。云托管是运行环境，非第三方业务集成
  （区别于 `DEC-0028`）。

## 8. Failure and edge behavior

- 部署失败时安全回滚，不留半上线状态；不得把失败显示为成功。
- 备份或恢复失败时明确标记，不得报告为成功。
- 登录提供方不可用时，不伪造登录成功（`SPEC-0002` R-017）。
- 疑似密钥泄露按安全事件处理，立即失效并轮换。
- 删除向备份传播未完成时，按 `SPEC-0011` 标记为未完成。

## 9. Acceptance criteria

- AC-001: Given 部署在云上的 CRM，when 授权用户从异地访问，then 需认证身份
  且脱敏/权限与本地一致。
- AC-002: Given 未认证或未授权主体，when 访问，then 被拒绝且不泄露内容。
- AC-003: Given 传输与存储，when 检查，then 无明文密钥存于代码/文档，密钥
  经运行时提供。
- AC-004: Given 数据丢失场景，when 执行恢复流程，then 数据按既定流程恢复且
  有演练记录。
- AC-005: Given 一次 `SPEC-0011` 永久删除，when 存在云备份，then 删除在有界
  窗口内传播到备份或被标记未完成。
- AC-006: Given 一次部署/配置变更，when 出现问题，then 可安全回滚，不留
  半上线状态。
- AC-007: Given 投入真实使用前，when 产品负责人验收，then 业务/可视化验收
  被记录，且不以自动化检查代替。
- AC-008: Given 需要付费云账号，when 推进部署，then AI 只提案、由负责人授权
  并亲自开户/付费，AI 不创建账号或输入支付信息。
- AC-009: Given 管理员的部署/恢复/配置操作，when 执行，then 均可审计。

自动化检查、恢复演练与人工业务/可视化验收必须分别记录。

## 10. Constraints and safety

- 绝不在代码、文档或日志中存放密钥、令牌或口令。
- 只允许合成数据验证；真实数据、付费账号与实际部署需产品负责人授权。
- AI 提案服务商与架构，但成本承担、开户与支付由产品负责人本人完成。
- 实现与部署必须遵守 `AGENTS.md` 第 5 节与第 8 节。

## 11. Open decisions

> 以下开放决策不改变本 SPEC 已定的行为规则（云访问需认证、脱敏一致、备份
> 可恢复、删除传播、可回滚、负责人验收、AI 不开户付费），因此不阻塞进入
> `20-review`；它们各自门控实际部署。

### OD-001: 云服务商与架构

- **Status**: RESOLVED by `DEC-0041`。
- **Decision**: 腾讯云轻量应用服务器（既有），`crm.aibrain.wiki` 子域名，
  nginx + HTTPS，SSH 推送部署。具体后端技术栈仍由 AI 在实现任务中提案。

### OD-002: 登录/认证机制

- **Status**: OPEN（延续 `SPEC-0002`），已约束为**服务端**方案。
- **Decision needed**: 随时随地访问的服务端登录/认证方式；由 AI 提案 + 负责人
  授权。参考项目的客户端登录不适用于 CRM。

### OD-003: 预算上限

- **Status**: RESOLVED by `DEC-0041`。
- **Decision**: 复用既有腾讯云轻量服务器，预计无新增经常性成本；若后续需要
  升配再单独决定。

## 12. References

- `docs/decisions/DECISION-LOG.md#dec-0040-deployment-target-is-cloud-with-anywhere-access` -
  VERIFIED - 云部署方向。
- `docs/specs/30-approved/SPEC-0002-users-roles-ownership.md` - VERIFIED -
  身份/权限/审计与会话失效。
- `docs/specs/30-approved/SPEC-0011-data-lifecycle.md` - VERIFIED -
  删除向备份传播。
- `docs/decisions/DECISION-LOG.md#dec-0037-legal-compliance-is-out-of-ai-scope-approve-spec-0011-v020` -
  VERIFIED - 法务/合规归属产品负责人。

## 13. Verification plan

| Criterion | Check | Environment | Evidence location |
|---|---|---|---|
| AC-001 | 异地访问需认证且脱敏一致测试 | Local/test | To be recorded after authorization |
| AC-002 | 未授权访问拒绝测试 | Local/test | To be recorded after authorization |
| AC-003 | 无明文密钥/运行时密钥测试 | Local/test | To be recorded after authorization |
| AC-004 | 备份恢复演练 | Staging | To be recorded after authorization |
| AC-005 | 删除向备份传播测试 | Staging | To be recorded after authorization |
| AC-006 | 部署回滚测试 | Staging | To be recorded after authorization |
| AC-007 | 产品负责人业务/可视化验收 | Human | To be recorded after implementation |
| AC-008 | AI 不开户/付费边界检查 | Human/process | To be recorded after authorization |
| AC-009 | 运维操作审计测试 | Local/test | To be recorded after authorization |

## 14. Approval

`APPROVED by DEC-0042 on 2026-07-27`

`SPEC-0012 v0.2.0` 并入 `DEC-0041` 的具体部署事实（腾讯轻量 +
`crm.aibrain.wiki` + nginx/HTTPS + SSH）。`OD-001`/`OD-003` 已解决，`OD-002`
（服务端登录）为非阻塞开放项。本批准不包含实施授权、真实数据使用、TLS 密钥
经手或实际部署授权；实际部署需先有已建成的应用与单独授权。

<!-- execution note: deployment execution for TASK-0040/TASK-0041 authorized by
product owner under `DEC-0163` (2026-08-23); behavior unchanged, no new
approval scope. -->
