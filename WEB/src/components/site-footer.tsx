import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { localizeCompany } from "@/data/company";
import { Pending } from "@/components/pending";
import { isPending } from "@/data/pending";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const locale = await getLocale();
  const showMachineTranslated = locale !== "zh";
  const c = localizeCompany(locale as "zh" | "en" | "fr" | "es" | "ja" | "ru");

  return (
    <footer className="border-t border-border bg-bg-warm">
      <div className="container-page grid gap-10 py-12 md:grid-cols-3">
        <div>
          <p className="text-sm font-medium text-primary">
            {t("positioning")}
          </p>
          <Image
            src="/images/brand/logo-blue.webp"
            alt="中科安樵（苏州）科技有限公司"
            width={1179}
            height={322}
            className="mt-3 h-8 w-auto"
          />
          <p className="mt-4 font-medium text-text">{c.fullName}</p>
          <p className="mt-1 text-text-light">{c.address}</p>
        </div>

        <div>
          <h2 className="font-semibold text-text">{t("contact")}</h2>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="text-sm text-text-light">{t("phone")}</dt>
              <dd className="mt-1">
                {isPending(c.phone) ? (
                  <Pending label={t("phone")} />
                ) : (
                  c.phone
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-text-light">{t("email")}</dt>
              <dd className="mt-1">
                {isPending(c.email) ? (
                  <Pending label={t("email")} />
                ) : (
                  c.email
                )}
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <h2 className="font-semibold text-text">{t("follow")}</h2>
          <Image
            src="/images/brand/qr.webp"
            alt="中科安樵微信公众号二维码"
            width={422}
            height={423}
            className="mt-4 h-32 w-32 rounded-md border border-border"
          />
        </div>
      </div>

      <div className="border-t border-border">
        <div className="container-page flex flex-col gap-2 py-5 text-sm text-text-light sm:flex-row sm:items-center sm:justify-between">
          <p>{c.copyright}</p>
          <div className="flex items-center gap-2">
            <span>{t("icp")}</span>
            {isPending(c.icp) ? (
              <Pending label={t("icp")} />
            ) : (
              <span>{c.icp}</span>
            )}
          </div>
        </div>
        {showMachineTranslated ? (
          <p className="container-page pb-4 text-xs text-text-muted">
            {t("machineTranslated")}
          </p>
        ) : null}
      </div>
    </footer>
  );
}
