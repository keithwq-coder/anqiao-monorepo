import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * 本地开发兜底：仅在未配置 CONSOLE_API_BASE 时写入 data/leads.jsonl。
 * 生产必须走基座 POST /v1/public/leads，禁止静默回退到本文件。
 */

/** 一条线索记录（写入 data/leads.jsonl，每行一个 JSON）。 */
export type LeadRecord = Record<string, unknown> & { submittedAt: string };

/** 写入队列：上一条写完才开始下一条。 */
let chain: Promise<void> = Promise.resolve();

/**
 * 串行追加一条线索，自动盖 submittedAt ISO 时间戳。
 * 返回的 Promise 在该条写入完成后 resolve；失败则 reject。
 */
export function appendLead(
  record: Omit<LeadRecord, "submittedAt">,
): Promise<void> {
  const stamped: LeadRecord = {
    ...record,
    submittedAt: new Date().toISOString(),
  };

  let resolveSelf!: () => void;
  let rejectSelf!: (e: unknown) => void;
  const done = new Promise<void>((resolve, reject) => {
    resolveSelf = resolve;
    rejectSelf = reject;
  });

  chain = chain.then(async () => {
    try {
      const dir = path.join(process.cwd(), "data");
      await mkdir(dir, { recursive: true });
      await appendFile(
        path.join(dir, "leads.jsonl"),
        `${JSON.stringify(stamped)}\n`,
        "utf8",
      );
      resolveSelf();
    } catch (e) {
      rejectSelf(e);
    }
  });

  return done;
}
