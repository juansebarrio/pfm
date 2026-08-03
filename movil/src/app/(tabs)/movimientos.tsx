import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChartPie,
  Check,
  ChevronDown,
  Inbox,
  List,
  ListChecks,
  Search,
  X,
} from "lucide-react-native";
import { formatearImporte } from "@dominio/dinero";
import { claveNombre, GRUPO_INGRESOS } from "@dominio/categorias";
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
  categorizarEnLote,
  categorizarMovimiento,
  mediosDePago,
  type CategoriaSimple,
  type MedioDePago,
} from "@/lib/acciones";
import { AIRE_PASTILLA, color, fuente, radio } from "@/lib/tema";
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
  const router = useRouter();
  const [sesion, setSesion] = useState<SesionHogar | null>(null);
  const [bandeja, setBandeja] = useState<MovimientoFila[]>([]);
  const [historial, setHistorial] = useState<MovimientoFila[]>([]);
  const [categorias, setCategorias] = useState<CategoriaSimple[]>([]);
  const [medios, setMedios] = useState<MedioDePago[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  // categorización inline: qué ítem está abierto, si muestra la grilla completa
  // y cuáles ya se ocultaron
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [grillaAbierta, setGrillaAbierta] = useState(false);
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

  // búsqueda y filtros EN MEMORIA sobre el historial del mes ya cargado (la
  // web filtra en el server vía searchParams; acá el mes entero ya está en
  // memoria y no hace falta otra consulta). El totalizador de arriba no se
  // toca: mide el mes, no lo filtrado.
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<"gasto" | "ingreso" | null>(null);
  const [hojaFiltro, setHojaFiltro] = useState<"categoria" | "tipo" | null>(null);

  // el layout de las tabs esconde la pastilla flotante mientras seleccionás
  const { activo: seleccionando, setActivo: setSeleccionando } = useModoSeleccion();
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [fechaDestino, setFechaDestino] = useState(hoy);
  const [moviendo, setMoviendo] = useState(false);
  const [categorizando, setCategorizando] = useState(false);
  const [hojaCategorias, setHojaCategorias] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // Se puede llegar acá con la categoría —y el mes— ya elegidos: la hoja de la
  // partida en Presupuesto ofrece "ver los movimientos de X". Los parámetros se
  // CONSUMEN (quedan en ""): si no, volver a la tab desde cualquier otro lado
  // reaplicaría un filtro que el usuario ya había sacado.
  const parametros = useLocalSearchParams<{ categoria?: string; mes?: string }>();
  useEffect(() => {
    if (!parametros.categoria && !parametros.mes) return;
    if (parametros.mes) setMes(parametros.mes);
    if (parametros.categoria) {
      setFiltroCategoria(parametros.categoria);
      setVista("lista");
    }
    router.setParams({ categoria: "", mes: "" });
  }, [parametros.categoria, parametros.mes, router]);

  // el primer pendiente de la bandeja llega ABIERTO, como en la web: colapsada
  // entera no enseña que tocar una fila la categoriza. Solo la primera carga —
  // después manda el usuario, y un refresh no le vuelve a abrir la fila.
  const bandejaSemilla = useRef(true);

  const cargar = useCallback(async () => {
    const s = await obtenerSesionHogar();
    if (!s) return;
    setSesion(s);
    const [b, h, c, t, pc, md] = await Promise.all([
      bandejaDeEntrada(s),
      movimientosCategorizados(s, { mes }),
      categoriasDelHogar(s),
      totalesDelMes(s, mes),
      gastosPorCategoria(s, mes),
      mediosDePago(s),
    ]);
    setPorCategoria(pc);
    setMedios(md);
    setBandeja(b);
    setHistorial(h);
    setCategorias(c);
    setTotales(t);
    setOcultos([]);
    if (bandejaSemilla.current) {
      bandejaSemilla.current = false;
      setAbiertoId(b[0]?.id ?? null);
    }
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
    setGrillaAbierta(false);
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

  async function categorizarLote(categoriaId: string) {
    if (!sesion || elegidos.length === 0 || categorizando) return;
    setCategorizando(true);
    setAviso(null);
    const r = await categorizarEnLote(sesion, elegidos, categoriaId);
    setCategorizando(false);
    if (!r.ok) {
      Alert.alert("No pudimos categorizarlos", r.error);
      return;
    }
    tacto.guardado();
    const nombre = categorias.find((c) => c.id === categoriaId)?.nombre;
    setAviso(
      `${r.cambiados === 1 ? "1 movimiento quedó" : `${r.cambiados} movimientos quedaron`}` +
        (nombre ? ` en ${nombre}` : " categorizados"),
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

  // Cuánto se usó cada categoría en el mes cargado: con eso se ordenan las
  // sugeridas de la bandeja. La web lo resuelve en el server con los últimos 60
  // días (categoriasRecientes); acá el mes entero ya está en memoria y sacar
  // otra consulta para tres chips no se paga.
  const usoPorCategoria = new Map<string, number>();
  for (const m of historial) {
    if (m.categoriaId) {
      usoPorCategoria.set(m.categoriaId, (usoPorCategoria.get(m.categoriaId) ?? 0) + 1);
    }
  }

  // Qué categorías se ofrecen para categorizar EN LOTE. Misma regla que la
  // bandeja, pero mirando todo lo elegido:
  //  · ámbito — si lo elegido es todo del mismo lado, las de ese lado; si
  //    mezcla, solo las del hogar: una categoría personal es de un miembro y
  //    ponérsela a un movimiento compartido lo dejaría sin categoría para el
  //    resto del hogar.
  //  · tipo — un ingreso se categoriza con las de Ingresos y un gasto con el
  //    resto; si la selección mezcla, no se filtra por grupo.
  const movimientosElegidos = historial.filter((m) => elegidos.includes(m.id));
  const ambitosElegidos = new Set(movimientosElegidos.map((m) => m.ambito));
  const ambitoDelLote = ambitosElegidos.size === 1 ? [...ambitosElegidos][0] : "hogar";
  const soloIngresos =
    movimientosElegidos.length > 0 && movimientosElegidos.every((m) => m.esIngreso);
  const soloGastos =
    movimientosElegidos.length > 0 && movimientosElegidos.every((m) => !m.esIngreso);
  const categoriasDelLote = categorias.filter((c) => {
    if (c.ambito !== ambitoDelLote) return false;
    if (soloIngresos) return c.grupo === GRUPO_INGRESOS;
    if (soloGastos) return c.grupo !== GRUPO_INGRESOS;
    return true;
  });

  // claveNombre (@dominio/categorias): sin tildes ni mayúsculas, para que
  // "cafe" encuentre "Café". Busca en descripción O categoría, como la web.
  const claveBusqueda = claveNombre(busqueda);
  const hayFiltros =
    claveBusqueda !== "" || filtroCategoria !== null || filtroTipo !== null;
  const historialVisible = historial.filter((m) => {
    if (ocultos.includes(m.id)) return false;
    if (filtroCategoria !== null && m.categoria !== filtroCategoria) return false;
    if (filtroTipo === "gasto" && m.esIngreso) return false;
    if (filtroTipo === "ingreso" && !m.esIngreso) return false;
    if (claveBusqueda !== "") {
      const enDescripcion = claveNombre(m.descripcion).includes(claveBusqueda);
      const enCategoria =
        m.categoria !== null && claveNombre(m.categoria).includes(claveBusqueda);
      if (!enDescripcion && !enCategoria) return false;
    }
    return true;
  });
  // suma bruta de lo filtrado: los importes son absolutos (el signo lo lleva
  // el tipo), así que no netea ingresos contra gastos — cuánto es lo visto
  const totalFiltradoCentavos = historialVisible.reduce(
    (suma, m) => suma + m.importeCentavos,
    0,
  );
  // opciones del chip Categoría: las presentes en el mes cargado
  const categoriasDelMes = [
    ...new Set(
      historial
        .map((m) => m.categoria)
        .filter((c): c is string => c !== null),
    ),
  ].sort((a, b) => a.localeCompare(b, "es"));
  const grupos = porDia(historialVisible, hoy);

  return (
    <>
    <ScrollView
      style={e.pantalla}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingHorizontal: 20,
        paddingBottom: insets.bottom + AIRE_PASTILLA,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refrescando}
          onRefresh={refrescar}
          tintColor={color.tintaSecundaria}
        />
      }
    >
      {/* Título + avatar del hogar. La entrada a /hogar vivía solo en Resumen:
          en las otras tres tabs desaparecía, y volver atrás para cambiar de
          pantalla es el tipo de cosa que se aprende mal una vez y molesta
          siempre. Misma anatomía que resumen.tsx (34px, inicial, → /hogar). */}
      <View style={e.encabezado}>
        <Text style={e.titulo}>Movimientos</Text>
        <Pressable onPress={() => router.push("/hogar")} hitSlop={8} style={e.avatar}>
          <Text style={e.avatarTexto}>
            {(sesion?.nombreMiembro ?? "?").charAt(0).toUpperCase()}
          </Text>
        </Pressable>
      </View>

      <NavegadorMes
        mes={mes}
        mesActual={mesActual}
        alCambiar={(nuevo) => {
          salirDeSeleccion();
          setMes(nuevo);
        }}
      />

      {/* Lista / por categoría: EL MISMO par de íconos que Presupuesto. Es la
          misma pregunta ("¿cómo miro esto?") y dibujarla acá como solapas de
          texto de ancho completo la hacía parecer otra cosa —y se comía una
          banda entera de alto arriba del totalizador. */}
      <View style={e.filaVista}>
        {/* mismo rol que su gemelo de Presupuesto: el <nav aria-label="Vista">
            de la web es un tablist, y cada ícono una solapa con su selected */}
        <View
          accessibilityRole="tablist"
          accessibilityLabel="Vista"
          style={e.conmutadorVista}
        >
          {(
            [
              { clave: "lista", Icono: List, etiqueta: "Ver lista" },
              { clave: "categorias", Icono: ChartPie, etiqueta: "Ver por categoría" },
            ] as const
          ).map(({ clave, Icono, etiqueta }) => (
            <Pressable
              key={clave}
              onPress={() => {
                if (vista === clave) return;
                tacto.toque();
                salirDeSeleccion();
                setVista(clave);
              }}
              accessibilityLabel={etiqueta}
              accessibilityRole="tab"
              accessibilityState={{ selected: vista === clave }}
              style={[e.botonVista, vista === clave && e.vistaActiva]}
            >
              <Icono
                size={17}
                color={vista === clave ? color.tinta : color.tintaSecundaria}
                strokeWidth={1.8}
              />
            </Pressable>
          ))}
        </View>
      </View>

      {aviso && <Text style={e.aviso}>{aviso}</Text>}

      {vista === "categorias" ? (
        <PorCategoria
          items={porCategoria}
          totalGastosCentavos={totales?.gastosCentavos}
          // la porción lleva a SUS movimientos: mismo mes, filtro puesto y de
          // vuelta a la lista. Es el filtro que ya existe, no una pantalla nueva.
          alElegirCategoria={(nombre) => {
            salirDeSeleccion();
            setFiltroCategoria(nombre);
            setVista("lista");
          }}
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
            {/* en negativo va en tinta con su signo: el rojo del sistema se
                reserva para "excedido", y gastar más de lo que entró no lo es
                (espejo de TotalizadorMes.tsx de la web) */}
            <Text
              numberOfLines={1}
              style={[
                e.totalCifra,
                {
                  color:
                    totales.ingresosCentavos - totales.gastosCentavos < 0
                      ? color.tinta
                      : color.verde,
                },
              ]}
            >
              {formatearImporte(totales.ingresosCentavos - totales.gastosCentavos)}
            </Text>
          </View>
        </View>
      )}

      {/* Búsqueda + filtros, espejo de app/(tabs)/movimientos/Filtros.tsx en
          versión mínima: buscar por comercio o categoría, y dos chips que
          abren hoja inferior. Todo filtra en memoria el historial de abajo. */}
      <View style={e.buscador}>
        <Search size={15} color={color.tintaTerciaria} strokeWidth={1.5} />
        <TextInput
          value={busqueda}
          onChangeText={(t) => {
            if (seleccionando) salirDeSeleccion();
            setBusqueda(t);
          }}
          placeholder="Buscar comercio o categoría"
          placeholderTextColor={color.tintaTerciaria}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          style={e.buscadorInput}
        />
      </View>

      <View style={e.filtros}>
        <Pressable
          onPress={() => {
            tacto.toque();
            setHojaFiltro("categoria");
          }}
          style={[e.chipFiltro, filtroCategoria !== null && e.chipFiltroActivo]}
        >
          <Text
            numberOfLines={1}
            style={[e.chipFiltroTexto, filtroCategoria !== null && e.chipFiltroTextoActivo]}
          >
            {filtroCategoria ?? "Categoría"}
          </Text>
          <ChevronDown size={12} color={color.tintaSecundaria} strokeWidth={1.5} />
        </Pressable>
        <Pressable
          onPress={() => {
            tacto.toque();
            setHojaFiltro("tipo");
          }}
          style={[e.chipFiltro, filtroTipo !== null && e.chipFiltroActivo]}
        >
          <Text
            numberOfLines={1}
            style={[e.chipFiltroTexto, filtroTipo !== null && e.chipFiltroTextoActivo]}
          >
            {filtroTipo === "gasto"
              ? "Solo gastos"
              : filtroTipo === "ingreso"
                ? "Solo ingresos"
                : "Tipo"}
          </Text>
          <ChevronDown size={12} color={color.tintaSecundaria} strokeWidth={1.5} />
        </Pressable>
      </View>

      {/* Con filtros activos, cuánto suma lo que quedó a la vista. El
          totalizador de arriba sigue midiendo el mes completo. */}
      {hayFiltros && historialVisible.length > 0 && (
        <Text style={e.totalFiltrado}>
          <Text style={e.totalFiltradoCifra}>{historialVisible.length}</Text>
          {historialVisible.length === 1 ? " movimiento · " : " movimientos · "}
          <Text style={e.totalFiltradoCifra}>
            {formatearImporte(totalFiltradoCentavos)}
          </Text>
        </Text>
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
                (m.esIngreso ? c.grupo === GRUPO_INGRESOS : c.grupo !== GRUPO_INGRESOS),
            );
            // igual que la web: 3 sugeridas (las más usadas del mes) + "todas →",
            // que despliega la grilla completa. Volcar veinte chips de una hacía
            // de la fila abierta un muro en vez de una decisión de un toque.
            const sugeridas = [...delAmbito]
              .sort((a, b) => (usoPorCategoria.get(b.id) ?? 0) - (usoPorCategoria.get(a.id) ?? 0))
              .slice(0, 3);
            return (
              <View key={m.id} style={i > 0 ? e.conBorde : undefined}>
                <Pressable
                  onPress={() => {
                    setAbiertoId(abierto ? null : m.id);
                    setGrillaAbierta(false);
                  }}
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

                {abierto &&
                  (grillaAbierta ? (
                    <View style={e.grillaCategorias}>
                      {delAmbito.map((c) => (
                        <Pressable
                          key={c.id}
                          onPress={() => categorizar(m.id, c.id)}
                          style={e.celdaCategoria}
                        >
                          <IconoCategoria nombre={c.icono} />
                          <Text numberOfLines={1} style={e.celdaCategoriaTexto}>
                            {c.nombre}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <View style={e.chipsCategoria}>
                      {sugeridas.map((c) => (
                        <Pressable
                          key={c.id}
                          onPress={() => categorizar(m.id, c.id)}
                          style={e.chipCategoria}
                        >
                          <IconoCategoria nombre={c.icono} tamano={13} />
                          <Text style={e.chipCategoriaTexto}>{c.nombre}</Text>
                        </Pressable>
                      ))}
                      {delAmbito.length > sugeridas.length && (
                        <Pressable
                          onPress={() => {
                            tacto.toque();
                            setGrillaAbierta(true);
                          }}
                          accessibilityLabel="Ver todas las categorías"
                          style={e.chipCategoria}
                        >
                          <Text style={e.chipCategoriaTexto}>todas →</Text>
                        </Pressable>
                      )}
                    </View>
                  ))}
              </View>
            );
          })}
        </View>
      )}

      {/* Historial agrupado por día. La selección masiva no convive con los
          filtros: "Todos" elegiría filas que no están a la vista, así que el
          botón se esconde mientras haya búsqueda o filtro activo. */}
      {grupos.length > 0 && !hayFiltros && (
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
        hayFiltros ? (
          <Text style={e.sinResultados}>
            {claveBusqueda !== ""
              ? `Nada con ese nombre en ${formatearMesLargo(mes)}`
              : "No encontramos movimientos con esos filtros."}
          </Text>
        ) : (
        <View style={{ marginTop: 48 }}>
          <EstadoVacio
            Icono={Inbox}
            titulo="Todavía no hay movimientos"
            cuerpo="Cargá tu primer gasto con el botón + y va a aparecer acá."
          />
        </View>
        )
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
                  // el diferencial argentino: a qué resumen cae el consumo.
                  // FilaMovimiento lo pinta en ámbar como "· cierra 28 jul".
                  cierreCiclo: m.cierreCiclo
                    ? `cierra ${formatearDiaCorto(m.cierreCiclo.fechaCierre)}`
                    : undefined,
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
      {/* aire para que la barra fija no tape el último movimiento (la barra
          creció: además de mover, categoriza) */}
      {seleccionando && <View style={{ height: 190 }} />}
        </>
      )}
    </ScrollView>

    {seleccionando && (
      <BarraSeleccion
        cantidad={elegidos.length}
        fecha={fechaDestino}
        pendiente={moviendo}
        pendienteCategoria={categorizando}
        puedeCategorizar={categoriasDelLote.length > 0}
        abajo={insets.bottom}
        alElegirFecha={setFechaDestino}
        alMover={mover}
        alCategorizar={() => setHojaCategorias(true)}
        alCancelar={salirDeSeleccion}
      />
    )}

    <HojaCategorias
      abierta={hojaCategorias}
      cantidad={elegidos.length}
      categorias={categoriasDelLote}
      alElegir={categorizarLote}
      alCerrar={() => setHojaCategorias(false)}
    />

    <HojaFiltro
      abierta={hojaFiltro !== null}
      titulo={hojaFiltro === "tipo" ? "Tipo" : "Categoría"}
      todas={hojaFiltro === "tipo" ? "Gastos e ingresos" : "Todas las categorías"}
      opciones={
        hojaFiltro === "tipo"
          ? [
              { valor: "gasto", etiqueta: "Solo gastos" },
              { valor: "ingreso", etiqueta: "Solo ingresos" },
            ]
          : categoriasDelMes.map((c) => ({ valor: c, etiqueta: c }))
      }
      actual={hojaFiltro === "tipo" ? filtroTipo : filtroCategoria}
      alElegir={(valor) => {
        salirDeSeleccion();
        if (hojaFiltro === "tipo") setFiltroTipo(valor as "gasto" | "ingreso" | null);
        else setFiltroCategoria(valor);
      }}
      alCerrar={() => setHojaFiltro(null)}
    />

    <DetalleMovimiento
      movimiento={detalle}
      sesion={sesion}
      categorias={categorias}
      medios={medios}
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

/**
 * Hoja inferior con las opciones de un filtro (patrón AgregarPartida). Espeja
 * la HojaInferior de Filtros.tsx de la web: primera fila "todas" que limpia,
 * y un tap en la opción ya activa la des-selecciona.
 */
function HojaFiltro({
  abierta,
  titulo,
  todas,
  opciones,
  actual,
  alElegir,
  alCerrar,
}: {
  abierta: boolean;
  titulo: string;
  /** la opción que limpia el filtro ("Todas las categorías") */
  todas: string;
  opciones: Array<{ valor: string; etiqueta: string }>;
  actual: string | null;
  alElegir: (valor: string | null) => void;
  alCerrar: () => void;
}) {
  const insets = useSafeAreaInsets();

  function elegir(valor: string | null) {
    tacto.toque();
    alElegir(valor);
    alCerrar();
  }

  return (
    <Modal visible={abierta} transparent animationType="slide" onRequestClose={alCerrar}>
      <View style={h.lleno}>
        <Pressable style={h.fondo} onPress={alCerrar} />
        <View style={[h.hoja, { paddingBottom: Math.max(20, insets.bottom) }]}>
          <View aria-hidden style={h.agarre} />
          <View style={h.filaTitulo}>
            <Text style={h.titulo}>{titulo}</Text>
            <Pressable onPress={alCerrar} hitSlop={10}>
              <X size={22} color={color.tintaSecundaria} strokeWidth={2} />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 380 }}>
            <OpcionFila
              etiqueta={todas}
              seleccionada={actual === null}
              alElegir={() => elegir(null)}
            />
            {opciones.map((opcion) => (
              <OpcionFila
                key={opcion.valor}
                etiqueta={opcion.etiqueta}
                seleccionada={actual === opcion.valor}
                conBorde
                alElegir={() => elegir(actual === opcion.valor ? null : opcion.valor)}
              />
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Hoja para categorizar EN LOTE (mismo patrón AgregarPartida que HojaFiltro).
 * Lista con ícono y nombre: la categoría se elige de un toque y se aplica a
 * todo lo seleccionado, sin paso de confirmación — deshacer es volver a
 * elegir, y una selección ya es una confirmación.
 */
function HojaCategorias({
  abierta,
  cantidad,
  categorias,
  alElegir,
  alCerrar,
}: {
  abierta: boolean;
  cantidad: number;
  categorias: CategoriaSimple[];
  alElegir: (categoriaId: string) => void;
  alCerrar: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={abierta} transparent animationType="slide" onRequestClose={alCerrar}>
      <View style={h.lleno}>
        <Pressable style={h.fondo} onPress={alCerrar} />
        <View style={[h.hoja, { paddingBottom: Math.max(20, insets.bottom) }]}>
          <View aria-hidden style={h.agarre} />
          <View style={h.filaTitulo}>
            <Text style={h.titulo}>
              {cantidad === 1
                ? "Categoría del movimiento"
                : `Categoría de ${cantidad} movimientos`}
            </Text>
            <Pressable onPress={alCerrar} hitSlop={10}>
              <X size={22} color={color.tintaSecundaria} strokeWidth={2} />
            </Pressable>
          </View>
          <Text style={h.ayuda}>
            Se aplica a todo lo elegido. La categoría anterior se reemplaza.
          </Text>
          <ScrollView style={{ maxHeight: 380 }}>
            {categorias.map((c, i) => (
              <Pressable
                key={c.id}
                onPress={() => {
                  tacto.toque();
                  alCerrar();
                  alElegir(c.id);
                }}
                style={[h.opcion, h.opcionCategoria, i > 0 && h.opcionConBorde]}
              >
                <IconoCategoria nombre={c.icono} tamano={17} />
                <Text style={h.opcionTexto}>{c.nombre}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function OpcionFila({
  etiqueta,
  seleccionada,
  conBorde,
  alElegir,
}: {
  etiqueta: string;
  seleccionada: boolean;
  conBorde?: boolean;
  alElegir: () => void;
}) {
  return (
    <Pressable onPress={alElegir} style={[h.opcion, conBorde && h.opcionConBorde]}>
      <Text style={[h.opcionTexto, seleccionada && h.opcionTextoActivo]}>
        {etiqueta}
      </Text>
      {seleccionada && <Check size={16} color={color.verde} strokeWidth={2} />}
    </Pressable>
  );
}

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
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titulo: { fontSize: 16, fontFamily: fuente.textoSemi, color: color.tinta },
  opcion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 13,
  },
  opcionCategoria: { justifyContent: "flex-start", gap: 10 },
  ayuda: {
    marginTop: 2,
    marginBottom: 6,
    fontSize: 11.5,
    lineHeight: 17,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
  },
  opcionConBorde: { borderTopWidth: 1, borderTopColor: color.separador },
  opcionTexto: { flexShrink: 1, fontSize: 14, fontFamily: fuente.textoMedio, color: color.tinta },
  opcionTextoActivo: { fontFamily: fuente.textoSemi, color: color.verde },
});

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.papel },
  filaVista: { marginTop: 12, flexDirection: "row", justifyContent: "flex-end" },
  conmutadorVista: {
    flexDirection: "row",
    borderRadius: 11,
    backgroundColor: color.fondoSegmented,
    padding: 2,
  },
  botonVista: {
    width: 44,
    height: 33,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  vistaActiva: { backgroundColor: color.segmentedActivo },
  filaSeleccion: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 14,
  },
  accionSeleccion: { fontSize: 12.5, fontFamily: fuente.textoMedio, color: color.verde },
  botonSeleccionar: { flexDirection: "row", alignItems: "center", gap: 6 },
  textoSeleccionar: {
    fontSize: 12.5,
    fontFamily: fuente.textoMedio,
    color: color.tintaSecundaria,
  },
  aviso: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 12.5,
    lineHeight: 19,
    fontFamily: fuente.textoMedio,
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
  buscador: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 12,
  },
  buscadorInput: {
    flex: 1,
    height: 40,
    fontSize: 13,
    fontFamily: fuente.texto,
    color: color.tinta,
  },
  filtros: { marginTop: 10, flexDirection: "row", gap: 8 },
  chipFiltro: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "60%",
    borderRadius: radio.chip,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipFiltroActivo: {
    borderWidth: 1.5,
    borderColor: color.verde,
    backgroundColor: color.verdeSuave,
  },
  chipFiltroTexto: {
    flexShrink: 1,
    fontSize: 12,
    fontFamily: fuente.texto,
    color: color.tinta,
  },
  chipFiltroTextoActivo: { fontFamily: fuente.textoSemi },
  totalFiltrado: {
    marginTop: 12,
    fontSize: 11.5,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
  },
  totalFiltradoCifra: {
    fontSize: 11.5,
    fontFamily: fuente.mono,
    fontVariant: ["tabular-nums"],
    color: color.tintaSecundaria,
  },
  sinResultados: {
    marginTop: 32,
    textAlign: "center",
    fontSize: 13.5,
    lineHeight: 21,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
  },
  totalCol: { flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
  totalConBorde: { borderLeftWidth: 1, borderLeftColor: color.separador },
  totalEtiqueta: { fontSize: 10.5, fontFamily: fuente.texto, color: color.tintaSecundaria },
  totalCifra: {
    marginTop: 2,
    fontSize: 14,
    fontFamily: fuente.monoSemi,
    fontVariant: ["tabular-nums"],
    color: color.tinta,
  },
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titulo: { fontSize: 22, fontFamily: fuente.textoSemi, color: color.tinta },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.tinta,
  },
  avatarTexto: { fontSize: 14, fontFamily: fuente.textoSemi, color: color.papel },
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
  bandejaTitulo: {
    flex: 1,
    fontSize: 13.5,
    fontFamily: fuente.textoSemi,
    color: color.tinta,
  },
  contador: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.ambar,
  },
  // el contador de la bandeja es cifra
  contadorTexto: {
    fontSize: 11,
    fontFamily: fuente.monoSemi,
    fontVariant: ["tabular-nums"],
    color: color.blanco,
  },
  bandejaFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  bandejaDescripcion: { fontSize: 14, fontFamily: fuente.textoMedio, color: color.tinta },
  bandejaMeta: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
  },
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
  chipCategoriaTexto: {
    fontSize: 11.5,
    fontFamily: fuente.textoMedio,
    color: color.tintaSecundaria,
  },
  grillaCategorias: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  celdaCategoria: {
    width: "23%",
    alignItems: "center",
    gap: 4,
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 2,
    paddingVertical: 9,
  },
  celdaCategoriaTexto: {
    width: "100%",
    textAlign: "center",
    fontSize: 10,
    fontFamily: fuente.textoMedio,
    color: color.tinta,
  },
  dia: {
    marginTop: 20,
    marginBottom: 8,
    fontSize: 12,
    fontFamily: fuente.textoSemi,
    color: color.tintaSecundaria,
  },
  conBorde: { borderTopWidth: 1, borderTopColor: color.separador },
});
