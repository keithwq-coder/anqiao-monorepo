import { readFileSync, writeFileSync } from "node:fs";
let t = readFileSync("docs/improvements.md", "utf8");
// 更新实施顺序说明，标注将与"三组差异化+档案化"一并实施
if (!t.includes("I-6 ")) t += `\n### I-6 认证理念调整（用户拍板）：一次性认证 → 碎片化档案\n- 内部员工不设一次性职业认证门槛；改为"学习+测试档案"，分数仅是参考（含入职评估），无硬性达标。\n- 落实：`getCertification` 不再产生内部硬性 certified/in_progress；改为输出 学习进度/分数记录；CRM 差异化为对外参考。\n-（与原款项 I-4 的"学完"信号结合，作为档案记录，非门槛。）\n`;
writeFileSync("docs/improvements.md", t);
console.log("improvements.md 已加 I-映射");
