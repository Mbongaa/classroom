'use client';

import { useEffect } from 'react';

/**
 * Backstop for browsers that don't support CSS `:has()` (Android Chrome < 105).
 * Modern browsers already get the marketing palette via the `:has([data-mkt-root])`
 * selector in globals.css; the SSR-applied `mkt-active` class on `<html>` covers
 * initial loads. This effect handles client-side navigation from `/dashboard`
 * back to `/` on legacy browsers.
 */
export function MarketingActiveClass() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('mkt-active');
    return () => {
      root.classList.remove('mkt-active');
    };
  }, []);
  return null;
}
