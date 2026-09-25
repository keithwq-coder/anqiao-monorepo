# 窗口 E 变更记录（2026-09-23）

日期：2026-09-23 23:02–23:06 +08:00  
操作人：MiMo Desktop 实现会话  
分支：`stage4-data-layer`

## 动作

1. 备份 unit / env / nginx  
   - `/tmp/anqiao-console.service.bak-20260923230513`  
   - `/tmp/anqiao-console.env.bak-20260923230513`  
   - `/tmp/anqiao-nginx-bak-20260923230513`  
2. 安装 **Node v22.14.0** → `/opt/node-v22`（首次下载截断后改用完整 29MB 包重装）  
3. 验证 `node:sqlite` → SQLITE_OK  
4. `ExecStart=/opt/node-v22/bin/node …`  
5. env：`DATA_LAYER=sqlite`，`DB_PATH=/opt/anqiao-console/server/anqiao.sqlite`  
6. `systemctl daemon-reload && restart anqiao-console.service` → **active**

## 验收

| 项 | 结果 |
|---|---|
| Node | v22.14.0 |
| DATA_LAYER | sqlite |
| 服务 | active |
| 登录 kaijian_admin | 200 |
| claim `A10242` | 200 → handling |
| **重启后** handling 列表含 **A10242** | **持久化 PASS** |
| sqlite 文件 | `anqiao.sqlite` + `-wal`/`-shm` 存在 |
| `/v1/overview` | 401（无令牌） |
| `/saas/` `/dash/` `/suqian-dash/` | 200 |

## 回滚（seed 模式）

```bash
sudo -n cp /tmp/anqiao-console.service.bak-20260923230513 /etc/systemd/system/anqiao-console.service
sudo -n cp /tmp/anqiao-console.env.bak-20260923230513 /etc/anqiao-console/env
sudo -n chmod 600 /etc/anqiao-console/env
sudo -n systemctl daemon-reload
sudo -n systemctl restart anqiao-console.service
# 或仅改 env：DATA_LAYER=seed 后 restart（unit 可保留 Node22）
```

## 遗留

1. `HW_*` 硬件云凭据注入（未做）  
2. 运维：吊销历史硬件云 token、轮换平台口令  
3. `stage4-data-layer` 验收后合回 `master`  
