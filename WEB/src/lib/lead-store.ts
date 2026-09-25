import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * 线索落地加固（SPEC §2.3「部署前必办」）。
 *
 * 串行化写入队列：避免并发追加写损坏 data/leads.jsonl。
 * 进程内链式 Promise，单实例足够；多实例需换外部队列或数据库。
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
