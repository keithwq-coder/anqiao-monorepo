# HANDOFF-20260803-GPT5.6SOL-S6-EVIDENCE-CORRECTION-AUDIT

- Task: TASK-0001 S6 证据修正轮独立审计（证据修正已完成，待独立模型核验）
- From tool/model: 证据修正执行者（TASK-0001 S6 证据修正轮）
- To tool/model: 审计大模型（gpt5.6sol）
- Handoff status: HANDOFF-ONLY
- Repository state: `uncommitted`（本仓库无任何 git 跟踪文件，`git status` 全部 `??` untracked、无初始 commit；`git diff` 不可用，变更证明只能靠文件读取 + mtime 取证）
- Written at: 2026-08-03（证据修正轮完成后）

## Required reading（接收者必读，不得跳读）

1. `AGENTS.md` 全文（重点 §3 证据分级 [VERIFIED]/[INFERENCE]/[PROPOSAL]/[UNKNOWN]、§7 跨工具协调、§9 完成报告）
2. `docs/decisions/DECISION-LOG.md` 中 DEC-0073 点 4（常设证据标准）、DEC-0076 点 5（留存日志）/点 6（fail-closed）、DEC-0077（缺陷记录）、DEC-0078 点 1-7（授权范围）
3. `docs/evidence/TASK-0001-S6-ENGINE-REPAIR-REALDB-RUN.md`（本次被修正的证据文件）
4. `docs/evidence/TASK-0001-S6-ENGINE-REPAIR-REALDB-RUN.log`（真库门控套件 19 passed 的原始日志）
5. `src/crm/persistence/database.py`（当前代码）
6. `pyproject.toml`（`requires-python = ">=3.12,<3.15"`）
7. `.pytest_cache/v/cache/lastfailed`（残留记录）

## 审计任务（给 gpt5.6sol 的提示词主体）

你（gpt5.6sol）是独立审计者，不是执行者的代言人。逐条核验后，按 AGENTS.md §9
五段输出裁决：`Status`（passed / partial / blocked / draft-only / handoff-only）、
`Scope`、`Evidence`（你实跑的命令与真实输出）、`Not verified`（含原因与剩余检查）、
`Decisions needed`。区分静态检查、自动化测试、本地运行时、真实库证明、人工验收——
禁止把"通过了转发路径测试"写成"生产已验证"。若提示词与仓库实际状态矛盾
（如 mtime 不符、database.py 非元组键版、证据文件缺某处修正），停下逐条列出矛盾，
不要用假设填充。

### 授权边界（执行者被授权范围，供审计核对）

- 仅允许修改 `docs/evidence/TASK-0001-S6-ENGINE-REPAIR-REALDB-RUN.md` 一个文件
- 禁止修改 src/、tests/、scripts/、migrations/、templates/、DECISION-LOG.md、NOW.md、任务卡
- 禁止重跑真库、禁止 SSH 转发、禁止访问任何数据库、禁止改 5.0 阈值、禁止 git commit/push、禁止部署/服务变更、禁止凭证轮换
- 禁止在文件中写入任何凭证值；允许可记录标识符：`crm_test_runner`、`127.0.0.1`、`crm_test`
- 背景结论（协调者已独立复核，无需重做，但可抽查）：修复本身合规——`pool_pre_ping` 修复前既有；22 调用点未动；P2 五处 `user_status=UserStatus.ENABLED` 仍在；阈值 5.0 未动；六维键控双向证明、凭证残留 0、SQLAlchemy 掩码均已实测

### 被审计的修正内容（执行者自述）

唯一缺陷被修正：证据文件原先把"门控套件 19 passed"写成当前仓库代码的结果，实际不是。
mtime 取证：`RUN.log` 13:34:16（19 passed 原始日志）→ `RUN.md` 13:47:23（证据定稿）→
`database.py` 13:48:18（当前代码，晚 14 分钟）。即真库门控运行时 `database.py` 的缓存键
还是 `str(settings.database_url)`；13:48 安全 follow-up 才改为 `_cache_key()` 六维元组键。
当前元组键版从未在 `crm_test` 上运行过。

**R1（必须）**：§5.1 Status 与 §2.2 措辞修正，明确四件事：
1. 19 passed 运行于 13:34，所用 database.py 是 str(URL) 键中间版，标 `[VERIFIED]`
2. 13:48 定稿的元组键版仅通过本地门、未在 crm_test 运行，标 `[NOT VERIFIED]` 并写明原因（门控套件早于该次改动）
3. 两版在单一固定配置下行为等价，引用协调者实测数据，标 `[VERIFIED]`（来源=协调者独立复核）
4. 由 3 推出"当前代码在 crm_test 会同样 19 passed"，必须标 `[INFERENCE]`

协调者实测数据（核对是否被忠实引用）：
```
[tuple-key (current, 13:48)]  CACHE_ENTRIES: 1  ONE_ENGINE_ACROSS_4_RESOLUTIONS: True
[str(URL)-key (as run 13:34)] CACHE_ENTRIES: 1  ONE_ENGINE_ACROSS_4_RESOLUTIONS: True
SINGLE_CONFIG_BEHAVIOR_IDENTICAL: True
[tuple-key]    REBUILD_ON_PASSWORD_CHANGE: True
[str(URL)-key] REBUILD_ON_PASSWORD_CHANGE: False
PASSWORD_DIMENSION_ONLY_DIFFERENCE: True
```

**R2（必须）**：§1.2 补记键控证明脚本已丢弃、未留存，与 DEC-0076 点 5 留存要求不符；
记录协调者已独立重建该证明并六维复证，故不阻塞。

**R3（必须）**：§7 补记两项记录卫生：
1. 2026-08-03 13:52:58-59 一批 Python 3.14 pyc 写入；协调者解析 pyc 头部内嵌源 mtime 确认
   编译的是当前源文件（`test_s6_integration.py` 08:53:29 / `database.py` 13:48:18 均
   `MATCHES_CURRENT_SOURCE: True`）；requires-python 允许 3.14，不构成越界
2. `.pytest_cache/v/cache/lastfailed`（mtime 13:54:14）残留 `test_delete_institution_admin_only`
   （该测试已按 SPEC-0001 范围外移除）；约 13:54 存在一次未记录的、用系统 Python 3.14
   而非 venv 3.12.8 的 pytest 运行，其命令与结果标 `[UNKNOWN]`，不得编造

**追加修正**（普通 review 发现的 should-fix）：§5.3 证据分类注明键控脚本已丢弃、
由协调者重建复验，与 R2 补记同步。

### 执行者实跑验证（命令与输出，供抽查或重跑）

- `pytest tests -q`（venv Python 3.12.8 + `PYTHONPATH=src`，与 `scripts/dev-test.ps1` 同解释器）
  → **`133 passed, 28 skipped, 11 warnings`（0 failed）**（证据文件最后一次变更之后实跑；
  多次运行 13.15s / 13.53s / 14.90s 同结果）
- `powershell -ExecutionPolicy Bypass -File scripts/dev-test.ps1` → `133 passed, 28 skipped, 0 failed`
- `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` → `[PASS]`
  （Approved SPECs: 7, Active tasks: 6, Legacy manifests: 1）
- mtime 取证：`src/crm/persistence/database.py` 仍为 **2026-08-03 13:48:18**；src/ tests/
  scripts/ 其余源文件全部早于本轮（最新 `tests/test_s6_local_no_external_calls.py` 11:53:19）
- 凭证残留扫描（修改后证据文件）：`postgresql://`、私钥、token、`SESSION_SECRET`、
  `DATABASE_PASSWORD` 等模式 0 命中；仅 `credential`/`credentials` 关键词引用
- 审查结论（执行者自报）：普通 review 两轮 **ship as-is**；security_review 两轮 **pass**
  （含对 docs/evidence 全目录的机密模式 grep，未命中真实值）

### 请重点核验的点

1. 证据文件 §2.2（行 104-130）与 §5.1（行 212-241）是否如实把 19 passed 归属 13:34 的
   str(URL) 键中间版，且四档标签 [VERIFIED]/[NOT VERIFIED]/[INFERENCE] 使用正确、
   无"证据措辞强于实际所跑"
2. mtime 取证（13:34:16 / 13:47:23 / 13:48:18）与仓库实际文件时间是否一致；
   `database.py` 当前是否确为 `_cache_key()` 六维元组键版本（`str(settings.database_url)` 无残留）
3. §2.2/§5.1 引用的协调者实测数据是否与上方六行数据逐字一致、来源署名是否明确
4. §7 两项记录卫生是否与仓库实际一致（pyc 批次 mtime 窗口、lastfailed 内容与 mtime）；
   `[UNKNOWN]` 是否被如实标注而非编造
5. §1.2/§5.3 对键控脚本丢弃的补记是否与 DEC-0076 点 5 的语义一致
6. 凭证残留：证据文件是否不含任何机密值（允许：关键词引用、`crm_test_runner`/
   `127.0.0.1`/`crm_test`/公网 IP/SSH 用户名/`.env.crm_test_local` 文件名）
7. 边界合规：仅证据文件被改动；database.py mtime 未变；阈值/调用点/P2 未动
8. 运行副产物说明：本轮验证运行可能更新 `tests/`、`src/` 下 `__pycache__/*.pyc` 的 mtime
   （编译产物，非源码）；`lastfailed` 已被恢复为取证内容（仅 `test_delete_institution_admin_only`）。
   另有 18 个 `cpython-311-pytest-9.0.2.pyc`（mtime 18:18:46-47）来源与本轮解释器
   （3.12.8/3.14）不符，归因 `[UNKNOWN]`——请独立判断是否构成问题

### 已知边界与未知项（执行者如实声明）

- 当前元组键版在 `crm_test` 上的真实运行：`[NOT VERIFIED]`（本轮无真库授权）；
  "当前代码同样 19 passed"仅为 `[INFERENCE]`
- 约 13:54 未记录 pytest 运行的命令与结果：`[UNKNOWN]`
- 系统 Python 3.14 直跑 pytest 会出现 8 个环境性失败（starlette/jinja2 依赖版本差异，
  `TemplateResponse` 签名），非仓库问题；标准验证以 venv 3.12.8 为准
- S6 正式验收、服务端 loopback 响应时间测量：待协调者/产品负责人裁决（DEC-0077 点 6、
  DEC-0078 点 6）

## Changes made（本轮证据修正，供审计对照）

- `docs/evidence/TASK-0001-S6-ENGINE-REPAIR-REALDB-RUN.md`：
  - R1：头部 Status 行（行 14-19）、§2.2 标题改 `intermediate str(URL)-key revision` +
    Key-version clarification 小节（行 104-130）、§5.1 Status 重写（行 212-241）
  - R2：§1.2 Record-hygiene correction（行 60-65）
  - R3：新增 §7 Record-hygiene notes（行 300-317）
  - 追加：§5.3 证据分类注明键控脚本已丢弃、由协调者重建复验（行 245-250）
- 未改动：src/、tests/、scripts/、migrations/、templates/、DECISION-LOG.md、NOW.md、任务卡、
  5.0 阈值、任何服务配置；无真库访问、无 SSH 转发、无 git commit

## Checks actually run（执行者实跑）

| Command/check | Environment | Result | Evidence |
|---|---|---|---|
| `pytest tests -q` | venv Python 3.12.8 + PYTHONPATH=src | `133 passed, 28 skipped, 11 warnings`（0 failed） | 最新变更后实跑（13.53s 等多次） |
| `powershell -ExecutionPolicy Bypass -File scripts/dev-test.ps1` | 本机 | `133 passed, 28 skipped, 0 failed` | 等价形态 |
| `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | 本机 | `[PASS]`（7 SPECs / 6 tasks / 1 manifest） | 实跑输出 |
| mtime 取证（Get-ChildItem） | 本机 | database.py `2026-08-03 13:48:18`；其余源文件早于本轮 | 见上文 |
| 凭证残留扫描（rg 敏感模式） | 本机 | 0 命中（仅关键词引用） | 见上文 |
| 普通 review（隔离子代理，两轮） | 只读 | ship as-is | R1/R2/R3 吻合、RUN.log 19 测试名逐字一致 |
| security_review（隔离子代理，两轮） | 只读 | pass | 机密值扫描干净、无安全误导、边界逐条吻合 |

## Failed or not verified

- 当前元组键版在 `crm_test` 上的真实运行：`[NOT VERIFIED]`（需新授权）；"当前代码同样
  19 passed"仅为 `[INFERENCE]`
- 约 13:54 未记录 pytest 运行的命令与结果：`[UNKNOWN]`
- 18 个 `cpython-311-pytest-9.0.2.pyc`（18:18:46-47）来源与执行者所用解释器不符，归因 `[UNKNOWN]`
- 系统 Python 3.14 直跑 pytest 8 个环境性失败（依赖版本差异），非仓库问题
- S6 正式验收、服务端 loopback 响应时间测量：待协调者/产品负责人裁决
- 人工验收：由接收审计模型（gpt5.6sol）独立裁决本证据修正

## Next bounded action

接收者（gpt5.6sol）按上方"审计任务"独立核验证据文件与仓库实际状态，输出
AGENTS.md §9 五段裁决，并据 DEC-0073 点 4 防"证据措辞强于实际所跑"。任何超出
证据核验的新授权请求返回 DECISION-LOG 流程。
