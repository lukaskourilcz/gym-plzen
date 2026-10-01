export type AdminSortOption = { value: string; label: string };
const date = { value: "date", label: "Datum" };
const name = { value: "name", label: "Jméno" };
const email = { value: "email", label: "E-mail" };
export function adminSortOptions(path: string): AdminSortOption[] {
  const options: Record<string, AdminSortOption[]> = {
    members: [
      { ...date, label: "Datum registrace" },
      name,
      email,
      { value: "phone", label: "Telefon" },
      { value: "role", label: "Role" },
    ],
    memberships: [{ ...date, label: "Datum registrace" }, name, email],
    reservations: [
      { ...date, label: "Začátek rezervace" },
      name,
      email,
      { value: "price", label: "Cena" },
      { value: "status", label: "Stav" },
      { value: "created", label: "Datum vytvoření" },
    ],
    messages: [{ ...date, label: "Datum odeslání" }, name, email],
    "access-codes": [
      { ...date, label: "Datum vytvoření" },
      name,
      email,
      { value: "start", label: "Platí od" },
      { value: "end", label: "Platí do" },
      { value: "status", label: "Stav kódu" },
    ],
    "entry-log": [
      date,
      name,
      { value: "action", label: "Akce" },
      { value: "trigger", label: "Způsob" },
    ],
    activity: [
      date,
      { ...name, label: "Kdo" },
      { value: "action", label: "Akce" },
    ],
    alerts: [
      date,
      { ...name, label: "Název" },
      { value: "severity", label: "Závažnost" },
      { value: "resolved", label: "Datum vyřešení" },
    ],
    newsletter: [
      { ...date, label: "Datum registrace" },
      email,
      { value: "status", label: "Stav" },
      { value: "source", label: "Zdroj" },
    ],
    vouchers: [
      { ...date, label: "Datum vytvoření" },
      { ...name, label: "Kód" },
      { value: "start", label: "Platí od" },
      { value: "end", label: "Platí do" },
      { value: "usage", label: "Použití" },
      { value: "status", label: "Stav" },
    ],
    doklady: [
      { ...date, label: "Datum vystavení" },
      name,
      email,
      { value: "number", label: "Číslo dokladu" },
      { value: "price", label: "Částka" },
      { value: "sent", label: "Datum odeslání" },
    ],
    schedule: [
      { ...date, label: "Začátek" },
      { value: "end", label: "Konec" },
      { value: "reason", label: "Důvod" },
      { ...name, label: "Poznámka" },
    ],
  };
  return options[path.replace("/admin/", "")] ?? [date];
}
