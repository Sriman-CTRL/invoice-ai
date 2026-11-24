/**
 * GST slabs for the free GST calculator, from the GST Council's own record: after its 56th meeting (3 Sep 2025, effective
 * 22 Sep 2025) the structure is a standard rate of 18%, a merit rate of 5% and a special rate of 40% for a few goods and
 * services. 0 is for nil-rated or exempt supplies.
 * Source: gstcouncil.gov.in, "Recommendations of the 56th Meeting of the GST Council" (read 24 Nov 2026). The 57th meeting
 * press release (8-9 Oct 2026, same site) lists only clarifications under "changes in GST rates", no new slab.
 *
 * Note: the older GST_RATES list in invoiceMath.ts (5, 12, 18, 28) feeds the invoice form and was not changed here.
 */
export const GST_SLABS = [0, 5, 18, 40] as const;
export const GST_SLABS_SOURCE_URL = "https://gstcouncil.gov.in/sites/default/files/2025-09/press_release_press_information_bureau_0.pdf";
export const GST_SLABS_CHECKED = "24 Nov 2026";
