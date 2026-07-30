import {
  Baby,
  Banknote,
  Bike,
  Book,
  Briefcase,
  Building2,
  Bus,
  Camera,
  Car,
  Clapperboard,
  Coffee,
  Dog,
  Droplet,
  Dumbbell,
  Flame,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  House,
  Landmark,
  Music,
  PiggyBank,
  Pill,
  Plane,
  Receipt,
  Scissors,
  Shield,
  Shirt,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tag,
  Ticket,
  Tv,
  Utensils,
  Wifi,
  Wrench,
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
  banknote: Banknote,
  briefcase: Briefcase,
  "hand-coins": HandCoins,
  baby: Baby,
  book: Book,
  car: Car,
  coffee: Coffee,
  dog: Dog,
  droplet: Droplet,
  dumbbell: Dumbbell,
  flame: Flame,
  "gamepad-2": Gamepad2,
  "graduation-cap": GraduationCap,
  landmark: Landmark,
  music: Music,
  plane: Plane,
  receipt: Receipt,
  scissors: Scissors,
  shield: Shield,
  shirt: Shirt,
  ticket: Ticket,
  wrench: Wrench,
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
