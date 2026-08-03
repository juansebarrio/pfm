import { useCallback, useEffect, useState } from "react";
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
import { Check, ChevronLeft, Pencil, Plus, X } from "lucide-react-native";
import { GRUPO_INGRESOS, GRUPO_OTROS, ICONOS_POR_TEMA } from "@dominio/categorias";
import { obtenerSesionHogar, type SesionHogar } from "@/lib/datos";
import {
  categoriasDelHogar,
  crearCategoria,
  editarCategoria,
  type CategoriaSimple,
} from "@/lib/acciones";
import { color, fuente, radio } from "@/lib/tema";
import { tacto } from "@/lib/tacto";
import { Card, IconoCategoria } from "@/componentes/sistema";

// Categorías del hogar: listado agrupado y alta de categorías propias.
// Espeja app/categorias/ de la web.
//
// No hay borrado: la RLS no lo permite y está bien — los movimientos
// referencian categorias con una FK sin cascade. Para dejar de usar una, se
// apaga su partida al armar el presupuesto.

type Modo = { tipo: "cerrado" } | { tipo: "nueva" } | { tipo: "editar"; c: CategoriaSimple };

export default function Categorias() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sesion, setSesion] = useState<SesionHogar | null>(null);
  const [categorias, setCategorias] = useState<CategoriaSimple[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modo, setModo] = useState<Modo>({ tipo: "cerrado" });

  const cargar = useCallback(async () => {
    const s = await obtenerSesionHogar();
    if (!s) return;
    setSesion(s);
    setCategorias(await categoriasDelHogar(s));
  }, []);

  useEffect(() => {
    cargar().finally(() => setCargando(false));
  }, [cargar]);

  // agrupadas para el listado, con Ingresos siempre al final
  const grupos = [...new Set(categorias.map((c) => c.grupo))].sort((a, b) => {
    if (a === GRUPO_INGRESOS) return 1;
    if (b === GRUPO_INGRESOS) return -1;
    return a.localeCompare(b, "es");
  });
  const gruposGasto = [
    ...new Set(categorias.filter((c) => c.grupo !== GRUPO_INGRESOS).map((c) => c.grupo)),
  ].sort((a, b) => a.localeCompare(b, "es"));

  return (
    <View style={e.pantalla}>
      <View style={[e.cabecera, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={20} color={color.tinta} strokeWidth={1.5} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={e.titulo}>Categorías</Text>
          <Text style={e.subtitulo}>
            {categorias.length} en total · las tuyas y las del hogar
          </Text>
        </View>
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
          keyboardShouldPersistTaps="handled"
        >
          {modo.tipo === "cerrado" ? (
            <Pressable onPress={() => setModo({ tipo: "nueva" })} style={e.cta}>
              <Plus size={18} color={color.papel} strokeWidth={2} />
              <Text style={e.ctaTexto}>Nueva categoría</Text>
            </Pressable>
          ) : (
            <Formulario
              key={modo.tipo === "editar" ? modo.c.id : "nueva"}
              sesion={sesion}
              categoria={modo.tipo === "editar" ? modo.c : null}
              gruposGasto={gruposGasto}
              alGuardar={async () => {
                await cargar();
                setModo({ tipo: "cerrado" });
              }}
              alCerrar={() => setModo({ tipo: "cerrado" })}
            />
          )}

          {grupos.map((grupo) => (
            <View key={grupo} style={{ marginTop: 20 }}>
              <Text style={e.grupo}>{grupo.toUpperCase()}</Text>
              <Card style={{ marginTop: 8 }}>
                {categorias
                  .filter((c) => c.grupo === grupo)
                  .map((c, i) => (
                    <View key={c.id} style={[e.fila, i > 0 && e.conBorde]}>
                      <IconoCategoria nombre={c.icono} />
                      <Text numberOfLines={1} style={e.nombre}>
                        {c.nombre}
                      </Text>
                      {c.ambito === "personal" && (
                        <Text style={e.marcaPersonal}>PERSONAL</Text>
                      )}
                      <Pressable
                        onPress={() => setModo({ tipo: "editar", c })}
                        hitSlop={10}
                      >
                        <Pencil size={16} color={color.tintaSecundaria} strokeWidth={1.5} />
                      </Pressable>
                    </View>
                  ))}
              </Card>
            </View>
          ))}

          <Text style={e.aclaracion}>
            Las categorías no se borran: hay movimientos que las usan y borrarlas
            rompería tu historial. Para dejar de usar una, apagá su partida
            cuando armes el presupuesto del mes.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

function Formulario({
  sesion,
  categoria,
  gruposGasto,
  alGuardar,
  alCerrar,
}: {
  sesion: SesionHogar | null;
  categoria: CategoriaSimple | null;
  gruposGasto: string[];
  alGuardar: () => Promise<void>;
  alCerrar: () => void;
}) {
  const editando = categoria !== null;
  const [nombre, setNombre] = useState(categoria?.nombre ?? "");
  const [icono, setIcono] = useState(categoria?.icono ?? "tag");
  const [esIngreso, setEsIngreso] = useState(categoria?.grupo === GRUPO_INGRESOS);
  const [ambito, setAmbito] = useState<"hogar" | "personal">(categoria?.ambito ?? "hogar");
  const [grupo, setGrupo] = useState(
    categoria && categoria.grupo !== GRUPO_INGRESOS ? categoria.grupo : GRUPO_OTROS,
  );
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);

  async function guardar() {
    if (!sesion || pendiente || nombre.trim() === "") return;
    setError(null);
    setPendiente(true);
    const grupoFinal = esIngreso ? GRUPO_INGRESOS : grupo.trim() || GRUPO_OTROS;
    const r = editando
      ? await editarCategoria(sesion, categoria.id, { nombre, grupo: grupoFinal, icono })
      : await crearCategoria(sesion, { nombre, grupo: grupoFinal, icono, ambito });
    if (r.ok) {
      tacto.guardado();
      await alGuardar();
    } else {
      tacto.error();
      setError(r.error);
      setPendiente(false);
    }
  }

  return (
    <View style={e.formulario}>
      <View style={e.formCabecera}>
        <Text style={e.formTitulo}>
          {editando ? `Editar ${categoria.nombre}` : "Nueva categoría"}
        </Text>
        <Pressable onPress={alCerrar} hitSlop={10}>
          <X size={18} color={color.tintaSecundaria} strokeWidth={2} />
        </Pressable>
      </View>

      {/* tipo y ámbito solo al crear: cambiarlos después movería movimientos */}
      {!editando && (
        <>
          {/* botones, no solapas: acá no se cambia de vista, se elige QUÉ
              categoría se está creando. Es el aria-pressed del gemelo web, que
              en nativo se dice con selected. */}
          <View style={e.segmented}>
            {[false, true].map((ing) => (
              <Pressable
                key={String(ing)}
                onPress={() => setEsIngreso(ing)}
                accessibilityRole="button"
                accessibilityState={{ selected: esIngreso === ing }}
                style={[e.segmento, esIngreso === ing && e.segmentoActivo]}
              >
                <Text style={[e.segmentoTexto, esIngreso === ing && e.segmentoTextoActivo]}>
                  {ing ? "Para ingresos" : "Para gastos"}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={[e.segmented, { marginTop: 8 }]}>
            {(["hogar", "personal"] as const).map((a) => (
              <Pressable
                key={a}
                onPress={() => setAmbito(a)}
                accessibilityRole="button"
                accessibilityState={{ selected: ambito === a }}
                style={[e.segmento, ambito === a && e.segmentoActivo]}
              >
                <Text style={[e.segmentoTexto, ambito === a && e.segmentoTextoActivo]}>
                  {a === "hogar" ? "Del hogar" : "Solo mía"}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <TextInput
        value={nombre}
        onChangeText={setNombre}
        maxLength={40}
        placeholder="Nombre (ej. Peluquería)"
        placeholderTextColor={color.tintaTerciaria}
        style={e.input}
      />

      {/* el grupo ordena el presupuesto; las de ingreso no van al presupuesto */}
      {!esIngreso && (
        <View style={{ marginTop: 12 }}>
          <Text style={e.etiqueta}>Grupo</Text>
          <View style={e.chips}>
            {[...new Set([...gruposGasto, GRUPO_OTROS])].map((g) => (
              <Pressable
                key={g}
                onPress={() => setGrupo(g)}
                style={[e.chip, grupo === g && e.chipSel]}
              >
                <Text style={[e.chipTexto, grupo === g && e.chipTextoSel]}>{g}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={grupo}
            onChangeText={setGrupo}
            maxLength={40}
            placeholder="…o escribí un grupo nuevo"
            placeholderTextColor={color.tintaTerciaria}
            style={[e.input, { height: 40, fontSize: 14, marginTop: 8 }]}
          />
        </View>
      )}

      <View style={{ marginTop: 12 }}>
        <Text style={e.etiqueta}>Ícono</Text>
        {ICONOS_POR_TEMA.map((tema) => (
          <View key={tema.tema} style={e.chips}>
            {tema.iconos.map((i) => (
              <Pressable
                key={i}
                onPress={() => setIcono(i)}
                style={[e.iconoBoton, icono === i && e.iconoBotonSel]}
              >
                <IconoCategoria nombre={i} tono={icono === i ? "verde" : "normal"} />
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      {error && <Text style={e.error}>{error}</Text>}

      <Pressable
        onPress={guardar}
        disabled={pendiente || nombre.trim() === ""}
        style={[e.cta, (pendiente || nombre.trim() === "") && { opacity: 0.4 }]}
      >
        {pendiente ? (
          <ActivityIndicator color={color.papel} size="small" />
        ) : (
          <>
            <Check size={18} color={color.papel} strokeWidth={2} />
            <Text style={e.ctaTexto}>
              {editando ? "Guardar cambios" : "Crear categoría"}
            </Text>
          </>
        )}
      </Pressable>
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
    paddingBottom: 14,
  },
  titulo: { fontSize: 19, fontFamily: fuente.textoSemi, color: color.tinta },
  subtitulo: { fontSize: 11.5, fontFamily: fuente.texto, color: color.tintaSecundaria },
  cta: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radio.cta,
    backgroundColor: color.verde,
    paddingVertical: 14,
  },
  ctaTexto: { fontSize: 14.5, fontFamily: fuente.textoSemi, color: color.papel },
  grupo: {
    fontSize: 11.5,
    fontFamily: fuente.textoSemi,
    letterSpacing: 0.5,
    color: color.tintaSecundaria,
  },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  conBorde: { borderTopWidth: 1, borderTopColor: color.separador },
  nombre: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontFamily: fuente.texto,
    color: color.tinta,
  },
  marcaPersonal: {
    fontSize: 9.5,
    fontFamily: fuente.texto,
    letterSpacing: 0.5,
    color: color.tintaTerciaria,
  },
  aclaracion: {
    marginTop: 24,
    fontSize: 11.5,
    lineHeight: 18,
    fontFamily: fuente.texto,
    color: color.tintaTerciaria,
  },
  formulario: {
    marginTop: 16,
    borderRadius: radio.card,
    borderWidth: 1,
    borderColor: color.borde,
    padding: 16,
  },
  formCabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  formTitulo: { flex: 1, fontSize: 15, fontFamily: fuente.textoSemi, color: color.tinta },
  segmented: {
    marginTop: 12,
    flexDirection: "row",
    borderRadius: radio.cta,
    backgroundColor: color.fondoSegmented,
    padding: 3,
  },
  segmento: { flex: 1, borderRadius: 9, paddingVertical: 9, alignItems: "center" },
  segmentoActivo: { backgroundColor: color.segmentedActivo },
  segmentoTexto: { fontSize: 13, fontFamily: fuente.textoMedio, color: color.tintaSecundaria },
  // el peso del activo es OTRO archivo de Rubik, no un fontWeight encima
  segmentoTextoActivo: { fontFamily: fuente.textoSemi, color: color.tinta },
  input: {
    marginTop: 12,
    height: 46,
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: fuente.texto,
    color: color.tinta,
  },
  etiqueta: { fontSize: 12, fontFamily: fuente.texto, color: color.tintaSecundaria },
  chips: { marginTop: 6, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderRadius: radio.chipMini,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipSel: { borderColor: color.verde, backgroundColor: color.verdeSuave },
  chipTexto: { fontSize: 12, fontFamily: fuente.texto, color: color.tinta },
  chipTextoSel: { fontFamily: fuente.textoSemi, color: color.verde },
  iconoBoton: {
    width: 38,
    height: 38,
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    alignItems: "center",
    justifyContent: "center",
  },
  iconoBotonSel: {
    borderWidth: 1.5,
    borderColor: color.verde,
    backgroundColor: color.verdeSuave,
  },
  error: {
    marginTop: 12,
    fontSize: 12.5,
    fontFamily: fuente.textoMedio,
    color: color.rojo,
  },
});
