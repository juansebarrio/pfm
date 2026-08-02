import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Minus, Pencil, Plus } from "lucide-react-native";
import { formatearImporte } from "@dominio/dinero";
import {
  formatearMesLargo,
  formatearMesSolo,
  hoyBA,
  mesAnterior,
  mesDe,
  mesSiguiente,
} from "@dominio/fechas";
import {
  DECIMAS_POR_DEFECTO,
  ajustarPorInflacion,
  decimasATexto,
  esTextoDecimasValido,
  moverDecimas,
  textoADecimas,
} from "@dominio/inflacion";
import { obtenerSesionHogar, type SesionHogar } from "@/lib/datos";
import { armarPresupuesto, baseParaArmar, type PartidaArmado } from "@/lib/acciones";
import { color, fuente, radio } from "@/lib/tema";
import { tacto } from "@/lib/tacto";
import { Card, IconoCategoria } from "@/componentes/sistema";

// 02 — Armar presupuesto. Se sugiere lo del mes anterior por partida, ajustado
// por inflación; se prende/apaga cada una y se retoca la que haga falta. El
// total se ve en vivo abajo.
//
// El ajuste es el corazón del ritual acá: un mes de un presupuesto argentino no
// se "copia", se empuja. El stepper mueve TODAS las partidas de a una décima de
// punto (la misma resolución que la web); tocar el monto de una fila la saca
// del ajuste general y la deja donde vos la pusiste, hasta que "Copiar sin
// ajuste" devuelva todo a cero. La aritmética no vive acá: es @dominio/inflacion.

/** 780000 → "780.000". Se escribe en pesos enteros; los centavos van a cero. */
function conPuntos(centavos: number): string {
  if (centavos <= 0) return "";
  return String(Math.round(centavos / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export default function ArmarPresupuesto() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mes?: string; ambito?: string }>();

  const mes =
    params.mes && /^\d{4}-\d{2}-01$/.test(params.mes)
      ? params.mes
      : mesSiguiente(mesDe(hoyBA()));
  const ambito: "hogar" | "personal" =
    params.ambito === "personal" ? "personal" : "hogar";

  const [sesion, setSesion] = useState<SesionHogar | null>(null);
  const [partidas, setPartidas] = useState<PartidaArmado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ajuste general (en décimas de punto) y los retoques a mano por partida.
  // Los overrides son la excepción, no el estado: mientras una fila no se toca,
  // sigue al stepper, y por eso el monto se DERIVA en vez de guardarse.
  const [decimas, setDecimas] = useState(0);
  const [textoPct, setTextoPct] = useState("0");
  const [editandoPct, setEditandoPct] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const s = await obtenerSesionHogar();
      if (!s) return;
      setSesion(s);
      const base = await baseParaArmar(s, mes, ambito);
      setPartidas(base);
      setOverrides({});
      // "Venimos de un mes armado" se lee en los datos: si alguna partida trae
      // monto del mes anterior, hay de dónde partir y el ajuste tiene sentido.
      // Arrancando de cero no hay nada que empujar y el stepper no aparece.
      const partimosDeAlgo = base.some((p) => p.asignadoAnteriorCentavos > 0);
      setDecimas(partimosDeAlgo ? DECIMAS_POR_DEFECTO : 0);
      setTextoPct(decimasATexto(partimosDeAlgo ? DECIMAS_POR_DEFECTO : 0));
    })().finally(() => setCargando(false));
  }, [mes, ambito]);

  const hayAnterior = partidas.some((p) => p.asignadoAnteriorCentavos > 0);
  const mesPrevioCorto = formatearMesSolo(mesAnterior(mes)).slice(0, 3);

  /** Lo que muestra la fila: el retoque a mano, o el ajuste general. */
  function montoDe(p: PartidaArmado): number {
    return (
      overrides[p.categoriaId] ??
      ajustarPorInflacion(p.asignadoAnteriorCentavos, decimas)
    );
  }

  function actualizar(categoriaId: string, cambios: Partial<PartidaArmado>) {
    setPartidas((prev) =>
      prev.map((p) => (p.categoriaId === categoriaId ? { ...p, ...cambios } : p)),
    );
  }

  function cambiarDecimas(pasos: number) {
    const siguiente = moverDecimas(decimas, pasos);
    if (siguiente === decimas) return;
    tacto.toque();
    setDecimas(siguiente);
    setTextoPct(decimasATexto(siguiente));
  }

  function cambiarTextoPct(texto: string) {
    // el teclado decimal del iPhone puede dar punto: acá la coma es la coma
    const limpio = texto.replace(".", ",").replace(/[^\d,]/g, "");
    if (!esTextoDecimasValido(limpio)) return;
    setTextoPct(limpio);
    setDecimas(textoADecimas(limpio));
  }

  function cerrarEdicionPct() {
    setEditandoPct(false);
    setTextoPct(decimasATexto(decimas));
  }

  /** "Copiar sin ajuste": ajuste en 0 y se descartan los retoques a mano. */
  function copiarSinAjuste() {
    tacto.toque();
    setDecimas(0);
    setTextoPct("0");
    setEditandoPct(false);
    setOverrides({});
  }

  const activas = partidas.filter((p) => p.activa);
  const total = activas.reduce((s, p) => s + montoDe(p), 0);

  async function guardar() {
    if (!sesion || pendiente) return;
    if (activas.length === 0) {
      setError("Prendé al menos una partida");
      return;
    }
    setError(null);
    setPendiente(true);
    // el monto es derivado: se congela recién acá, al guardar
    const r = await armarPresupuesto(
      sesion,
      mes,
      ambito,
      partidas.map((p) => ({ ...p, asignadoCentavos: p.activa ? montoDe(p) : 0 })),
    );
    if (r.ok) router.back();
    else {
      setError(r.error);
      setPendiente(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={e.pantalla}
    >
      <View style={[e.cabecera, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={20} color={color.tinta} strokeWidth={1.5} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={e.titulo}>Armar presupuesto</Text>
          <Text style={e.subtitulo}>
            {formatearMesLargo(mes)} · {ambito === "hogar" ? "Hogar" : "Personal"}
          </Text>
        </View>
      </View>

      {cargando ? (
        <View style={e.centrado}>
          <ActivityIndicator color={color.verde} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={e.ayuda}>
            Asignale un monto a cada partida, como sobres de plata.{" "}
            {hayAnterior
              ? `Partimos del presupuesto de ${formatearMesSolo(mesAnterior(mes))}.`
              : "Arrancamos de cero."}
          </Text>

          {/* Ajuste general por inflación. La web pone el control al lado del
              texto explicativo; en un teléfono eso deja la bajada en una
              columna de 180 px, así que acá el título y el stepper comparten
              la primera línea y la explicación va abajo, a lo ancho. */}
          {hayAnterior && (
            <Card style={e.cardAjuste}>
              <View style={e.filaAjuste}>
                <Text style={e.tituloAjuste}>Ajuste general por inflación</Text>
                <View style={e.stepper}>
                  <Pressable
                    onPress={() => cambiarDecimas(-1)}
                    disabled={decimas === 0}
                    hitSlop={8}
                    accessibilityLabel="Bajar una décima el ajuste"
                    style={[e.stepperBoton, decimas === 0 && { opacity: 0.35 }]}
                  >
                    <Minus size={16} color={color.tinta} strokeWidth={2} />
                  </Pressable>
                  {editandoPct ? (
                    <View style={e.stepperCentro}>
                      <TextInput
                        autoFocus
                        value={textoPct}
                        onChangeText={cambiarTextoPct}
                        onBlur={cerrarEdicionPct}
                        onSubmitEditing={cerrarEdicionPct}
                        keyboardType="decimal-pad"
                        returnKeyType="done"
                        accessibilityLabel="Porcentaje de ajuste por inflación"
                        style={[e.stepperValor, e.stepperInput]}
                      />
                      <Text style={e.stepperValor}>%</Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => setEditandoPct(true)}
                      accessibilityLabel={`Editar ajuste por inflación, ahora ${decimasATexto(decimas)} por ciento`}
                      style={e.stepperCentro}
                    >
                      <Text style={e.stepperValor}>
                        {decimas > 0 ? "+ " : ""}
                        {decimasATexto(decimas)} %
                      </Text>
                      <Pencil size={11} color={color.tintaSecundaria} strokeWidth={1.5} />
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => cambiarDecimas(1)}
                    hitSlop={8}
                    accessibilityLabel="Subir una décima el ajuste"
                    style={e.stepperBoton}
                  >
                    <Plus size={16} color={color.tinta} strokeWidth={2} />
                  </Pressable>
                </View>
              </View>
              <Text style={e.bajadaAjuste}>
                Se aplica a todas las partidas; después ajustá las que quieras
                una por una.
              </Text>
              <View style={e.separadorAjuste}>
                <Pressable onPress={copiarSinAjuste} hitSlop={8}>
                  <Text style={e.copiar}>Copiar sin ajuste</Text>
                </Pressable>
              </View>
            </Card>
          )}

          <Card style={{ marginTop: 12 }}>
            {partidas.map((p, i) => {
              const monto = montoDe(p);
              const delta = monto - p.asignadoAnteriorCentavos;
              return (
                <View
                  key={p.categoriaId}
                  style={[e.fila, i > 0 && e.conBorde, !p.activa && { opacity: 0.5 }]}
                >
                  <Pressable
                    onPress={() => actualizar(p.categoriaId, { activa: !p.activa })}
                    hitSlop={6}
                    style={[e.check, p.activa && e.checkOn]}
                  >
                    {p.activa && <View style={e.checkPunto} />}
                  </Pressable>
                  <IconoCategoria nombre={p.icono} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={e.nombre}>
                      {p.nombre}
                    </Text>
                    {/* El monto viejo tachado: se ve de dónde viene el nuevo */}
                    {p.asignadoAnteriorCentavos > 0 && (
                      <Text style={e.anterior}>
                        {mesPrevioCorto} {formatearImporte(p.asignadoAnteriorCentavos)}
                      </Text>
                    )}
                  </View>
                  <View style={e.columnaMonto}>
                    <TextInput
                      value={conPuntos(monto)}
                      onChangeText={(v) => {
                        // pesos enteros → centavos, sin floats. Tocar el monto
                        // saca la fila del ajuste general hasta "copiar sin
                        // ajuste": lo que escribiste a mano no se pisa solo.
                        const pesos = v.replace(/\D/g, "").slice(0, 9);
                        setOverrides((prev) => ({
                          ...prev,
                          [p.categoriaId]: pesos ? Number(pesos) * 100 : 0,
                        }));
                        if (pesos && !p.activa) actualizar(p.categoriaId, { activa: true });
                      }}
                      placeholder="0"
                      placeholderTextColor={color.tintaTerciaria}
                      keyboardType="number-pad"
                      accessibilityLabel={`Monto de ${p.nombre} en pesos`}
                      style={e.input}
                    />
                    {p.asignadoAnteriorCentavos > 0 && delta !== 0 && (
                      <Text style={e.delta}>
                        {delta > 0 ? "+ " : "− "}
                        {formatearImporte(Math.abs(delta))}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </Card>
        </ScrollView>
      )}

      {/* Total en vivo + CTA */}
      {!cargando && (
        <View style={[e.pie, { paddingBottom: Math.max(16, insets.bottom) }]}>
          {error && <Text style={e.error}>{error}</Text>}
          <View style={e.totalFila}>
            <Text style={e.totalEtiqueta}>
              Total asignado · {activas.length}{" "}
              {activas.length === 1 ? "partida" : "partidas"}
            </Text>
            <Text style={e.total}>{formatearImporte(total)}</Text>
          </View>
          <Pressable
            onPress={guardar}
            disabled={pendiente}
            style={[e.cta, pendiente && { opacity: 0.6 }]}
          >
            {pendiente ? (
              <ActivityIndicator color={color.papel} />
            ) : (
              <Text style={e.ctaTexto}>Crear presupuesto</Text>
            )}
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
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
  subtitulo: { fontSize: 11.5, color: color.tintaSecundaria, textTransform: "capitalize" },
  ayuda: { marginTop: 4, fontSize: 12.5, lineHeight: 19, color: color.tintaSecundaria },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  conBorde: { borderTopWidth: 1, borderTopColor: color.separador },
  check: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: color.borde,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { borderColor: color.verde, backgroundColor: color.verdeSuave },
  checkPunto: { width: 9, height: 9, borderRadius: 2, backgroundColor: color.verde },
  nombre: { fontSize: 14, fontWeight: "500", color: color.tinta },
  anterior: {
    marginTop: 2,
    fontSize: 10.5,
    fontFamily: fuente.mono,
    color: color.tintaTerciaria,
    textDecorationLine: "line-through",
  },
  columnaMonto: { alignItems: "flex-end" },
  input: {
    width: 106,
    height: 40,
    borderRadius: radio.chipChico,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.papel,
    paddingHorizontal: 10,
    fontSize: 15,
    fontFamily: fuente.monoSemi,
    textAlign: "right",
    color: color.tinta,
  },
  delta: {
    marginTop: 3,
    fontSize: 10.5,
    fontFamily: fuente.mono,
    color: color.tintaSecundaria,
  },
  // ── ajuste por inflación
  cardAjuste: { marginTop: 12, paddingHorizontal: 12, paddingVertical: 12 },
  filaAjuste: { flexDirection: "row", alignItems: "center", gap: 10 },
  tituloAjuste: { flex: 1, fontSize: 13.5, fontWeight: "600", color: color.tinta },
  bajadaAjuste: {
    marginTop: 6,
    fontSize: 11.5,
    lineHeight: 17,
    color: color.tintaSecundaria,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radio.chip,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.papel,
  },
  stepperBoton: { width: 32, height: 38, alignItems: "center", justifyContent: "center" },
  stepperCentro: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 68,
    height: 38,
    justifyContent: "center",
  },
  stepperValor: { fontSize: 15, fontFamily: fuente.monoSemi, color: color.tinta },
  stepperInput: { width: 40, height: 38, textAlign: "right", padding: 0 },
  separadorAjuste: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: color.separador,
  },
  copiar: { fontSize: 12.5, fontWeight: "500", color: color.verde },
  pie: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: color.separador,
    backgroundColor: color.papel,
  },
  totalFila: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  totalEtiqueta: { fontSize: 12, color: color.tintaSecundaria },
  total: { fontSize: 20, fontWeight: "600", color: color.tinta },
  error: {
    marginBottom: 8,
    textAlign: "center",
    fontSize: 12.5,
    fontWeight: "500",
    color: color.rojo,
  },
  cta: {
    marginTop: 12,
    borderRadius: radio.cta,
    backgroundColor: color.verde,
    paddingVertical: 15,
    alignItems: "center",
  },
  ctaTexto: { fontSize: 15, fontWeight: "600", color: color.papel },
});
