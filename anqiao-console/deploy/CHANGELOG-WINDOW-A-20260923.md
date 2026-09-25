# 窗口 A 变更记录（2026-09-23）

日期：2026-09-23
窗口：A（原定 23:00–06:00；**用户明确授权提前执行**，实际 22:35–22:40）
操作人：MiMo Desktop 实现会话
分支：`stage4-data-layer`（含 P0–P3）

## 前置

- 日间只读预检：旧服务 active、三页 200、`/opt` 不存在、无 `/v1/` 块、无 2831
- `/etc/anqiao-console/env` 于 22:32 新建（`ensure_env.py`，mode 600，密钥目标机生成不回显）
- 本地产物：console `dist/` 已 build；dashboard kaijian/suqian 已 build

## 执行

1. 22:35 `deploy_shadow.py`：nginx 备份 `/tmp/anqiao-nginx-bak-20260923223511`；上传 server+dist；服务 **activating 失败**
   - 根因：服务器 **Node 20** 无 `node:sqlite`（stage4 顶层 import）；`package.json`/argon2 未就位
   - **未进入 nginx 变更**（脚本正确中止）
2. 修复：`server/db.js` 改为 **seed 模式不加载 `node:sqlite`**（动态 import）；`index.js`/`ltc.js` 适配 async load
3. 22:38 本地 seed 冒烟 login 200
4. 22:38–22:40 `deploy/resume_shadow.py`：
   - 备份 nginx `/tmp/anqiao-nginx-bak-20260923223856`
   - 重传 server + `npm install argon2`（ARGON_OK）
   - `anqiao-console.service` → **active**，:2831 未认证 401
   - 插入 `/v1/` 块 → `nginx -t` successful → reload
   - 公网验证见下

## 步骤验证

| 步骤 | 结果 |
|---|---|
| [1] nginx 备份 | OK（`/tmp/anqiao-nginx-bak-20260923223856`） |
| [2] 上传 server / dist | OK（`/opt/anqiao-console/server`、`/var/www/anqiao-console`） |
| [3] anqiao-console.service | **active**，:2831 |
| [4] nginx -t + reload | successful |
| [5] `/v1/overview` 无令牌 | 本机 401 / 公网 401 |
| [5] WS 坏令牌 | 公网 401 |
| [5] 登录后 overview / floors | 见 `smoke_after_a.py` 输出（本记录附跑通时刻） |
| [6] `/saas/` `/dash/` `/suqian-dash/` | 均 200 |
| [6] `anqiao-saas.service` | **active**（未动 2830） |

## 本窗口明确未做

- 不切换 `/saas/api/` → 2831
- 不下线 `anqiao-saas.service:2830`
- 不改 `/dash/` `/suqian-dash/` 静态指向
- 未部署 dashboard 新构建到生产（窗口 A 仅 console 影子）

## 回滚

触发：核心页面不可看 ≥10 分钟

```bash
sudo -n cp /tmp/anqiao-nginx-bak-20260923223856 /etc/nginx/sites-enabled/anqiao
sudo -n nginx -t && sudo -n systemctl reload nginx
sudo -n systemctl stop anqiao-console.service
curl -sk -o /dev/null -w '%{http_code}\n' https://anqiao.aibrain.wiki/saas/
curl -sk -o /dev/null -w '%{http_code}\n' https://anqiao.aibrain.wiki/dash/
curl -sk -o /dev/null -w '%{http_code}\n' https://anqiao.aibrain.wiki/suqian-dash/
sudo -n systemctl is-active anqiao-saas.service   # 应为 active
```

## 观察

- 上线完成时刻：2026-09-23 22:40 +08:00
- 留守观察起点：22:40（建议 ≥15 分钟至 22:55）
- 回滚触发条件：核心页面不可看 ≥10min
- 是否回滚：否（待观察）

## 遗留 / 下一步

1. **阶段四 sqlite 窗口 E**：`DATA_LAYER=sqlite` 需服务器 **Node ≥22**（当前 20.20.2）；缺省 seed 已可跑
2. 硬件云 `HW_*` 未注入 → `/v1/hardware/*` 503（预期）
3. 运维：吊销历史硬件云 token、轮换平台口令
4. `stage4-data-layer` 验收后合回 `master`
