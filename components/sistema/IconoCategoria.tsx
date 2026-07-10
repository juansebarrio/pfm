import {
  Bike,
  Building2,
  Bus,
  Camera,
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
} from "lucide-react";

// Los nombres viven en categorias.icono (seed). Fallback: tag.
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

type Props = {
  nombre: string;
  className?: string;
  /**
   * ámbar cuando la partida tiene un aviso activo (DESIGN_NOTES.md §1.5);
   * verde en la tile seleccionada del picker de categorías (03, §3.12)
   */
  tono?: "normal" | "ambar" | "verde";
};

const tonos = {
  normal: "text-tinta-secundaria",
  ambar: "text-ambar",
  verde: "text-verde",
} as const;

export function IconoCategoria({ nombre, className = "size-[18px]", tono = "normal" }: Props) {
  const Icono = iconos[nombre] ?? Tag;
  return <Icono className={`${className} ${tonos[tono]}`} strokeWidth={1.5} aria-hidden />;
}
