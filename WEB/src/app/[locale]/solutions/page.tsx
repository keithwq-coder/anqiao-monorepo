import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CtaLink } from "@/components/cta";
import { Pending } from "@/components/pending";
import { Link } from "@/i18n/navigation";
import { localizeSolution, solutions } from "@/data/solutions";
import { groupSolutions } from "@/data/solution-groups";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "solutionsPage" });
  return { title: t("title"), description: t("lead") };
}

export default async function SolutionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("solutionsPage");
  const loc = locale as "zh" | "en" | "fr" | "es" | "ja" | "ru";
  const localized = solutions.map((item) => localizeSolution(item, loc));
  const grouped = groupSolutions(solutions);
  // 保持本地化顺序与 groupSolutions 对齐
  const localizedByAnchor = new Map(localized.map((s) => [s.anchor, s]));

  return (
    <>
      <section className="bg-primary-light py-14">
        <div className="container-page">
          <h1 className="text-3xl font-semibold text-text">{t("title")}</h1>
          <p className="mt-4 text-text-light">{t("lead")}</p>
          <nav aria-label={t("navAria")} className="mt-8">
            <div className="space-y-4">
              {grouped.map(({ group, items }) => (
                <div key={group.id}>
                  <p className="text-sm font-semibold text-text">
                    {group.name[loc]}
                  </p>
                  <ul className="flex flex-wrap gap-3">
                    {items.map((item) => {
                      const s = localizedByAnchor.get(item.anchor);
                      if (!s) return null;
                      return (
                        <li key={s.anchor}>
                          <Link
                            href={`/solutions/${s.anchor}`}
                            className="focus-ring inline-block rounded-md border border-primary bg-white px-4 py-2 text-primary hover:bg-primary-light"
                          >
                            {s.name}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </nav>
        </div>
      </section>

      {grouped.map(({ group, items }, gi) => (
        <section
          key={group.id}
          className={`scroll-mt-20 py-16 ${gi % 2 === 0 ? "bg-bg" : "bg-bg-warm"}`}
        >
          <div className="container-page">
            <h2 className="text-3xl font-semibold text-text">
              {group.name[loc]}
            </h2>
            <p className="mt-2 text-sm text-text-muted">
              {items.length} {t("scenarios")}
            </p>

            <div className="mt-10 space-y-16">
              {items.map((item, index) => {
                const s = localizedByAnchor.get(item.anchor);
                if (!s) return null;
                return (
                  <article key={s.anchor} id={s.anchor}>
                    <h3 className="text-2xl font-semibold text-text">
                      <Link
                        href={`/solutions/${s.anchor}`}
                        className="focus-ring rounded-md text-text hover:text-primary"
                      >
                        {s.name}
                      </Link>
                    </h3>
                    <p className="mt-2 text-sm text-text-muted">
                      {t("buyer")}：{s.buyer}
                    </p>

                    <h4 className="mt-8 text-lg font-semibold text-text">
                      {t("painPoints")}
                    </h4>
                    <ul className="mt-3 space-y-2">
                      {s.painPoints.map((point) => (
                        <li key={point} className="flex gap-2 text-text-light">
                          <span aria-hidden="true" className="text-primary">
                            ·
                          </span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>

                    <h4 className="mt-8 text-lg font-semibold text-text">
                      {t("devices")}
                    </h4>
                    <div className="mt-3">
                      {s.devices === null ? (
                        <Pending label={`${s.name} 推荐设备组合`} />
                      ) : (
                        <p className="text-text-light">{s.devices}</p>
                      )}
                    </div>

                    <h4 className="mt-8 text-lg font-semibold text-text">
                      {t("value")}
                    </h4>
                    <div className="mt-3">
                      {s.value === null ? (
                        <Pending label={`${s.name} 交付价值`} />
                      ) : (
                        <p className="text-text-light">{s.value}</p>
                      )}
                    </div>

                    <div className="mt-8 flex flex-wrap gap-4">
                      <CtaLink href="/contact">{t("quote")}</CtaLink>
                      <Link
                        href={`/solutions/${s.anchor}`}
                        className="focus-ring inline-flex items-center rounded-md border border-primary bg-white px-6 py-3 text-base font-medium text-primary hover:bg-primary-light"
                      >
                        {t("viewDetail")} →
                      </Link>
                    </div>

                    <div className="mt-8 border-t border-border" />
                    {index === items.length - 1 ? null : null}
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
