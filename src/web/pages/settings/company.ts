// The company profile's types (and the layout classes its settings screens share).

export type Address = { id?: number; label: string; address: string; city: string; pincode: string | null; is_primary: boolean };

export type BankAccount = {
  id?: number;
  bank_name: string;
  account_name: string | null;
  account_number: string;
  ifsc: string;
  branch: string | null;
  is_default: boolean;
};

export type Company = {
  id: number;
  legal_name: string;
  trade_name: string | null;
  state_code: string;
  gstin: string | null;
  pan: string | null;
  phone: string | null;
  email: string | null;
  logo: string | null;
  signature: string | null;
  terms: string;
  addresses: Address[];
  bank_accounts: BankAccount[];
};

export { errorText as error, note, stack as section } from "../../components/formLayout.ts";
