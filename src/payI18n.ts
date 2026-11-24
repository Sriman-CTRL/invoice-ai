// Client pay page text in English and Hindi. A plain typed dictionary, no library.
// The switch changes labels and instructions ONLY. Amounts, dates, names, invoice lines, the UPI ID and the UPI link
// are always shown exactly as the server sent them. Messages that come back from the server (for example after
// submitting a UTR) are shown as received and are not translated here.
// The Hindi is a first draft: it needs a native speaker's review before you rely on it (see docs/NIGHT-REPORT.md).

export type Lang = "en" | "hi";
export const LANG_KEY = "paivo_pay_lang";

const en = {
  loading: "Loading payment page...",
  notFoundTitle: "Invoice Not Found",
  notFoundBody: "The requested invoice could not be located. Please check the link or contact the billing issuer.",
  goToPaivo: "Go to Paivo",
  poweredBy: "Powered by Paivo",
  print: "Print / PDF",
  https: "Secure connection (HTTPS)",
  invoiceLabel: "Invoice",
  statusPaid: "Paid & Settled",
  statusSettledCredit: "Settled by credit note",
  statusSettledMixed: "Settled: payment + credit note",
  statusPartial: "Partially Paid",
  statusDue: "Payment Due",
  billedTo: "Billed To",
  datesTerms: "Dates & Terms",
  issued: "Issued:",
  dueDate: "Due Date:",
  immediate: "Immediate",
  uponReceipt: "Upon Receipt",
  colDescription: "Description",
  colQtyRate: "Qty × Rate",
  colAmount: "Amount",
  subtotal: "Subtotal",
  discount: "Discount",
  settlementProgress: "Settlement Progress",
  total: "Total",
  paid: "Paid",
  remaining: "Remaining",
  creditApplied: (cur: string, amt: string) => `Credit note applied: - ${cur} ${amt}. You only pay the remaining amount.`,
  filesTitle: "Final files",
  filesUnlocked: "Unlocked",
  filesLocked: "Locked until paid",
  filesBodyPaid: "The seller has confirmed your payment. The final files are available below.",
  filesBodyLocked: "The seller has attached the final files to this invoice. They unlock after the seller confirms your payment: pay, then enter your UTR below so they can check it.",
  openFiles: "Download Final Deliverables",
  paymentReceived: "Payment received",
  thankYou: (seller: string) => `Thank you. ${seller} has confirmed this invoice is paid in full.`,
  filesUnlockedNote: "Your files are unlocked on the left.",
  explainTitle: (seller: string) => `You're paying ${seller}`,
  explainDirect: "Your payment goes straight to their UPI ID or bank account. Paivo never holds the money.",
  explainNext: (seller: string, hasFiles: boolean) =>
    `After you pay, enter the UTR (the transaction reference shown in your UPI or banking app). ${seller} checks their bank and confirms${hasFiles ? ", and then the files unlock on this page" : ""}.`,
  selectMethod: "Select Settlement Method",
  tabUpi: "Instant UPI",
  tabBank: "Bank NEFT",
  tabProof: "Submit UTR",
  whatUpi: "UPI",
  whatBank: "Bank transfer",
  notSetUp: (what: string) => `${what} isn't set up for this invoice yet.`,
  notSetUpHint: "Please ask the sender for their payment details, or use another method.",
  payWithUpiApp: "Pay with UPI app",
  qrAlt: "UPI Payment QR Code",
  generatingQr: "Generating QR...",
  scanWith: "Scan with any UPI App (GPay, PhonePe, Paytm, CRED)",
  amountLabel: (cur: string, amt: string) => `Amount: ${cur} ${amt}`,
  bigAmountBank: "UPI apps and banks set a limit on each payment, so a large amount may not go through. For this amount, bank transfer (NEFT/RTGS) is easier.",
  bigAmountParts: "UPI apps and banks set a limit on each payment, so a large amount may not go through. You can pay in parts and submit each UTR.",
  upiIdLabel: "UPI ID",
  copyUpi: "Copy UPI ID",
  transferredAlready: "Transferred already?",
  submitHere: "Submit your 12-digit UTR number here",
  bankIntro: "Transfer funds via NEFT, RTGS, or IMPS using the account details below:",
  beneficiary: "Beneficiary Name",
  accountNumber: "Account Number",
  ifsc: "IFSC Code",
  bankName: "Bank",
  copy: "Copy to clipboard",
  transferMade: "I have made the transfer → Submit UTR Reference",
  utrLabel: "UTR / Bank Reference ID *",
  utrPlaceholder: "e.g. 332410982734 or CMS-WIRE-889",
  utrHint: "Found in your bank receipt or UPI transaction details.",
  amountPaid: (cur: string) => `Amount Paid (${cur}) *`,
  notesLabel: "Additional Notes (Optional)",
  notesPlaceholder: "e.g. Deducted 10% TDS (challan attached), or paid from personal account.",
  screenshotLabel: "Payment screenshot (optional, helps get confirmed faster)",
  screenshotAlt: "Screenshot preview",
  verifying: "Verifying Reference...",
  confirmSubmit: "Confirm Payment Submission",
  enterUtr: "Please enter your 12-digit UTR or Transaction Reference number.",
  humanCheck: "Please complete the human check below.",
  privacy: "Privacy Policy",
  terms: "Terms of Service",
  moneyStraight: (seller: string) => `Money goes straight to ${seller}; Paivo never holds it`,
  filesAfterPay: "Final files unlock after payment",
  footerNote: "Paivo helps sellers send invoices and confirm payments. Your payment goes straight to the seller. We never store card or bank login details and never hold customer funds.",
  language: "Language",
};

export type PayText = typeof en;

const hi: PayText = {
  loading: "भुगतान पेज लोड हो रहा है…",
  notFoundTitle: "इनवॉइस नहीं मिला",
  notFoundBody: "यह इनवॉइस नहीं मिला। कृपया लिंक जाँच लें या भेजने वाले से संपर्क करें।",
  goToPaivo: "Paivo पर जाएँ",
  poweredBy: "Paivo द्वारा संचालित",
  print: "प्रिंट / PDF",
  https: "सुरक्षित कनेक्शन (HTTPS)",
  invoiceLabel: "इनवॉइस",
  statusPaid: "भुगतान हो गया",
  statusSettledCredit: "क्रेडिट नोट से निपटाया गया",
  statusSettledMixed: "निपटाया गया: भुगतान + क्रेडिट नोट",
  statusPartial: "आंशिक भुगतान",
  statusDue: "भुगतान बाकी है",
  billedTo: "बिल किसके नाम",
  datesTerms: "तारीख़ें और शर्तें",
  issued: "जारी:",
  dueDate: "देय तिथि:",
  immediate: "तुरंत",
  uponReceipt: "मिलते ही",
  colDescription: "विवरण",
  colQtyRate: "मात्रा × दर",
  colAmount: "राशि",
  subtotal: "उप-योग",
  discount: "छूट",
  settlementProgress: "भुगतान की प्रगति",
  total: "कुल",
  paid: "चुकाया",
  remaining: "बाकी",
  creditApplied: (cur, amt) => `क्रेडिट नोट लागू: - ${cur} ${amt}। आपको सिर्फ़ बची हुई राशि देनी है।`,
  filesTitle: "फ़ाइनल फ़ाइलें",
  filesUnlocked: "खुली हुई",
  filesLocked: "भुगतान तक बंद",
  filesBodyPaid: "विक्रेता ने आपका भुगतान पक्का कर दिया है। फ़ाइनल फ़ाइलें नीचे उपलब्ध हैं।",
  filesBodyLocked: "विक्रेता ने इस इनवॉइस के साथ फ़ाइनल फ़ाइलें जोड़ी हैं। विक्रेता के आपका भुगतान पक्का करने के बाद ये खुल जाती हैं: पहले भुगतान करें, फिर नीचे अपना UTR डालें ताकि वे जाँच सकें।",
  openFiles: "फ़ाइनल फ़ाइलें खोलें",
  paymentReceived: "भुगतान मिल गया",
  thankYou: (seller) => `धन्यवाद। ${seller} ने पुष्टि की है कि यह इनवॉइस पूरा चुका दिया गया है।`,
  filesUnlockedNote: "आपकी फ़ाइलें इसी पेज पर खुल गई हैं।",
  explainTitle: (seller) => `आप ${seller} को भुगतान कर रहे हैं`,
  explainDirect: "आपका पैसा सीधे उनकी UPI ID या बैंक खाते में जाता है। Paivo पैसा अपने पास नहीं रखता।",
  explainNext: (seller, hasFiles) =>
    `भुगतान के बाद UTR डालें (आपके UPI या बैंकिंग ऐप में दिखने वाला ट्रांज़ैक्शन रेफ़रेंस)। ${seller} अपना बैंक देखकर पुष्टि करते हैं${hasFiles ? ", और उसके बाद फ़ाइलें इसी पेज पर खुल जाती हैं" : ""}।`,
  selectMethod: "भुगतान का तरीक़ा चुनें",
  tabUpi: "तुरंत UPI",
  tabBank: "बैंक NEFT",
  tabProof: "UTR भेजें",
  whatUpi: "UPI",
  whatBank: "बैंक ट्रांसफ़र",
  notSetUp: (what) => `${what} इस इनवॉइस के लिए अभी सेट नहीं है।`,
  notSetUpHint: "कृपया भेजने वाले से भुगतान की जानकारी माँगें, या कोई दूसरा तरीक़ा चुनें।",
  payWithUpiApp: "UPI ऐप से भुगतान करें",
  qrAlt: "UPI भुगतान QR कोड",
  generatingQr: "QR बन रहा है…",
  scanWith: "किसी भी UPI ऐप (GPay, PhonePe, Paytm, CRED) से स्कैन करें",
  amountLabel: (cur, amt) => `राशि: ${cur} ${amt}`,
  bigAmountBank: "UPI ऐप और बैंक हर भुगतान की एक सीमा तय करते हैं, इसलिए बड़ी राशि अटक सकती है। इस राशि के लिए बैंक ट्रांसफ़र (NEFT/RTGS) आसान है।",
  bigAmountParts: "UPI ऐप और बैंक हर भुगतान की एक सीमा तय करते हैं, इसलिए बड़ी राशि अटक सकती है। आप हिस्सों में भुगतान करके हर बार का UTR भेज सकते हैं।",
  upiIdLabel: "UPI ID",
  copyUpi: "UPI ID कॉपी करें",
  transferredAlready: "पहले ही भुगतान कर दिया?",
  submitHere: "अपना 12 अंकों का UTR यहाँ भेजें",
  bankIntro: "नीचे दिए गए खाते की जानकारी से NEFT, RTGS या IMPS द्वारा पैसे भेजें:",
  beneficiary: "लाभार्थी का नाम",
  accountNumber: "खाता संख्या",
  ifsc: "IFSC कोड",
  bankName: "बैंक",
  copy: "कॉपी करें",
  transferMade: "मैंने ट्रांसफ़र कर दिया है → UTR भेजें",
  utrLabel: "UTR / बैंक रेफ़रेंस ID *",
  utrPlaceholder: "जैसे 332410982734 या CMS-WIRE-889",
  utrHint: "यह आपकी बैंक रसीद या UPI ट्रांज़ैक्शन की जानकारी में मिलेगा।",
  amountPaid: (cur) => `चुकाई गई राशि (${cur}) *`,
  notesLabel: "अतिरिक्त टिप्पणी (वैकल्पिक)",
  notesPlaceholder: "जैसे 10% TDS कटा है (चालान संलग्न), या निजी खाते से भुगतान किया।",
  screenshotLabel: "भुगतान का स्क्रीनशॉट (वैकल्पिक, जल्दी पुष्टि में मदद करता है)",
  screenshotAlt: "स्क्रीनशॉट का पूर्वावलोकन",
  verifying: "रेफ़रेंस जाँचा जा रहा है…",
  confirmSubmit: "भुगतान जमा करने की पुष्टि करें",
  enterUtr: "कृपया अपना 12 अंकों का UTR या ट्रांज़ैक्शन रेफ़रेंस नंबर डालें।",
  humanCheck: "कृपया नीचे दिया गया इंसान होने का चेक पूरा करें।",
  privacy: "गोपनीयता नीति",
  terms: "सेवा की शर्तें",
  moneyStraight: (seller) => `पैसा सीधे ${seller} को जाता है; Paivo उसे कभी अपने पास नहीं रखता`,
  filesAfterPay: "फ़ाइनल फ़ाइलें भुगतान के बाद खुलती हैं",
  footerNote: "Paivo विक्रेताओं को इनवॉइस भेजने और भुगतान की पुष्टि करने में मदद करता है। आपका भुगतान सीधे विक्रेता को जाता है। हम कार्ड या बैंक लॉगिन की जानकारी नहीं रखते और ग्राहकों का पैसा कभी अपने पास नहीं रखते।",
  language: "भाषा",
};

export const PAY_TEXT: Record<Lang, PayText> = { en, hi };

export function isLang(v: unknown): v is Lang {
  return v === "en" || v === "hi";
}

/** The remembered choice, or English. Never throws (private windows and blocked storage are fine). */
export function loadLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return isLang(v) ? v : "en";
  } catch {
    return "en";
  }
}

export function saveLang(lang: Lang): void {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* storage unavailable: the choice just lasts until the page is closed */
  }
}
