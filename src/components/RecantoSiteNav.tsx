"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Início" },
  { href: "/gatinhos", label: "Gatinhos" },
  { href: "/campanhas", label: "Campanhas" },
] as const;

export function RecantoSiteNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Principal" className="flex items-center gap-5 sm:gap-6">
      {LINKS.map((link) => {
        const active =
          link.href === "/"
            ? pathname === "/"
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`relative pb-1 text-sm font-semibold transition-colors duration-200 sm:text-[0.95rem] ${
              active ? "text-brand-dark" : "text-stone-600 hover:text-stone-900"
            }`}
          >
            {link.label}
            <span
              aria-hidden="true"
              className={`absolute inset-x-0 -bottom-0.5 h-0.5 origin-left rounded-full bg-brand-dark transition-transform duration-300 ease-out ${
                active ? "scale-x-100" : "scale-x-0"
              }`}
            />
          </Link>
        );
      })}
    </nav>
  );
}
