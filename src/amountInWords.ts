// Indian-system amount in words (lakh, crore), e.g. 45000 -> "Rupees Forty-Five Thousand Only".
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function below100(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "");
}

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", rest ? below100(rest) : ""].filter(Boolean).join(" ");
}

/** Whole number in Indian grouping: crore (1,00,00,000), lakh (1,00,000), thousand, hundred. */
export function wholeNumberInWords(n: number): string {
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;
  return [
    crore ? `${wholeNumberInWords(crore)} Crore` : "",
    lakh ? `${below100(lakh)} Lakh` : "",
    thousand ? `${below100(thousand)} Thousand` : "",
    rest ? below1000(rest) : "",
  ].filter(Boolean).join(" ");
}

/** Returns e.g. "Rupees Ninety-Nine and Fifty Paise Only", or null when the amount is not a usable number. */
export function amountInWords(amount: number): string | null {
  if (!Number.isFinite(amount) || amount < 0 || amount >= 1e13) return null;
  const totalPaise = Math.round(amount * 100);
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;
  const rupeeText = `Rupees ${wholeNumberInWords(rupees)}`;
  return paise ? `${rupeeText} and ${below100(paise)} Paise Only` : `${rupeeText} Only`;
}
