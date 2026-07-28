import { borrarCuenta } from "@/lib/datos/borrar-cuenta";
import { crearClienteConToken } from "@/lib/supabase/portador";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// DELETE /api/cuenta — borrado de cuenta desde la app nativa.
// La web usa el server action `borrarMiCuenta`; acá la lógica es la misma, solo
// cambia de dónde sale la identidad (bearer en vez de cookies).

export async function DELETE(request: Request) {
  const autorizacion = request.headers.get("authorization");
  const token = autorizacion?.startsWith("Bearer ")
    ? autorizacion.slice(7).trim()
    : null;

  const supabase = token ? crearClienteConToken(token) : await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("No autorizado", { status: 401 });

  const resultado = await borrarCuenta(user.id, supabase);
  if (!resultado.ok) return new Response(resultado.error, { status: 500 });

  return new Response(null, { status: 204 });
}
