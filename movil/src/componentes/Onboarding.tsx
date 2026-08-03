import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Camera,
  CreditCard,
  Inbox,
  Lock,
  Plus,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react-native";
import {
  CLAVE_ONBOARDING,
  PASOS_ONBOARDING,
  type PasoOnboarding,
} from "@dominio/onboarding";
import {
  Badge,
  Card,
  CardPartida,
  FilaMovimiento,
  IconoCategoria,
  Importe,
} from "@/componentes/sistema";
import { color, fuente, radio } from "@/lib/tema";
import { tacto } from "@/lib/tacto";

// El recorrido de bienvenida. Espeja components/sistema/Onboarding.tsx de la
// web: el contenido vive en lib/dominio/onboarding.ts y acá solo se dibuja.
//
// Los pasos van en una FlatList horizontal con paging: los puntos de abajo
// prometen un carrusel y acá deslizar CUMPLE esa promesa (en la web alcanzan
// los botones). El gesto y el botón "Siguiente" mueven el mismo estado: el
// swipe actualiza `paso` al asentarse el scroll, y los botones hacen
// scrollToIndex — puntos, CTA y contador nunca se desincronizan de la página.
//
// Se abre solo la primera vez (OnboardingAuto, con AsyncStorage) y siempre
// desde "Enseñame a utilizar la app" en Hogar.

const ICONOS: Record<string, LucideIcon> = {
  wallet: Wallet,
  camera: Camera,
  inbox: Inbox,
  "credit-card": CreditCard,
  lock: Lock,
  sparkles: Sparkles,
};

// La viñeta de cada paso: el sistema mostrándose a sí mismo. Antes el paso
// contaba con palabras lo que la app dibuja con componentes (y el de la cámara
// describía una pastilla que este mismo modal tapa); ahora cada paso trae una
// mini-vista armada con los componentes reales de sistema.tsx donde alcanzan
// (CardPartida, FilaMovimiento, Badge, Importe) y réplicas con los mismos
// tokens donde el real es interactivo (la pastilla del tab bar, los chips de
// la bandeja). Datos de mentira FIJOS: enseña la anatomía, no un estado.
function MiniVista({ paso }: { paso: string }) {
  switch (paso) {
    case "wallet":
      // el sobre tal cual se ve en Presupuesto: nombre, "queda", barrita, meta
      return (
        <Card>
          <CardPartida
            nombre="Supermercado"
            icono="shopping-cart"
            asignadoCentavos={45000000}
            gastadoCentavos={19840000}
            estado="ok"
          />
        </Card>
      );
    case "camera":
      // réplica chica de la pastilla de (tabs)/_layout — que el modal tapa
      return (
        <View style={v.pastilla}>
          <View style={v.mitad}>
            <Camera size={20} color={color.papel} strokeWidth={2} />
          </View>
          <View style={v.divisor} />
          <View style={v.mitad}>
            <Plus size={22} color={color.papel} strokeWidth={2.5} />
          </View>
        </View>
      );
    case "inbox":
      // la card de la bandeja: borde cálido, contador ámbar, fila sin
      // categoría y los chips sugeridos abiertos
      return (
        <Card style={{ borderColor: color.bordeBandeja }}>
          <View style={v.bandejaHeader}>
            <Inbox size={15} color={color.ambar} strokeWidth={1.5} />
            <Text style={v.bandejaTitulo}>Bandeja de entrada</Text>
            <View style={v.contador}>
              <Text style={v.contadorTexto}>2</Text>
            </View>
          </View>
          <View style={v.bandejaFila}>
            <View style={v.bandejaTexto}>
              <Text numberOfLines={1} style={v.filaTitulo}>
                Coto Digital
              </Text>
              <Text numberOfLines={1} style={v.filaMeta}>
                hoy · Visa •• 4321
              </Text>
            </View>
            <Importe centavos={4830000} variante="fila" />
          </View>
          <View style={v.chips}>
            <View style={v.chip}>
              <IconoCategoria nombre="shopping-cart" tamano={13} />
              <Text style={v.chipTexto}>Supermercado</Text>
            </View>
            <View style={v.chip}>
              <IconoCategoria nombre="utensils" tamano={13} />
              <Text style={v.chipTexto}>Comida afuera</Text>
            </View>
            <View style={v.chip}>
              <Text style={v.chipTexto}>todas →</Text>
            </View>
          </View>
        </Card>
      );
    case "credit-card":
      // un consumo en cuotas: el cierre en ámbar y el badge CUOTA, de verdad
      return (
        <Card>
          <FilaMovimiento
            descripcion="Vuelo a Salta"
            icono="plane"
            metadata="Viajes · Visa •• 4321"
            cierreCiclo="cierra 28 jul"
            importeCentavos={8940000}
            badgeCuota="cuota 3/6"
          />
        </Card>
      );
    case "lock":
      // los dos ámbitos, lado a lado, con el Badge real
      return (
        <Card>
          <View style={v.badgesFila}>
            <Badge variante="hogar">hogar</Badge>
            <Badge variante="personal">personal</Badge>
          </View>
        </Card>
      );
    case "sparkles":
      // como en el asistente: la pregunta es un encabezado tenue y la
      // respuesta llega con tus números — cifra en mono
      return (
        <View>
          <Text style={v.pregunta}>¿Cuánto va el súper?</Text>
          <View style={v.burbuja}>
            <Text style={v.burbujaTexto}>
              Van <Text style={v.cifraChat}>$ 198.400</Text> de{" "}
              <Text style={v.cifraChat}>$ 450.000</Text>. Venís bien.
            </Text>
          </View>
        </View>
      );
    default:
      return null;
  }
}

export function Onboarding({
  abierto,
  alCerrar,
}: {
  abierto: boolean;
  alCerrar: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: ancho } = useWindowDimensions();
  const [paso, setPaso] = useState(0);
  const lista = useRef<FlatList<PasoOnboarding>>(null);

  // cada apertura arranca del principio (estado y scroll, juntos)
  useEffect(() => {
    if (abierto) {
      setPaso(0);
      lista.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [abierto]);

  const esUltimo = paso === PASOS_ONBOARDING.length - 1;

  function cerrar() {
    // la marca se escribe al CERRAR: si recargás a mitad del recorrido, lo
    // volvés a ver entero, que es mejor que perderte la mitad para siempre
    void AsyncStorage.setItem(CLAVE_ONBOARDING, "1");
    alCerrar();
  }

  function irA(indice: number) {
    const destino = Math.max(0, Math.min(PASOS_ONBOARDING.length - 1, indice));
    setPaso(destino);
    lista.current?.scrollToIndex({ index: destino, animated: true });
  }

  function alAsentarse(ev: NativeSyntheticEvent<NativeScrollEvent>) {
    const indice = Math.round(ev.nativeEvent.contentOffset.x / ancho);
    setPaso(Math.max(0, Math.min(PASOS_ONBOARDING.length - 1, indice)));
  }

  return (
    <Modal visible={abierto} animationType="fade" onRequestClose={cerrar}>
      <View
        style={[
          e.pantalla,
          { paddingTop: Math.max(20, insets.top), paddingBottom: Math.max(24, insets.bottom) },
        ]}
      >
        <View style={e.filaSaltar}>
          <Pressable onPress={cerrar} hitSlop={12}>
            <Text style={e.saltar}>Saltar</Text>
          </Pressable>
        </View>

        <FlatList
          ref={lista}
          data={PASOS_ONBOARDING}
          keyExtractor={(item) => item.icono}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={alAsentarse}
          getItemLayout={(_, index) => ({ length: ancho, offset: ancho * index, index })}
          style={e.carrusel}
          renderItem={({ item }) => {
            const Icono = ICONOS[item.icono] ?? Wallet;
            return (
              <View style={[e.paginaPaso, { width: ancho }]}>
                <View style={e.circulo}>
                  <Icono size={36} color={color.verde} strokeWidth={1.5} />
                </View>
                <Text style={e.titulo}>{item.titulo}</Text>
                <Text style={e.cuerpo}>{item.cuerpo}</Text>
                {/* la viñeta: decorativa y quieta (los lectores ya tienen el cuerpo) */}
                <View
                  style={e.vineta}
                  pointerEvents="none"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <MiniVista paso={item.icono} />
                </View>
              </View>
            );
          }}
        />

        <View style={e.pie}>
          <View style={e.puntos}>
            {PASOS_ONBOARDING.map((_, i) => (
              <View key={i} style={[e.punto, i === paso && e.puntoActivo]} />
            ))}
          </View>
          <View style={e.filaBotones}>
            {paso > 0 && (
              <Pressable
                onPress={() => {
                  tacto.toque();
                  irA(paso - 1);
                }}
                hitSlop={10}
                style={e.atras}
              >
                <Text style={e.atrasTexto}>Atrás</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => {
                tacto.toque();
                if (esUltimo) cerrar();
                else irA(paso + 1);
              }}
              style={e.cta}
            >
              <Text style={e.ctaTexto}>{esUltimo ? "Listo, a usarla" : "Siguiente"}</Text>
            </Pressable>
          </View>
          <Text style={e.contador}>
            {paso + 1} de {PASOS_ONBOARDING.length}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

/** El disparo de la primera vez: si AsyncStorage ya tiene la marca, nada. */
export function OnboardingAuto() {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CLAVE_ONBOARDING).then((visto) => {
      if (!visto) setAbierto(true);
    });
  }, []);

  return <Onboarding abierto={abierto} alCerrar={() => setAbierto(false)} />;
}

const e = StyleSheet.create({
  // sin padding horizontal: el carrusel necesita el ancho ENTERO de la
  // pantalla para que cada página mida exactamente `ancho` y el paging
  // caiga justo; el aire lateral lo ponen cada página, el saltar y el pie
  pantalla: { flex: 1, backgroundColor: color.papel },
  filaSaltar: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 24 },
  saltar: { fontSize: 13, fontFamily: fuente.textoMedio, color: color.tintaSecundaria, padding: 6 },
  carrusel: { flex: 1 },
  paginaPaso: {
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  circulo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.verdeSuave,
  },
  titulo: {
    marginTop: 28,
    fontSize: 24,
    lineHeight: 30,
    fontFamily: fuente.textoSemi,
    color: color.tinta,
    textAlign: "center",
  },
  cuerpo: {
    marginTop: 14,
    maxWidth: 300,
    fontSize: 14.5,
    lineHeight: 23,
    color: color.tintaSecundaria,
    textAlign: "center",
  },
  vineta: { marginTop: 28, width: "100%", maxWidth: 300 },
  pie: { alignItems: "center", gap: 22, paddingHorizontal: 24 },
  puntos: { flexDirection: "row", alignItems: "center", gap: 8 },
  punto: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.tintaMuda },
  puntoActivo: { width: 20, backgroundColor: color.verde },
  filaBotones: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "stretch" },
  atras: { paddingHorizontal: 12 },
  atrasTexto: { fontSize: 13.5, fontFamily: fuente.textoMedio, color: color.tintaSecundaria },
  cta: {
    flex: 1,
    height: 48,
    borderRadius: radio.cta,
    backgroundColor: color.verde,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaTexto: { fontSize: 15, fontFamily: fuente.textoSemi, color: color.papel },
  contador: { fontSize: 10.5, color: color.tintaTerciaria },
});

// estilos de las viñetas: mismos tokens que sistema.tsx y (tabs)/_layout
const v = StyleSheet.create({
  pastilla: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    height: 46,
    borderRadius: 23,
    backgroundColor: color.verde,
    // el resplandor verde de la pastilla real, a escala de viñeta
    shadowColor: color.verde,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  mitad: { width: 52, height: 46, alignItems: "center", justifyContent: "center" },
  divisor: { width: 1, height: 22, backgroundColor: "rgba(0,0,0,0.3)" },
  bandejaHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  bandejaTitulo: { flex: 1, fontSize: 13.5, fontFamily: fuente.textoSemi, color: color.tinta },
  contador: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.ambar,
  },
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
    borderTopWidth: 1,
    borderTopColor: color.separador,
  },
  bandejaTexto: { flex: 1, minWidth: 0 },
  filaTitulo: { fontSize: 14, fontFamily: fuente.textoMedio, color: color.tinta },
  filaMeta: { marginTop: 2, fontSize: 11, fontFamily: fuente.texto, color: color.tintaSecundaria },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radio.chipMini,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipTexto: { fontSize: 11.5, fontFamily: fuente.textoMedio, color: color.tintaSecundaria },
  badgesFila: { flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 16 },
  pregunta: { fontSize: 12.5, fontFamily: fuente.textoSemi, color: color.tintaSecundaria },
  burbuja: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderRadius: radio.card,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  burbujaTexto: { fontSize: 13, lineHeight: 20, fontFamily: fuente.texto, color: color.tinta },
  cifraChat: { fontFamily: fuente.monoSemi, fontVariant: ["tabular-nums"] },
});
