# -*- coding: utf-8 -*-
"""
飞书视频库 入库器（数据源无关）

规则（owner 定版，长期有效）：
1. 每次运行生成唯一批次号 YYYYMMDD-HHmmss，本次所有记录共用。
2. 去重键优先级：平台+作品ID → 平台+规范化链接 → 平台+账号+发布时间+规范化标题
3. 写入前按去重键查询：存在则更新，不存在才新建（Base 无 unique 约束，这是唯一防线）
4. 确认不到的数据填 null，禁止猜测补造
"""
import json
import re
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path

BASE_TOKEN = "YJE6b1Phsa5x06sPv6IchtPNnQg"
TABLE_ID = "tblaUcu1ccrK39B2"
AS = "user"

# 允许写入的字段白名单（严格对照最终字段模型，禁止新增）
FIELDS = [
    "标题", "平台", "来源链接", "账号名称", "发布时间", "采集时间",
    "榜单排名", "点赞数", "评论数", "转发数", "收藏数",
    "发布文案", "话题标签", "标题结构", "开头钩子", "爆款原因",
    "仿写标题", "仿写文案", "学习笔记", "分析状态",
    "作品ID", "去重键", "采集批次",
]
NUM_FIELDS = {"榜单排名", "点赞数", "评论数", "转发数", "收藏数"}
DATETIME_FIELDS = {"发布时间", "采集时间"}
SELECT_FIELDS = {"平台", "分析状态"}
TEXT_FIELDS = set(FIELDS) - NUM_FIELDS - DATETIME_FIELDS - SELECT_FIELDS

PLATFORM_OPTS = {"抖音", "快手", "其他"}
STATUS_OPTS = {"待分析", "已分析", "已复盘", "需人工复核"}

TMP = Path(tempfile.gettempdir()) / "video_ingest"
TMP.mkdir(exist_ok=True)


# ---------- 批次号 ----------
def new_batch() -> str:
    return datetime.now().strftime("%Y%m%d-%H%M%S")


# ---------- 规范化 ----------
def norm_title(t: str) -> str:
    if not t:
        return ""
    t = re.sub(r"[\s\u3000]+", "", t)
    t = re.sub(r"[#＃@＠]", "", t)
    return t.strip().lower()


def norm_url(u: str) -> str:
    """规范化视频链接：去掉查询参数、锚点、末尾斜杠"""
    if not u:
        return ""
    u = u.split("?")[0].split("#")[0].rstrip("/")
    u = re.sub(r"^https?://", "", u)
    u = re.sub(r"^(www\.|m\.)", "", u)
    return u.lower()


def norm_time(t) -> str:
    if not t:
        return ""
    return re.sub(r"[^\d]", "", str(t))[:12]


# ---------- 去重键（三级优先级） ----------
def make_dedup_key(rec: dict) -> tuple:
    """返回 (去重键, 命中级别)。级别: id / url / title / none"""
    plat = (rec.get("平台") or "其他").strip()

    wid = (rec.get("作品ID") or "").strip()
    if wid:
        return f"{plat}#{wid}", "id"

    url = norm_url(rec.get("来源链接"))
    if url and re.search(r"/(video|short-video|note)/", url):
        return f"{plat}#{url}", "url"

    acct = (rec.get("账号名称") or "").strip()
    pub = norm_time(rec.get("发布时间"))
    title = norm_title(rec.get("标题"))
    if acct and pub and title:
        return f"{plat}#{acct}#{pub}#{title}", "title"

    return "", "none"


# ---------- 清洗 ----------
def clean_record(rec: dict, batch: str) -> dict:
    out = {}
    for k in FIELDS:
        v = rec.get(k)
        if k == "采集批次":
            out[k] = batch
            continue
        if k == "去重键":
            continue
        if k == "分析状态":
            out[k] = v if v in STATUS_OPTS else "需人工复核"
            continue
        if k == "平台":
            out[k] = v if v in PLATFORM_OPTS else "其他"
            continue
        if k in NUM_FIELDS:
            if v is None or v == "":
                continue
            try:
                out[k] = int(str(v).replace(",", "").strip())
            except (ValueError, TypeError):
                continue
            continue
        if k in DATETIME_FIELDS:
            if not v:
                continue
            out[k] = str(v)[:16]
            continue
        if v is None or v == "":
            continue
        out[k] = v
    return out


# ---------- lark-cli ----------
def run_cli(args, timeout=90):
    r = subprocess.run(["lark-cli"] + args, capture_output=True,
                       text=True, encoding="utf-8", errors="ignore",
                       timeout=timeout, shell=True)
    return r.stdout or ""


def fetch_index() -> dict:
    """拉全表，构建 {去重键: record_id}"""
    out_file = TMP / "index.ndjson"
    if out_file.exists():
        out_file.unlink()
    run_cli(["base", "+record-list", "--as", AS,
             "--base-token", BASE_TOKEN, "--table-id", TABLE_ID,
             "--format", "ndjson", "--output", str(out_file), "--overwrite"],
            timeout=180)

    idx = {}
    if not out_file.exists():
        print("  [警告] 索引拉取失败，将全部按新增处理（风险：可能重复）")
        return idx
    for line in out_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            d = json.loads(line)
        except json.JSONDecodeError:
            continue
        rid = d.get("record_id") or d.get("id")
        key = d.get("去重键")
        if isinstance(key, list):
            key = key[0] if key else ""
        if rid and key:
            idx[str(key)] = rid
    return idx


def _write_json(data, name):
    p = TMP / name
    p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return p


def batch_create(records):
    """records: list[dict] 已清洗字段字典（不含去重键）"""
    if not records:
        return 0
    payload = {"create_records": records}
    p = _write_json(payload, "create.json")
    out = run_cli(["base", "+record-batch-create", "--as", AS,
                   "--base-token", BASE_TOKEN, "--table-id", TABLE_ID,
                   "--json", f"@{p}"])
    ok = '"ok":true' in out.replace(" ", "") or "ok" in out[:200]
    return len(records) if ok else 0


def batch_update(records):
    """records: list[(record_id, fields)]"""
    if not records:
        return 0
    payload = {"update_records": {rid: f for rid, f in records}}
    p = _write_json(payload, "update.json")
    out = run_cli(["base", "+record-batch-update", "--as", AS,
                   "--base-token", BASE_TOKEN, "--table-id", TABLE_ID,
                   "--json", f"@{p}"])
    ok = '"ok":true' in out.replace(" ", "") or "ok" in out[:200]
    return len(records) if ok else 0


# ---------- 主流程 ----------
def ingest(raw_records: list, dry_run=False) -> dict:
    batch = new_batch()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    stat = {"batch": batch, "total": len(raw_records),
            "created": 0, "updated": 0, "skipped": 0, "levels": {}}

    print(f"[入库] 批次号 {batch}   输入 {len(raw_records)} 条")

    prepared, skipped = [], 0
    for r in raw_records:
        r = dict(r)
        r.setdefault("采集时间", now_str)
        key, level = make_dedup_key(r)
        stat["levels"][level] = stat["levels"].get(level, 0) + 1
        if not key:
            skipped += 1
            continue
        fields = clean_record(r, batch)
        fields["去重键"] = key
        prepared.append((key, level, fields))
    stat["skipped"] = skipped

    if dry_run:
        print(f"[dry-run] 不写入。样例：")
        for k, lv, f in prepared[:3]:
            print(f"  [{lv}] {k}")
            print(f"      {json.dumps(f, ensure_ascii=False)[:220]}")
        return stat

    idx = fetch_index()
    print(f"  已有记录索引 {len(idx)} 条")

    to_create, to_update = [], []
    for key, level, fields in prepared:
        if key in idx:
            to_update.append((idx[key], fields))
        else:
            to_create.append(fields)

    # 单次上限 200
    for i in range(0, len(to_create), 200):
        stat["created"] += batch_create(to_create[i:i + 200])
    for i in range(0, len(to_update), 200):
        stat["updated"] += batch_update(to_update[i:i + 200])

    print(f"  完成：新增 {stat['created']} / 更新 {stat['updated']} / "
          f"跳过(无去重键) {stat['skipped']}")
    print(f"  去重键级别分布: {stat['levels']}")
    return stat


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True, help="JSON 数组文件或 .jsonl")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    txt = Path(a.file).read_text(encoding="utf-8")
    try:
        data = json.loads(txt)
    except json.JSONDecodeError:
        data = [json.loads(l) for l in txt.splitlines() if l.strip()]
    ingest(data, dry_run=a.dry_run)
