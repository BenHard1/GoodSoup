import { BookOpen, CalendarDays, Compass, House, Refrigerator, ShoppingBasket } from "lucide-react";

/** Les six espaces de l'application. `phase` indique quand l'espace devient fonctionnel. */
export const NAV_ITEMS = [
  { href: "/accueil", label: "Accueil", Icon: House, phase: 0 },
  { href: "/recettes", label: "Recettes", Icon: BookOpen, phase: 1 },
  { href: "/frigo", label: "Frigo", Icon: Refrigerator, phase: 3 },
  { href: "/menus", label: "Menus", Icon: CalendarDays, phase: 4 },
  { href: "/courses", label: "Courses", Icon: ShoppingBasket, phase: 4 },
  { href: "/decouvrir", label: "Découvrir", Icon: Compass, phase: 1 },
] as const;
