"""模板 & 静态文件路径配置"""

from pathlib import Path

from jinja2 import Environment, FileSystemLoader

TEMPLATE_DIR = Path(__file__).parent / "templates"
env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)), autoescape=True)


def render_template(name: str, **context) -> str:
    """渲染模板并返回 HTML 字符串"""
    template = env.get_template(name)
    return template.render(**context)
