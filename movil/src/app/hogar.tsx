import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Lock,
  ScanFace,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react-native";
import { useBloqueo } from "@/lib/bloqueo";
import {
  activarAvisos,
  avisosActivos,
  desactivarAvisos,
  reprogramarAvisos,
} from "@/lib/avisos";
import {
  obtenerHogar,
  obtenerSesionHogar,
  type MiembroFila,
  type SesionHogar,
} from "@/lib/datos";
import { supabase } from "@/lib/supabase";
import { color } from "@/lib/tema";
import { Badge, Card } from "@/componentes/sistema";

// 09 — Hogar: miembros con su rol, accesos a cuentas y cuotas, el statement de
// visibilidad y la salida (cerrar sesión).

/** "los ve Juanse" / "los ven Juanse y Vale" / "los ven A, B y C". */
function losVen(nombres: string[]): string {
  if (nombres.length <= 1) return `los ve ${nombres[0] ?? "el hogar"}`;
  return `los ven ${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

export default function Hogar() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bloqueo = useBloqueo();
  const [nombre, setNombre] = useState("Mi hogar");
  const [miembros, setMiembros] = useState<MiembroFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sesion, setSesion] = useState<SesionHogar | null>(null);
  const [avisos, setAvisos] = useState(false);
  const [programados, setProgramados] = useState(0);

  useEffect(() => {
    (async () => {
      const s = await obtenerSesionHogar();
      if (!s) return;
      setSesion(s);
      const h = await obtenerHogar(s);
      setNombre(h.nombre);
      setMiembros(h.miembros);

      // los avisos se reprograman en cada apertura: los ciclos se mueven
      if (await avisosActivos()) {
        setAvisos(true);
        setProgramados(await reprogramarAvisos(s));
      }
    })().finally(() => setCargando(false));
  }, []);

  async function alternarAvisos(prender: boolean) {
    if (!sesion) return;
    if (prender) {
      const ok = await activarAvisos();
      setAvisos(ok);
      if (ok) setProgramados(await reprogramarAvisos(sesion));
      else {
        Alert.alert(
          "Faltan permisos",
          "Activá las notificaciones de Fin de mes desde Ajustes del teléfono.",
        );
      }
    } else {
      await desactivarAvisos();
      setAvisos(false);
      setProgramados(0);
    }
  }

  const n = miembros.length;

  return (
    <View style={e.pantalla}>
      <View style={[e.cabecera, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={20} color={color.tinta} strokeWidth={1.5} />
        </Pressable>
        <Text style={e.titulo}>Hogar</Text>
      </View>

      {cargando ? (
        <View style={e.centrado}>
          <ActivityIndicator color={color.verde} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 32,
          }}
        >
          {/* Card del hogar: header + filas de miembros */}
          <Card style={{ marginTop: 4 }}>
            <View style={e.hogarHeader}>
              <Users size={17} color={color.tinta} strokeWidth={1.5} />
              <View style={{ minWidth: 0 }}>
                <Text numberOfLines={1} style={e.hogarNombre}>
                  {nombre}
                </Text>
                <Text style={e.hogarMeta}>
                  {n} {n === 1 ? "miembro" : "miembros"}
                </Text>
              </View>
            </View>
            {miembros.map((m) => (
              <View key={m.userId} style={[e.miembro, e.conBorde]}>
                <View
                  style={[
                    e.avatar,
                    { backgroundColor: m.esUsuarioActual ? color.tinta : color.tintaSecundaria },
                  ]}
                >
                  <Text style={e.avatarTexto}>
                    {(m.nombre.trim()[0] ?? "?").toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={e.miembroNombre}>
                    {m.nombre}
                  </Text>
                  {m.esUsuarioActual && <Text style={e.miembroMeta}>vos</Text>}
                </View>
                <Badge variante="neutro">{m.rol}</Badge>
              </View>
            ))}
          </Card>

          {/* Navegación */}
          <Card style={{ marginTop: 16 }}>
            <Pressable onPress={() => router.push("/asistente")} style={e.navFila}>
              <Sparkles size={17} color={color.verde} strokeWidth={1.5} />
              <Text style={e.navTexto}>Asistente financiero</Text>
              <ChevronRight size={16} color={color.tintaTerciaria} strokeWidth={1.5} />
            </Pressable>
            <Pressable onPress={() => router.push("/cuentas")} style={[e.navFila, e.conBorde]}>
              <Wallet size={17} color={color.tinta} strokeWidth={1.5} />
              <Text style={e.navTexto}>Cuentas y tarjetas</Text>
              <ChevronRight size={16} color={color.tintaTerciaria} strokeWidth={1.5} />
            </Pressable>
            <Pressable onPress={() => router.push("/cuotas")} style={[e.navFila, e.conBorde]}>
              <CreditCard size={17} color={color.tinta} strokeWidth={1.5} />
              <Text style={e.navTexto}>Compras en cuotas</Text>
              <ChevronRight size={16} color={color.tintaTerciaria} strokeWidth={1.5} />
            </Pressable>
          </Card>

          {/* Avisos de tarjeta */}
          <Card style={{ marginTop: 16 }}>
            {/* toda la fila alterna: el Switch solo, en 51pt, es un blanco chico */}
            <Pressable onPress={() => alternarAvisos(!avisos)} style={e.navFila}>
              <Bell size={17} color={color.tinta} strokeWidth={1.5} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={e.navTexto}>Avisarme de cierres y vencimientos</Text>
                <Text style={e.navAyuda}>
                  {avisos
                    ? `${programados} ${programados === 1 ? "aviso programado" : "avisos programados"}`
                    : "Un día antes, a las 10 de la mañana"}
                </Text>
              </View>
              <Switch
                value={avisos}
                onValueChange={alternarAvisos}
                trackColor={{ true: color.verde, false: color.borde }}
              />
            </Pressable>
          </Card>

          {/* Bloqueo biométrico: solo se ofrece si el equipo lo soporta */}
          {bloqueo.disponible && (
            <Card style={{ marginTop: 16 }}>
              <Pressable onPress={bloqueo.alternar} style={e.navFila}>
                <ScanFace size={17} color={color.tinta} strokeWidth={1.5} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={e.navTexto}>Pedir Face ID al abrir</Text>
                  <Text style={e.navAyuda}>
                    Se bloquea sola cuando dejás la app un rato
                  </Text>
                </View>
                <Switch
                  value={bloqueo.activo}
                  onValueChange={bloqueo.alternar}
                  trackColor={{ true: color.verde, false: color.borde }}
                />
              </Pressable>
            </Card>
          )}

          {/* Statement de visibilidad */}
          <Card style={{ marginTop: 16, paddingHorizontal: 16, paddingVertical: 14 }}>
            <View style={e.lockFila}>
              <Lock size={17} color={color.tinta} strokeWidth={1.5} />
              <Text style={e.statement}>
                Lo personal es tuyo. Lo compartido lo ven los adultos del hogar.
              </Text>
            </View>
            <View style={{ marginTop: 12, gap: 8 }}>
              <View style={e.leyenda}>
                <Badge variante="hogar">hogar</Badge>
                <Text style={e.leyendaTexto}>
                  presupuesto y movimientos compartidos:{" "}
                  {losVen(miembros.map((m) => m.nombre))}
                </Text>
              </View>
              <View style={e.leyenda}>
                <Badge variante="personal">personal</Badge>
                <Text style={e.leyendaTexto}>tus partidas privadas: solo las ves vos</Text>
              </View>
            </View>
          </Card>

          <Pressable
            onPress={() => supabase.auth.signOut()}
            style={{ marginTop: 24, alignItems: "center", paddingVertical: 12 }}
          >
            <Text style={e.cerrar}>Cerrar sesión</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.papel },
  centrado: { flex: 1, alignItems: "center", justifyContent: "center" },
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  titulo: { fontSize: 17, fontWeight: "600", color: color.tinta },
  hogarHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  hogarNombre: { fontSize: 16, fontWeight: "600", color: color.tinta },
  hogarMeta: { fontSize: 11.5, color: color.tintaSecundaria },
  miembro: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  conBorde: { borderTopWidth: 1, borderTopColor: color.separador },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTexto: { fontSize: 14, fontWeight: "600", color: color.papel },
  miembroNombre: { fontSize: 14, fontWeight: "500", color: color.tinta },
  miembroMeta: { fontSize: 11.5, color: color.tintaSecundaria },
  navFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  navTexto: { flex: 1, fontSize: 14, fontWeight: "500", color: color.tinta },
  navAyuda: { marginTop: 2, fontSize: 11, color: color.tintaSecundaria },
  lockFila: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  statement: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: "600",
    color: color.tinta,
  },
  leyenda: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  leyendaTexto: { flex: 1, fontSize: 11.5, lineHeight: 17, color: color.tintaSecundaria },
  cerrar: { fontSize: 13, fontWeight: "500", color: color.rojo },
});
