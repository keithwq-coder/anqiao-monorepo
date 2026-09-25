# DeepSeek handoff - TASK-0009 remediation

- Task: `TASK-0009`
- From: coordinator
- To: DeepSeek (sole implementation executor)
- Status: HANDOFF-ONLY / REMEDIATION REQUIRED
- Authority: `DEC-0089`, activation `DEC-0090`
- Audit evidence: `docs/evidence/TASK-0009-COORDINATOR-AUDIT-20260806.md`
- Repository state: uncommitted and broadly untracked; preserve all existing files

## Message to forward verbatim

你是本轮 `TASK-0009` 的唯一实现执行者。协调器已独立复核，当前交付不能验收；请只做本返工任务，不要开始 `TASK-0014`。产品负责人只负责转发消息和你的结构化报告，不负责编辑文件、运行命令、合并变更或判断验收。

### 必须先读和先停

完整读取 `AGENTS.md`、`docs/NOW.md`、`docs/PROJECT.md`、`docs/specs/INDEX.md`、`docs/specs/SPEC-BASELINE.md`、`docs/decisions/DECISION-LOG.md`（尤其 `DEC-0089`、`DEC-0090`）、`docs/tasks/active/TASK-0009-integration-test-baseline.md`、`docs/evidence/TASK-0009-COORDINATOR-AUDIT-20260806.md` 以及当前实际源码/测试。

若发现 `src/crm/web/main.py`、`templates/` 或其他不属于 TASK-0009 owned paths 的行为必须修改才能解决问题，立即停止并报告 `BLOCKED: OWNERSHIP-RELEASE-REQUIRED`，不要自行编辑。不要通过删测试、改弱断言、增加无条件 skip、修改治理门禁或把真实缺失写成假证据来获得绿色结果。

### 本轮唯一目标

在 TASK-0009 允许的路径内建立可复现的依赖和集成测试基线，并解释/修复审计发现：

1. 让依赖真相源与当前环境一致。`pyproject.toml` 声明了 `jinja2`，但 `pip check` 报安装元数据缺失；`fastapi==0.136.3` 与已安装 `starlette==0.44.0` 不满足依赖约束。选择与仓库声明相容、可复现、最小的修复方式，更新必要的依赖/锁定文件或测试运行器，并实际运行 `pip check`。不要凭模型记忆选择版本；以当前包元数据和项目声明为依据。
2. 调查首次全套运行出现的 `test_non_owner_page_and_api_masked_identically` 失败。该测试单独运行及随后三次全套运行通过，但这不能直接证明基线稳定。确认是否为共享 app state、测试隔离、收集顺序或真实实现问题；修复只允许在 TASK-0009 owned test/runner/fixture 路径内进行。若必须改 `main.py`/模板/业务逻辑，停止并报告范围冲突。
3. 对 `src/crm/web/main.py` 的实际 `TemplateResponse` 数量和 Starlette 版本给出可重复的命令输出。当前审计观察到 23 个调用点、Starlette 0.44.0；DeepSeek 原报告写的是 24 处和 Starlette 1.0.0，必须解释差异，不得改写历史结果。
4. 逐一列出本任务实际改变的路径。`backup/legacy-scripts/` 下的 8 个脚本不是 TASK-0009 明确 owned destination；只有在能给出源路径、过时分类、完整性/hash 和可逆恢复证据时才可保留，否则停止并报告范围冲突。不要删除原文件或其他未知文件。

### 允许的路径

仅限 `TASK-0009` 任务卡中的依赖声明/锁定文件、测试文件与测试运行器、经证据证明过时的 root test script 归档、`docs/evidence/TASK-0009-*` 和该任务卡。不得编辑 `src/crm/web/main.py`、模板、领域/策略/持久化/迁移、部署或远程资源，除非先报告 ownership blocker 并等待协调器决定。

### 必须执行的验证

使用项目 `.venv` 和 `PYTHONPATH=src`，逐项记录真实输出：

- `python -m pip check`
- 依赖/锁定文件与安装包版本检查
- 受影响的 focused tests，以及能证明隔离/顺序稳定性的重复运行
- `powershell -ExecutionPolicy Bypass -File scripts/dev-test.ps1`，至少一次完整运行，并在发现顺序敏感时重复运行
- `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`
- 如涉及 Python 文件，运行对应 `python -m compileall -q src tests`

不得访问远程 PostgreSQL/SSH、部署、生产迁移、真实数据、凭据、付费服务或外部写入。

### 必须回传的报告（原样结构）

```text
Task: TASK-0009
Status: PASSED | PARTIAL | BLOCKED
Executor: DeepSeek (only identify model if actually known)
Owned paths changed:
- path: exact change and why it is in TASK-0009

SPEC/task mapping:
- TASK-0009 acceptance item: evidence and test name

Commands actually run:
- command | environment | exit/result | evidence path

Tests and results:
- focused tests: N passed, N failed, N skipped
- full local suite: exact count and repeatability result
- pip check: exact result
- governance: exact `[PASS]` or failure output

Failed, skipped, or NOT VERIFIED:
- reason and exact remaining check

Scope and safety:
- no deployment/remote DB/real-data/external write: YES or explain stop
- no out-of-scope paths changed: YES or list every conflict

Risks and rollback:
- concrete risk and reversible rollback point

Next bounded action:
- `STOP: coordinator audit required; do not start TASK-0014`
```

不要在本轮报告中宣称 TASK-0014 已开始或 SPEC 已全部完成。协调器会重新检查所有路径、依赖元数据、测试隔离、完整套件和治理结果；只有独立审计通过后，才会另行激活下一张任务卡。
