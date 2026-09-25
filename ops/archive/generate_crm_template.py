# 生成飞书 CRM 数据导入模板的脚本

"""
使用此脚本生成标准格式的 Excel 文件，可直接用于飞书多维表格导入
"""

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

# 创建工作簿
wb = Workbook()

# ============================================
# Sheet 1: 客户信息表
# ============================================
ws1 = wb.active
ws1.title = "客户信息表"

# 标题样式
header_font = Font(bold=True, color="FFFFFF", size=12)
header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
cell_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

# 列头信息（根据之前的模板）
headers = [
    "客户编号", "客户名称", "联系人", "联系电话", "公司邮箱", 
    "行业分类", "客户等级", "跟进状态", "商机关联金额 (万元)", 
    "预计成交时间", "负责人", "备注", "下次跟进时间"
]

# 写入表头
for col_num, header in enumerate(headers, 1):
    cell = ws1.cell(row=1, column=col_num, value=header)
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = cell_alignment

# 示例数据 - 实际使用时替换为你的真实数据
sample_data = [
    ["CL20260724001", "XX 银行", "张总", "13800138001", "zhang@xxbank.com", 
     "银行", "A 级", "谈判中", 50, "2026-08-15", "张三", 
     "意向强烈，预算充足，重点跟进", "2026-07-28"],
    
    ["CL20260724002", "中国电信分公司", "李经理", "13900139001", "li@chinatelecom.cn",
     "电信", "A 级", "报价中", 35, "2026-09-01", "张三",
     "技术方案已基本确认，等待价格审批", "2026-07-30"],
    
    ["CL20260724003", "XX 保险公司", "王总", "13700137001", "wang@xxinsurance.com",
     "保险", "B 级", "方案演示", 25, "2026-10-15", "李四",
     "刚完成首次方案演示，需补充案例", "2026-07-29"],
    
    ["CL20260724004", "XX 科技公司", "陈总", "13600136001", "chen@techcorp.com",
     "其他", "C 级", "初次接触", 10, "2026-11-30", "张三",
     "首次拜访已预约，准备 PPT", "2026-08-05"],
    
    ["CL20260724005", "YY 商业银行", "赵行长", "13500135001", "zhao@yybank.com",
     "银行", "A 级", "未接触", 80, "2026-12-31", "李四",
     "新开发客户，高层关系打通", "2026-07-27"],
]

# 写入数据行
for row_num, data in enumerate(sample_data, 2):
    for col_num, value in enumerate(data, 1):
        cell = ws1.cell(row=row_num, column=col_num, value=value)
        cell.alignment = cell_alignment

# 自动调整列宽
for column in ws1.columns:
    max_length = 0
    column = [cell for cell in column]
    for cell in column:
        try:
            if len(str(cell.value)) > max_length:
                max_length = len(str(cell.value))
        except:
            pass
    adjusted_width = (max_length + 2) * 1.2
    ws1.column_dimensions[column[0].column_letter].width = adjusted_width

# ============================================
# Sheet 2: 跟进记录表
# ============================================
ws2 = wb.create_sheet("跟进记录表")

headers_record = [
    "记录编号", "关联客户 ID", "跟进方式", "跟进时间", "参会人员",
    "沟通内容摘要", "下一步计划", "下次跟进时间", "附件", "创建时间"
]

# 写入表头
for col_num, header in enumerate(headers_record, 1):
    cell = ws2.cell(row=1, column=col_num, value=header)
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = cell_alignment

# 示例数据
sample_records = [
    ["REC001", "CL20260724001", "拜访", "2026-07-22", "张三、张总、技术经理",
     "了解银行数字化转型需求，客户对 AI 风控方案感兴趣",
     "准备详细方案和报价", "2026-07-28", "无", "2026-07-22 15:30"],
    
    ["REC002", "CL20260724002", "会议", "2026-07-20", "张三、李经理、产品总监",
     "演示产品功能，回答技术问题，确认兼容性",
     "提交正式报价单", "2026-07-30", "meeting_20260720.pdf", "2026-07-20 11:20"],
    
    ["REC003", "CL20260724003", "拜访", "2026-07-19", "李四、王总",
     "首次方案演示，客户关注成本和部署周期",
     "补充同行业案例，优化实施计划", "2026-07-29", "presentation_v2.pptx", "2026-07-19 14:45"],
    
    ["REC004", "CL20260724004", "电话", "2026-07-18", "张三、陈总",
     "初步沟通需求，了解 IT 架构现状",
     "发送公司介绍和案例集", "2026-08-05", "无", "2026-07-18 10:15"],
    
    ["REC005", "CL20260724005", "邮件", "2026-07-15", "李四、赵行长团队",
     "发送合作方案框架，等待反馈",
     "预约首次见面", "2026-07-27", "proposal_draft.docx", "2026-07-15 16:00"],
]

# 写入数据行
for row_num, data in enumerate(sample_records, 2):
    for col_num, value in enumerate(data, 1):
        cell = ws2.cell(row=row_num, column=col_num, value=value)
        cell.alignment = cell_alignment

# 自动调整列宽
for column in ws2.columns:
    max_length = 0
    column = [cell for cell in column]
    for cell in column:
        try:
            if len(str(cell.value)) > max_length:
                max_length = len(str(cell.value))
        except:
            pass
    adjusted_width = (max_length + 2) * 1.2
    ws2.column_dimensions[column[0].column_letter].width = adjusted_width

# 保存文件
output_file = "飞书_CRM_导入模板.xlsx"
wb.save(output_file)
print(f"✅ Excel 文件已生成：{output_file}")
print(f"\n📋 使用说明:")
print(f"1. 打开飞书 App → 创建新的多维表格")
print(f"2. 点击「导入」→ 选择该文件")
print(f"3. 按照字段映射确认后导入")
print(f"4. 检查数据完整性即可开始使用")
