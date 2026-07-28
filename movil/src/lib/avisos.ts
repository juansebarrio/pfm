import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { hoyBA } from "@dominio/fechas";
import { listarMedios, type SesionHogar } from "@/lib/datos";
import { supabase } from "@/lib/supabase";

// Avisos locales de cierre y vencimiento de tarjeta. Son LOCALES a propósito:
// las fechas ya están en la base, así que no hace falta un servidor mandando
// push — el teléfono se las programa solo. Menos infraestructura y menos datos
// saliendo del dispositivo.
//
// Estrategia: se borra todo y se reprograma en cada apertura. Es idempotente y
// evita el problema real (avisos viejos de un ciclo que ya se concilió o de una
// tarjeta que se dio de baja).

/** Cuántos días antes avisar. */
const DIAS_ANTES = 1;
/** 10 de la mañana de Buenos Aires: temprano para hacer algo, no de madrugada. */
const HORA_AVISO = 10;
/** Tope defensivo: iOS descarta lo que pase de 64 notificaciones pendientes. */
const MAX_AVISOS = 32;

const CLAVE_PERMISO = "fdm.avisos";

/** Se llama una vez al cargar la app, antes de renderizar. */
export function engancharNotificaciones() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function avisosActivos(): Promise<boolean> {
  return (await AsyncStorage.getItem(CLAVE_PERMISO)) === "1";
}

/** Prende los avisos: pide permiso al sistema y deja la preferencia guardada. */
export async function activarAvisos(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  const ok = status === "granted";
  await AsyncStorage.setItem(CLAVE_PERMISO, ok ? "1" : "0");
  if (!ok) await Notifications.cancelAllScheduledNotificationsAsync();
  return ok;
}

export async function desactivarAvisos() {
  await AsyncStorage.setItem(CLAVE_PERMISO, "0");
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** Fecha ISO (yyyy-mm-dd) + hora local → Date, restando los días de anticipación. */
function momentoDelAviso(fechaISO: string, diasAntes: number): Date {
  const [a, m, d] = fechaISO.split("-").map(Number);
  // Date local del dispositivo: el usuario vive en el mismo huso que su tarjeta
  const cuando = new Date(a, m - 1, d, HORA_AVISO, 0, 0, 0);
  cuando.setDate(cuando.getDate() - diasAntes);
  return cuando;
}

/**
 * Reprograma todos los avisos desde cero con los ciclos abiertos de cada
 * tarjeta activa. Silencioso: si los avisos están apagados, no hace nada.
 */
export async function reprogramarAvisos(sesion: SesionHogar): Promise<number> {
  if (!(await avisosActivos())) return 0;

  await Notifications.cancelAllScheduledNotificationsAsync();

  const { tarjetas } = await listarMedios(sesion);
  const activas = tarjetas.filter((t) => t.activa);
  if (activas.length === 0) return 0;

  // ciclos que todavía no cerraron, de las tarjetas activas
  const { data: ciclos } = await supabase
    .from("ciclos_tarjeta")
    .select("id, tarjeta_id, fecha_cierre, fecha_vencimiento, estado")
    .in(
      "tarjeta_id",
      activas.map((t) => t.id),
    )
    .gte("fecha_cierre", hoyBA())
    .order("fecha_cierre", { ascending: true });

  const ahora = Date.now();
  const pendientes: Array<{ titulo: string; cuerpo: string; cuando: Date }> = [];

  for (const c of ciclos ?? []) {
    const tarjeta = activas.find((t) => t.id === c.tarjeta_id);
    if (!tarjeta) continue;
    const nombre = `${tarjeta.nombre} •• ${tarjeta.ultimos4}`;

    const cierre = momentoDelAviso(c.fecha_cierre, DIAS_ANTES);
    if (cierre.getTime() > ahora) {
      pendientes.push({
        titulo: `${nombre} cierra mañana`,
        cuerpo: "Lo que cargues hoy todavía entra en este resumen.",
        cuando: cierre,
      });
    }

    const vence = momentoDelAviso(c.fecha_vencimiento, DIAS_ANTES);
    if (vence.getTime() > ahora) {
      pendientes.push({
        titulo: `${nombre} vence mañana`,
        cuerpo: "Revisá el resumen antes de que se pasen los intereses.",
        cuando: vence,
      });
    }
  }

  const aProgramar = pendientes
    .sort((x, y) => x.cuando.getTime() - y.cuando.getTime())
    .slice(0, MAX_AVISOS);

  for (const p of aProgramar) {
    await Notifications.scheduleNotificationAsync({
      content: { title: p.titulo, body: p.cuerpo },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: p.cuando,
      },
    });
  }
  return aProgramar.length;
}
