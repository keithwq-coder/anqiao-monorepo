# 窗口 B / D 变更记录（2026-09-23）

日期：2026-09-23  
操作人：MiMo Desktop 实现会话  
授权：用户明确要求不等 23:00，提前执行（同窗口 A）

## 窗口 B · 凯健大屏 `/dash/`

| 时刻 | 动作 |
|---|---|
| 22:47 | 首次切换 **失败**（`/dash/` 404） |
| 22:49 | **紧急回滚** alias → `/var/www/anqiao-dash`，`/dash/` 恢复 200 |
| 根因 | `run_cmd(sudo=True)` 只给命令首词加 `sudo -n`，`mkdir`/`tar` 未提权，v2 目录未创建仍切了 alias |
| 22:51–22:52 | 修复为 `bash -c '…'` 整段 sudo 后重跑 **成功** |

成功结果：
- 预发 `/var/www/anqiao-dash-v2`（`V2_OK`）
- 备份 `/var/www/anqiao-dash.bak-20260923225153`
- nginx alias → v2，`nginx -t` + reload
- `/dash/` **200**，公网新 bundle **OK**
- 回滚：`cp /tmp/anqiao-nginx-bak-20260923225153 /etc/nginx/sites-enabled/anqiao`（或 alias 改回 `OLD_DIR`）

## 窗口 D · 宿迁大屏 `/suqian-dash/`

| 时刻 | 动作 |
|---|---|
| 22:53 | `VITE_PROJECT=suqian` 构建后切换 **成功** |

成功结果：
- 预发 `/var/www/suqian-dash-v2`
- 备份 `/var/www/suqian-dash.bak-20260923225338`
- `/suqian-dash/` **200**，公网 bundle OK
- 同步验证：`/saas/` 200、`/dash/` 200、`/v1/overview` 401（未认证正常）
- 回滚：`cp /tmp/anqiao-nginx-bak-20260923225338 /etc/nginx/sites-enabled/anqiao` + alias 回 `/var/www/suqian-dash`

## 本两窗明确未做

- **未下线** `anqiao-saas.service:2830`（`/saas/api/` 仍指向 2830；需先切 API 再另窗下线）
- 未改官网/其它 location
- 未执行窗口 E（sqlite 需 Node ≥22）

## 验收快照（22:53）

- `/dash/` 200  
- `/suqian-dash/` 200  
- `/saas/` 200  
- `/v1/overview` 401  
- `anqiao-console.service` active（窗口 A）  
- `anqiao-saas.service` active  

## 观察

- 窗口 B 完成 22:52，窗口 D 完成 22:53  
- 建议观察 ≥15 分钟（至约 23:08）  
- 回滚触发：核心页不可看 ≥10 分钟  

## 2830 下线（阶段三收尾 · 22:57–22:58）

| 项 | 结果 |
|---|---|
| `/saas/api/` | `proxy_pass` **2830 → 2831**（REPLACED 1，剥前缀） |
| `anqiao-saas.service` | **inactive**（unit 文件保留，可 `systemctl start` 回滚） |
| 验证 | `/saas/` 200 · `/dash/` 200 · `/suqian-dash/` 200 · `/v1/overview` 401 |
| nginx 备份 | `/tmp/anqiao-nginx-bak-20260923225753` |
| 回滚 | `systemctl start anqiao-saas.service` + `cp bak → sites-enabled/anqiao` |

## 遗留

1. 窗口 E：升级服务器 Node ≥22 后 `DATA_LAYER=sqlite`（当前 Node 20.20.2）  
2. `HW_*` 注入后硬件代理可用；运维吊销旧硬件云 token  
3. 观察建议至约 23:08（窗口 B/D 起算 ≥15 分钟）  
