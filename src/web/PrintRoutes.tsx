import { Route, Routes } from "react-router";
import { ChallanPrint } from "./pages/sales/ChallanPrint.tsx";
import { PoPrint } from "./pages/purchase/PoPrint.tsx";
import { CreditNotePrint } from "./pages/sales/CreditNotePrint.tsx";
import { InvoicePrint } from "./pages/sales/InvoicePrint.tsx";
import { QuotationPrint } from "./pages/sales/QuotationPrint.tsx";

/** Print pages: a bare A4 sheet, no app layout. */
export function PrintRoutes() {
  return (
    <Routes>
      <Route path="quotations/:id" element={<QuotationPrint />} /> {/* under /print/ */}
      <Route path="challans/:id" element={<ChallanPrint />} />
      <Route path="invoices/:id" element={<InvoicePrint />} />
      <Route path="credit-notes/:id" element={<CreditNotePrint />} />
      <Route path="purchase-orders/:id" element={<PoPrint />} />
      <Route path="*" element={<p>Page not found.</p>} />
    </Routes>
  );
}
