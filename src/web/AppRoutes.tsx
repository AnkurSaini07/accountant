import { useAtomValue } from "jotai";
import { Navigate, Route, Routes } from "react-router";
import { parseFyLabel } from "../shared/fy.ts";
import { Dashboard } from "./pages/Dashboard.tsx";
import { CompanySettings } from "./pages/settings/Company.tsx";
import { Numbering } from "./pages/settings/Numbering.tsx";
import { ItemForm } from "./pages/items/ItemForm.tsx";
import { ItemList } from "./pages/items/ItemList.tsx";
import { LedgerList } from "./pages/ledgers/LedgerList.tsx";
import { PartyForm } from "./pages/parties/PartyForm.tsx";
import { PartyList } from "./pages/parties/PartyList.tsx";
import { ChallanForm } from "./pages/sales/ChallanForm.tsx";
import { ChallanList } from "./pages/sales/ChallanList.tsx";
import { GrnForm } from "./pages/purchase/GrnForm.tsx";
import { GrnList } from "./pages/purchase/GrnList.tsx";
import { PoForm } from "./pages/purchase/PoForm.tsx";
import { PoList } from "./pages/purchase/PoList.tsx";
import { CreditNoteForm } from "./pages/sales/CreditNoteForm.tsx";
import { CreditNoteList } from "./pages/sales/CreditNoteList.tsx";
import { InvoiceForm } from "./pages/sales/InvoiceForm.tsx";
import { InvoiceList } from "./pages/sales/InvoiceList.tsx";
import { OrderForm } from "./pages/sales/OrderForm.tsx";
import { OrderList } from "./pages/sales/OrderList.tsx";
import { QuotationForm } from "./pages/sales/QuotationForm.tsx";
import { QuotationList } from "./pages/sales/QuotationList.tsx";
import { financialYearAtom } from "./state.ts";
import { NAV } from "./routes.ts";
import { NotFound } from "./pages/NotFound.tsx";
import { Placeholder } from "./pages/Placeholder.tsx";

export function AppRoutes() {
  const financialYear = useAtomValue(financialYearAtom); // the header's FY label, e.g. "2026-27"
  return (
    <Routes>
      <Route path="/sales" element={<Navigate replace to="/sales/quotations" />} />
      <Route path="/sales/quotations" element={<QuotationList />} />
      <Route path="/sales/quotations/new" element={<QuotationForm />} />
      <Route path="/sales/quotations/:id" element={<QuotationForm />} />
      <Route path="/sales/orders" element={<OrderList />} />
      <Route path="/sales/orders/new" element={<OrderForm />} />
      <Route path="/sales/orders/:id" element={<OrderForm />} />
      <Route path="/sales/challans" element={<ChallanList />} />
      <Route path="/sales/challans/new" element={<ChallanForm />} />
      <Route path="/sales/challans/:id" element={<ChallanForm />} />
      <Route path="/sales/invoices" element={<InvoiceList />} />
      <Route path="/sales/invoices/new" element={<InvoiceForm />} />
      <Route path="/sales/invoices/:id" element={<InvoiceForm />} />
      <Route path="/sales/credit-notes" element={<CreditNoteList />} />
      <Route path="/sales/credit-notes/new" element={<CreditNoteForm />} />
      <Route path="/sales/credit-notes/:id" element={<CreditNoteForm />} />
      <Route path="/purchase" element={<Navigate replace to="/purchase/orders" />} />
      <Route path="/purchase/orders" element={<PoList />} />
      <Route path="/purchase/orders/new" element={<PoForm />} />
      <Route path="/purchase/orders/:id" element={<PoForm />} />
      <Route path="/purchase/grns" element={<GrnList />} />
      <Route path="/purchase/grns/new" element={<GrnForm />} />
      <Route path="/purchase/grns/:id" element={<GrnForm />} />
      <Route path="/masters" element={<Navigate replace to="/masters/parties" />} />
      <Route path="/masters/parties" element={<PartyList />} />
      <Route path="/masters/parties/new" element={<PartyForm />} />
      <Route path="/masters/parties/:id" element={<PartyForm />} />
      <Route path="/masters/items" element={<ItemList />} />
      <Route path="/masters/items/new" element={<ItemForm />} />
      <Route path="/masters/items/:id" element={<ItemForm />} />
      <Route path="/masters/ledgers" element={<LedgerList />} />
      <Route path="/settings" element={<Navigate replace to="/settings/company" />} />
      <Route path="/settings/company" element={<CompanySettings />} />
      <Route path="/settings/numbering" element={<Numbering fy={parseFyLabel(financialYear)} />} />
      <Route path="/" element={<Dashboard />} />
      {NAV.filter(({ path }) => path !== "/settings" && path !== "/").map(({ path, label }) => (
        <Route key={path} path={`${path}/*`} element={<Placeholder label={label} />} />
      ))}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
