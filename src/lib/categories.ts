export const CATEGORIES = [
  { id: "food", label: "Food & drink", icon: "🍽️" },
  { id: "lodging", label: "Lodging", icon: "🏠" },
  { id: "transport", label: "Transport", icon: "🚗" },
  { id: "activities", label: "Activities", icon: "🎟️" },
  { id: "groceries", label: "Groceries", icon: "🛒" },
  { id: "other", label: "Other", icon: "🧾" },
] as const;

export function categoryIcon(id: string | null) {
  return CATEGORIES.find((c) => c.id === id)?.icon ?? "🧾";
}
