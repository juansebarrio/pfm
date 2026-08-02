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
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  type Href,
} from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { formatearImporte } from "@dominio/dinero";
import { diaDelMes, formatearDiaCorto, hoyBA } from "@dominio/fechas";
import {
  obtenerSesionHogar,
  obtenerTarjeta,
  type CicloFila,
  type DetalleTarjeta,
  type SesionHogar,
} from "@/lib/datos";
import { actualizarDiaCierre, indiceCicloVigente } from "@/lib/acciones-tarjeta";
import { color, fuente, radio } from "@/lib/tema";
import { tacto } from "@/lib/tacto";
import { Badge, Card, EncabezadoSeccion, Importe } from "@/componentes/sistema";

// 06 — Detalle de tarjeta. El PRÓXIMO resumen es el héroe (como en la web:
// cierre, vencimiento y total proyectado protagonistas) y los demás ciclos van
// debajo, todos tocables → detalle de ciclo con conciliación y pago.
//
// El "sin día de cierre" nunca se muestra como dato roto: si hay ciclos se
// deriva "cierra alrededor del N · estimado" del último; si no hay nada, es
// una acción que abre la hoja para cargarlo.

const ETIQUETA_ESTADO: Record<string, string> = {
  abierto: "abierto",
  cerrado: "cerrado",
  conciliado: "conciliado",
};

export default function Tarjeta() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [sesion, setSesion] = useState<SesionHogar | null>(null);
  const [tarjeta, setTarjeta] = useState<DetalleTarjeta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [hojaCierre, setHojaCierre] = useState(false);

  const cargar = useCallback(async () => {
    if (!id) return;
    const s = await obtenerSesionHogar();
    if (!s) return;
    setSesion(s);
    setTarjeta(await obtenerTarjeta(s, id));
  }, [id]);

  useEffect(() => {
    cargar().finally(() => setCargando(false));
  }, [cargar]);

  // al volver del detalle de un ciclo (conciliar / pagar), refrescar totales
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const hoy = hoyBA();
  // obtenerTarjeta ordena descendente; el índice vigente se calcula ascendente
  const ascendentes = tarjeta
    ? [...tarjeta.ciclos].sort((a, b) => a.fechaCierre.localeCompare(b.fechaCierre))
    : [];
  const vigente =
    ascendentes.length > 0 ? ascendentes[indiceCicloVigente(ascendentes, hoy)] : null;
  const demas = tarjeta ? tarjeta.ciclos.filter((c) => c.id !== vigente?.id) : [];
  const ultimo = ascendentes.length > 0 ? ascendentes[ascendentes.length - 1] : null;

  function abrirCiclo(c: CicloFila) {
    tacto.toque();
    router.push(`/tarjeta/ciclo/${c.id}?tarjeta=${id}` as Href);
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
      ) : !tarjeta ? (
        <View style={e.centrado}>
          <Text style={e.vacio}>No encontramos esa tarjeta.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 32,
          }}
        >
          <Card style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
            {tarjeta.diaCierre ? (
              <Text style={e.meta}>
                {tarjeta.banco} · cierra el {tarjeta.diaCierre} de cada mes
              </Text>
            ) : ultimo ? (
              // sin día cargado pero con ciclos: el dato se deriva, no se rompe
              <Text style={e.meta}>
                {tarjeta.banco} · cierra alrededor del {diaDelMes(ultimo.fechaCierre)}{" "}
                <Text style={{ color: color.ambarTexto }}>· estimado</Text>
              </Text>
            ) : (
              // sin día y sin ciclos: es una acción, no un dato faltante
              <Pressable onPress={() => setHojaCierre(true)} hitSlop={6}>
                <Text style={e.meta}>
                  {tarjeta.banco} · sin día de cierre{" "}
                  <Text style={e.metaAccion}>· cargalo</Text>
                </Text>
              </Pressable>
            )}
            {tarjeta.impuestosCentavos > 0 && (
              <Text style={[e.meta, { marginTop: 4 }]}>
                impuestos estimados por resumen:{" "}
                {formatearImporte(tarjeta.impuestosCentavos)}
              </Text>
            )}
          </Card>

          {/* Héroe: el próximo resumen, con cierre/vencimiento/proyectado
              protagonistas. Tocable → detalle del ciclo. */}
          {vigente && (
            <Pressable onPress={() => abrirCiclo(vigente)}>
              <Card style={{ marginTop: 12, paddingHorizontal: 16, paddingVertical: 14 }}>
                <View style={e.filaHero}>
                  <Text style={e.heroEtiqueta}>Próximo resumen</Text>
                  <Badge
                    variante={
                      vigente.estadoFechas === "confirmado" ? "confirmada" : "estimada"
                    }
                  >
                    {vigente.estadoFechas === "confirmado" ? "confirmada" : "estimada"}
                  </Badge>
                  <View style={{ flex: 1 }} />
                  <ChevronRight size={18} color={color.tintaMuda} strokeWidth={1.5} />
                </View>
                <View style={{ marginTop: 4 }}>
                  <Importe
                    centavos={vigente.totalRealCentavos ?? vigente.proyectadoCentavos}
                    variante="card"
                  />
                </View>
                <Text style={e.heroPie}>
                  {vigente.totalRealCentavos !== null ? "total del resumen" : "proyectado"}{" "}
                  · cierra el <Text style={e.heroFecha}>{formatearDiaCorto(vigente.fechaCierre)}</Text>{" "}
                  · vence el <Text style={e.heroFecha}>{formatearDiaCorto(vigente.fechaVencimiento)}</Text>
                </Text>
              </Card>
            </Pressable>
          )}

          {tarjeta.ciclos.length === 0 ? (
            <>
              <EncabezadoSeccion>Ciclos</EncabezadoSeccion>
              <Card style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
                <Text style={e.meta}>
                  Todavía no hay ciclos. Se crean solos al cargar el primer consumo.
                </Text>
              </Card>
            </>
          ) : demas.length > 0 ? (
            <>
              <EncabezadoSeccion>Otros ciclos</EncabezadoSeccion>
              <View style={{ gap: 8 }}>
                {demas.map((c) => {
                  // conciliado manda el total real; si no, el proyectado
                  const conciliado = c.totalRealCentavos !== null;
                  return (
                    <Pressable key={c.id} onPress={() => abrirCiclo(c)}>
                      <Card style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
                        <View style={e.filaCiclo}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={e.cierre}>
                              Cierra el {formatearDiaCorto(c.fechaCierre)}
                            </Text>
                            <Text style={e.vence}>
                              vence el {formatearDiaCorto(c.fechaVencimiento)} ·{" "}
                              {ETIQUETA_ESTADO[c.estado] ?? c.estado}
                            </Text>
                          </View>
                          <Badge
                            variante={
                              c.estadoFechas === "confirmado" ? "confirmada" : "estimada"
                            }
                          >
                            {c.estadoFechas === "confirmado" ? "confirmada" : "estimada"}
                          </Badge>
                          <ChevronRight
                            size={16}
                            color={color.tintaMuda}
                            strokeWidth={1.5}
                          />
                        </View>
                        <View style={e.filaTotal}>
                          <Text style={e.totalEtiqueta}>
                            {conciliado ? "total del resumen" : "proyectado"}
                          </Text>
                          <Importe
                            centavos={c.totalRealCentavos ?? c.proyectadoCentavos}
                            variante="fila"
                          />
                        </View>
                      </Card>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
        </ScrollView>
      )}

      {tarjeta && (
        <HojaDiaCierre
          abierta={hojaCierre}
          tarjetaId={id ?? ""}
          sesion={sesion}
          alGuardar={cargar}
          alCerrar={() => setHojaCierre(false)}
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────── hoja: cargar día de cierre
//
// Hoja mínima con el patrón de AgregarPartida: un solo campo (1–28) y el CTA.
// La escritura espeja guardarTarjeta de la web (acciones-tarjeta.ts).

function HojaDiaCierre({
  abierta,
  tarjetaId,
  sesion,
  alGuardar,
  alCerrar,
}: {
  abierta: boolean;
  tarjetaId: string;
  sesion: SesionHogar | null;
  alGuardar: () => Promise<void> | void;
  alCerrar: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);

  // cada apertura arranca vacía
  useEffect(() => {
    if (abierta) {
      setTexto("");
      setGuardando(false);
    }
  }, [abierta]);

  const dia = /^\d{1,2}$/.test(texto) ? Number(texto) : null;
  const listo = dia !== null && dia >= 1 && dia <= 28;

  async function guardar() {
    if (!listo || guardando || !sesion || dia === null) return;
    setGuardando(true);
    const r = await actualizarDiaCierre(sesion, { tarjetaId, diaCierre: dia });
    setGuardando(false);
    if (r.ok) {
      tacto.guardado();
      alCerrar();
      await alGuardar();
    } else {
      Alert.alert("No pudimos guardarlo", r.error);
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
            <Text style={h.titulo}>Día de cierre</Text>
            <Pressable onPress={alCerrar} hitSlop={10}>
              <X size={22} color={color.tintaSecundaria} strokeWidth={2} />
            </Pressable>
          </View>

          <Text style={h.etiqueta}>Día del mes (1 al 28)</Text>
          <TextInput
            value={texto}
            onChangeText={(t) => setTexto(t.replace(/\D/g, "").slice(0, 2))}
            keyboardType="number-pad"
            placeholder="28"
            placeholderTextColor={color.tintaTerciaria}
            style={[
              h.campo,
              texto !== "" && !listo && { borderColor: color.rojo },
            ]}
          />
          <Text style={h.ayuda}>
            El día en que el banco te corta el resumen. Con eso armamos los
            ciclos estimados.
          </Text>

          <Pressable
            onPress={guardar}
            disabled={!listo || guardando}
            style={[h.cta, (!listo || guardando) && { opacity: 0.4 }]}
          >
            <Text style={h.ctaTexto}>
              {guardando ? "Guardando…" : "Guardar el día de cierre"}
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
  meta: { fontSize: 12, fontFamily: fuente.texto, color: color.tintaSecundaria },
  metaAccion: { color: color.verde, fontFamily: fuente.textoMedio },
  vacio: { fontSize: 14, fontFamily: fuente.texto, color: color.tintaSecundaria },
  filaHero: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroEtiqueta: {
    fontSize: 12,
    fontFamily: fuente.textoMedio,
    color: color.tintaSecundaria,
  },
  heroPie: {
    marginTop: 6,
    fontSize: 11.5,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
  },
  heroFecha: {
    fontFamily: fuente.monoMedio,
    fontVariant: ["tabular-nums"],
    color: color.tinta,
  },
  filaCiclo: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cierre: { fontSize: 14, fontFamily: fuente.textoMedio, color: color.tinta },
  vence: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
  },
  filaTotal: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: color.separador,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  totalEtiqueta: { fontSize: 11, fontFamily: fuente.texto, color: color.tintaSecundaria },
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
  campo: {
    height: 56,
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.papel,
    paddingHorizontal: 14,
    fontSize: 26,
    fontFamily: fuente.monoSemi,
    fontVariant: ["tabular-nums"],
    color: color.tinta,
  },
  ayuda: {
    marginTop: 8,
    fontSize: 11.5,
    lineHeight: 17,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
  },
  cta: {
    marginTop: 16,
    height: 48,
    borderRadius: radio.cta,
    backgroundColor: color.verde,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaTexto: { fontSize: 15, fontFamily: fuente.textoSemi, color: color.papel },
});
