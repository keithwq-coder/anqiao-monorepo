#!/usr/bin/env bash
# 素材管线：源图 → WebP（< 300KB），文件名 ASCII。映射照抄 SPEC §6.1.1。
# 依赖 ffmpeg（本机已确认 8.1）。ImageMagick 未安装，不要用 magick/convert。
set -euo pipefail

SRC_ROOT="C:/Users/K/Documents/安樵/图集"
PROD_SRC="$SRC_ROOT/产品照片"
BRAND_SRC="$SRC_ROOT/品牌照片"
OUT_PROD="public/images/products"
OUT_BRAND="public/images/brand"

# slug|源文件（相对 产品照片/）|目标文件名
PRODUCT_MAP=(
  "zq-sh100|ZQSH100 AI健康守护仪/ZQSH100 AI健康守护仪 三视图.png|three-view.webp"
  "zq-sh100|ZQSH100 AI健康守护仪/ZQSH100 AI健康守护仪 场景图.png|scene.webp"
  "zq-d100|ZQD100 跌倒监测仪/ZQD100 跌倒监测仪 三视图.png|three-view.webp"
  "za100|ZA100 健康筛查一体机/ZA100 健康通道一体机 三视图.png|three-view.webp"
  "za100|ZA100 健康筛查一体机/ZA100 健康通道一体机 场景图.png|scene.webp"
  "zq50|ZQ50 健康快速通道一体机/ZQ50 健康快速通道 三视图.png|three-view.webp"
  "zq50|ZQ50 健康快速通道一体机/ZQ50 健康快速通道 场景图.png|scene.webp"
  "zq-bh100|ZQ-BH100 床下健康监测仪/ZQ-BH100 床下健康监测仪 三视图.png|three-view.webp"
  "zq-gj100|ZQ-GJ100 人体轨迹监测仪/人体轨迹仪 三视图.png|three-view.webp"
  "zq-zh100|ZQ-ZH100 照护采集仪/照护采集终端 三视图.png|three-view.webp"
  "zqkfc100|ZQKFC100 健康守护康复智能床/ZQKFC100 健康守护康复智能床.png|main.webp"
  "zq-w100|ZQ-W100 白细胞检测仪/白细胞检测仪 三视图.png|three-view.webp"
  "zq-w100|ZQ-W100 白细胞检测仪/白细胞检测仪 使用示意图.png|usage.webp"
  "zq-w100|ZQ-W100 白细胞检测仪/白细胞检测仪 打开示意图.png|open.webp"
  "smart-switch|智能开关/智能开关 三视图.png|three-view.webp"
  "platform|系统/系统展示大屏.png|screen.webp"
  "platform|系统/系统展示效果图.png|preview.webp"
)

# 目标文件名|源文件（相对 品牌照片/）
BRAND_MAP=(
  "logo-blue.webp|logo 透明底蓝字.png"
  "qr.webp|公众号二维码.jpg"
)

MAX_BYTES=$((300 * 1024))
fail=0

convert_one() {
  local src="$1" out="$2" scale="$3"
  if [ ! -f "$src" ]; then
    echo "MISSING SOURCE: $src"
    fail=1
    return
  fi
  mkdir -p "$(dirname "$out")"
  if [ "$scale" = "yes" ]; then
    ffmpeg -y -v error -i "$src" -vf "scale='min(1600,iw)':-2" \
      -c:v libwebp -quality 82 -compression_level 6 "$out"
  else
    ffmpeg -y -v error -i "$src" \
      -c:v libwebp -quality 82 -compression_level 6 "$out"
  fi
  local bytes dim
  bytes=$(stat -c%s "$out")
  dim=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$out")
  printf "%-46s %-12s %6dKB\n" "$out" "$dim" "$((bytes / 1024))"
  if [ "$bytes" -ge "$MAX_BYTES" ]; then
    echo "OVER 300KB: $out"
    fail=1
  fi
}

for row in "${PRODUCT_MAP[@]}"; do
  slug="${row%%|*}"
  rest="${row#*|}"
  rel="${rest%%|*}"
  name="${rest##*|}"
  convert_one "$PROD_SRC/$rel" "$OUT_PROD/$slug/$name" yes
done

for row in "${BRAND_MAP[@]}"; do
  name="${row%%|*}"
  rel="${row##*|}"
  convert_one "$BRAND_SRC/$rel" "$OUT_BRAND/$name" no
done

if [ "$fail" -ne 0 ]; then
  echo "ASSET PIPELINE FAILED"
  exit 1
fi
echo "ASSET PIPELINE OK"
