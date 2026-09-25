# -*- coding: utf-8 -*-
"""
公共工具模块
中科安樵 - 养老行业数据采集
"""

import os
import re
import time
import random
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Optional

import pandas as pd
from openpyxl import load_workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side

import config


def random_delay(min_sec: float = None, max_sec: float = None):
    """随机延迟，模拟人类行为"""
    min_sec = min_sec or config.REQUEST_DELAY_MIN
    max_sec = max_sec or config.REQUEST_DELAY_MAX
    delay = random.uniform(min_sec, max_sec)
    time.sleep(delay)


async def async_random_delay(min_sec: float = None, max_sec: float = None):
    """异步随机延迟"""
    min_sec = min_sec or config.REQUEST_DELAY_MIN
    max_sec = max_sec or config.REQUEST_DELAY_MAX
    delay = random.uniform(min_sec, max_sec)
    await asyncio.sleep(delay)


def extract_phone(text: str) -> Optional[str]:
    """从文本中提取电话号码"""
    if not text:
        return None
    
    # 匹配手机号
    mobile_pattern = r'1[3-9]\d{9}'
    # 匹配座机号（区号-号码 或 区号号码）
    landline_pattern = r'(?:0\d{2,3}[-\s]?)?\d{7,8}'
    # 匹配 400 电话
    phone_400_pattern = r'400[-\s]?\d{3,4}[-\s]?\d{3,4}'
    
    phones = []
    
    # 先找 400 电话
    for match in re.finditer(phone_400_pattern, text):
        phones.append(match.group().replace('-', '').replace(' ', ''))
    
    # 再找手机号
    for match in re.finditer(mobile_pattern, text):
        phones.append(match.group())
    
    # 最后找座机
    for match in re.finditer(landline_pattern, text):
        phone = match.group().replace('-', '').replace(' ', '')
        if len(phone) >= 7:  # 过滤太短的匹配
            phones.append(phone)
    
    # 去重并返回第一个
    if phones:
        return phones[0]
    return None


def extract_all_phones(text: str) -> List[str]:
    """从文本中提取所有电话号码"""
    if not text:
        return []
    
    patterns = [
        r'400[-\s]?\d{3,4}[-\s]?\d{3,4}',
        r'1[3-9]\d{9}',
        r'0\d{2,3}[-\s]?\d{7,8}',
    ]
    
    phones = []
    for pattern in patterns:
        for match in re.finditer(pattern, text):
            phone = match.group().replace('-', '').replace(' ', '')
            if phone not in phones:
                phones.append(phone)
    
    return phones


def classify_institution(name: str) -> str:
    """根据机构名称分类机构类型"""
    for inst_type, keywords in config.INSTITUTION_TYPE_KEYWORDS.items():
        for keyword in keywords:
            if keyword in name:
                return inst_type
    return "其他养老相关"


def is_within_valid_days(date_str: str, valid_days: int = None) -> bool:
    """检查日期是否在有效范围内"""
    valid_days = valid_days or config.BIDDING_VALID_DAYS
    
    if not date_str:
        return False
    
    # 尝试多种日期格式
    date_formats = [
        "%Y-%m-%d",
        "%Y年%m月%d日",
        "%Y.%m.%d",
        "%Y/%m/%d",
    ]
    
    for fmt in date_formats:
        try:
            pub_date = datetime.strptime(date_str.strip(), fmt)
            cutoff_date = datetime.now() - timedelta(days=valid_days)
            return pub_date >= cutoff_date
        except ValueError:
            continue
    
    return False


def parse_date(date_str: str) -> Optional[str]:
    """解析日期字符串，统一格式为 YYYY-MM-DD"""
    if not date_str:
        return None
    
    date_formats = [
        "%Y-%m-%d",
        "%Y年%m月%d日",
        "%Y.%m.%d",
        "%Y/%m/%d",
    ]
    
    for fmt in date_formats:
        try:
            pub_date = datetime.strptime(date_str.strip(), fmt)
            return pub_date.strftime("%Y-%m-%d")
        except ValueError:
            continue
    
    return date_str.strip()


def deduplicate_by_name(data: List[Dict], name_field: str = "机构名称") -> List[Dict]:
    """按名称去重"""
    seen = set()
    result = []
    
    for item in data:
        name = item.get(name_field, "").strip()
        if name and name not in seen:
            seen.add(name)
            result.append(item)
    
    return result


def export_to_excel(
    data: List[Dict],
    filename: str,
    sheet_name: str = "Sheet1",
    title: str = None
):
    """
    导出数据到 Excel，带格式化样式
    """
    if not data:
        print(f"警告：{filename} 无数据可导出")
        return None
    
    # 确保输出目录存在
    os.makedirs(config.OUTPUT_DIR, exist_ok=True)
    filepath = os.path.join(config.OUTPUT_DIR, filename)
    
    # 创建 DataFrame
    df = pd.DataFrame(data)
    
    # 先导出基础数据
    df.to_excel(filepath, index=False, sheet_name=sheet_name)
    
    # 加载并美化
    wb = load_workbook(filepath)
    ws = wb[sheet_name]
    
    # 定义样式
    header_font = Font(name="微软雅黑", bold=True, size=11, color="FFFFFF")
    header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    
    cell_font = Font(name="微软雅黑", size=10)
    cell_alignment = Alignment(vertical="center", wrap_text=True)
    
    thin_border = Border(
        left=Side(style="thin", color="D9D9D9"),
        right=Side(style="thin", color="D9D9D9"),
        top=Side(style="thin", color="D9D9D9"),
        bottom=Side(style="thin", color="D9D9D9"),
    )
    
    # 设置表头样式
    for cell in ws[1]:
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
        cell.border = thin_border
    
    # 设置数据行样式
    for row in ws.iter_rows(min_row=2, max_row=ws.max_row):
        for cell in row:
            cell.font = cell_font
            cell.alignment = cell_alignment
            cell.border = thin_border
    
    # 自动调整列宽
    for column in ws.columns:
        max_length = 0
        column_letter = column[0].column_letter
        for cell in column:
            try:
                if cell.value:
                    # 中文字符按 2 个宽度计算
                    cell_len = sum(2 if ord(c) > 127 else 1 for c in str(cell.value))
                    max_length = max(max_length, cell_len)
            except:
                pass
        adjusted_width = min(max_length + 4, 50)  # 最大宽度 50
        ws.column_dimensions[column_letter].width = adjusted_width
    
    # 冻结首行
    ws.freeze_panes = "A2"
    
    wb.save(filepath)
    print(f"已导出：{filepath}（共 {len(data)} 条记录）")
    return filepath


def print_progress(current: int, total: int, message: str = ""):
    """打印进度"""
    percent = (current / total * 100) if total > 0 else 0
    bar_length = 30
    filled = int(bar_length * current / total) if total > 0 else 0
    bar = "█" * filled + "░" * (bar_length - filled)
    print(f"\r[{bar}] {percent:.1f}% ({current}/{total}) {message}", end="", flush=True)
    if current >= total:
        print()  # 完成后换行


def clean_text(text: str) -> str:
    """清理文本，去除多余空白"""
    if not text:
        return ""
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def merge_records(existing: List[Dict], new_data: List[Dict], key_field: str) -> List[Dict]:
    """合并记录，新数据补充缺失字段"""
    existing_map = {item.get(key_field, ""): item for item in existing}
    
    for new_item in new_data:
        key = new_item.get(key_field, "")
        if key in existing_map:
            # 补充缺失字段
            for field, value in new_item.items():
                if not existing_map[key].get(field) and value:
                    existing_map[key][field] = value
        else:
            existing.append(new_item)
            existing_map[key] = new_item
    
    return existing
