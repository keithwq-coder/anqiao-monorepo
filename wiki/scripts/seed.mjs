// scripts/seed.mjs — 从 seed/ 三个文件导入种子数据并断言
// 用户拍板（见 docs/plan.md D1/D2）：导入全部账号（含 99 个 dl_00xx 占位，全部 dealer）；
// 10 个实名账号（wj/wq/gj/zqt/yq/zq/kj/dhg/gsy/zjj）role 由种子的 admin 降级为 internal_sales。
// 全部账号 must_change_password=true、临时密码 AnQiao@2026（argon2id 哈希入库）；
// 例外：why（内部销售）为指定口令 123123、must_change_password=false。
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { hash, verify } from "@node-rs/argon2";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("FATAL: DATABASE_URL 未设置");
  process.exit(1);
}

const TEMP_PASSWORD = "123"; // 种子账号初始口令统一 123（首登强制改密）
const PROMOTED_TO_SALES = ["wj", "wq", "gj", "zqt", "yq", "zq", "kj", "dhg", "gsy", "zjj"];
// 指定口令账号：登录密码固定为给定值，且不强制首登改密
const FIXED_PASSWORD_ACCOUNTS = { why: "123123" };

const auth = JSON.parse(await readFile(path.join(root, "seed", "auth.json"), "utf8"));
const cw = JSON.parse(await readFile(path.join(root, "seed", "courseware.json"), "utf8"));
const qz = JSON.parse(await readFile(path.join(root, "seed", "quizzes.json"), "utf8"));

const client = new pg.Client({ connectionString: url });
await client.connect();

// 清空业务表（保持可重复执行）
await client.query(
  `TRUNCATE course_views, quiz_attempts, sessions, login_attempts,
     quiz_questions, module_access, module_quiz_required, modules, users
   RESTART IDENTITY CASCADE`
);

// 1. modules
for (let i = 0; i < cw.length; i++) {
  const m = cw[i];
  await client.query(
    "insert into modules(id, title, layer, ordinal) values($1,$2,$3,$4)",
    [m.id, m.title, m.layer ?? null, i + 1]
  );
}

// 2. module_access
let maCount = 0;
for (const [mid, roles] of Object.entries(auth.module_access)) {
  for (const [role, access] of Object.entries(roles)) {
    await client.query(
      "insert into module_access(module_id, role, access) values($1,$2,$3)",
      [mid, role, access]
    );
    maCount++;
  }
}

// 3. module_quiz_required
let mqrCount = 0;
for (const [mid, roles] of Object.entries(auth.quiz_roles)) {
  for (const [role, required] of Object.entries(roles)) {
    await client.query(
      "insert into module_quiz_required(module_id, role, required) values($1,$2,$3)",
      [mid, role, required]
    );
    mqrCount++;
  }
}

// 4. quiz_questions
let qCount = 0;
for (const [mid, questions] of Object.entries(qz)) {
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!Array.isArray(q.opts) || q.opts.length !== 4) {
      console.error(`FATAL: ${mid} 第 ${i + 1} 题 opts 不是 4 项`);
      process.exit(1);
    }
    if (!["A", "B", "C", "D"].includes(q.ans)) {
      console.error(`FATAL: ${mid} 第 ${i + 1} 题 ans 非法: ${q.ans}`);
      process.exit(1);
    }
    await client.query(
      "insert into quiz_questions(module_id, ordinal, question, options, answer) values($1,$2,$3,$4,$5)",
      [mid, i + 1, q.q, JSON.stringify(q.opts), q.ans]
    );
    qCount++;
  }
}

// 5. users（全部导入）
let userCount = 0;
for (const u of auth.users) {
  let role = u.role;
  if (PROMOTED_TO_SALES.includes(u.username)) role = "internal_sales";
  const fixed = FIXED_PASSWORD_ACCOUNTS[u.username];
  const plain = fixed ?? TEMP_PASSWORD;
  const mustChange = fixed ? false : true;
  const h = await hash(plain, {
    algorithm: 2, // argon2id
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  const isPlaceholder = /^dl_00\d{2}$/.test(u.username); // dl_0001..dl_0099 种子占位
  await client.query(
    `insert into users(username, password_hash, role, name, realname, idcard, phone, must_change_password, is_placeholder)
     values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [u.username, h, role, u.name, u.realname ?? "", u.idcard ?? "", u.phone ?? "", mustChange, isPlaceholder]
  );
  userCount++;
}

// ===== 断言 =====
const res = await client.query(
  `select
     (select count(*)::int from users) as users,
     (select count(*)::int from users where role='dealer') as dealers,
     (select count(*)::int from users where role='admin') as admins,
     (select count(*)::int from modules) as modules,
     (select count(*)::int from quiz_questions) as quiz,
     (select count(*)::int from module_access) as ma,
     (select count(*)::int from module_quiz_required) as mqr`
);
const counts = res.rows[0];

const EXPECT = {
  users: 115,
  dealers: 99,
  admins: 1,
  modules: 15,
  quiz: qCount, // 63
  ma: 90,
  mqr: 90,
};

let fail = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: got=${got} want=${want}`);
};

check("users", counts.users, EXPECT.users);
check("dealers", counts.dealers, EXPECT.dealers);
check("admins", counts.admins, EXPECT.admins);
check("modules", counts.modules, EXPECT.modules);
check("quiz_questions", counts.quiz, EXPECT.quiz);
check("module_access rows", counts.ma, EXPECT.ma);
check("module_quiz_required rows", counts.mqr, EXPECT.mqr);

// 事实核对（口径 B）：各角色 |required_modules| == |required_quizzes|
const ROLES = ["internal_sales", "internal_tech", "internal_ops", "dealer", "agent", "reseller"];
const expectFact = {
  internal_sales: 10,
  internal_tech: 5,
  internal_ops: 4,
  dealer: 10,
  agent: 10,
  reseller: 7,
};
for (const role of ROLES) {
  const req = Object.entries(auth.module_access).filter(([, r]) => r[role] === "req");
  const reqq = req.filter(([m]) => auth.quiz_roles[m]?.[role]);
  const ok = req.length === reqq.length && req.length === expectFact[role];
  if (!ok) fail++;
  console.log(
    `${ok ? "PASS" : "FAIL"} fact ${role}: req=${req.length} req_quiz=${reqq.length} want=${expectFact[role]}`
  );
}

// nickname 列为空
const nnRes = await client.query("select count(*)::int as n from users where nickname is not null");
const nn = nnRes.rows[0].n;
console.log(`${nn === 0 ? "PASS" : "FAIL"} nickname all null: got=${nn}`);

// why 指定口令账号断言
const whyRes = await client.query(
  `select username, role, must_change_password, password_hash from users where username='why'`
);
if (whyRes.rowCount === 1) {
  const w = whyRes.rows[0];
  const pwOk = await verify(w.password_hash, FIXED_PASSWORD_ACCOUNTS.why, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  const ok = w.role === "internal_sales" && w.must_change_password === false && pwOk === true;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"} why account: role=${w.role} must_change=${w.must_change_password} pw_ok=${pwOk}`);
} else {
  fail++;
  console.log(`FAIL why account: rowCount=${whyRes.rowCount}`);
}

console.log(fail === 0 ? "ASSERT OK" : `ASSERT FAILED (${fail})`);
await client.end();
process.exit(fail === 0 ? 0 : 1);
