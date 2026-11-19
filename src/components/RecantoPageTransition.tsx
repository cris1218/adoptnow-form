"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

export function RecantoPageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="recanto-page-enter">
      {children}
    </div>
  );
}
