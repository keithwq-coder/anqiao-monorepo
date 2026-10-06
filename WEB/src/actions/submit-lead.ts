"use server";

import { headers } from "next/headers";
import {
  CUSTOMER_TYPES,
  INQUIRY_TYPES,
  LIMITS,
  type LeadFormState,
} from "@/lib/lead";
import { checkRateLimit } from "@/lib/rate-limit";
import { appendLead } from "@/lib/lead-store";

/**
 * 生产必须把线索写入基座 POST /v1/public/leads。
 * 本机未起 console 时才允许落到 data/leads.jsonl，禁止生产静默回退。
 */
function consoleApiBase(): string {
  return (process.env.CONSOLE_API_BASE ?? "").replace(/\/$/, "");
}

/** 电话允许数字、空格、加号、减号、括号。 */
const PHONE_RE = /^[0-9+\-()\s]{5,20}$/;

function field(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** 从请求头解析客户端 IP（限速与验证码校验用）。 */
function getClientIp(requestHeaders: Headers): string {
  const xff = requestHeaders.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return requestHeaders.get("x-real-ip") ?? "unknown";
}

export async function submitLead(
  _prev: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const requestHeaders = await headers();
  const ip = getClientIp(requestHeaders);

  const rate = await checkRateLimit(ip);
  if (!rate.ok) {
    return {
      ok: false,
      message: `提交过于频繁，请 ${rate.retryAfter} 秒后重试。`,
      errors: {},
    };
  }

  const type = field(formData, "type") === "dealer" ? "dealer" : "inquiry";
  const name = field(formData, "name");
  const phone = field(formData, "phone");
  const organization = field(formData, "organization");
  const inquiryType = field(formData, "inquiryType");
  const customerType = field(formData, "customerType");
  const product = field(formData, "product");
  const message = field(formData, "message");

  const errors: Record<string, string> = {};

  if (!name) errors.name = "请填写姓名";
  else if (name.length > LIMITS.name)
    errors.name = `姓名不能超过 ${LIMITS.name} 个字符`;

  if (!phone) errors.phone = "请填写联系电话";
  else if (phone.length > LIMITS.phone)
    errors.phone = `联系电话不能超过 ${LIMITS.phone} 个字符`;
  else if (!PHONE_RE.test(phone)) errors.phone = "联系电话格式不正确";

  if (!organization) errors.organization = "请填写机构/公司名称";
  else if (organization.length > LIMITS.organization)
    errors.organization = `机构/公司名称不能超过 ${LIMITS.organization} 个字符`;

  if (!inquiryType) errors.inquiryType = "请选择咨询类型";
  else if (!(INQUIRY_TYPES as readonly string[]).includes(inquiryType))
    errors.inquiryType = "咨询类型不在可选范围内";

  if (customerType && !(CUSTOMER_TYPES as readonly string[]).includes(customerType))
    errors.customerType = "客户类型不在可选范围内";

  if (product.length > LIMITS.product)
    errors.product = `意向产品不能超过 ${LIMITS.product} 个字符`;

  if (message.length > LIMITS.message)
    errors.message = `需求说明不能超过 ${LIMITS.message} 个字符`;

  if (Object.keys(errors).length > 0) {
    return { ok: false, message: "请检查表单填写", errors };
  }

  const source = requestHeaders.get("referer") ?? "unknown";
  const payload = {
    type,
    name,
    phone,
    organization,
    inquiry_type: inquiryType,
    inquiryType,
    customer_type: customerType || null,
    customerType: customerType || null,
    product: product || null,
    message: message || null,
    source,
    ip,
  };

  const apiBase = consoleApiBase();
  if (apiBase) {
    try {
      const res = await fetch(`${apiBase}/v1/public/leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": ip,
          "X-Real-IP": ip,
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as {
        code?: number;
        msg?: string;
      };
      if (!res.ok || body.code !== 200) {
        return {
          ok: false,
          message: body.msg || "提交失败，请稍后重试。",
          errors: {},
        };
      }
      return { ok: true, message: "提交成功，我们会尽快与您联系。", errors: {} };
    } catch {
      return {
        ok: false,
        message: "提交失败，请稍后重试。",
        errors: {},
      };
    }
  }

  if (process.env.NODE_ENV === "production") {
    return {
      ok: false,
      message: "线索通道未配置，请稍后重试。",
      errors: {},
    };
  }

  try {
    await appendLead(payload);
  } catch {
    return {
      ok: false,
      message: "提交失败，请稍后重试。",
      errors: {},
    };
  }

  return { ok: true, message: "提交成功，我们会尽快与您联系。", errors: {} };
}
