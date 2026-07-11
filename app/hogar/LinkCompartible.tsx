"use client";

import { useState } from "react";

// Bloque "Compartí este link" (09): aparece cuando la invitación se creó
// pero el email no salió (sin RESEND_API_KEY). El link ES la invitación,
// así que se ofrece copiarlo a mano.

export function LinkCompartible({ link }: { link: string }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <div>
      <p className="text-[11.5px] text-tinta-secundaria">Compartí este link:</p>
      <p className="cifra mt-1.5 rounded-[10px] border border-borde bg-papel p-[10px] text-[11px] break-all text-tinta">
        {link}
      </p>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(link);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        }}
        aria-label="Copiar el link de invitación"
        className="hit-44 mt-2 text-[12.5px] font-medium text-verde"
      >
        {copiado ? "Copiado ✓" : "Copiar link"}
      </button>
    </div>
  );
}
