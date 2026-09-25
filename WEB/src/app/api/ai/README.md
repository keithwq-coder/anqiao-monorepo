# 未来 AI 服务扩展位

本目录为将来接入 AI 相关服务预留，当前**没有任何实现**。

- 本阶段官网不实现任何 AI 能力（SPEC §10）。
- 未来若接入，在此目录下新增 `route.ts` 作为 API 入口。
- 不要在此目录存放密钥。密钥应走环境变量，且 `.env*` 已在 `.gitignore` 中。

内容数据层已抽象在 `src/data/`（`products.ts` / `news.ts` / `solutions.ts` / `company.ts`），
未来换数据库只需替换该层，页面组件无需改动（SPEC §2.2）。
