import type { components } from "./api-schema"

// Read models for detailed responses that currently have open OpenAPI schemas.
// Keep these aligned with the API's wire format; amounts and dates are strings.
export type BudgetDetail = components["schemas"]["BudgetDetail"]
export type Commitment = BudgetDetail["commitments"][number]
export type ListItem = components["schemas"]["ListItem"]
export type InventoryItem = Pick<
  components["schemas"]["Inventory"],
  | "id"
  | "revision"
  | "name"
  | "category"
  | "unit"
  | "minimum"
  | "productId"
  | "usable"
  | "needed"
> & {
  batches: (components["schemas"]["Inventory"]["batches"][number] & {
    purchaseLineId: string | null
    movements: { reason: string; quantity: string }[]
  })[]
}
export interface StoreRule {
  id: string
  revision: number
  mode: string
  minimum: string
  delivery: string | null
  freeThreshold: string | null
  travel: string
  source: string
  observedAt: string
}
export interface Store {
  id: string
  name: string
  retailer: string
  location: string
  active: boolean
  rules: StoreRule[]
}
export interface ProductListing {
  id: string
  productId: string
  product: { name: string; brand: string; category: string }
  store: { name: string }
  packageQuantity: string
  unit: string
  baseUnit: string
  price: string | null
  unitPrice: string | null
  availability: string
  observedAt: string | null
  stale: boolean
  source: string | null
}
export interface PriceObservation {
  listing: { store: { name: string } }
  observedAt: string
  price: string
  source: { name: string }
}
export interface ImportPreview {
  id: string
  revision: number
  count: number
  errors: { row: number; message: string }[]
  committed: boolean
  result?: { imported: number; duplicates: number }
}
export interface Candidate {
  name: string
  storeName: string
  packs: number
  purchased: string
  excess: string
  unit: string
  cost: string
  price: string
  source: string
  observedAt: string
  stale: boolean
}
export interface PlanComparison {
  total: string
  storeCount: number
  coverage: string
  feasible: boolean
  withinBudget: boolean
  remaining: string
  warnings: string[]
  allocations: Candidate[]
  stores: {
    name: string
    subtotal: string
    delivery: string
    travel: string
    total: string
  }[]
}
export interface ShoppingPlan {
  id: string
  revision: number
  listName: string
  createdAt: string
  searchComplete: boolean
  runtimeMs: number
  purchaseState?: string
  purchaseId?: string
  needsReview: boolean
  state: string
  availableBudget: string
  missing: string[]
  best: PlanComparison | null
  chosen: PlanComparison | null
  single: PlanComparison | null
  itemByItem: PlanComparison | null
  deferrals: { deferred: string[]; plan: PlanComparison }[]
  listItems: ListItem[]
  restriction: string
}
export interface PurchaseLine {
  id: string
  name: string
  category: string
  quantity: string
  unit: string
  lineCost: string
  expiryDate: string | null
  inventoryItemId: string | null
  productId: string | null
}
export interface Purchase {
  id: string
  revision: number
  budgetId: string
  purchasedOn: string
  storeName: string
  delivery: string
  travel: string
  state: string
  total: string
  adjustedTotal: string
  lines: PurchaseLine[]
  adjustments: {
    id: string
    reason: string
    amount: string
    createdAt: string
  }[]
}
export interface VariableReport {
  category: string
  label: string
  monthsUsed: number
  current: string | null
  planned: string | null
  average: string | null
  change: string | null
  abovePlan: boolean
  history: { month: string; actual: string }[]
}
export interface Dashboard {
  summary: components["schemas"]["Summary"] | null
  lowStock: InventoryItem[]
  expiring: InventoryItem[]
}
export interface GenerationPreview {
  id: string
  proposed: Pick<ListItem, "name" | "quantity" | "unit">[]
  quantityRequired: { name: string }[]
}
export interface PriceComparison {
  candidates: Candidate[]
  unmatched: { name: string }[]
}
export interface AdminSummary {
  users: number
  activeUsers: number
  admins: number
  sessions: number
  audit: { createdAt: string; action: string; targetId: string }[]
}
export interface AssistantResult {
  id: string
  revision: number
  listRevision: number
  verifiedBudget: components["schemas"]["Summary"]
  explanation: string
  meals: {
    name: string
    ingredientIds: string[]
    additionalIngredients: string[]
    steps: string
  }[]
  alternatives: {
    productId: string
    reason: string
    verifiedSaving: string
    assumption: string
  }[]
}
