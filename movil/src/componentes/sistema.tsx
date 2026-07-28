import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import {
  ArrowDownLeft,
  Bike,
  Building2,
  Bus,
  Camera,
  Check,
  Clapperboard,
  Fuel,
  Gift,
  HeartPulse,
  House,
  PiggyBank,
  Pill,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tag,
  Tv,
  Utensils,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react-native";
import { formatearImporte, type Moneda } from "@dominio/dinero";
import { color, radio } from "@/lib/tema";

// Componentes del sistema de diseño, portados de components/sistema/ de la web.
// Misma anatomía y mismo léxico; lo que cambia es CSS → StyleSheet y <div> →
// <View>. Los tamaños en px del export se conservan tal cual.

// ─────────────────────────────────────────────────────── Card

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[e.card, style]}>{children}</View>;
}

export function EncabezadoSeccion({ children }: { children: React.ReactNode }) {
  return <Text style={e.encabezadoSeccion}>{children}</Text>;
}

// ─────────────────────────────────────────────────────── Importe

const variantesImporte = {
  hero: { fontSize: 40, fontWeight: "500" },
  card: { fontSize: 34, fontWeight: "500" },
  patrimonio: { fontSize: 28, fontWeight: "500" },
  fila: { fontSize: 13, fontWeight: "600" },
  filaChica: { fontSize: 12.5, fontWeight: "600" },
  meta: { fontSize: 11, fontWeight: "400" },
} as const;

export function Importe({
  centavos,
  moneda = "ARS",
  variante = "fila",
  conSigno = false,
  color: colorTexto = color.tinta,
}: {
  centavos: number;
  moneda?: Moneda;
  variante?: keyof typeof variantesImporte;
  conSigno?: boolean;
  color?: string;
}) {
  const texto = formatearImporte(Math.abs(centavos), moneda);
  const prefijo = conSigno && centavos > 0 ? "+ " : centavos < 0 ? "− " : "";
  return (
    <Text style={[variantesImporte[variante], { color: colorTexto }]}>
      {prefijo}
      {texto}
    </Text>
  );
}

// ─────────────────────────────────────────────────────── Badge

type VarianteBadge =
  | "hogar"
  | "personal"
  | "estimada"
  | "confirmada"
  | "rollover"
  | "cuota"
  | "pendiente"
  | "neutro";

const estilosBadge: Record<VarianteBadge, ViewStyle> = {
  hogar: { borderWidth: 1, borderColor: color.borde, backgroundColor: color.superficie },
  personal: { borderWidth: 1, borderColor: color.borde, backgroundColor: color.superficie },
  neutro: { borderWidth: 1, borderColor: color.borde, backgroundColor: color.superficie },
  estimada: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: color.bordeEstimada,
    backgroundColor: color.fondoEstimada,
  },
  pendiente: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: color.bordeEstimada,
    backgroundColor: color.fondoEstimada,
  },
  confirmada: { backgroundColor: color.verdeSuave },
  rollover: { backgroundColor: color.azulSuave },
  cuota: { backgroundColor: color.separador },
};

const colorBadge: Record<VarianteBadge, string> = {
  hogar: color.tintaSecundaria,
  personal: color.tintaSecundaria,
  neutro: color.tintaSecundaria,
  estimada: color.ambarTexto,
  pendiente: color.ambarTexto,
  confirmada: color.verde,
  rollover: color.azul,
  cuota: color.tintaSecundaria,
};

export function Badge({
  variante,
  children,
}: {
  variante: VarianteBadge;
  children: string;
}) {
  return (
    <View style={[e.badge, estilosBadge[variante]]}>
      <Text style={[e.badgeTexto, { color: colorBadge[variante] }]}>
        {children.toUpperCase()}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────── BarraAvance

type Tono = "ok" | "pagada" | "atencion" | "excedido" | "tinta";

const coloresTono: Record<Tono, string> = {
  ok: color.verde,
  pagada: color.verde,
  atencion: color.ambar,
  excedido: color.rojo,
  tinta: color.tinta,
};

export function BarraAvance({
  progreso,
  tono,
  altura = 4,
  marcadorDia,
  style,
}: {
  progreso: number;
  tono: Tono;
  altura?: number;
  marcadorDia?: number;
  style?: ViewStyle;
}) {
  const ancho = Math.max(0, Math.min(1, progreso)) * 100;
  return (
    <View style={[e.pista, { height: altura }, style]}>
      <View
        style={{
          height: "100%",
          borderRadius: 2,
          width: `${ancho}%`,
          backgroundColor: coloresTono[tono],
          // una fija pagada al 100 % se ve calma
          opacity: tono === "pagada" ? 0.4 : 1,
        }}
      />
      {marcadorDia !== undefined && (
        <View
          style={{
            position: "absolute",
            width: 2,
            borderRadius: 1,
            backgroundColor: color.verde,
            left: `${Math.max(0, Math.min(1, marcadorDia)) * 100}%`,
            top: -3.5,
            height: altura + 7,
          }}
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────── IconoCategoria

const iconos: Record<string, LucideIcon> = {
  house: House,
  "building-2": Building2,
  "shopping-cart": ShoppingCart,
  bike: Bike,
  utensils: Utensils,
  "piggy-bank": PiggyBank,
  "heart-pulse": HeartPulse,
  pill: Pill,
  zap: Zap,
  wifi: Wifi,
  smartphone: Smartphone,
  tv: Tv,
  fuel: Fuel,
  bus: Bus,
  clapperboard: Clapperboard,
  sparkles: Sparkles,
  camera: Camera,
  gift: Gift,
  tag: Tag,
};

const tonosIcono = {
  normal: color.tintaSecundaria,
  ambar: color.ambar,
  verde: color.verde,
} as const;

export function IconoCategoria({
  nombre,
  tamano = 18,
  tono = "normal",
}: {
  nombre: string | null;
  tamano?: number;
  tono?: keyof typeof tonosIcono;
}) {
  const Icono = (nombre && iconos[nombre]) || Tag;
  return <Icono size={tamano} color={tonosIcono[tono]} strokeWidth={1.5} />;
}

// ─────────────────────────────────────────────────────── EstadoVacio

export function EstadoVacio({
  Icono,
  titulo,
  cuerpo,
}: {
  Icono: LucideIcon;
  titulo: string;
  cuerpo: string;
}) {
  return (
    <View style={e.vacio}>
      <View style={e.vacioCirculo}>
        <Icono size={28} color={color.verde} strokeWidth={1.5} />
      </View>
      <Text style={e.vacioTitulo}>{titulo}</Text>
      <Text style={e.vacioCuerpo}>{cuerpo}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────── CardPartida

export type DatosPartida = {
  nombre: string;
  icono: string;
  asignadoCentavos: number;
  gastadoCentavos: number;
  rolloverCentavos?: number;
  fija?: boolean;
  rollover?: boolean;
  estado: "ok" | "atencion" | "excedido";
  excedenteProyectadoCentavos?: number | null;
  sufijoMeta?: string;
  avisoRecurrente?: string;
  textoRollover?: string;
  esAhorro?: boolean;
};

export function CardPartida(p: DatosPartida) {
  const disponible = p.asignadoCentavos + (p.rolloverCentavos ?? 0);
  const queda = disponible - p.gastadoCentavos;
  const pagada = Boolean(
    p.fija && p.gastadoCentavos >= p.asignadoCentavos && p.estado === "ok",
  );
  // guarda: una partida rollover con asignado 0 daría Infinity
  const progreso = p.asignadoCentavos > 0 ? p.gastadoCentavos / p.asignadoCentavos : 0;
  const tieneAviso = Boolean(p.avisoRecurrente);
  // importe ámbar: atención + gastado ≥ 75 % del disponible (DESIGN_NOTES §1.8)
  const importeAmbar = p.estado === "atencion" && p.gastadoCentavos >= disponible * 0.75;

  return (
    <View style={e.partida}>
      <View style={e.partidaFila}>
        <IconoCategoria nombre={p.icono} tono={tieneAviso ? "ambar" : "normal"} />
        <View style={e.partidaNombre}>
          <Text numberOfLines={1} style={e.partidaTitulo}>
            {p.nombre}
          </Text>
          {p.rollover && <Badge variante="rollover">Rollover</Badge>}
        </View>
        {pagada ? (
          <View style={e.pagada}>
            <Check size={14} color={color.verde} strokeWidth={2} />
            <Text style={e.pagadaTexto}>{p.esAhorro ? "transferido" : "pagado"}</Text>
          </View>
        ) : (
          <View style={e.quedaFila}>
            <Text style={e.quedaEtiqueta}>queda</Text>
            <Importe
              centavos={queda}
              variante="fila"
              color={
                p.estado === "excedido"
                  ? color.rojo
                  : importeAmbar
                    ? color.ambarTexto
                    : color.tinta
              }
            />
          </View>
        )}
      </View>

      <BarraAvance
        progreso={progreso}
        tono={
          p.estado === "excedido"
            ? "excedido"
            : p.estado === "atencion"
              ? "atencion"
              : pagada
                ? "pagada"
                : "ok"
        }
        style={{ marginTop: 8 }}
      />

      <View style={e.partidaPie}>
        <Text style={e.partidaMeta}>
          {formatearImporte(p.gastadoCentavos)} de{" "}
          {formatearImporte(p.asignadoCentavos)}
          {p.sufijoMeta ? ` ${p.sufijoMeta}` : ""}
        </Text>
        {p.avisoRecurrente ? (
          <Text style={[e.partidaAviso, { color: color.ambarTexto }]}>
            {p.avisoRecurrente}
          </Text>
        ) : p.estado === "atencion" && p.excedenteProyectadoCentavos != null ? (
          <Text style={[e.partidaAviso, { color: color.ambarTexto }]}>
            a este ritmo terminás {formatearImporte(p.excedenteProyectadoCentavos)} arriba
          </Text>
        ) : p.estado === "excedido" ? (
          <Text style={[e.partidaAviso, { color: color.rojo, fontWeight: "500" }]}>
            te pasaste {formatearImporte(-queda)}
          </Text>
        ) : p.textoRollover ? (
          <Text style={[e.partidaAviso, { color: color.azul }]}>{p.textoRollover}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────── FilaMovimiento

export function FilaMovimiento({
  descripcion,
  icono,
  metadata,
  cierreCiclo,
  importeCentavos,
  esIngreso,
  ambito,
  badgeCuota,
}: {
  descripcion: string;
  icono?: string | null;
  metadata?: string;
  cierreCiclo?: string | null;
  importeCentavos: number;
  esIngreso?: boolean;
  ambito?: "hogar" | "personal";
  badgeCuota?: string;
}) {
  return (
    <View style={e.movimiento}>
      <IconoCategoria nombre={icono ?? null} />
      <View style={e.movimientoTexto}>
        <Text numberOfLines={1} style={e.movimientoDescripcion}>
          {descripcion}
        </Text>
        {(metadata || cierreCiclo) && (
          <Text numberOfLines={1} style={e.movimientoMeta}>
            {metadata}
            {cierreCiclo ? (
              <Text style={{ color: color.ambarTexto }}> · {cierreCiclo}</Text>
            ) : null}
          </Text>
        )}
      </View>
      {esIngreso && <ArrowDownLeft size={17} color={color.verde} strokeWidth={1.5} />}
      <View style={e.movimientoDerecha}>
        <Importe
          centavos={importeCentavos}
          variante="fila"
          conSigno={esIngreso}
          color={esIngreso ? color.verde : color.tinta}
        />
        <View style={e.movimientoBadges}>
          {badgeCuota && <Badge variante="cuota">{badgeCuota}</Badge>}
          {ambito && <Badge variante={ambito}>{ambito}</Badge>}
        </View>
      </View>
    </View>
  );
}

const e = StyleSheet.create({
  card: {
    borderRadius: radio.card,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    overflow: "hidden",
  },
  encabezadoSeccion: {
    marginTop: 14,
    marginBottom: 6,
    paddingHorizontal: 2,
    fontSize: 12,
    fontWeight: "600",
    color: color.tintaSecundaria,
  },
  badge: {
    borderRadius: radio.tag,
    paddingHorizontal: 5,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  badgeTexto: { fontSize: 8.5, fontWeight: "600", letterSpacing: 0.7 },
  pista: {
    width: "100%",
    borderRadius: 2,
    backgroundColor: color.pista,
    position: "relative",
  },
  vacio: { alignItems: "center", paddingHorizontal: 44, paddingBottom: 90 },
  vacioCirculo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.verdeSuave,
  },
  vacioTitulo: {
    marginTop: 20,
    fontSize: 19,
    fontWeight: "600",
    color: color.tinta,
    textAlign: "center",
  },
  vacioCuerpo: {
    marginTop: 10,
    maxWidth: 280,
    fontSize: 13.5,
    lineHeight: 21,
    color: color.tintaSecundaria,
    textAlign: "center",
  },
  partida: { paddingHorizontal: 14, paddingVertical: 11 },
  partidaFila: { flexDirection: "row", alignItems: "center", gap: 10 },
  partidaNombre: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  partidaTitulo: { flexShrink: 1, fontSize: 14, fontWeight: "500", color: color.tinta },
  pagada: { flexDirection: "row", alignItems: "center", gap: 4 },
  pagadaTexto: { fontSize: 12.5, fontWeight: "500", color: color.verde },
  quedaFila: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  quedaEtiqueta: { fontSize: 11, color: color.tintaSecundaria },
  partidaPie: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  partidaMeta: { fontSize: 11, color: color.tintaSecundaria, flexShrink: 1 },
  partidaAviso: { fontSize: 11, textAlign: "right", flexShrink: 1 },
  movimiento: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  movimientoTexto: { flex: 1, minWidth: 0 },
  movimientoDescripcion: { fontSize: 14, fontWeight: "500", color: color.tinta },
  movimientoMeta: { marginTop: 2, fontSize: 11, color: color.tintaSecundaria },
  movimientoDerecha: { alignItems: "flex-end" },
  movimientoBadges: { flexDirection: "row", gap: 4, marginTop: 4 },
});
