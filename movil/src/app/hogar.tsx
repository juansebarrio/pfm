import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Lock,
  Mail,
  ScanFace,
  Sparkles,
  Tags,
  Users,
  Wallet,
  GraduationCap,
  X,
} from "lucide-react-native";
import { diasEntre, fechaDesdeMs, hoyBA } from "@dominio/fechas";
import { useBloqueo } from "@/lib/bloqueo";
import { borrarMiCuenta } from "@/lib/cuenta";
import {
  activarAvisos,
  avisosActivos,
  desactivarAvisos,
  reprogramarAvisos,
} from "@/lib/avisos";
import {
  invitarAlHogar,
  reenviarInvitacion,
  revocarInvitacion,
} from "@/lib/acciones";
import {
  obtenerHogar,
  obtenerSesionHogar,
  type MiembroFila,
  type SesionHogar,
} from "@/lib/datos";
import { supabase } from "@/lib/supabase";
import { tacto } from "@/lib/tacto";
import { color, fuente, radio } from "@/lib/tema";
import { Onboarding } from "@/componentes/Onboarding";
import { Badge, Card } from "@/componentes/sistema";

// 09 — Hogar: miembros con su rol, accesos a cuentas y cuotas, el statement de
// visibilidad y la salida (cerrar sesión).

const API = process.env.EXPO_PUBLIC_API_URL;

/** "los ve Juanse" / "los ven Juanse y Vale" / "los ven A, B y C". */
function losVen(nombres: string[]): string {
  if (nombres.length <= 1) return `los ve ${nombres[0] ?? "el hogar"}`;
  return `los ven ${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

type InvitacionFila = { id: string; email: string; creadoEl: string };

/** Espeja la consulta de la web (lib/datos/hogar.ts): solo pendientes, más viejas primero. */
async function invitacionesPendientes(hogarId: string): Promise<InvitacionFila[]> {
  const { data } = await supabase
    .from("invitaciones")
    .select("id, email, creado_el")
    .eq("hogar_id", hogarId)
    .eq("estado", "pendiente")
    .order("creado_el", { ascending: true });
  return (data ?? []).map((i) => ({
    id: i.id as string,
    email: i.email as string,
    creadoEl: i.creado_el as string,
  }));
}

/** "invitada hoy" / "invitada hace 1 día" / "invitada hace N días", en BA. */
function etiquetaInvitada(creadoEl: string, hoy: string): string {
  const fecha = fechaDesdeMs(Date.parse(creadoEl));
  const dias = Math.max(0, diasEntre(fecha, hoy));
  const cuando =
    dias === 0 ? "invitada hoy" : dias === 1 ? "invitada hace 1 día" : `invitada hace ${dias} días`;
  return `${cuando} · sin responder`;
}

const EMAIL_VALIDO = /\S+@\S+\.\S+/;

export default function Hogar() {
  const [onboardingAbierto, setOnboardingAbierto] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bloqueo = useBloqueo();
  const [nombre, setNombre] = useState("Mi hogar");
  const [miembros, setMiembros] = useState<MiembroFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sesion, setSesion] = useState<SesionHogar | null>(null);
  const [avisos, setAvisos] = useState(false);
  const [programados, setProgramados] = useState(0);
  const [borrando, setBorrando] = useState(false);
  const [invitaciones, setInvitaciones] = useState<InvitacionFila[]>([]);
  // la fila con una acción en curso: evita reenviar y revocar a la vez
  const [invitacionOcupada, setInvitacionOcupada] = useState<string | null>(null);
  const [invitarAbierto, setInvitarAbierto] = useState(false);
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorInvitar, setErrorInvitar] = useState<string | null>(null);
  // sin RESEND_API_KEY el email no sale: el server devuelve el link para compartir
  const [linkInvitacion, setLinkInvitacion] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const s = await obtenerSesionHogar();
      if (!s) return;
      setSesion(s);
      const [h, pendientes] = await Promise.all([
        obtenerHogar(s),
        invitacionesPendientes(s.hogarId),
      ]);
      setNombre(h.nombre);
      setMiembros(h.miembros);
      setInvitaciones(pendientes);

      // los avisos se reprograman en cada apertura: los ciclos se mueven
      if (await avisosActivos()) {
        setAvisos(true);
        setProgramados(await reprogramarAvisos(s));
      }
    })().finally(() => setCargando(false));
  }, []);

  async function refrescarInvitaciones() {
    if (sesion) setInvitaciones(await invitacionesPendientes(sesion.hogarId));
  }

  function abrirInvitar() {
    setEmail("");
    setErrorInvitar(null);
    setLinkInvitacion(null);
    setInvitarAbierto(true);
  }

  async function enviarInvitacion() {
    const limpio = email.trim();
    if (!EMAIL_VALIDO.test(limpio) || enviando) return;
    setEnviando(true);
    setErrorInvitar(null);
    const r = await invitarAlHogar(limpio);
    setEnviando(false);
    if (!r.ok) {
      setErrorInvitar(r.error);
      return;
    }
    tacto.guardado();
    await refrescarInvitaciones();
    if (r.enviado) setInvitarAbierto(false);
    else setLinkInvitacion(r.link); // el mail no salió: se comparte a mano
  }

  async function reenviar(inv: InvitacionFila) {
    if (invitacionOcupada) return;
    setInvitacionOcupada(inv.id);
    const r = await reenviarInvitacion(inv.id);
    setInvitacionOcupada(null);
    if (!r.ok) {
      Alert.alert("No pudimos reenviar", r.error);
      return;
    }
    tacto.guardado();
    // el email no salió (sin RESEND): el link renovado se comparte a mano
    if (!r.enviado && r.link) void Share.share({ message: r.link });
    await refrescarInvitaciones();
  }

  async function revocar(inv: InvitacionFila) {
    if (!sesion || invitacionOcupada) return;
    setInvitacionOcupada(inv.id);
    const r = await revocarInvitacion(sesion, inv.id);
    setInvitacionOcupada(null);
    if (!r.ok) {
      Alert.alert("No pudimos revocar", r.error);
      return;
    }
    tacto.guardado();
    await refrescarInvitaciones();
  }

  /**
   * Dos pasos a propósito: el primero explica qué se lleva puesto, el segundo
   * es el destructivo. No hay papelera ni "deshacer" del otro lado.
   */
  function confirmarBorrado() {
    const soloMiembro = miembros.length === 1;
    Alert.alert(
      "Borrar mi cuenta",
      soloMiembro
        ? "Se borra tu hogar completo: movimientos, presupuestos, cuentas, tarjetas y patrimonio."
        : "Se borra tu usuario y todo lo personal. Lo compartido del hogar queda para los demás.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Continuar",
          style: "destructive",
          onPress: () =>
            Alert.alert("¿Seguro?", "Esto no se puede deshacer.", [
              { text: "No", style: "cancel" },
              { text: "Borrar", style: "destructive", onPress: borrar },
            ]),
        },
      ],
    );
  }

  async function borrar() {
    setBorrando(true);
    const r = await borrarMiCuenta();
    if (r.ok) {
      // signOut deja la sesión nula y el Portero global saca de esta pantalla
      await supabase.auth.signOut();
    } else {
      setBorrando(false);
      Alert.alert("No pudimos borrarla", r.error);
    }
  }

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
  const nInv = invitaciones.length;
  const subtitulo =
    `${n} ${n === 1 ? "miembro" : "miembros"}` +
    (nInv > 0
      ? ` · ${nInv} ${nInv === 1 ? "invitación pendiente" : "invitaciones pendientes"}`
      : "");
  const hoy = hoyBA();
  const emailListo = EMAIL_VALIDO.test(email.trim());

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
                <Text style={e.hogarMeta}>{subtitulo}</Text>
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

            {/* Invitaciones pendientes: avatar punteado ámbar, como en la web */}
            {invitaciones.map((inv) => (
              <View key={inv.id} style={[e.invitacion, e.conBorde]}>
                <View style={e.invitacionFila}>
                  <View style={e.avatarPendiente}>
                    <Text style={e.avatarPendienteTexto}>
                      {(inv.email.trim()[0] ?? "?").toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={e.miembroNombre}>
                      {inv.email}
                    </Text>
                    <Text style={e.miembroMeta}>
                      {etiquetaInvitada(inv.creadoEl, hoy)}
                    </Text>
                  </View>
                  <Badge variante="pendiente">pendiente</Badge>
                </View>
                <View style={e.invitacionAcciones}>
                  <Pressable
                    onPress={() => reenviar(inv)}
                    disabled={invitacionOcupada !== null}
                    hitSlop={10}
                  >
                    <Text
                      style={[
                        e.accionReenviar,
                        invitacionOcupada !== null && { opacity: 0.6 },
                      ]}
                    >
                      Reenviar
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => revocar(inv)}
                    disabled={invitacionOcupada !== null}
                    hitSlop={10}
                  >
                    <Text
                      style={[
                        e.accionRevocar,
                        invitacionOcupada !== null && { opacity: 0.6 },
                      ]}
                    >
                      Revocar
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}

            {/* CTA de invitar: fila del card, mismo lenguaje que la navegación */}
            <Pressable onPress={abrirInvitar} style={[e.navFila, e.conBorde]}>
              <Mail size={17} color={color.verde} strokeWidth={1.5} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={e.navTexto}>Invitar al hogar</Text>
                <Text style={e.navAyuda}>
                  Por email. La persona elige su clave al entrar.
                </Text>
              </View>
              <ChevronRight size={16} color={color.tintaTerciaria} strokeWidth={1.5} />
            </Pressable>
          </Card>

          {/* Navegación */}
          <Card style={{ marginTop: 16 }}>
            <Pressable onPress={() => router.push("/asistente")} style={e.navFila}>
              <Sparkles size={17} color={color.verde} strokeWidth={1.5} />
              <Text style={e.navTexto}>Asistente financiero</Text>
              <ChevronRight size={16} color={color.tintaTerciaria} strokeWidth={1.5} />
            </Pressable>
            <Pressable onPress={() => router.push("/categorias")} style={[e.navFila, e.conBorde]}>
              <Tags size={17} color={color.tinta} strokeWidth={1.5} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={e.navTexto}>Categorías</Text>
                <Text style={e.navAyuda}>Creá las tuyas y ordenalas por grupo</Text>
              </View>
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
            <Pressable
              onPress={() => setOnboardingAbierto(true)}
              style={[e.navFila, e.conBorde]}
            >
              <GraduationCap size={17} color={color.tinta} strokeWidth={1.5} />
              <View style={{ flex: 1 }}>
                <Text style={e.navTexto}>Enseñame a utilizar la app</Text>
                <Text style={e.navSubtexto}>El recorrido de bienvenida, las veces que quieras</Text>
              </View>
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

          {/* La política vive en la web: una sola fuente para las dos apps */}
          <Pressable
            onPress={() => WebBrowser.openBrowserAsync(`${API}/privacidad`)}
            style={{ marginTop: 24, alignItems: "center", paddingVertical: 10 }}
          >
            <Text style={e.privacidad}>Cómo cuidamos tus datos</Text>
          </Pressable>

          <Pressable
            onPress={() => supabase.auth.signOut()}
            style={{ marginTop: 4, alignItems: "center", paddingVertical: 12 }}
          >
            <Text style={e.cerrar}>Cerrar sesión</Text>
          </Pressable>

          {/* Apple exige poder borrar la cuenta desde la app (guía 5.1.1(v)) */}
          <Pressable
            onPress={confirmarBorrado}
            disabled={borrando}
            style={{ marginTop: 12, alignItems: "center", paddingVertical: 10 }}
          >
            <Text style={e.borrarCuenta}>
              {borrando ? "Borrando…" : "Borrar mi cuenta"}
            </Text>
          </Pressable>
        </ScrollView>
      )}

      {/* Hoja inferior de invitar: mismo patrón que AgregarPartida */}
      <Modal
        visible={invitarAbierto}
        transparent
        animationType="slide"
        onRequestClose={() => setInvitarAbierto(false)}
      >
        <KeyboardAvoidingView
          style={e.lleno}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={e.fondoHoja} onPress={() => setInvitarAbierto(false)} />
          <View style={[e.hoja, { paddingBottom: Math.max(20, insets.bottom) }]}>
            <View aria-hidden style={e.agarre} />
            <View style={e.filaTituloHoja}>
              <Text style={e.tituloHoja}>Invitar al hogar</Text>
              <Pressable onPress={() => setInvitarAbierto(false)} hitSlop={10}>
                <X size={22} color={color.tintaSecundaria} strokeWidth={2} />
              </Pressable>
            </View>

            {linkInvitacion ? (
              <>
                {/* el email no salió (sin RESEND): el link se comparte a mano */}
                <Text style={e.avisoLink}>
                  La invitación ya está creada, pero el email no salió. Compartí
                  este link (vence en 14 días):
                </Text>
                <Text selectable style={e.link}>
                  {linkInvitacion}
                </Text>
                <Pressable
                  onPress={() => Share.share({ message: linkInvitacion })}
                  style={e.ctaHoja}
                >
                  <Text style={e.ctaHojaTexto}>Compartir el link</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={e.etiquetaHoja}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoComplete="email"
                  placeholder="nombre@email.com"
                  placeholderTextColor={color.tintaTerciaria}
                  style={e.inputEmail}
                />
                <Text style={e.ayudaHoja}>
                  Por email. La persona elige su clave al entrar.
                </Text>

                {errorInvitar && <Text style={e.errorHoja}>{errorInvitar}</Text>}

                <Pressable
                  onPress={enviarInvitacion}
                  disabled={!emailListo || enviando}
                  style={[e.ctaHoja, (!emailListo || enviando) && { opacity: 0.4 }]}
                >
                  <Text style={e.ctaHojaTexto}>
                    {enviando ? "Enviando…" : "Enviar invitación"}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Onboarding
        abierto={onboardingAbierto}
        alCerrar={() => setOnboardingAbierto(false)}
      />
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
  titulo: { fontSize: 17, fontFamily: fuente.textoSemi, color: color.tinta },
  hogarHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  hogarNombre: { fontSize: 16, fontFamily: fuente.textoSemi, color: color.tinta },
  hogarMeta: { fontSize: 11.5, fontFamily: fuente.texto, color: color.tintaSecundaria },
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
  avatarTexto: { fontSize: 14, fontFamily: fuente.textoSemi, color: color.papel },
  miembroNombre: { fontSize: 14, fontFamily: fuente.textoMedio, color: color.tinta },
  miembroMeta: { fontSize: 11.5, fontFamily: fuente.texto, color: color.tintaSecundaria },
  navFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  navTexto: { flex: 1, fontSize: 14, fontFamily: fuente.textoMedio, color: color.tinta },
  navSubtexto: { fontSize: 11.5, fontFamily: fuente.texto, color: color.tintaSecundaria },
  navAyuda: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
  },
  lockFila: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  statement: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 20,
    fontFamily: fuente.textoSemi,
    color: color.tinta,
  },
  leyenda: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  leyendaTexto: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 17,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
  },
  privacidad: {
    fontSize: 12.5,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
    textDecorationLine: "underline",
  },
  cerrar: { fontSize: 13, fontFamily: fuente.textoMedio, color: color.rojo },
  borrarCuenta: {
    fontSize: 12.5,
    fontFamily: fuente.texto,
    color: color.tintaTerciaria,
    textDecorationLine: "underline",
  },

  // invitaciones pendientes (espejan la fila de miembro; avatar como ESTIMADA)
  invitacion: { paddingHorizontal: 16, paddingVertical: 12 },
  invitacionFila: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarPendiente: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: color.bordeEstimada,
    backgroundColor: color.fondoEstimada,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPendienteTexto: {
    fontSize: 14,
    fontFamily: fuente.textoSemi,
    color: color.ambarTexto,
  },
  // alineadas al texto: avatar (36) + gap (12) = 48
  invitacionAcciones: { flexDirection: "row", gap: 16, paddingLeft: 48, marginTop: 8 },
  accionReenviar: { fontSize: 12.5, fontFamily: fuente.textoMedio, color: color.verde },
  accionRevocar: { fontSize: 12.5, fontFamily: fuente.textoMedio, color: color.rojo },

  // hoja de invitar (calca AgregarPartida)
  lleno: { flex: 1, justifyContent: "flex-end" },
  fondoHoja: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: "rgba(20, 19, 18, 0.6)",
  },
  hoja: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  agarre: {
    alignSelf: "center",
    height: 4,
    width: 36,
    borderRadius: 2,
    backgroundColor: color.tintaMuda,
  },
  filaTituloHoja: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tituloHoja: { fontSize: 16, fontFamily: fuente.textoSemi, color: color.tinta },
  etiquetaHoja: {
    marginTop: 16,
    marginBottom: 6,
    fontSize: 11.5,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
  },
  inputEmail: {
    height: 48,
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.papel,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: fuente.texto,
    color: color.tinta,
  },
  ayudaHoja: {
    marginTop: 8,
    fontSize: 11.5,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
  },
  errorHoja: { marginTop: 8, fontSize: 12.5, fontFamily: fuente.texto, color: color.rojo },
  avisoLink: {
    marginTop: 16,
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
  },
  link: { marginTop: 8, fontSize: 12.5, fontFamily: fuente.texto, color: color.verde },
  ctaHoja: {
    marginTop: 16,
    height: 48,
    borderRadius: radio.cta,
    backgroundColor: color.verde,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaHojaTexto: { fontSize: 15, fontFamily: fuente.textoSemi, color: color.papel },
});
