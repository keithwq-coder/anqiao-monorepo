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
    <header className="sticky top-0 z-50 border-b border-border/70 bg-white/90 backdrop-blur-md shadow-[0_2px_10px_rgba(44,62,58,0.03)] transition-all">
      <div className="container-page flex h-[74px] items-center justify-between gap-6">
        <Link href="/" className="focus-ring flex items-center gap-3 py-1 transition-opacity hover:opacity-90">
          <Image
            src="/images/brand/logo-blue.webp"
            alt="中科安樵（苏州）科技有限公司"
            width={1179}
            height={322}
            className="h-8.5 w-auto"
            priority
          />
        </Link>

        <nav aria-label="主导航" className="hidden lg:block">
          <ul className="flex items-center gap-7 xl:gap-9">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="focus-ring relative py-2 text-[15px] font-medium text-text transition-colors hover:text-primary tracking-wide"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <LocaleSwitcher />
          <CtaLink href="/contact" className="text-sm">
            {th("quote")}
          </CtaLink>
        </div>

        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
          className="focus-ring rounded-[8px] border border-border bg-white px-3.5 py-2 text-sm font-medium text-text shadow-2xs hover:bg-bg-warm lg:hidden"
        >
          {open ? th("closeMenu") : th("openMenu")}
        </button>
      </div>

      {open ? (
        <nav
          id="mobile-nav"
          aria-label="移动端主导航"
          className="border-t border-border/80 bg-white/98 backdrop-blur-xl lg:hidden shadow-xl"
        >
          <ul className="container-page flex flex-col py-5 space-y-1.5">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="focus-ring block rounded-[8px] px-3.5 py-3 text-base font-medium text-text hover:bg-primary-light hover:text-primary transition-colors"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="pt-4 border-t border-border/60">
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
