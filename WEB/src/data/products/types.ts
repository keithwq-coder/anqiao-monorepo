import type { L } from "@/data/locale";

export type ProductImage = {
  src: string;
  /** 随语言变化。 */
  alt: L<string>;
  width: number;
  height: number;
};

export type Product = {
  slug: string;
  /** 型号。产品无型号资料时用 PENDING（由调用方处理）。 */
  model: string | null;
  /** 展示名，随语言变化。 */
  name: L<string>;
  /** 正式名称。仅当企业资料无正式名称时才出现。 */
  officialName?: L<string>;
  /** 一句话定位，随语言变化。 */
  tagline: L<string>;
  /** 核心卖点，随语言变化。 */
  features: L<string[]>;
  /** 适用场景标签，随语言变化。 */
  scenes: L<string[]>;
  /** 技术参数短文，随语言变化；无精确参数表为 null。 */
  spec: L<string | null>;
  /** 适用客户，随语言变化；无定性描述为 null。 */
  customers: L<string | null>;
  /** 质保表述，随语言变化。 */
  warranty: L<string>;
  /** 图片（src/尺寸不随语言变，alt 随语言变）。 */
  images: ProductImage[];
  /** 房间级部署点位（不随语言变）。 */
  deployment?: string[];
  /** 互补产品 slug，驱动相关产品 Tab。 */
  relatedSlugs?: string[];
  /** 云平台中枢标记（安守护）。 */
  isPlatform?: boolean;
  /** 结构化参数分组（探测/通信/安装/电源 等），文本随语言变。 */
  specGroups?: {
    groupName: L<string>;
    items: { label: L<string>; value: L<string> }[];
  }[];
  /** 产品视频，title 随语言变。 */
  videos?: {
    title: L<string>;
    url: string;
    type: "intro" | "installation" | "scenario";
  }[];
  /** 可下载文档，title 随语言变。 */
  documents?: {
    title: L<string>;
    url: string;
    type: "manual" | "brochure" | "certificate";
    size?: string;
  }[];
  /** 常见问题，随语言变。 */
  faqs?: { question: L<string>; answer: L<string> }[];
};

/** 本地化后的扁平产品（组件直接访问字符串字段）。 */
export type LocalizedProduct = Omit<
  Product,
  | "name"
  | "officialName"
  | "tagline"
  | "features"
  | "scenes"
  | "spec"
  | "customers"
  | "warranty"
  | "images"
  | "specGroups"
  | "videos"
  | "documents"
  | "faqs"
> & {
  model: string | null;
  name: string;
  officialName?: string;
  tagline: string;
  features: string[];
  scenes: string[];
  spec: string | null;
  customers: string | null;
  warranty: string;
  images: { src: string; alt: string; width: number; height: number }[];
  specGroups?: {
    groupName: string;
    items: { label: string; value: string }[];
  }[];
  videos?: {
    title: string;
    url: string;
    type: "intro" | "installation" | "scenario";
  }[];
  documents?: {
    title: string;
    url: string;
    type: "manual" | "brochure" | "certificate";
    size?: string;
  }[];
  faqs?: { question: string; answer: string }[];
};

/** 卡片主图优先级：three-view > main > screen。 */
export function primaryImage(
  product: Pick<LocalizedProduct, "images">,
): LocalizedProduct["images"][number] | undefined {
  const order = ["three-view", "main", "screen"];
  for (const key of order) {
    const hit = product.images.find((img) => img.src.includes(`/${key}.webp`));
    if (hit) return hit;
  }
  return product.images[0];
}
