export const money = (amount: number | string | null | undefined, currency = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount || 0));
export const date = (value: string | null | undefined, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) => value ? new Intl.DateTimeFormat("en-IN", options).format(new Date(value)) : "—";
export const dateTime = (value: string | null | undefined) => date(value, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
export const initials = (name?: string | null) => (name || "U").split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
export const titleCase = (value: string) => value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
