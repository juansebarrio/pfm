import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, CreditCard, Plus, Wallet, X } from "lucide-react-native";
import {
  listarMedios,
  obtenerSesionHogar,
  type CuentaFila,
  type SesionHogar,
  type TarjetaFila,
} from "@/lib/datos";
import { cambiarActiva, crearCuenta, crearTarjeta } from "@/lib/acciones";
import { color, radio } from "@/lib/tema";
import { Badge, Card, EncabezadoSeccion } from "@/componentes/sistema";

// Cuentas y tarjetas: hueco declarado del export (§5). Lista con activas
// primero e inactivas al final atenuadas; alta en hoja inferior. Sin borrado
// físico — se desactivan, porque hay movimientos que las referencian.

type Hoja = "cuenta" | "tarjeta" | null;

export default function Cuentas() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sesion, setSesion] = useState<SesionHogar | null>(null);
  const [cuentas, setCuentas] = useState<CuentaFila[]>([]);
  const [tarjetas, setTarjetas] = useState<TarjetaFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [hoja, setHoja] = useState<Hoja>(null);

  const cargar = useCallback(async () => {
    const s = await obtenerSesionHogar();
    if (!s) return;
    setSesion(s);
    const { cuentas: c, tarjetas: t } = await listarMedios(s);
    setCuentas(c);
    setTarjetas(t);
  }, []);

  useEffect(() => {
    cargar().finally(() => setCargando(false));
  }, [cargar]);

  async function alternar(tabla: "cuentas" | "tarjetas", id: string, activa: boolean) {
    if (!sesion) return;
    await cambiarActiva(sesion, tabla, id, !activa);
    await cargar();
  }

  return (
    <View style={e.pantalla}>
      <View style={[e.cabecera, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={20} color={color.tinta} strokeWidth={1.5} />
        </Pressable>
        <Text style={e.titulo}>Cuentas y tarjetas</Text>
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
          <EncabezadoSeccion>Cuentas</EncabezadoSeccion>
          <Card>
            {cuentas.map((c, i) => (
              <Pressable
                key={c.id}
                onLongPress={() => alternar("cuentas", c.id, c.activa)}
                style={[e.fila, i > 0 && e.conBorde, !c.activa && { opacity: 0.45 }]}
              >
                <Wallet size={17} color={color.tintaSecundaria} strokeWidth={1.5} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={e.filaNombre}>
                    {c.nombre}
                  </Text>
                  <Text style={e.filaMeta}>
                    {c.tipo} · {c.moneda}
                    {!c.activa ? " · inactiva" : ""}
                  </Text>
                </View>
                <Badge variante={c.visibilidad === "compartido" ? "hogar" : "personal"}>
                  {c.visibilidad === "compartido" ? "hogar" : "personal"}
                </Badge>
              </Pressable>
            ))}
            <Pressable onPress={() => setHoja("cuenta")} style={[e.fila, e.conBorde]}>
              <Plus size={17} color={color.verde} strokeWidth={2} />
              <Text style={e.agregar}>Agregar cuenta</Text>
            </Pressable>
          </Card>

          <EncabezadoSeccion>Tarjetas</EncabezadoSeccion>
          <Card>
            {tarjetas.map((t, i) => (
              <Pressable
                key={t.id}
                onPress={() => router.push(`/tarjeta/${t.id}`)}
                onLongPress={() => alternar("tarjetas", t.id, t.activa)}
                style={[e.fila, i > 0 && e.conBorde, !t.activa && { opacity: 0.45 }]}
              >
                <CreditCard size={17} color={color.tintaSecundaria} strokeWidth={1.5} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={e.filaNombre}>
                    {t.nombre} •• {t.ultimos4}
                  </Text>
                  <Text style={e.filaMeta}>
                    {t.red} · {t.banco}
                    {t.diaCierre ? ` · cierra el ${t.diaCierre}` : " · sin día de cierre"}
                  </Text>
                </View>
                <Badge variante={t.visibilidad === "compartido" ? "hogar" : "personal"}>
                  {t.visibilidad === "compartido" ? "hogar" : "personal"}
                </Badge>
              </Pressable>
            ))}
            <Pressable onPress={() => setHoja("tarjeta")} style={[e.fila, e.conBorde]}>
              <Plus size={17} color={color.verde} strokeWidth={2} />
              <Text style={e.agregar}>Agregar tarjeta</Text>
            </Pressable>
          </Card>

          <Text style={e.ayuda}>
            Mantené apretada una cuenta o tarjeta para desactivarla. No se borran:
            hay movimientos que las referencian.
          </Text>
        </ScrollView>
      )}

      <HojaAlta
        tipo={hoja}
        sesion={sesion}
        onCerrar={() => setHoja(null)}
        onGuardado={async () => {
          setHoja(null);
          await cargar();
        }}
      />
    </View>
  );
}

// ─────────────────────────────────────────── hoja de alta

function HojaAlta({
  tipo,
  sesion,
  onCerrar,
  onGuardado,
}: {
  tipo: Hoja;
  sesion: SesionHogar | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [nombre, setNombre] = useState("");
  const [banco, setBanco] = useState("");
  const [ultimos4, setUltimos4] = useState("");
  const [diaCierre, setDiaCierre] = useState("");
  const [tipoCuenta, setTipoCuenta] = useState<EntradaTipoCuenta>("banco");
  const [red, setRed] = useState<Red>("visa");
  const [visibilidad, setVisibilidad] = useState<"compartido" | "personal">("compartido");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);

  // limpiar el formulario cada vez que se abre
  useEffect(() => {
    if (tipo) {
      setNombre("");
      setBanco("");
      setUltimos4("");
      setDiaCierre("");
      setTipoCuenta("banco");
      setRed("visa");
      setVisibilidad("compartido");
      setError(null);
      setPendiente(false);
    }
  }, [tipo]);

  async function guardar() {
    if (!sesion || pendiente) return;
    setError(null);
    setPendiente(true);
    const r =
      tipo === "cuenta"
        ? await crearCuenta(sesion, {
            nombre,
            tipo: tipoCuenta,
            moneda: "ARS",
            visibilidad,
          })
        : await crearTarjeta(sesion, {
            nombre,
            banco,
            red,
            ultimos4,
            visibilidad,
            diaCierre: diaCierre ? Number(diaCierre) : null,
          });
    if (r.ok) onGuardado();
    else {
      setError(r.error);
      setPendiente(false);
    }
  }

  return (
    <Modal visible={tipo !== null} transparent animationType="slide" onRequestClose={onCerrar}>
      <Pressable style={e.backdrop} onPress={onCerrar} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={e.hojaContenedor}
      >
        <View style={[e.hoja, { paddingBottom: Math.max(20, insets.bottom) }]}>
          <View style={e.tirador} />
          <View style={e.hojaCabecera}>
            <Text style={e.hojaTitulo}>
              {tipo === "cuenta" ? "Nueva cuenta" : "Nueva tarjeta"}
            </Text>
            <Pressable onPress={onCerrar} hitSlop={12}>
              <X size={22} color={color.tintaSecundaria} strokeWidth={2} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Campo
              etiqueta="Nombre"
              valor={nombre}
              onChange={setNombre}
              placeholder={tipo === "cuenta" ? "Galicia, Efectivo…" : "Visa Galicia"}
            />

            {tipo === "cuenta" ? (
              <Selector
                etiqueta="Tipo"
                opciones={["efectivo", "banco", "billetera", "inversion"]}
                valor={tipoCuenta}
                onChange={(v) => setTipoCuenta(v as EntradaTipoCuenta)}
              />
            ) : (
              <>
                <Campo
                  etiqueta="Banco"
                  valor={banco}
                  onChange={setBanco}
                  placeholder="Galicia"
                />
                <Selector
                  etiqueta="Red"
                  opciones={["visa", "mastercard", "amex", "otra"]}
                  valor={red}
                  onChange={(v) => setRed(v as Red)}
                />
                <Campo
                  etiqueta="Últimos 4 dígitos"
                  valor={ultimos4}
                  onChange={(v) => setUltimos4(v.replace(/\D/g, "").slice(0, 4))}
                  placeholder="4321"
                  teclado="number-pad"
                />
                <Campo
                  etiqueta="Día de cierre (1 a 28)"
                  valor={diaCierre}
                  onChange={(v) => setDiaCierre(v.replace(/\D/g, "").slice(0, 2))}
                  placeholder="28"
                  teclado="number-pad"
                />
              </>
            )}

            <Selector
              etiqueta="Visibilidad"
              opciones={["compartido", "personal"]}
              valor={visibilidad}
              onChange={(v) => setVisibilidad(v as "compartido" | "personal")}
            />

            {error && <Text style={e.error}>{error}</Text>}

            <Pressable
              onPress={guardar}
              disabled={pendiente}
              style={[e.cta, pendiente && { opacity: 0.6 }]}
            >
              {pendiente ? (
                <ActivityIndicator color={color.papel} />
              ) : (
                <Text style={e.ctaTexto}>Guardar</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type EntradaTipoCuenta = "efectivo" | "banco" | "billetera" | "inversion";
type Red = "visa" | "mastercard" | "amex" | "otra";

function Campo({
  etiqueta,
  valor,
  onChange,
  placeholder,
  teclado,
}: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  teclado?: "default" | "number-pad";
}) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={e.campoEtiqueta}>{etiqueta}</Text>
      <TextInput
        value={valor}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={color.tintaTerciaria}
        keyboardType={teclado ?? "default"}
        autoCapitalize="words"
        style={e.input}
      />
    </View>
  );
}

function Selector({
  etiqueta,
  opciones,
  valor,
  onChange,
}: {
  etiqueta: string;
  opciones: string[];
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={e.campoEtiqueta}>{etiqueta}</Text>
      <View style={e.chips}>
        {opciones.map((o) => {
          const sel = o === valor;
          return (
            <Pressable
              key={o}
              onPress={() => onChange(o)}
              style={[e.chip, sel && e.chipSel]}
            >
              <Text style={[e.chipTexto, sel && e.chipTextoSel]}>{o}</Text>
            </Pressable>
          );
        })}
      </View>
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
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  conBorde: { borderTopWidth: 1, borderTopColor: color.separador },
  filaNombre: { fontSize: 14, fontWeight: "500", color: color.tinta },
  filaMeta: { marginTop: 2, fontSize: 11, color: color.tintaSecundaria },
  agregar: { fontSize: 13.5, fontWeight: "500", color: color.verde },
  ayuda: {
    marginTop: 16,
    fontSize: 11,
    lineHeight: 17,
    color: color.tintaTerciaria,
    textAlign: "center",
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  hojaContenedor: { position: "absolute", left: 0, right: 0, bottom: 0 },
  hoja: {
    maxHeight: "88%",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  tirador: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.tintaMuda,
  },
  hojaCabecera: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hojaTitulo: { fontSize: 16, fontWeight: "600", color: color.tinta },
  campoEtiqueta: { marginBottom: 6, fontSize: 12, color: color.tintaSecundaria },
  input: {
    height: 46,
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.papel,
    paddingHorizontal: 14,
    fontSize: 16,
    color: color.tinta,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderRadius: radio.chipChico,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.papel,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipSel: { backgroundColor: color.tinta, borderColor: color.tinta },
  chipTexto: { fontSize: 12, fontWeight: "500", color: color.tintaSecundaria },
  chipTextoSel: { fontWeight: "600", color: color.papel },
  error: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 12.5,
    fontWeight: "500",
    color: color.rojo,
  },
  cta: {
    marginTop: 20,
    borderRadius: radio.cta,
    backgroundColor: color.verde,
    paddingVertical: 15,
    alignItems: "center",
  },
  ctaTexto: { fontSize: 15, fontWeight: "600", color: color.papel },
});
