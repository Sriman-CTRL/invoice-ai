// Client pay page explainer text. English is the default; Hinglish (Roman-script Hindi-English mix) is shown only
// when VITE_FEATURE_HINGLISH_PAY=true. Both versions must say the same things.
export type PayLang = "en" | "hinglish";

export function hinglishEnabled(value: unknown): boolean {
  return typeof value === "string" && value.trim().toLowerCase() === "true";
}

export const HINGLISH_PAY_ENABLED: boolean = hinglishEnabled(import.meta.env?.VITE_FEATURE_HINGLISH_PAY);

export interface PayExplainer {
  title: string;
  direct: string;
  next: string;
}

export function payExplainer(lang: PayLang, seller: string, hasFiles: boolean): PayExplainer {
  if (lang === "hinglish") {
    return {
      title: `Aap ${seller} ko pay kar rahe hain`,
      direct: "Aapka payment seedha unke UPI ID ya bank account mein jaata hai. Paivo paise apne paas nahi rakhta.",
      next: `Pay karne ke baad UTR daalein (UPI ya banking app mein dikhne wala transaction reference). ${seller} apna bank check karke confirm karte hain${hasFiles ? ", aur uske baad files is page par unlock ho jaati hain" : ""}.`,
    };
  }
  return {
    title: `You're paying ${seller}`,
    direct: "Your payment goes straight to their UPI ID or bank account. Paivo never holds the money.",
    next: `After you pay, enter the UTR (the transaction reference shown in your UPI or banking app). ${seller} checks their bank and confirms${hasFiles ? ", and then the files unlock on this page" : ""}.`,
  };
}
