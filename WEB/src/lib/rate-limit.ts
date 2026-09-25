import { readFile, writeFile, unlink } from "node:fs/promises";
import { open } from "node:fs/promises";
import path from "node:path";

/**
 * 基于 IP 的提交限速（SPEC §2.3「部署前必办」）。
 *
 * 询价/招商表单：60 秒内同一 IP 最多 3 次提交。
 *
 * 实现说明：Next.js 16 Turbopack 的 Server Action 在子进程/工作线程中
 * 并发运行，模块级 Map 无法跨请求持久化，且并发读写文件有竞态。
 * 因此用 O_EXCL 排他锁文件串行化读写，保证「检查-更新」原子性。
 * 单实例可靠；多实例需换共享存储（如 Redis），本阶段不做。
 */

const WINDOW_MS = 60_000; // 60 秒窗口
const MAX_SUBMITS = 3; // 窗口内最多 3 次提交

function dataDir(): string {
  return path.join(process.cwd(), "data");
}

function stateFile(): string {
  return path.join(dataDir(), "rate-limit.json");
}

function lockFile(): string {
  return path.join(dataDir(), "rate-limit.lock");
}

type Records = Record<string, number[]>; // IP → 提交时间戳数组

async function readRecords(): Promise<Records> {
  try {
    const raw = await readFile(stateFile(), "utf8");
    return JSON.parse(raw) as Records;
  } catch {
    return {};
  }
}

async function writeRecords(records: Records): Promise<void> {
  await writeFile(stateFile(), JSON.stringify(records), "utf8");
}

/**
 * 用 O_EXCL 创建锁文件实现排他锁（单实例、无 native 依赖）。
 * 拿不到锁就自旋等待；拿到后返回释放函数。
 */
async function acquireLock(): Promise<() => Promise<void>> {
  const lock = lockFile();
  // 最多等 3 秒
  const deadline = Date.now() + 3000;
  for (;;) {
    try {
      // O_EXCL：文件已存在则失败，原子操作
      const fh = await open(lock, "wx");
      await fh.writeFile(String(process.pid));
      await fh.close();
      return async () => {
        try {
          await unlink(lock);
        } catch {
          /* 锁文件可能已被清理，忽略 */
        }
      };
    } catch {
      if (Date.now() > deadline) {
        // 超时：放弃加锁，放行（不阻塞正常提交）
        return async () => {};
      }
      await new Promise((r) => setTimeout(r, 20));
    }
  }
}

/**
 * 检查某 IP 是否仍可提交。
 * @returns ok=是否放行；retryAfter=还需等待的秒数（被拒时 > 0）
 */
export async function checkRateLimit(
  ip: string,
): Promise<{ ok: boolean; retryAfter: number }> {
  const now = Date.now();
  const release = await acquireLock();
  try {
    const records = await readRecords();
    const all = (records[ip] ?? []).filter((t) => t > now - WINDOW_MS);

    if (all.length >= MAX_SUBMITS) {
      const oldest = Math.min(...all);
      const retryAfter = Math.ceil((oldest + WINDOW_MS - now) / 1000);
      records[ip] = all;
      await writeRecords(records);
      return { ok: false, retryAfter: Math.max(retryAfter, 1) };
    }

    all.push(now);
    records[ip] = all;
    await writeRecords(records);
    return { ok: true, retryAfter: 0 };
  } finally {
    await release();
  }
}
