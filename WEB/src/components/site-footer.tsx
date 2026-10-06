import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Pending } from "@/components/pending";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  return (
    <footer className="border-t border-border bg-paper text-text">
      <div className="container-page grid gap-12 py-16 md:grid-cols-3">
        {/* 企业定位与资质 */}
        <div>
          <p className="text-sm font-semibold text-primary-dark">
            {t("positioning")}
          </p>
          <div className="mt-4">
            <Image
              src="/images/brand/logo-blue.webp"
              alt="中科安樵（苏州）科技有限公司"
              width={1179}
              height={322}
              className="h-8 w-auto"
            />
          </div>
          <p className="mt-4 text-sm font-semibold text-text">中科安樵（苏州）科技有限公司</p>
          <p className="mt-1.5 text-sm text-text-light leading-relaxed">
            苏州市石湖金陵广场商务楼 18 楼
          </p>
          <p className="mt-1 text-xs text-text-muted">{t("lineage")}</p>
        </div>

        {/* 官方联络 */}
        <div>
          <h2 className="text-xs font-bold text-text-muted">{t("contact")}</h2>
          <dl className="mt-4 space-y-3.5">
            <div>
              <dt className="text-xs font-medium text-text-muted">{t("phone")}</dt>
              <dd className="mt-0.5">
                <a
                  href="tel:13405084570"
                  className="text-base font-bold text-text hover:text-primary-dark transition-colors"
                >
                  13405084570
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-text-muted">{t("email")}</dt>
              <dd className="mt-0.5">
                <a
                  href="mailto:13405084570@139.com"
                  className="text-sm font-semibold text-text hover:text-primary-dark transition-colors"
                >
                  13405084570@139.com
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-text-muted">{t("partnerLogin")}</dt>
              <dd className="mt-0.5">
                <a
                  href="https://anqiao.aibrain.wiki/saas/"
                  className="text-sm font-semibold text-primary-dark underline decoration-primary-dark/40 underline-offset-4 transition-colors hover:decoration-primary-dark inline-flex items-center gap-1"
                >
                  {t("partnerLoginLink")} <span aria-hidden="true">→</span>
                </a>
              </dd>
            </div>
          </dl>
        </div>

        {/* 官方公众平台 */}
        <div>
          <h2 className="text-xs font-bold text-text-muted">{t("follow")}</h2>
          <div className="mt-4 inline-block border border-border bg-white p-3">
            <Image
              src="/images/brand/qr.webp"
              alt="中科安樵微信公众号二维码"
              width={422}
              height={423}
              className="h-28 w-28 object-contain"
            />
          </div>
          <p className="mt-2 text-xs text-text-muted">{t("followNote")}</p>
        </div>
      </div>

      <div className="border-t border-border bg-bg-warm">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-text-light sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 中科安樵（苏州）科技有限公司 · 保留所有权利</p>
          <div className="flex items-center gap-2">
            <span>{t("icp")}</span>
            <Pending label={t("icp")} />
          </div>
        </div>
      </div>
    </footer>
  );
}
