import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Banknote,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
} from "lucide-react-native";
import { formatearImporte } from "@dominio/dinero";
import { diasEntre, formatearDiaCorto, hoyBA } from "@dominio/fechas";
import { diferenciaConciliacion } from "@dominio/tarjetas";
import {
  movimientosDeCiclo,
  obtenerSesionHogar,
  obtenerTarjeta,
  totalesDeCiclo,
  type CicloFila,
  type DetalleTarjeta,
  type MovimientoFila,
  type SesionHogar,
  type TotalesCiclo,
} from "@/lib/datos";
import {
  borrarMovimiento,
  categoriasDelHogar,
  mediosDePago,
  type CategoriaSimple,
  type MedioDePago,
} from "@/lib/acciones";
import {
  conciliarResumen,
  indiceCicloVigente,
  pagarResumen,
  sumarDias,
} from "@/lib/acciones-tarjeta";
import { color, fuente, radio } from "@/lib/tema";
import { tacto } from "@/lib/tacto";
import {
  Badge,
  Card,
  EncabezadoSeccion,
  FilaMovimiento,
  Importe,
} from "@/componentes/sistema";
import { DetalleMovimiento } from "@/componentes/DetalleMovimiento";

// 06 — Detalle de un ciclo de tarjeta: el resumen proyectado con su desglose,
// las dos acciones del diferencial argentino (CONCILIAR el total contra el
// resumen real del banco y REGISTRAR EL PAGO, que jamás computa como gasto) y
// los consumos del ciclo, tocables como en toda la app. Espeja
// app/tarjetas/[id]/page.tsx + Conciliacion.tsx + PagoResumen.tsx.

const VISIBLES = 5;

type Cuenta = { id: string; etiqueta: string };

export default function Ciclo() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, tarjeta: tarjetaId } = useLocalSearchParams<{
    id: string;
    tarjeta: string;
  }>();

  const [sesion, setSesion] = useState<SesionHogar | null>(null);
  const [tarjeta, setTarjeta] = useState<DetalleTarjeta | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoFila[]>([]);
  const [totales, setTotales] = useState<TotalesCiclo | null>(null);
  const [categorias, setCategorias] = useState<CategoriaSimple[]>([]);
  const [medios, setMedios] = useState<MedioDePago[]>([]);
  const [cargando, setCargando] = useState(true);
  const [expandida, setExpandida] = useState(false);
  const [detalle, setDetalle] = useState<MovimientoFila | null>(null);
  const [hojaConciliar, setHojaConciliar] = useState(false);
  const [hojaPagar, setHojaPagar] = useState(false);

  const cargar = useCallback(async () => {
    if (!id || !tarjetaId) return;
    const s = await obtenerSesionHogar();
    if (!s) return;
    setSesion(s);
    const t = await obtenerTarjeta(s, tarjetaId);
    setTarjeta(t);
    if (!t) return;
    const [movs, tot, cats, meds] = await Promise.all([
      movimientosDeCiclo(s, id),
      totalesDeCiclo(s, id, t.impuestosCentavos),
      categoriasDelHogar(s),
      mediosDePago(s),
    ]);
    setMovimientos(movs);
    setTotales(tot);
    setCategorias(cats);
    setMedios(meds);
  }, [id, tarjetaId]);

  useEffect(() => {
    cargar().finally(() => setCargando(false));
  }, [cargar]);

  // al volver (p. ej. de editar un consumo en otra pantalla), refrescar; el
  // detalle se cierra porque un Modal no se desmonta con la navegación
  useFocusEffect(
    useCallback(() => {
      cargar();
      return () => setDetalle(null);
    }, [cargar]),
  );

  const hoy = hoyBA();
  const ciclo: CicloFila | null =
    tarjeta?.ciclos.find((c) => c.id === id) ?? null;

  // vigente y ciclo anterior se calculan sobre el orden ascendente (web)
  const ascendentes = tarjeta
    ? [...tarjeta.ciclos].sort((a, b) => a.fechaCierre.localeCompare(b.fechaCierre))
    : [];
  const indice = ciclo ? ascendentes.findIndex((c) => c.id === ciclo.id) : -1;
  const esVigente =
    ascendentes.length > 0 && indice === indiceCicloVigente(ascendentes, hoy);
  const anterior = indice > 0 ? ascendentes[indice - 1] : null;
  // inicio del ciclo: día después del cierre anterior (o cierre − 30 si es el primero)
  const inicio = ciclo
    ? anterior
      ? sumarDias(anterior.fechaCierre, 1)
      : sumarDias(ciclo.fechaCierre, -30)
    : null;

  // Conciliación / pago — mismas condiciones que app/tarjetas/[id]/page.tsx
  const realCentavos = ciclo?.totalRealCentavos ?? null;
  const dif =
    ciclo && totales && ciclo.estado === "conciliado" && realCentavos !== null
      ? diferenciaConciliacion(realCentavos, totales.proyectadoCentavos)
      : null;
  const mostrarConciliar = ciclo ? esVigente || ciclo.fechaCierre <= hoy : false;
  const mostrarPago = ciclo
    ? ciclo.estado !== "abierto" ||
      ciclo.fechaCierre <= hoy ||
      (esVigente && diasEntre(hoy, ciclo.fechaVencimiento) <= 7)
    : false;
  const totalAPagar = realCentavos ?? totales?.proyectadoCentavos ?? 0;

  const cuentas: Cuenta[] = medios
    .filter((m): m is Extract<MedioDePago, { tipo: "cuenta" }> => m.tipo === "cuenta")
    .map((m) => ({ id: m.id, etiqueta: m.etiqueta }));

  const visibles = expandida ? movimientos : movimientos.slice(0, VISIBLES);
  const badgeFechas =
    ciclo?.estadoFechas === "confirmado" ? ("confirmada" as const) : ("estimada" as const);

  async function borrar(movimientoId: string) {
    if (!sesion) return;
    const r = await borrarMovimiento(sesion, movimientoId);
    if (!r.ok) Alert.alert("No pudimos borrarlo", r.error);
    await cargar();
  }

  return (
    <View style={e.pantalla}>
      <View style={[e.cabecera, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={20} color={color.tinta} strokeWidth={1.5} />
        </Pressable>
        <Text numberOfLines={1} style={e.titulo}>
          {tarjeta ? `${tarjeta.nombre} •• ${tarjeta.ultimos4}` : "Tarjeta"}
        </Text>
      </View>

      {cargando ? (
        <View style={e.centrado}>
          <ActivityIndicator color={color.verde} />
        </View>
      ) : !ciclo || !totales || !inicio ? (
        <View style={e.centrado}>
          <Text style={e.vacio}>No encontramos ese ciclo.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 32,
          }}
        >
          {/* ‹ Ciclo actual · 29 jun – 28 jul › (el paginador de la web,
              reducido a rótulo: acá se llega desde la lista de ciclos) */}
          <Text style={e.rangoCiclo}>
            {esVigente ? "Ciclo actual" : "Ciclo"} ·{" "}
            <Text style={e.rangoFecha}>
              {formatearDiaCorto(inicio)} – {formatearDiaCorto(ciclo.fechaCierre)}
            </Text>
          </Text>

          {/* Resumen proyectado (§3.24): monto grande + desglose label/valor */}
          <Card style={{ marginTop: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 }}>
            <View style={e.filaEtiqueta}>
              <Text style={e.etiquetaResumen}>Resumen proyectado</Text>
              <Badge variante={badgeFechas}>{badgeFechas}</Badge>
            </View>
            <View style={{ marginTop: 4 }}>
              <Importe centavos={totales.proyectadoCentavos} variante="card" />
            </View>
            <Text style={e.venceLinea}>
              cierra el <Text style={e.venceFecha}>{formatearDiaCorto(ciclo.fechaCierre)}</Text>{" "}
              · vence el <Text style={e.venceFecha}>{formatearDiaCorto(ciclo.fechaVencimiento)}</Text>
            </Text>

            <View style={e.desglose}>
              <View style={e.filaDesglose}>
                <Text style={e.desgloseEtiqueta}>Consumos del ciclo</Text>
                <Text style={e.desgloseValor}>
                  {formatearImporte(totales.consumosCentavos)}
                </Text>
              </View>
              <View style={e.filaDesglose}>
                <Text style={e.desgloseEtiqueta}>Cuotas del mes</Text>
                <Text style={e.desgloseValor}>
                  {formatearImporte(totales.cuotasCentavos)}
                </Text>
              </View>
              <View style={e.filaDesglose}>
                <Text style={e.desgloseEtiqueta}>Impuestos y cargos estimados</Text>
                <Text style={e.desgloseValor}>
                  {formatearImporte(totales.impuestosCentavos)}
                </Text>
              </View>
            </View>

            {dif && realCentavos !== null ? (
              <Text style={e.conciliadoLinea}>
                Conciliado:{" "}
                <Text style={e.conciliadoCifra}>{formatearImporte(realCentavos)}</Text>
                {" · "}diferencia{" "}
                <Text
                  style={[
                    e.conciliadoCifra,
                    { color: dif.tono === "verde" ? color.verde : color.ambarTexto },
                  ]}
                >
                  {dif.centavos > 0 ? "+ " : dif.centavos < 0 ? "− " : ""}
                  {formatearImporte(Math.abs(dif.centavos))}
                </Text>
              </Text>
            ) : mostrarConciliar ? (
              <Pressable
                onPress={() => {
                  tacto.toque();
                  setHojaConciliar(true);
                }}
                style={e.bloqueConciliar}
              >
                <View style={e.filaConciliar}>
                  <RefreshCw size={15} color={color.verde} strokeWidth={1.5} />
                  <Text style={e.conciliarTexto}>Conciliar resumen</Text>
                  <ChevronRight size={16} color={color.tintaMuda} strokeWidth={1.5} />
                </View>
                <Text style={e.conciliarAyuda}>
                  Cuando llegue el real, cargá el total y vemos la diferencia.
                </Text>
              </Pressable>
            ) : null}
          </Card>

          {/* Pago del resumen: cuando cerró, está conciliado o vence pronto */}
          {(mostrarPago || totales.pagadoCentavos > 0) && (
            <Card style={{ marginTop: 10 }}>
              {mostrarPago && (
                <Pressable
                  onPress={() => {
                    tacto.toque();
                    setHojaPagar(true);
                  }}
                  style={e.filaPagar}
                >
                  <Banknote size={18} color={color.tintaSecundaria} strokeWidth={1.5} />
                  <Text style={e.pagarTexto}>Pagar resumen</Text>
                  <ChevronRight size={16} color={color.tintaMuda} strokeWidth={1.5} />
                </Pressable>
              )}
              {totales.pagadoCentavos > 0 && (
                <Text style={[e.pagadoLinea, mostrarPago && e.pagadoBorde]}>
                  Pagado{" "}
                  <Text style={e.pagadoCifra}>
                    {formatearImporte(totales.pagadoCentavos)}
                  </Text>
                </Text>
              )}
            </Card>
          )}

          {/* Consumos del ciclo · N (§3.34): 5 filas + "Ver los N consumos →" */}
          <EncabezadoSeccion>
            Consumos del ciclo · {movimientos.length}
          </EncabezadoSeccion>
          {movimientos.length === 0 ? (
            <Card style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
              <Text style={e.vacio}>Sin consumos en este ciclo.</Text>
            </Card>
          ) : (
            <Card>
              {visibles.map((m, i) => (
                <Pressable
                  key={m.id}
                  onPress={() => setDetalle(m)}
                  style={i > 0 ? e.conBorde : undefined}
                >
                  <FilaMovimiento
                    descripcion={m.descripcion}
                    icono={m.icono}
                    metadata={[m.categoria, m.medio].filter(Boolean).join(" · ")}
                    importeCentavos={m.importeCentavos}
                    esIngreso={m.esIngreso}
                    ambito={m.ambito}
                    badgeCuota={m.badgeCuota}
                  />
                </Pressable>
              ))}
              {!expandida && movimientos.length > VISIBLES && (
                <Pressable onPress={() => setExpandida(true)} style={e.conBorde}>
                  <Text style={e.verMas}>
                    Ver los {movimientos.length} consumos →
                  </Text>
                </Pressable>
              )}
            </Card>
          )}
        </ScrollView>
      )}

      {ciclo && totales && (
        <>
          <HojaConciliar
            abierta={hojaConciliar}
            cicloId={ciclo.id}
            proyectadoCentavos={totales.proyectadoCentavos}
            sesion={sesion}
            alGuardar={cargar}
            alCerrar={() => setHojaConciliar(false)}
          />
          <HojaPagar
            abierta={hojaPagar}
            cicloId={ciclo.id}
            totalCentavos={totalAPagar}
            cuentas={cuentas}
            sesion={sesion}
            alGuardar={cargar}
            alCerrar={() => setHojaPagar(false)}
          />
        </>
      )}

      <DetalleMovimiento
        movimiento={detalle}
        sesion={sesion}
        categorias={categorias}
        medios={medios}
        alCambiar={cargar}
        alCerrar={() => setDetalle(null)}
        alBorrar={() => {
          const movId = detalle?.id;
          setDetalle(null);
          if (movId) borrar(movId);
        }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────── hoja: conciliar resumen
//
// UN solo campo con el total real en pesos enteros y la diferencia contra lo
// proyectado EN VIVO debajo, con color semántico (verde chica, ámbar grande).
// Sin matching línea por línea: cargás el total y listo. Espeja Conciliacion.tsx.

function HojaConciliar({
  abierta,
  cicloId,
  proyectadoCentavos,
  sesion,
  alGuardar,
  alCerrar,
}: {
  abierta: boolean;
  cicloId: string;
  proyectadoCentavos: number;
  sesion: SesionHogar | null;
  alGuardar: () => Promise<void> | void;
  alCerrar: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [pesos, setPesos] = useState(""); // solo dígitos, pesos enteros
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (abierta) {
      setPesos("");
      setGuardando(false);
    }
  }, [abierta]);

  const centavos = pesos === "" ? null : Number(pesos) * 100;
  const dif =
    centavos !== null ? diferenciaConciliacion(centavos, proyectadoCentavos) : null;
  const listo = centavos !== null && centavos > 0;

  async function guardar() {
    if (!listo || guardando || !sesion || centavos === null) return;
    setGuardando(true);
    const r = await conciliarResumen(sesion, { cicloId, totalRealCentavos: centavos });
    setGuardando(false);
    if (r.ok) {
      tacto.guardado();
      alCerrar();
      await alGuardar();
    } else {
      Alert.alert("No pudimos conciliar", r.error);
    }
  }

  return (
    <Modal visible={abierta} transparent animationType="slide" onRequestClose={alCerrar}>
      <KeyboardAvoidingView
        style={h.lleno}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={h.fondo} onPress={alCerrar} />
        <View style={[h.hoja, { paddingBottom: Math.max(20, insets.bottom) }]}>
          <View aria-hidden style={h.agarre} />
          <View style={h.filaTitulo}>
            <Text style={h.titulo}>Conciliar resumen</Text>
            <Pressable onPress={alCerrar} hitSlop={10}>
              <X size={22} color={color.tintaSecundaria} strokeWidth={2} />
            </Pressable>
          </View>

          <Text style={h.etiqueta}>Total real del resumen</Text>
          <View style={h.campoImporte}>
            <Text style={h.pesoSigno}>$</Text>
            <TextInput
              value={pesos}
              onChangeText={(t) => setPesos(t.replace(/\D/g, "").slice(0, 9))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={color.tintaTerciaria}
              style={h.campoTexto}
            />
          </View>

          {dif && (
            <Text
              style={[
                h.diferencia,
                { color: dif.tono === "verde" ? color.verde : color.ambarTexto },
              ]}
            >
              {dif.centavos === 0 ? (
                "clavado al proyectado"
              ) : (
                <>
                  <Text style={h.diferenciaCifra}>
                    {dif.centavos > 0 ? "+ " : "− "}
                    {formatearImporte(Math.abs(dif.centavos))}
                  </Text>
                  {dif.centavos > 0 ? " sobre lo proyectado" : " bajo lo proyectado"}
                </>
              )}
            </Text>
          )}

          <Pressable
            onPress={guardar}
            disabled={!listo || guardando}
            style={[h.cta, (!listo || guardando) && { opacity: 0.4 }]}
          >
            <Text style={h.ctaTexto}>{guardando ? "Guardando…" : "Guardar"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─────────────────────────────────────────────── hoja: pagar resumen
//
// Monto prefijado al total (real si está conciliado, si no proyectado) con
// chips "Total" / "Otro monto", y la cuenta de origen como chips (solo
// cuentas: un resumen no se paga con otra tarjeta). El pago es una
// transferencia y JAMÁS computa como gasto. Espeja PagoResumen.tsx.

function HojaPagar({
  abierta,
  cicloId,
  totalCentavos,
  cuentas,
  sesion,
  alGuardar,
  alCerrar,
}: {
  abierta: boolean;
  cicloId: string;
  totalCentavos: number;
  cuentas: Cuenta[];
  sesion: SesionHogar | null;
  alGuardar: () => Promise<void> | void;
  alCerrar: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [modo, setModo] = useState<"total" | "otro">("total");
  const [pesos, setPesos] = useState("");
  const [cuentaId, setCuentaId] = useState<string | null>(null);
  const [registrando, setRegistrando] = useState(false);

  const pesosTotal = String(Math.round(totalCentavos / 100));

  useEffect(() => {
    if (abierta) {
      setModo("total");
      setPesos(String(Math.round(totalCentavos / 100)));
      setCuentaId(cuentas[0]?.id ?? null);
      setRegistrando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta]);

  // en modo "total" se paga el total EXACTO (con sus centavos sub-peso, que el
  // input de pesos enteros no puede representar); "otro" usa lo tecleado
  const centavos =
    modo === "total" ? totalCentavos : pesos === "" ? 0 : Number(pesos) * 100;
  const listo = cuentaId !== null && centavos > 0;

  async function registrar() {
    if (!listo || registrando || !sesion || cuentaId === null) return;
    setRegistrando(true);
    const r = await pagarResumen(sesion, {
      cicloId,
      cuentaId,
      importeCentavos: centavos,
    });
    setRegistrando(false);
    if (r.ok) {
      tacto.guardado();
      alCerrar();
      await alGuardar();
    } else {
      Alert.alert("No pudimos registrar el pago", r.error);
    }
  }

  return (
    <Modal visible={abierta} transparent animationType="slide" onRequestClose={alCerrar}>
      <KeyboardAvoidingView
        style={h.lleno}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={h.fondo} onPress={alCerrar} />
        <View style={[h.hoja, { paddingBottom: Math.max(20, insets.bottom) }]}>
          <View aria-hidden style={h.agarre} />
          <View style={h.filaTitulo}>
            <Text style={h.titulo}>Pagar resumen</Text>
            <Pressable onPress={alCerrar} hitSlop={10}>
              <X size={22} color={color.tintaSecundaria} strokeWidth={2} />
            </Pressable>
          </View>

          <View style={h.chips}>
            <Pressable
              onPress={() => {
                tacto.toque();
                setModo("total");
                setPesos(pesosTotal);
              }}
              style={[h.chip, modo === "total" && h.chipActiva]}
            >
              <Text style={[h.chipTexto, modo === "total" && h.chipTextoActivo]}>
                Total
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                tacto.toque();
                setModo("otro");
                setPesos("");
              }}
              style={[h.chip, modo === "otro" && h.chipActiva]}
            >
              <Text style={[h.chipTexto, modo === "otro" && h.chipTextoActivo]}>
                Otro monto
              </Text>
            </Pressable>
          </View>

          <Text style={h.etiqueta}>Monto</Text>
          <View style={h.campoImporte}>
            <Text style={h.pesoSigno}>$</Text>
            <TextInput
              value={pesos}
              onChangeText={(t) => {
                setModo("otro");
                setPesos(t.replace(/\D/g, "").slice(0, 9));
              }}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={color.tintaTerciaria}
              style={h.campoTexto}
            />
          </View>
          <Text style={h.ayuda}>
            Total del resumen:{" "}
            <Text style={h.ayudaCifra}>{formatearImporte(totalCentavos)}</Text>
          </Text>

          <Text style={h.etiqueta}>Desde la cuenta</Text>
          <View style={h.chips}>
            {cuentas.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => {
                  tacto.toque();
                  setCuentaId(c.id);
                }}
                style={[h.chip, c.id === cuentaId && h.chipActiva]}
              >
                <Text style={[h.chipTexto, c.id === cuentaId && h.chipTextoActivo]}>
                  {c.etiqueta}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={registrar}
            disabled={!listo || registrando}
            style={[h.cta, (!listo || registrando) && { opacity: 0.4 }]}
          >
            <Text style={h.ctaTexto}>
              {registrando ? "Registrando…" : "Registrar pago"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  titulo: { flex: 1, fontSize: 17, fontFamily: fuente.textoSemi, color: color.tinta },
  vacio: { fontSize: 13, fontFamily: fuente.texto, color: color.tintaSecundaria },
  rangoCiclo: {
    marginTop: 2,
    textAlign: "center",
    fontSize: 13,
    fontFamily: fuente.textoSemi,
    color: color.tinta,
  },
  rangoFecha: {
    fontFamily: fuente.monoSemi,
    fontVariant: ["tabular-nums"],
  },
  filaEtiqueta: { flexDirection: "row", alignItems: "center", gap: 8 },
  etiquetaResumen: {
    fontSize: 12,
    fontFamily: fuente.textoMedio,
    color: color.tintaSecundaria,
  },
  venceLinea: {
    marginTop: 6,
    fontSize: 11.5,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
  },
  venceFecha: {
    fontFamily: fuente.monoMedio,
    fontVariant: ["tabular-nums"],
    color: color.tinta,
  },
  desglose: { marginTop: 12, gap: 6 },
  filaDesglose: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  desgloseEtiqueta: {
    fontSize: 12.5,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
    flexShrink: 1,
  },
  desgloseValor: {
    fontSize: 12.5,
    fontFamily: fuente.monoMedio,
    fontVariant: ["tabular-nums"],
    color: color.tinta,
  },
  conciliadoLinea: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: color.separador,
    fontSize: 12.5,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
  },
  conciliadoCifra: {
    fontFamily: fuente.monoMedio,
    fontVariant: ["tabular-nums"],
    color: color.tinta,
  },
  bloqueConciliar: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: color.separador,
  },
  filaConciliar: { flexDirection: "row", alignItems: "center", gap: 8 },
  conciliarTexto: {
    flex: 1,
    fontSize: 13,
    fontFamily: fuente.textoMedio,
    color: color.verde,
  },
  conciliarAyuda: {
    marginTop: 4,
    fontSize: 11,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
  },
  filaPagar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pagarTexto: {
    flex: 1,
    fontSize: 13.5,
    fontFamily: fuente.textoMedio,
    color: color.tinta,
  },
  pagadoLinea: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 12,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
  },
  pagadoBorde: { borderTopWidth: 1, borderTopColor: color.separador },
  pagadoCifra: {
    fontFamily: fuente.monoSemi,
    fontVariant: ["tabular-nums"],
    color: color.tinta,
  },
  conBorde: { borderTopWidth: 1, borderTopColor: color.separador },
  verMas: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13.5,
    fontFamily: fuente.textoMedio,
    color: color.verde,
  },
});

const h = StyleSheet.create({
  lleno: { flex: 1, justifyContent: "flex-end" },
  fondo: {
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
  filaTitulo: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titulo: { fontSize: 16, fontFamily: fuente.textoSemi, color: color.tinta },
  etiqueta: {
    marginTop: 16,
    marginBottom: 6,
    fontSize: 11.5,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
  },
  chips: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.papel,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActiva: { borderColor: color.verde, backgroundColor: color.verdeSuave },
  chipTexto: {
    fontSize: 12.5,
    fontFamily: fuente.textoMedio,
    color: color.tintaSecundaria,
  },
  chipTextoActivo: { color: color.verde },
  campoImporte: {
    height: 56,
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.papel,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pesoSigno: {
    fontSize: 22,
    fontFamily: fuente.mono,
    color: color.tintaSecundaria,
  },
  campoTexto: {
    flex: 1,
    fontSize: 26,
    fontFamily: fuente.monoSemi,
    fontVariant: ["tabular-nums"],
    color: color.tinta,
  },
  diferencia: {
    marginTop: 10,
    fontSize: 12.5,
    fontFamily: fuente.textoMedio,
  },
  diferenciaCifra: {
    fontFamily: fuente.monoSemi,
    fontVariant: ["tabular-nums"],
  },
  ayuda: {
    marginTop: 8,
    fontSize: 11.5,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
  },
  ayudaCifra: {
    fontFamily: fuente.mono,
    fontVariant: ["tabular-nums"],
    color: color.tinta,
  },
  cta: {
    marginTop: 18,
    height: 48,
    borderRadius: radio.cta,
    backgroundColor: color.verde,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaTexto: { fontSize: 15, fontFamily: fuente.textoSemi, color: color.papel },
});
