import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Check, Inbox, TriangleAlert } from "lucide-react-native";
import { GRUPO_INGRESOS } from "@dominio/categorias";
import {
  altaDesdeComprobante,
  bloqueantes,
  elegirCategoria,
  elegirMedio,
  type CampoFaltante,
  type ComprobanteLeido as Lectura,
} from "@dominio/comprobante";
import { centavosDesdeTexto, formatearImporte } from "@dominio/dinero";
import {
  crearGasto,
  type CategoriaSimple,
  type MedioDePago,
} from "@/lib/acciones";
import type { SesionHogar } from "@/lib/datos";
import { IconoCategoria } from "@/componentes/sistema";
import { aISO, desdeISO } from "@/lib/fecha-local";
import { color, fuente, radio } from "@/lib/tema";
import { tacto } from "@/lib/tacto";

// La tarjeta de confirmación de un comprobante leído, en nativo.
//
// Espeja app/asistente/Comprobante.tsx de la web, y el criterio es el mismo: la
// foto PROPONE, el usuario DISPONE. Nada se carga sin un toque explícito, ni
// cuando el modelo leyó los seis campos perfectos. Todo lo leído es editable
// acá mismo, y lo que no se leyó se pide en lugar de inventarse.
//
// Sin categoría se carga igual: eso es la bandeja de entrada, que ya existe.

type Estado =
  | { fase: "editando" }
  | { fase: "cargando" }
  | { fase: "cargado"; aBandeja: boolean }
  | { fase: "descartado" };

const NOMBRE_CAMPO: Record<CampoFaltante, string> = {
  monto: "el importe",
  fecha: "la fecha",
  tipo: "el tipo",
  medio: "con qué se pagó",
  // categoria nunca llega acá: no bloquea la carga (va a la bandeja)
  categoria: "la categoría",
};

/** "el importe", "el importe y la fecha", "el importe, la fecha y el medio". */
function listar(partes: string[]): string {
  if (partes.length <= 1) return partes[0] ?? "";
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

export function ComprobanteLeido({
  leido,
  sesion,
  medios,
  categorias,
  hoy,
  miniatura,
}: {
  leido: Lectura;
  sesion: SesionHogar;
  medios: MedioDePago[];
  categorias: CategoriaSimple[];
  hoy: string;
  miniatura: string | null;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ fase: "editando" });
  const [error, setError] = useState<string | null>(null);

  const [comercio, setComercio] = useState(leido.comercio ?? "");
  const [montoTexto, setMontoTexto] = useState(
    leido.montoCentavos !== null ? formatearImporte(leido.montoCentavos) : "",
  );
  const [fecha, setFecha] = useState(leido.fecha ?? hoy);
  const [tipo, setTipo] = useState<"gasto" | "ingreso">(leido.tipo ?? "gasto");
  const [ambito, setAmbito] = useState<"hogar" | "personal">("hogar");
  const [medioId, setMedioId] = useState<string | null>(
    () =>
      elegirMedio(
        leido.medio,
        medios.map((m) => ({
          id: m.id,
          tipo: m.tipo,
          nombre: m.nombre,
          ultimos4: m.tipo === "tarjeta" ? etiquetaUltimos4(m.etiqueta) : null,
        })),
      )?.id ?? null,
  );
  const [categoriaId, setCategoriaId] = useState<string | null>(
    () => elegirCategoria(leido.categoria, categorias)?.id ?? null,
  );

  const montoCentavos = centavosDesdeTexto(montoTexto);
  const esIngreso = tipo === "ingreso";
  // un ingreso entra a una cuenta: la base lo exige, no ofrecemos tarjetas
  const mediosPosibles = esIngreso ? medios.filter((m) => m.tipo === "cuenta") : medios;
  const medio = mediosPosibles.find((m) => m.id === medioId) ?? null;
  const deEsteAmbito = categorias.filter(
    (c) => c.ambito === ambito && (c.grupo === GRUPO_INGRESOS) === esIngreso,
  );
  const categoria = deEsteAmbito.find((c) => c.id === categoriaId) ?? null;

  const falta = bloqueantes({
    ...leido,
    montoCentavos,
    fecha: fecha || null,
    tipo,
    medio: medio ? medio.nombre : null,
  });

  async function cargar() {
    if (estado.fase !== "editando" || falta.length > 0 || !medio || montoCentavos === null) {
      return;
    }
    setError(null);
    setEstado({ fase: "cargando" });
    const aBandeja = categoria === null;
    const alta = altaDesdeComprobante({
      montoCentavos,
      fecha,
      tipo,
      medio: { id: medio.id, tipo: medio.tipo },
      categoriaId: categoria?.id ?? null,
      ambito,
      comercio: comercio.trim() || null,
    });
    const r = await crearGasto(sesion, alta);
    if (r.ok) {
      tacto.guardado();
      setEstado({ fase: "cargado", aBandeja });
    } else {
      setError(r.error);
      setEstado({ fase: "editando" });
    }
  }

  if (estado.fase === "descartado") {
    return (
      <View style={e.card}>
        <Text style={e.descartado}>Descartaste esta lectura. Nada se cargó.</Text>
      </View>
    );
  }

  if (estado.fase === "cargado") {
    return (
      <View style={e.exito}>
        <View style={e.filaExito}>
          {estado.aBandeja ? (
            <Inbox size={17} color={color.verde} strokeWidth={1.8} />
          ) : (
            <Check size={17} color={color.verde} strokeWidth={2.2} />
          )}
          <Text style={e.tituloExito}>
            {estado.aBandeja ? "Fue a la bandeja de entrada" : "Cargado"}
          </Text>
        </View>
        <Text style={e.detalleExito}>
          {comercio.trim() || (esIngreso ? "Ingreso" : "Gasto")} ·{" "}
          {montoCentavos !== null ? formatearImporte(montoCentavos) : ""}
          {estado.aBandeja ? " · te falta elegirle categoría" : ""}
        </Text>
        <Pressable onPress={() => router.push("/movimientos")} hitSlop={8}>
          <Text style={e.enlace}>Ver en movimientos</Text>
        </Pressable>
      </View>
    );
  }

  const cargando = estado.fase === "cargando";

  return (
    <View style={e.card}>
      {miniatura && <Image source={{ uri: miniatura }} style={e.miniatura} resizeMode="contain" />}
      <Text style={e.rotulo}>LO QUE LEÍ DEL COMPROBANTE</Text>

      <TextInput
        value={comercio}
        onChangeText={setComercio}
        maxLength={80}
        placeholder="Comercio o concepto"
        placeholderTextColor={color.tintaTerciaria}
        style={e.inputComercio}
      />

      {/* el monto grande: es el dato que hay que revisar */}
      <TextInput
        value={montoTexto}
        onChangeText={setMontoTexto}
        keyboardType="numbers-and-punctuation"
        placeholder="$ 0"
        placeholderTextColor={color.tintaTerciaria}
        style={[
          e.inputMonto,
          montoTexto !== "" && montoCentavos === null && { borderColor: color.rojo },
        ]}
      />
      {montoTexto !== "" && montoCentavos === null && (
        <Text style={e.errorCampo}>No pude entender ese importe. Escribilo como $ 84.320.</Text>
      )}

      <View style={e.filaDoble}>
        <View style={{ flex: 1 }}>
          <Text style={e.etiqueta}>Fecha</Text>
          <View style={e.cajaFecha}>
            <DateTimePicker
              mode="date"
              display="compact"
              value={desdeISO(fecha)}
              maximumDate={desdeISO(hoy)}
              onChange={(_evento, elegida) => elegida && setFecha(aISO(elegida))}
              themeVariant="dark"
              accentColor={color.verde}
            />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={e.etiqueta}>Tipo</Text>
          <View style={e.segmentado}>
            {(["gasto", "ingreso"] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => {
                  tacto.toque();
                  setTipo(t);
                  setCategoriaId(null);
                  if (t === "ingreso" && medio?.tipo === "tarjeta") setMedioId(null);
                }}
                style={[e.opcion, tipo === t && e.opcionActiva]}
              >
                <Text style={[e.opcionTexto, tipo === t && e.opcionTextoActivo]}>
                  {t === "gasto" ? "Gasto" : "Ingreso"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <Text style={e.etiqueta}>
        {esIngreso ? "Entra a" : "Se pagó con"}
        {falta.includes("medio") && <Text style={e.pendiente}> · elegí uno</Text>}
      </Text>
      <View style={e.chips}>
        {mediosPosibles.map((m) => (
          <Chip
            key={m.id}
            activo={medioId === m.id}
            onPress={() => setMedioId(m.id)}
            texto={m.etiqueta}
          />
        ))}
      </View>

      <Text style={e.etiqueta}>Ámbito</Text>
      <View style={e.chips}>
        {(["hogar", "personal"] as const).map((a) => (
          <Chip
            key={a}
            activo={ambito === a}
            onPress={() => {
              setAmbito(a);
              setCategoriaId(null); // las categorías son por ámbito
            }}
            texto={a === "hogar" ? "Del hogar" : "Solo mío"}
          />
        ))}
      </View>

      <Text style={e.etiqueta}>Categoría</Text>
      <View style={e.chips}>
        {deEsteAmbito.map((c) => (
          <Chip
            key={c.id}
            activo={categoriaId === c.id}
            onPress={() => setCategoriaId(categoriaId === c.id ? null : c.id)}
            texto={c.nombre}
            icono={c.icono}
          />
        ))}
      </View>
      {categoria === null && (
        <View style={e.filaNota}>
          <Inbox size={13} color={color.tintaSecundaria} strokeWidth={1.8} />
          <Text style={e.nota}>Sin categoría va a la bandeja de entrada y la elegís después.</Text>
        </View>
      )}

      {/* Lo que el comprobante dice y esta pantalla decide no hacer sola. */}
      {leido.cuotas !== null && (
        <View style={e.ojo}>
          <TriangleAlert size={15} color={color.ambarTexto} strokeWidth={1.8} />
          <Text style={e.ojoTexto}>
            El comprobante dice {leido.cuotas} cuotas. Se carga como un solo movimiento
            por el total; si querés la serie, cargala desde Compras en cuotas.
          </Text>
        </View>
      )}

      {error && <Text style={e.error}>{error}</Text>}

      <View style={e.acciones}>
        <Pressable
          onPress={cargar}
          disabled={falta.length > 0 || cargando}
          style={[e.cta, (falta.length > 0 || cargando) && { opacity: 0.4 }]}
        >
          <Check size={17} color={color.papel} strokeWidth={2.2} />
          <Text style={e.ctaTexto}>
            {cargando ? "Cargando…" : categoria ? "Cargar" : "Cargar a la bandeja"}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setEstado({ fase: "descartado" })}
          disabled={cargando}
          hitSlop={10}
        >
          <Text style={e.descartar}>Descartar</Text>
        </Pressable>
      </View>

      {falta.length > 0 && (
        <Text style={e.faltante}>
          Falta {listar(falta.map((c) => NOMBRE_CAMPO[c]))} para poder cargarlo.
        </Text>
      )}
    </View>
  );
}

/**
 * Los últimos 4 salen de la etiqueta del medio ("Visa Galicia •• 4321"), que es
 * lo único que trae mediosDePago del nativo. Espeja el campo ultimos4 de la web.
 */
function etiquetaUltimos4(etiqueta: string): string | null {
  return /(\d{4})\s*$/.exec(etiqueta)?.[1] ?? null;
}

function Chip({
  activo,
  onPress,
  texto,
  icono,
}: {
  activo: boolean;
  onPress: () => void;
  texto: string;
  icono?: string;
}) {
  return (
    <Pressable
      onPress={() => {
        tacto.toque();
        onPress();
      }}
      style={[e.chip, activo && e.chipActivo]}
    >
      {icono && (
        <IconoCategoria nombre={icono} tono={activo ? "verde" : "normal"} tamano={14} />
      )}
      <Text style={[e.chipTexto, activo && e.chipTextoActivo]}>{texto}</Text>
    </Pressable>
  );
}

const e = StyleSheet.create({
  card: {
    borderRadius: radio.card,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.papel,
    padding: 14,
    gap: 8,
  },
  miniatura: {
    height: 110,
    width: "100%",
    borderRadius: radio.cta,
    backgroundColor: color.superficie,
  },
  rotulo: {
    fontSize: 11,
    letterSpacing: 0.5,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
  },
  inputComercio: {
    height: 42,
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: fuente.textoMedio,
    color: color.tinta,
  },
  // el campo del monto es cifra: mono, como el .cifra del gemelo web
  inputMonto: {
    height: 58,
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 12,
    fontSize: 28,
    fontFamily: fuente.monoSemi,
    fontVariant: ["tabular-nums"],
    color: color.tinta,
  },
  errorCampo: { fontSize: 11.5, fontFamily: fuente.texto, color: color.rojo },
  filaDoble: { flexDirection: "row", gap: 8 },
  cajaFecha: { height: 40, justifyContent: "center", marginTop: 4 },
  etiqueta: {
    fontSize: 11.5,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
    marginTop: 2,
  },
  pendiente: { color: color.ambarTexto },
  segmentado: {
    flexDirection: "row",
    height: 40,
    borderRadius: radio.cta,
    backgroundColor: color.fondoSegmented,
    padding: 3,
    marginTop: 4,
  },
  opcion: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  opcionActiva: { backgroundColor: color.segmentedActivo },
  opcionTexto: { fontSize: 12.5, fontFamily: fuente.textoMedio, color: color.tintaSecundaria },
  // el peso del activo es OTRO archivo de Rubik, no un fontWeight encima
  opcionTextoActivo: { fontFamily: fuente.textoSemi, color: color.tinta },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: radio.chip,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipActivo: { borderWidth: 1.5, borderColor: color.verde, backgroundColor: color.verdeSuave },
  chipTexto: { fontSize: 12, fontFamily: fuente.texto, color: color.tinta },
  chipTextoActivo: { fontFamily: fuente.textoSemi },
  filaNota: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  nota: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 18,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
  },
  ojo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.bordeEstimada,
    backgroundColor: color.fondoEstimada,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  // "El comprobante dice 6 cuotas…": frase con un contador adentro, queda en Rubik
  ojoTexto: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fuente.texto,
    color: color.ambarTexto,
  },
  error: { fontSize: 12.5, fontFamily: fuente.textoMedio, color: color.rojo },
  acciones: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  cta: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    borderRadius: radio.cta,
    backgroundColor: color.verde,
  },
  ctaTexto: { fontSize: 14, fontFamily: fuente.textoSemi, color: color.papel },
  descartar: {
    fontSize: 13,
    fontFamily: fuente.textoMedio,
    color: color.tintaSecundaria,
    paddingHorizontal: 6,
  },
  faltante: {
    textAlign: "center",
    fontSize: 11.5,
    fontFamily: fuente.texto,
    color: color.tintaTerciaria,
  },
  descartado: { fontSize: 12.5, fontFamily: fuente.texto, color: color.tintaSecundaria },
  exito: {
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.verde,
    backgroundColor: color.verdeSuave,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  filaExito: { flexDirection: "row", alignItems: "center", gap: 8 },
  tituloExito: { fontSize: 13.5, fontFamily: fuente.textoSemi, color: color.tinta },
  // "Coto · $ 84.320 · te falta elegirle categoría": el <p> del gemelo web
  // tampoco lleva .cifra, así que la línea entera queda en Rubik
  detalleExito: {
    fontSize: 12.5,
    lineHeight: 19,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
  },
  enlace: {
    marginTop: 4,
    fontSize: 12.5,
    fontFamily: fuente.textoMedio,
    color: color.verde,
    textDecorationLine: "underline",
  },
});
