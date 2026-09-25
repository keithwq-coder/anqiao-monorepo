-- 005_scenario.sql — 考试主观题（客户挑战性问答模拟题，AI 评分参考/人工最终打分，不计入客观总分）
create table if not exists scenario_questions (
  id         serial primary key,
  scenario   text not null unique,   -- 客户挑战场景（学员可见）
  hint       text not null default '', -- 评分参考要点（学员不可见，供人工/AI 评分）
  category   text not null default '客户挑战',
  created_at timestamptz not null default now()
);

alter table exams add column if not exists scenario_ids jsonb; -- 本次考试的主观题 id（组卷时随机抽 2）

alter table exam_attempts add column if not exists scenario_answers jsonb; -- {scenarioId: "学员作答文本"}

-- 预置客户挑战性问答场景（可重复执行）
insert into scenario_questions(scenario, hint, category) values
  ('客户说“你们卖的太贵了，隔壁便宜一半。”你如何回应？',
   '回应要点：价值锚定（24 个月只换不修/9 项专利/二类器械/跌倒 99.8%）；对比人工看护成本；不贬低竞品；可申请价格审批但不擅自破价。', '客户挑战'),
  ('我是经销商，如果我不做你们代理了，我的货能退回来吗？',
   '回应要点：渠道政策以协议为准；退换货/库存处理按《经销协议》与退出清算流程执行；不承诺协议外事项，转交商务对接。', '客户挑战'),
  ('客户问“设备坏了怎么修？质保多久？会不会很久？”',
   '回应要点：24 个月质保只换不修（非人为）；换新流程 报障→登记→确认→寄回→换新；安全关键设备可申请备用机；质保内不收费。', '客户挑战'),
  ('客户担心“装了这个会不会泄露我爸的隐私？”',
   '回应要点：不成像不拍摄、零摄像头零麦克风；仅雷达点云；本地加密、传输加密；符合《个人信息保护法》；物业只收应急告警。', '客户挑战'),
  ('机构说“我们已经有监控了，为什么还要你们的设备？”',
   '回应要点：监控看画面、满足不了体征与跌倒识别；毫米波补充夜间/隐私区域；可叠加不冲突；输出照护数据与告警闭环。', '客户挑战'),
  ('客户问“买回去不会用怎么办？老人会用吗？”',
   '回应要点：无感免操作、开机即用；APP 由家属操作；提供安装指导与培训；7×24 热线；质保期内售后无忧。', '客户挑战'),
  ('客户质疑“你怎么证明你们的跌倒监测靠谱？”',
   '回应要点：跌倒识别准确率 99.8%；9 项专利二类器械；可现场演示/试点；告警链路多重（声光+APP+电话）不脱节。', '客户挑战'),
  ('客户问“设备离线了还能监测吗？断网怎么办？”',
   '回应要点：边缘计算本地判定不依赖网络；断网本地缓存、恢复后同步；双通道告警补漏；安装前确认网络与供电。', '客户挑战')
on conflict (scenario) do nothing;

create index if not exists idx_exam_attempts_scenario on exam_attempts(exam_id) where scenario_answers is not null;