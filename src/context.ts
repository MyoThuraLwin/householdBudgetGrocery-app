import { createContext, useContext } from "react"
import type { Household, Budget, ShoppingList, AuthUser } from "@/lib/api"
import type {
  BudgetDetail,
  InventoryItem,
  ProductListing,
  Store,
  Purchase,
  ShoppingPlan,
  VariableReport,
  Dashboard,
} from "@/lib/models"
export interface Workspace {
  user: AuthUser
  household: Household
  budgets: Budget[]
  budget: BudgetDetail | null
  month: string
  inventory: InventoryItem[]
  lists: ShoppingList[]
  products: ProductListing[]
  stores: Store[]
  purchases: Purchase[]
  plans: ShoppingPlan[]
  reports: VariableReport[]
  dashboard: Dashboard
  pending: boolean
  act: <T>(work: () => Promise<T>, message?: string) => Promise<T>
  navigate: (page: string) => void
  refresh: () => void
}
export const WorkspaceContext = createContext<Workspace | null>(null)
export const useWorkspace = () => {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error("Workspace provider is missing")
  return value
}
