"use client";

import { useEffect } from "react";

export function RegistroSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Sin SW no hay instalación PWA, pero la app funciona igual.
      });
    }
  }, []);

  return null;
}
