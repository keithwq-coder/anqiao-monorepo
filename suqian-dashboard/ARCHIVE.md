# suqian-dashboard 归档说明（INTEGRATION-SPEC §3 / §9-5）

> 状态：**迁移完成后归档只读**，不再接受新提交。
> 归档前置：阶段三验收通过（宿迁大屏以合流构建在线，旧 `anqiao-saas.service:2830` 已下线）。

## 有效改动合回清单（逐项核对，已全部合入 `anqiao-dashboard`）

| # | 宿迁改动 | 合回位置 | 状态 |
|---|---|---|---|
| 1 | `src/assets/ltciArchive.ts` 参保档案（未获取恒 null） | `anqiao-dashboard/src/projects/suqian/ltciArchive.ts` | ✅ |
| 2 | 长护险监管屏（第六屏，评估+服务两阶段、防骗保 M1-M4） | `anqiao-dashboard/src/views/ScreenLtci.vue`（suqian 版）+ `PROJECT.ltciScreen` 开关 | ✅ |
| 3 | 在册设备恒为 3 台（ASH01086/ASH01078/ASH01092）红线 | `src/projects/suqian/anqiaoDevices.ts` | ✅ |
| 4 | 云扫描「只比对不写回」红线 | `PROJECT.cloudScanMode='compare_only'` + `cloudScan.ts` 写回门禁 | ✅ |
| 5 | 单一项目（关闭多机构切换） | `PROJECT.multiOrg=false` | ✅ |
| 6 | 宿迁部署脚本 / `/suqian-dash/` 站点块 | 已并入 `anqiao-console/deploy/nginx-suqian-dash-api.conf`（补 API 反代） | ✅ |
| 7 | `geoHierarchy`/`orgData`/`profileData` 宿迁口径 | `src/projects/suqian/` 对应文件 | ✅ |
| 8 | 项目标题/跑马灯宿迁文案 | `src/projects/config.ts` `projectTitle` | ✅ |

## 归档动作

1. 在本仓打 tag：`git tag archive/suqian-dashboard-2026 && git push --tags`
2. GitHub/远端设为 **Archive**（只读）。
3. 本地目录保留 ≥7 天后可删除；历史改动已由上表覆盖。

## 合流构建产物

```bash
cd anqiao-dashboard
VITE_PROJECT=suqian VITE_BASE=/suqian-dash/ VITE_API_BASE=/suqian-dash/v1 npm run build
# 产物部署至 /var/www/suqian-dash（窗口 D）
```
