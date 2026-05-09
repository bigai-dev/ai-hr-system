'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

type MobileNavValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
};

const MobileNavContext = createContext<MobileNavValue | null>(null);

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while drawer is open on mobile.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <MobileNavContext.Provider value={{ open, setOpen, toggle }}>
      {children}
    </MobileNavContext.Provider>
  );
}

export function useMobileNav(): MobileNavValue {
  const ctx = useContext(MobileNavContext);
  if (!ctx) {
    // Outside the provider (e.g. public /apply pages) — return a no-op so
    // TopBar can still render without crashing.
    return { open: false, setOpen: () => {}, toggle: () => {} };
  }
  return ctx;
}
