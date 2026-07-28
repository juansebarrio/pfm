import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarDays, CreditCard, Delete, Wallet, X } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { formatearImporte } from "@dominio/dinero";
import { formatearDiaCorto } from "@dominio/fechas";
import { obtenerSesionHogar, type SesionHogar } from "@/lib/datos";
import {
  categoriasDelHogar,
  crearGasto,
  mediosDePago,
  type CategoriaSimple,
  type MedioDePago,
} from "@/lib/acciones";
import { color, radio } from "@/lib/tema";
import { tacto } from "@/lib/tacto";
import { Badge, EstadoVacio, IconoCategoria } from "@/componentes/sistema";

// 03 — Alta rápida: de tocar + a guardado en menos de 10 segundos.
// El monto vive como string (entero + decimales) y se convierte a centavos con
// aritmética entera: ningún float toca plata. Ámbito y medio se recuerdan en
// AsyncStorage (en la web era localStorage).

type Ambito = "hogar" | "personal";
type Cuotas = 1 | 3 | 6 | 12;

const OPCIONES_CUOTAS: readonly Cuotas[] = [1, 3, 6, 12];
const CLAVE_AMBITO = "sobres.ambito";
const CLAVE_MEDIO = "sobres.medio";
const MAX_DIGITOS_ENTERO = 9; // tope de tecleo: $ 999.999.999

export default function GastoNuevo() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [sesion, setSesion] = useState<SesionHogar | null>(null);
  const [medios, setMedios] = useState<MedioDePago[]>([]);
  const [categorias, setCategorias] = useState<CategoriaSimple[]>([]);
  const [cargando, setCargando] = useState(true);

  const [ambito, setAmbito] = useState<Ambito>("hogar");
  const [medioId, setMedioId] = useState<string | null>(null);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [cuotas, setCuotas] = useState<Cuotas>(1);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);

  // monto tecleado: pesos enteros + decimales en curso (null = sin coma)
  const [entero, setEntero] = useState("");
  const [decimales, setDecimales] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const s = await obtenerSesionHogar();
      if (!s) return;
      setSesion(s);
      const [m, c] = await Promise.all([mediosDePago(s), categoriasDelHogar(s)]);
      setMedios(m);
      setCategorias(c);

      // última elección recordada
      const [a, guardadoMedio] = await Promise.all([
        AsyncStorage.getItem(CLAVE_AMBITO),
        AsyncStorage.getItem(CLAVE_MEDIO),
      ]);
      if (a === "hogar" || a === "personal") setAmbito(a);
      setMedioId(
        guardadoMedio && m.some((x) => x.id === guardadoMedio)
          ? guardadoMedio
          : (m[0]?.id ?? null),
      );
    })().finally(() => setCargando(false));
  }, []);

  const medio = medios.find((m) => m.id === medioId);
  const enteroCentavos = Number(entero || "0") * 100;
  const centavos = enteroCentavos + (decimales ? Number(decimales.padEnd(2, "0")) : 0);
  const categoriasDelAmbito = categorias.filter((c) => c.ambito === ambito);
  const hayCategoria = categoriaId !== null;

  // updates funcionales: taps consecutivos en el mismo tick no se pisan
  function tocarDigito(d: string) {
    tacto.toque();
    if (decimales !== null) {
      setDecimales((x) => (x !== null && x.length < 2 ? x + d : x));
      return;
    }
    setEntero((x) => (x.length >= MAX_DIGITOS_ENTERO ? x : x === "0" ? d : x + d));
  }

  function tocarComa() {
    tacto.toque();
    if (decimales !== null) return;
    setEntero((x) => (x === "" ? "0" : x));
    setDecimales("");
  }

  function tocarBorrar() {
    tacto.toque();
    if (decimales !== null) {
      setDecimales((x) => (x !== null && x.length > 0 ? x.slice(0, -1) : null));
      return;
    }
    setEntero((x) => x.slice(0, -1));
  }

  function elegirAmbito(a: Ambito) {
    setAmbito(a);
    setCategoriaId(null); // la categoría pertenece al ámbito
    AsyncStorage.setItem(CLAVE_AMBITO, a);
  }

  function elegirMedio(m: MedioDePago) {
    setMedioId(m.id);
    if (m.tipo !== "tarjeta") setCuotas(1);
    AsyncStorage.setItem(CLAVE_MEDIO, m.id);
  }

  async function guardar() {
    if (!sesion || !medio || centavos <= 0 || pendiente) return;
    setError(null);
    setPendiente(true);
    const r = await crearGasto(sesion, {
      importeCentavos: centavos,
      medioTipo: medio.tipo,
      medioId: medio.id,
      categoriaId,
      ambito,
      cuotas: medio.tipo === "tarjeta" ? cuotas : 1,
      nota: nota.trim() || undefined,
    });
    if (r.ok) {
      tacto.guardado();
      router.back();
    } else {
      tacto.error();
      setError(r.error);
      setPendiente(false);
    }
  }

  const cabecera = (
    <View style={[e.cabecera, { paddingTop: insets.top + 8 }]}>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <X size={22} color={color.tinta} strokeWidth={2} />
      </Pressable>
      <Text style={e.titulo}>Nuevo gasto</Text>
      {medios.length > 0 && (
        <View style={e.segmentedMini}>
          {(["hogar", "personal"] as const).map((a) => (
            <Pressable
              key={a}
              onPress={() => elegirAmbito(a)}
              style={[e.segmentoMini, ambito === a && e.segmentoMiniActivo]}
            >
              <Text style={[e.segmentoMiniTexto, ambito === a && e.segmentoMiniTextoActivo]}>
                {a === "hogar" ? "Hogar" : "Personal"}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );

  if (cargando) {
    return (
      <View style={e.pantalla}>
        {cabecera}
        <View style={e.centrado}>
          <ActivityIndicator color={color.verde} />
        </View>
      </View>
    );
  }

  // sin ningún medio de pago no se puede cargar un gasto: se explica y se sale
  if (medios.length === 0) {
    return (
      <View style={e.pantalla}>
        {cabecera}
        <View style={e.centrado}>
          <EstadoVacio
            Icono={Wallet}
            titulo="Primero, una cuenta o tarjeta"
            cuerpo="Para cargar gastos necesitás al menos un medio de pago. Creá una cuenta o tarjeta y volvé."
          />
        </View>
      </View>
    );
  }

  const puedeGuardar =
    centavos > 0 && !!medio && !pendiente && !(cuotas > 1 && !hayCategoria);

  return (
    <View style={e.pantalla}>
      {cabecera}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Monto protagonista: 52px, la tipografía más grande del sistema */}
        <View style={e.montoFila}>
          <Text style={e.monto}>{formatearImporte(enteroCentavos)}</Text>
          {decimales !== null && <Text style={e.monto}>,{decimales}</Text>}
        </View>

        {/* Chips de medio de pago */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={e.chipsFila}
          style={{ marginTop: 20 }}
        >
          {medios.map((m) => {
            const sel = m.id === medioId;
            return (
              <Pressable
                key={m.id}
                onPress={() => elegirMedio(m)}
                style={[e.chipMedio, sel && e.chipMedioSel]}
              >
                {m.tipo === "tarjeta" && (
                  <CreditCard
                    size={14}
                    color={sel ? color.papel : color.tintaSecundaria}
                    strokeWidth={1.5}
                  />
                )}
                <Text style={[e.chipMedioTexto, sel && e.chipMedioTextoSel]}>
                  {m.etiqueta}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Card contextual de tarjeta: ciclo + cuotas */}
        {medio?.tipo === "tarjeta" && (
          <View style={e.cardTarjeta}>
            {medio.cicloCierre && (
              <View style={e.cicloFila}>
                <CalendarDays size={15} color={color.tintaSecundaria} strokeWidth={1.5} />
                <Text style={e.cicloTexto}>
                  Cae en el ciclo que cierra el{" "}
                  <Text style={{ fontWeight: "600" }}>
                    {formatearDiaCorto(medio.cicloCierre)}
                  </Text>
                </Text>
                <Badge variante={medio.cicloEstado === "confirmado" ? "confirmada" : "estimada"}>
                  {medio.cicloEstado === "confirmado" ? "confirmada" : "estimada"}
                </Badge>
              </View>
            )}
            <View style={[e.cuotasFila, medio.cicloCierre && e.cuotasConBorde]}>
              <Text style={e.cuotasEtiqueta}>Cuotas</Text>
              {OPCIONES_CUOTAS.map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setCuotas(n)}
                  style={[e.cuotaBoton, cuotas === n && e.cuotaBotonSel]}
                >
                  <Text style={[e.cuotaTexto, cuotas === n && e.cuotaTextoSel]}>{n}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Categoría (opcional) + comentario */}
        <Text style={e.etiquetaSeccion}>¿En qué lo gastaste? · opcional</Text>
        <View style={e.grillaCategorias}>
          {categoriasDelAmbito.map((c) => {
            const sel = c.id === categoriaId;
            return (
              <Pressable
                key={c.id}
                onPress={() => setCategoriaId(sel ? null : c.id)}
                style={[e.tile, sel && e.tileSel]}
              >
                <IconoCategoria nombre={c.icono} tono={sel ? "verde" : "normal"} />
                <Text numberOfLines={1} style={[e.tileTexto, sel && e.tileTextoSel]}>
                  {c.nombre}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          value={nota}
          onChangeText={setNota}
          maxLength={200}
          placeholder="Comentario (opcional)"
          placeholderTextColor={color.tintaTerciaria}
          style={e.inputNota}
        />
      </ScrollView>

      {/* Teclado + CTA, pegados abajo */}
      <View style={[e.pie, { paddingBottom: Math.max(16, insets.bottom) }]}>
        {error && <Text style={e.error}>{error}</Text>}
        {cuotas > 1 && !hayCategoria && (
          <Text style={e.avisoCuotas}>
            Elegí una categoría para guardar una compra en cuotas.
          </Text>
        )}

        <View style={e.teclado}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((t) => (
            <Tecla key={t} etiqueta={t} onPress={() => tocarDigito(t)} />
          ))}
          <Tecla etiqueta="," onPress={tocarComa} />
          <Tecla etiqueta="0" onPress={() => tocarDigito("0")} />
          <Pressable onPress={tocarBorrar} style={e.tecla}>
            <Delete size={20} color={color.tinta} strokeWidth={1.5} />
          </Pressable>
        </View>

        <Pressable
          onPress={guardar}
          disabled={!puedeGuardar}
          style={[e.cta, !puedeGuardar && { opacity: 0.6 }]}
        >
          {pendiente ? (
            <ActivityIndicator color={color.papel} />
          ) : (
            <Text style={e.ctaTexto}>
              {hayCategoria ? "Listo" : "Guardar sin categoría"}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function Tecla({ etiqueta, onPress }: { etiqueta: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={e.tecla}>
      <Text style={e.teclaTexto}>{etiqueta}</Text>
    </Pressable>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.papel },
  centrado: { flex: 1, alignItems: "center", justifyContent: "center" },
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  titulo: { flex: 1, fontSize: 16, fontWeight: "600", color: color.tinta },
  segmentedMini: {
    flexDirection: "row",
    borderRadius: radio.chipChico,
    backgroundColor: color.fondoSegmented,
    padding: 2,
  },
  segmentoMini: { borderRadius: 7, paddingHorizontal: 12, paddingVertical: 5 },
  segmentoMiniActivo: { backgroundColor: color.segmentedActivo },
  segmentoMiniTexto: { fontSize: 11.5, fontWeight: "500", color: color.tintaSecundaria },
  segmentoMiniTextoActivo: { fontWeight: "600", color: color.tinta },
  montoFila: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "baseline",
  },
  monto: { fontSize: 52, fontWeight: "500", color: color.tinta },
  chipsFila: { gap: 8, paddingVertical: 4 },
  chipMedio: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radio.chip,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipMedioSel: { backgroundColor: color.tinta, borderColor: color.tinta },
  chipMedioTexto: { fontSize: 12.5, fontWeight: "500", color: color.tintaSecundaria },
  chipMedioTextoSel: { fontWeight: "600", color: color.papel },
  cardTarjeta: {
    marginTop: 12,
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cicloFila: { flexDirection: "row", alignItems: "center", gap: 8 },
  cicloTexto: { flex: 1, fontSize: 12.5, color: color.tinta },
  cuotasFila: { flexDirection: "row", alignItems: "center", gap: 8 },
  cuotasConBorde: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: color.separador,
  },
  cuotasEtiqueta: { flex: 1, fontSize: 12, color: color.tintaSecundaria },
  cuotaBoton: {
    width: 44,
    borderRadius: radio.chipChico,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingVertical: 7,
    alignItems: "center",
  },
  cuotaBotonSel: { backgroundColor: color.tinta, borderColor: color.tinta },
  cuotaTexto: { fontSize: 13, fontWeight: "500", color: color.tinta },
  cuotaTextoSel: { fontWeight: "600", color: color.papel },
  etiquetaSeccion: { marginTop: 20, fontSize: 12, color: color.tintaSecundaria },
  grillaCategorias: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 7 },
  tile: {
    width: "23%",
    alignItems: "center",
    gap: 4,
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingVertical: 9,
    paddingHorizontal: 2,
  },
  tileSel: { borderWidth: 1.5, borderColor: color.verde, backgroundColor: color.verdeSuave },
  tileTexto: { maxWidth: "100%", fontSize: 10, fontWeight: "500", color: color.tinta },
  tileTextoSel: { fontWeight: "600", color: color.verde },
  inputNota: {
    marginTop: 12,
    marginBottom: 16,
    height: 44,
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 14,
    fontSize: 16,
    color: color.tinta,
  },
  pie: {
    paddingHorizontal: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: color.separador,
    backgroundColor: color.papel,
  },
  error: {
    marginBottom: 8,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "500",
    color: color.rojo,
  },
  avisoCuotas: {
    marginBottom: 8,
    textAlign: "center",
    fontSize: 11.5,
    color: color.tintaSecundaria,
  },
  teclado: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  tecla: {
    width: "31.5%",
    height: 50,
    borderRadius: radio.chip,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    alignItems: "center",
    justifyContent: "center",
  },
  teclaTexto: { fontSize: 22, fontWeight: "500", color: color.tinta },
  cta: {
    marginTop: 12,
    borderRadius: radio.cta,
    backgroundColor: color.verde,
    paddingVertical: 15,
    alignItems: "center",
  },
  ctaTexto: { fontSize: 15, fontWeight: "600", color: color.papel },
});
