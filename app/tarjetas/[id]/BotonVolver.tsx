"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

// Back del header de detalle (§3.17.3): chevron-left 20px tinta.

export function BotonVolver() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Volver"
      className="hit-44 text-tinta"
    >
      <ChevronLeft className="size-5" strokeWidth={1.5} aria-hidden />
    </button>
  );
}
