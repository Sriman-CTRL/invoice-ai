# Export invoices: what Paivo prints and what it does not

Paivo lets a seller issue invoices in USD, EUR, GBP, AUD, CAD, SGD and AED. These invoices have no UPI QR; they show the seller's bank details with the SWIFT/BIC code, an optional "other payment link" (for example PayPal or Wise, https only) and, if the seller entered them, a LUT number and an export declaration line.

## The export declaration text is NOT supplied by Paivo

The brief asked for the declaration wording to come from an official CBIC/GST source, cited here. **That could not be done:** on 25 Nov 2026 the CBIC GST site and gst.gov.in pages that should hold the CGST Rules 2017 (Rule 46, tax invoice) either returned 404 or had no link to the rules text, so the verbatim wording, clause letter and amendment date could not be read. Nothing was copied from memory.

So the default is **empty**. The seller types whatever line their accountant tells them to print (it depends on whether they export under a Letter of Undertaking or pay IGST), in Settings under "Clients outside India". Paivo prints exactly what was typed, only on non-INR invoices.

To finish this properly: read Rule 46 of the CGST Rules 2017 on an official CBIC/India Code page, cite the URL and date here and in a code comment, and consider offering the official wording as a suggestion the seller can edit.

## Analytics

Amounts in different currencies are never added together. The analytics page totals (money in by month, best clients, received, still to collect, overdue) are INR only, and every other currency appears in its own row under "Other currencies". The main dashboard summary (`dashboardService`) still sums across currencies and is not changed in this PR.
