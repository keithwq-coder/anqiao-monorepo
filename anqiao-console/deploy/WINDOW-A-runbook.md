# 窗口 A 操作手册 · 阶段一 console 后端影子上线

> 对应 `INTEGRATION-SPEC.md` §8 阶段一 / §7.2 夜间窗口 / §7.3 回滚。
> **执行窗口：23:00–次日 06:00。日间（06:00–23:00）禁止执行。**
> 一个窗口只做一件事：本窗口只做「2831 影子上线 + /v1/ 反代」，不做任何切换或下线。

## 0. 前置检查（执行前必须全部满足）

| 项 | 检查 |
|---|---|
| 回滚方案 | 本手册「回滚标准动作」已存在；旧静态目录、旧 service 文件在位 |
| 目标机密钥 | `/etc/anqiao-console/env` 已按 `anqiao-console.env.example` 填入 `TOKEN_SECRET`、`SEED_ACCOUNT_PASSWORD`，`chmod 600` |
| SSH | 密钥/agent 可登录（`ssh_auth.py`，`SSH_KEY_PATH` 可选）；`ubuntu` 用户具备 `sudo -n` |
| 本地产物 | `npm run build` 通过，`dist/index.html` 存在 |
| 旧服务 | `anqiao-saas.service` 处于 `active`，`/dash/` `/saas/` `/suqian-dash/` 可看 |
| 时间窗 | 当前时间 ∈ [23:00, 06:00) |

## 1. 执行步骤（`deploy_shadow.py` 自动完成，此处为人工核对点）

1. **备份** nginx 配置 → `/tmp/anqiao-nginx-bak-<ts>`（脚本打印路径，记入变更记录）。
2. **上传解压** 到 `/opt/anqiao-console/server` 与 `/var/www/anqiao-console`（**不动** `/home/ubuntu/anqiao-saas`、`/var/www/anqiao-saas`、`/var/www/anqiao-dash`、`/var/www/suqian-dash`）。
3. **安装并启动** `anqiao-console.service`（`127.0.0.1:2831`）。服务未 `active` 则中止，不进入 nginx 变更。
4. **nginx 并入 `/v1/`** 反代块（`nginx-v1-location.conf`）→ `nginx -t` → `reload`。`nginx -t` 失败自动恢复备份。
5. **只读验证**（不做写压测）：
   - `GET :2831/v1/overview` 无令牌 → 401
   - 公网 `GET /v1/overview` 无令牌 → 401
   - 公网 `WS /v1/ws?token=bad` 握手 → 401
   - 登录后 `GET /v1/overview` → 200（可用 `SMOKE_USER`/`SMOKE_PASS`）
6. **零变化确认**：`/saas/`、`/dash/`、`/suqian-dash/` HTTP 200；`anqiao-saas.service` 仍 `active`。

## 2. 操作后

- 留守观察 **≥15 分钟**（页面可看、WS 不掉线、2830 无异常日志）。
- 写当日变更记录：窗口、动作、每步验证结果、备份路径、回滚触发条件。

## 3. 回滚标准动作

触发条件（§7.3）：核心页面不可看 ≥10 分钟即回滚，不得带病观察过夜。

```bash
# 3.1 nginx 指回（不动旧目录）
sudo -n cp /tmp/anqiao-nginx-bak-<ts> /etc/nginx/sites-enabled/anqiao
sudo -n nginx -t && sudo -n systemctl reload nginx

# 3.2 新服务停止（旧 service 只停不删——本窗口本就未动旧服务）
sudo -n systemctl stop anqiao-console.service
# 需要彻底退出开机自启时（可选）：sudo -n systemctl disable anqiao-console.service

# 3.3 验证回滚结果
curl -s -o /dev/null -w '%{http_code}\n' -k https://anqiao.aibrain.wiki/saas/
curl -s -o /dev/null -w '%{http_code}\n' -k https://anqiao.aibrain.wiki/dash/
curl -s -o /dev/null -w '%{http_code}\n' -k https://anqiao.aibrain.wiki/suqian-dash/
sudo -n systemctl is-active anqiao-saas.service   # 应为 active
```

- 静态目录与 `/opt/anqiao-console` **保留 ≥7 天**；`/etc/systemd/system/anqiao-console.service` **只停不删**（阶段三验收前）。
- 次日白天用户验收；验收不过在下一窗口回滚。

## 4. 本窗口明确不做

- 不切换 `/saas/api/` 到 2831（过渡期仍指 2830，见未决项 2）。
- 不下线 `anqiao-saas.service:2830`。
- 不改 `/dash/`、`/suqian-dash/` 静态目录指向。
- 不做写操作压测。

## 5. 变更记录模板

```
日期：
窗口：A（23:00-06:00）
操作人：
备份路径：/tmp/anqiao-nginx-bak-<ts>
步骤验证：
  [1] nginx 备份 OK
  [2] 上传解压 OK（/opt/anqiao-console、/var/www/anqiao-console）
  [3] anqiao-console.service active，:2831 监听
  [4] nginx -t successful，reload OK
  [5] /v1/overview 401（未认证）；登录后 200；WS 坏令牌 401
  [6] /saas/ /dash/ /suqian-dash/ 200；anqiao-saas active
观察记录（≥15min）：
回滚触发条件：核心页面不可看 ≥10min
是否回滚：否
```
