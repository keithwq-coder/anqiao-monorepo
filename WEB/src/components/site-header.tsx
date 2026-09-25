"use client";

import Image from "next/image";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CtaLink } from "@/components/cta";
import { LocaleSwitcher } from "@/components/locale-switcher";

export function SiteHeader() {
  const tn = useTranslations("nav");
  const th = useTranslations("header");
  const [open, setOpen] = useState(false);

  const NAV_ITEMS = [
    { href: "/products", label: tn("products") },
    { href: "/solutions", label: tn("solutions") },
    { href: "/dealers", label: tn("dealers") },
    { href: "/about", label: tn("about") },
    { href: "/news", label: tn("news") },
    { href: "/contact", label: tn("contact") },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="focus-ring flex items-center rounded-md">
          <Image
            src="/images/brand/logo-blue.webp"
            alt="中科安樵（苏州）科技有限公司"
            width={1179}
            height={322}
            className="h-8 w-auto"
            priority
          />
        </Link>

        <nav aria-label="主导航" className="hidden lg:block">
          <ul className="flex items-center gap-7">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="focus-ring rounded-md text-text-light hover:text-primary"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <LocaleSwitcher />
          <CtaLink href="/contact" className="px-5 py-2 text-sm">
            {th("quote")}
          </CtaLink>
        </div>

        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
          className="focus-ring rounded-md border border-border px-3 py-2 text-sm text-text lg:hidden"
        >
          {open ? th("closeMenu") : th("openMenu")}
        </button>
      </div>

      {open ? (
        <nav
          id="mobile-nav"
          aria-label="移动端主导航"
          className="border-t border-border bg-bg lg:hidden"
        >
          <ul className="container-page flex flex-col py-3">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="focus-ring block rounded-md py-2 text-text-light hover:text-primary"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="pt-3">
              <LocaleSwitcher />
            </li>
            <li className="pt-3">
              <CtaLink href="/contact" className="w-full">
                {th("quote")}
              </CtaLink>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
