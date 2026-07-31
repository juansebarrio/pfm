import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Inbox, ListChecks } from "lucide-react-native";
import { formatearImporte } from "@dominio/dinero";
import {
  etiquetaDia,
  formatearDiaCorto,
  formatearMesLargo,
  hoyBA,
  mesDe,
} from "@dominio/fechas";
import {
  bandejaDeEntrada,
  gastosPorCategoria,
  movimientosCategorizados,
  obtenerSesionHogar,
  totalesDelMes,
  type MovimientoFila,
  type SesionHogar,
  type TotalesMes,
} from "@/lib/datos";
import {
  actualizarFechasEnLote,
  borrarMovimiento,
  categoriasDelHogar,
  categorizarMovimiento,
  type CategoriaSimple,
} from "@/lib/acciones";
import { color, radio } from "@/lib/tema";
import { useModoSeleccion } from "@/lib/modo-seleccion";
import { tacto } from "@/lib/tacto";
import {
  Card,
  EstadoVacio,
  IconoCategoria,
  Importe,
} from "@/componentes/sistema";
import { FilaSwipe } from "@/componentes/FilaSwipe";
import { DetalleMovimiento } from "@/componentes/DetalleMovimiento";
import { NavegadorMes } from "@/componentes/NavegadorMes";
import { PorCategoria } from "@/componentes/PorCategoria";
import { Solapas } from "@/componentes/Solapas";
import {
  BarraSeleccion,
  FilaSeleccionable,
} from "@/componentes/SeleccionMovimientos";

// 05 — Movimientos: bandeja de entrada (lo que llegó sin categoría) arriba, y
// abajo el historial agrupado por día. La bandeja lleva el borde cálido, único
// en el sistema (§3.8).
//
// Con flechas para moverse mes a mes y un modo SELECCIÓN para cambiarle la
// fecha a varios de una — que es como se arrastra medio mes al siguiente sin
// abrir uno por uno. Paridad con la web; el cambio de a uno sigue en el detalle.

/** Agrupa el historial por fecha, conservando el orden. */
function porDia(movimientos: MovimientoFila[], hoy: string) {
  const grupos: Array<{ etiqueta: string; items: MovimientoFila[] }> = [];
  for (const m of movimientos) {
    const etiqueta = etiquetaDia(m.fecha, hoy);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.etiqueta === etiqueta) ultimo.items.push(m);
    else grupos.push({ etiqueta, items: [m] });
  }
  return grupos;
}

export default function Movimientos() {
  const insets = useSafeAreaInsets();
  const [sesion, setSesion] = useState<SesionHogar | null>(null);
  const [bandeja, setBandeja] = useState<MovimientoFila[]>([]);
  const [historial, setHistorial] = useState<MovimientoFila[]>([]);
  const [categorias, setCategorias] = useState<CategoriaSimple[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  // categorización inline: qué ítem está abierto y cuáles ya se ocultaron
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [ocultos, setOcultos] = useState<string[]>([]);
  const [detalle, setDetalle] = useState<MovimientoFila | null>(null);
  const [totales, setTotales] = useState<TotalesMes | null>(null);
  const [vista, setVista] = useState<"lista" | "categorias">("lista");
  const [porCategoria, setPorCategoria] = useState<
    Array<{ clave: string; nombre: string; icono: string | null; centavos: number }>
  >([]);

  const hoy = hoyBA();
  const mesActual = mesDe(hoy);
  const [mes, setMes] = useState(mesActual);
  const esMesActual = mes === mesActual;

  // el layout de las tabs esconde la pastilla flotante mientras seleccionás
  const { activo: seleccionando, setActivo: setSeleccionando } = useModoSeleccion();
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [fechaDestino, setFechaDestino] = useState(hoy);
  const [moviendo, setMoviendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const s = await obtenerSesionHogar();
    if (!s) return;
    setSesion(s);
    const [b, h, c, t, pc] = await Promise.all([
      bandejaDeEntrada(s),
      movimientosCategorizados(s, { mes }),
      categoriasDelHogar(s),
      totalesDelMes(s, mes),
      gastosPorCategoria(s, mes),
    ]);
    setPorCategoria(pc);
    setBandeja(b);
    setHistorial(h);
    setCategorias(c);
    setTotales(t);
    setOcultos([]);
  }, [mes]);

  useEffect(() => {
    cargar().finally(() => setCargando(false));
  }, [cargar]);

  // al volver de cargar un gasto, refrescar sin spinner de pantalla completa.
  // Al salir se cierra el detalle: un Modal no se desmonta con la navegación y
  // si no, queda flotando arriba de la pantalla siguiente.
  useFocusEffect(
    useCallback(() => {
      cargar();
      return () => {
        setDetalle(null);
        // al irse de la pantalla se sale del modo: si no, la pastilla se
        // quedaría escondida en las otras tabs
        setSeleccionando(false);
        setElegidos([]);
      };
    }, [cargar]),
  );

  async function refrescar() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  /** Optimista: la fila sale de la bandeja al instante y luego se reconcilia. */
  async function categorizar(movimientoId: string, categoriaId: string) {
    if (!sesion) return;
    setOcultos((prev) => [...prev, movimientoId]);
    setAbiertoId(null);
    const r = await categorizarMovimiento(sesion, movimientoId, categoriaId);
    if (!r.ok) setOcultos((prev) => prev.filter((id) => id !== movimientoId));
    else await cargar();
  }

  /** Igual que categorizar: la fila desaparece ya y se reconcilia contra la base. */
  async function borrar(movimientoId: string) {
    if (!sesion) return;
    setOcultos((prev) => [...prev, movimientoId]);
    const r = await borrarMovimiento(sesion, movimientoId);
    if (!r.ok) {
      setOcultos((prev) => prev.filter((id) => id !== movimientoId));
      Alert.alert("No pudimos borrarlo", r.error);
    } else {
      await cargar();
    }
  }

  function alternar(id: string) {
    setElegidos((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function salirDeSeleccion() {
    setSeleccionando(false);
    setElegidos([]);
  }

  async function mover() {
    if (!sesion || elegidos.length === 0 || moviendo) return;
    setMoviendo(true);
    setAviso(null);
    const r = await actualizarFechasEnLote(sesion, elegidos, fechaDestino);
    setMoviendo(false);
    if (!r.ok) {
      Alert.alert("No pudimos moverlos", r.error);
      return;
    }
    tacto.guardado();
    // el resultado se cuenta como pasó: si alguna cuota se coló, se dice
    setAviso(
      `${r.movidos === 1 ? "Moviste 1 movimiento" : `Moviste ${r.movidos} movimientos`} al ${formatearDiaCorto(fechaDestino)}` +
        (r.omitidos > 0
          ? ` · ${r.omitidos === 1 ? "1 cuota quedó" : `${r.omitidos} cuotas quedaron`} afuera`
          : ""),
    );
    salirDeSeleccion();
    await cargar();
  }

  if (cargando) {
    return (
      <View style={e.centrado}>
        <ActivityIndicator color={color.verde} />
      </View>
    );
  }

  const visiblesBandeja = bandeja.filter((m) => !ocultos.includes(m.id));
  // las cuotas no entran: su fecha la manda la serie de la compra
  const seleccionables = historial.filter(
    (m) => !m.badgeCuota && !ocultos.includes(m.id),
  );
  const todosElegidos =
    seleccionables.length > 0 && elegidos.length === seleccionables.length;
  const grupos = porDia(
    historial.filter((m) => !ocultos.includes(m.id)),
    hoy,
  );

  return (
    <>
    <ScrollView
      style={e.pantalla}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingHorizontal: 20,
        paddingBottom: insets.bottom + 24,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refrescando}
          onRefresh={refrescar}
          tintColor={color.tintaSecundaria}
        />
      }
    >
      <Text style={e.titulo}>Movimientos</Text>

      <NavegadorMes
        mes={mes}
        mesActual={mesActual}
        alCambiar={(nuevo) => {
          salirDeSeleccion();
          setMes(nuevo);
        }}
      />

      <Solapas
        activa={vista}
        opciones={[
          { clave: "lista" as const, etiqueta: "Lista" },
          { clave: "categorias" as const, etiqueta: "Por categoría" },
        ]}
        alElegir={(v) => {
          salirDeSeleccion();
          setVista(v);
        }}
      />

      {aviso && <Text style={e.aviso}>{aviso}</Text>}

      {vista === "categorias" ? (
        <PorCategoria
          items={porCategoria}
          totalGastosCentavos={totales?.gastosCentavos}
          vacio={`No cargaste gastos en ${formatearMesLargo(mes)}. Cuando cargues alguno, acá vas a ver en qué se te fue.`}
        />
      ) : (
        <>
      {/* Totalizador del mes: lo que entró, lo que salió y el saldo. Es caja
          (ingresos − gastos), no el "disponible" del presupuesto. */}
      {totales && (
        <View style={e.totalizador}>
          <View style={e.totalCol}>
            <Text style={e.totalEtiqueta}>Ingresos</Text>
            <Text numberOfLines={1} style={[e.totalCifra, { color: color.verde }]}>
              {formatearImporte(totales.ingresosCentavos)}
            </Text>
          </View>
          <View style={[e.totalCol, e.totalConBorde]}>
            <Text style={e.totalEtiqueta}>Gastos</Text>
            <Text numberOfLines={1} style={e.totalCifra}>
              {formatearImporte(totales.gastosCentavos)}
            </Text>
          </View>
          <View style={[e.totalCol, e.totalConBorde]}>
            <Text style={e.totalEtiqueta}>Balance</Text>
            <Text
              numberOfLines={1}
              style={[
                e.totalCifra,
                {
                  color:
                    totales.ingresosCentavos - totales.gastosCentavos < 0
                      ? color.rojo
                      : color.verde,
                },
              ]}
            >
              {formatearImporte(totales.ingresosCentavos - totales.gastosCentavos)}
            </Text>
          </View>
        </View>
      )}

      {/* Bandeja de entrada: borde cálido + contador ámbar. Tocar un ítem
          despliega las categorías; al asignar, pasa al historial.
          Solo en el mes en curso: es una lista de PENDIENTES, no un corte
          histórico — verla mirando mayo haría pensar que son de mayo. */}
      {visiblesBandeja.length > 0 && esMesActual && !seleccionando && (
        <View style={e.bandeja}>
          <View style={e.bandejaEncabezado}>
            <Inbox size={15} color={color.ambar} strokeWidth={1.5} />
            <Text style={e.bandejaTitulo}>Bandeja de entrada</Text>
            <View style={e.contador}>
              <Text style={e.contadorTexto}>{visiblesBandeja.length}</Text>
            </View>
          </View>
          {visiblesBandeja.map((m, i) => {
            const abierto = abiertoId === m.id;
            // un ingreso se categoriza con las de Ingresos; un gasto, con el resto
            const delAmbito = categorias.filter(
              (c) =>
                c.ambito === m.ambito &&
                (m.esIngreso ? c.grupo === "Ingresos" : c.grupo !== "Ingresos"),
            );
            return (
              <View key={m.id} style={i > 0 ? e.conBorde : undefined}>
                <Pressable
                  onPress={() => setAbiertoId(abierto ? null : m.id)}
                  style={e.bandejaFila}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={e.bandejaDescripcion}>
                      {m.descripcion}
                    </Text>
                    <Text numberOfLines={1} style={e.bandejaMeta}>
                      {[etiquetaDia(m.fecha, hoy).toLowerCase(), m.medio]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                  <Importe
                    centavos={m.importeCentavos}
                    variante="fila"
                    conSigno={m.esIngreso}
                    color={m.esIngreso ? color.verde : color.tinta}
                  />
                </Pressable>

                {abierto && (
                  <View style={e.chipsCategoria}>
                    {delAmbito.map((c) => (
                      <Pressable
                        key={c.id}
                        onPress={() => categorizar(m.id, c.id)}
                        style={e.chipCategoria}
                      >
                        <IconoCategoria nombre={c.icono} tamano={13} />
                        <Text style={e.chipCategoriaTexto}>{c.nombre}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Historial agrupado por día */}
      {grupos.length > 0 && (
        <View style={e.filaSeleccion}>
          {seleccionando && seleccionables.length > 0 && (
            <Pressable
              onPress={() => {
                tacto.toque();
                setElegidos(todosElegidos ? [] : seleccionables.map((m) => m.id));
              }}
              hitSlop={10}
            >
              <Text style={e.accionSeleccion}>{todosElegidos ? "Ninguno" : "Todos"}</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => {
              tacto.toque();
              if (seleccionando) salirDeSeleccion();
              else setSeleccionando(true);
            }}
            hitSlop={10}
            style={e.botonSeleccionar}
          >
            <ListChecks size={15} color={color.tintaSecundaria} strokeWidth={1.8} />
            <Text style={e.textoSeleccionar}>{seleccionando ? "Salir" : "Seleccionar"}</Text>
          </Pressable>
        </View>
      )}

      {grupos.length === 0 ? (
        <View style={{ marginTop: 48 }}>
          <EstadoVacio
            Icono={Inbox}
            titulo="Todavía no hay movimientos"
            cuerpo="Cargá tu primer gasto con el botón + y va a aparecer acá."
          />
        </View>
      ) : (
        grupos.map((g) => (
          <View key={g.etiqueta}>
            <Text style={e.dia}>{g.etiqueta}</Text>
            <Card>
              {g.items.map((m, i) => {
                const datos = {
                  descripcion: m.descripcion,
                  icono: m.icono,
                  metadata: [m.categoria, m.medio].filter(Boolean).join(" · "),
                  importeCentavos: m.importeCentavos,
                  esIngreso: m.esIngreso,
                  ambito: m.ambito,
                  badgeCuota: m.badgeCuota,
                };
                return (
                  <View key={m.id} style={i > 0 ? e.conBorde : undefined}>
                    {seleccionando ? (
                      <FilaSeleccionable
                        datos={datos}
                        elegido={elegidos.includes(m.id)}
                        seleccionable={!m.badgeCuota}
                        alAlternar={() => alternar(m.id)}
                      />
                    ) : (
                      <FilaSwipe
                        datos={datos}
                        etiquetaBorrar={m.badgeCuota ? "Borrar compra" : "Borrar"}
                        alBorrar={() => borrar(m.id)}
                        alTocar={() => setDetalle(m)}
                      />
                    )}
                  </View>
                );
              })}
            </Card>
          </View>
        ))
      )}
      {seleccionando && <View style={{ height: 130 }} />}
        </>
      )}
    </ScrollView>

    {seleccionando && (
      <BarraSeleccion
        cantidad={elegidos.length}
        fecha={fechaDestino}
        pendiente={moviendo}
        abajo={insets.bottom}
        alElegirFecha={setFechaDestino}
        alMover={mover}
        alCancelar={salirDeSeleccion}
      />
    )}

    <DetalleMovimiento
      movimiento={detalle}
      sesion={sesion}
      alCambiar={cargar}
      alCerrar={() => setDetalle(null)}
      alBorrar={() => {
        const id = detalle?.id;
        setDetalle(null);
        if (id) borrar(id);
      }}
    />
    </>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.papel },
  filaSeleccion: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 14,
  },
  accionSeleccion: { fontSize: 12.5, fontWeight: "500", color: color.verde },
  botonSeleccionar: { flexDirection: "row", alignItems: "center", gap: 6 },
  textoSeleccionar: { fontSize: 12.5, fontWeight: "500", color: color.tintaSecundaria },
  aviso: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 12.5,
    lineHeight: 19,
    fontWeight: "500",
    color: color.verde,
  },
  centrado: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.papel,
  },
  totalizador: {
    marginTop: 14,
    flexDirection: "row",
    borderRadius: radio.card,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
  },
  totalCol: { flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
  totalConBorde: { borderLeftWidth: 1, borderLeftColor: color.separador },
  totalEtiqueta: { fontSize: 10.5, color: color.tintaSecundaria },
  totalCifra: { marginTop: 2, fontSize: 14, fontWeight: "600", color: color.tinta },
  titulo: { fontSize: 22, fontWeight: "600", color: color.tinta },
  bandeja: {
    marginTop: 16,
    borderRadius: radio.card,
    borderWidth: 1,
    borderColor: color.bordeBandeja,
    backgroundColor: color.superficie,
    overflow: "hidden",
  },
  bandejaEncabezado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  bandejaTitulo: { flex: 1, fontSize: 13.5, fontWeight: "600", color: color.tinta },
  contador: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.ambar,
  },
  contadorTexto: { fontSize: 11, fontWeight: "600", color: color.blanco },
  bandejaFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  bandejaDescripcion: { fontSize: 14, fontWeight: "500", color: color.tinta },
  bandejaMeta: { marginTop: 2, fontSize: 11, color: color.tintaSecundaria },
  chipsCategoria: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  chipCategoria: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: radio.chipMini,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  chipCategoriaTexto: { fontSize: 11.5, fontWeight: "500", color: color.tintaSecundaria },
  dia: {
    marginTop: 20,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "600",
    color: color.tintaSecundaria,
  },
  conBorde: { borderTopWidth: 1, borderTopColor: color.separador },
});
