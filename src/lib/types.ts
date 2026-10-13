export type TxKind = "income" | "expense";
export type Necessity = "kebutuhan" | "keinginan" | "tabungan";

export type Category = {
  id: string;
  name: string;
  kind: TxKind;
  parent_id: string | null;
  necessity: Necessity | null;
  keywords: string[];
  icon: string | null;
};

export type Transaction = {
  id: string;
  kind: TxKind;
  amount: number;
  category_id: string | null;
  description: string;
  counterparty: string | null;
  occurred_at: string;
  source: "manual" | "assistant";
  ontology_synced: boolean;
};

export type CategoryTotal = {
  name: string;
  icon: string | null;
  total: number;
  count: number;
};

export type MonthlySummary = {
  month: string;
  income: number;
  expense: number;
  balance: number;
  /** Expense rolled up to top-level categories via the category hierarchy. */
  byRoot: CategoryTotal[];
  /** Expense per leaf category. */
  byCategory: CategoryTotal[];
  incomeByCategory: CategoryTotal[];
  /** 50/30/20 split using necessity inherited through the hierarchy. */
  byNecessity: Record<Necessity, number>;
  /** Where the hierarchy reasoning came from. */
  reasoning: "typedb" | "fallback";
};
