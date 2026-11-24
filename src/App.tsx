import { useCallback, useEffect, useState, type ReactNode } from "react"
import { api, apiAll, localDate } from "@/lib/api"
import { WorkspaceContext, type Workspace } from "@/context"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { OverviewPage, BudgetPage, SettingsPage } from "@/pages/budget"
import { InventoryPage, ListsPage } from "@/pages/inventory"
import { ProductsPage, StoresPage } from "@/pages/catalogue"
import { PlansPage, PurchasesPage, AssistantPage } from "@/pages/planning"
import { useAuth } from "@/auth-context"
import { AuthPage } from "@/pages/auth"
import { AdminPage } from "@/pages/admin"
import type { AuthUser, Household, Budget, ShoppingList } from "@/lib/api"
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
type WorkspaceData = Omit<
  Workspace,
  "user" | "month" | "pending" | "act" | "navigate" | "refresh"
>

const navigation = [
  {
    id: "overview",
    label: "Overview",
    icon: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  },
  {
    id: "budget",
    label: "Budget & expenses",
    icon: "M3 5h18v15H3z M3 9h18 M16 13h5v4h-5z M5 5V3h13v2",
  },
  {
    id: "inventory",
    label: "Kitchen inventory",
    icon: "M4 3h16v18H4z M4 11h16 M8 6v2 M8 14v3",
  },
  {
    id: "lists",
    label: "Shopping lists",
    icon: "M9 5h12 M9 12h12 M9 19h12 M3 5l1 1 2-3 M3 12l1 1 2-3 M3 19l1 1 2-3",
  },
  {
    id: "products",
    label: "Products & prices",
    icon: "M3 3h8l10 10-8 8L3 11z M7 7h.01",
  },
  {
    id: "stores",
    label: "Store costs",
    icon: "M3 10h18l-2-7H5z M5 10v11h14V10 M9 21v-7h6v7",
  },
  {
    id: "plans",
    label: "Shopping plans",
    icon: "M3 5h2l3 12h11l2-9H6 M9 21h.01 M18 21h.01",
  },
  {
    id: "purchases",
    label: "Purchases",
    icon: "M5 3h14v19l-3-2-4 2-4-2-3 2z M8 7h8 M8 11h8 M8 15h4",
  },
  {
    id: "assistant",
    label: "Assistant",
    icon: "M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z",
  },
  {
    id: "settings",
    label: "Settings",
    icon: "M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6",
  },
  {
    id: "admin",
    label: "Administration",
    icon: "M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M9 12l2 2 4-4",
  },
]
function Icon({ path }: { path: string }) {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  )
}
function HouseholdWorkspace({
  user,
  logout,
}: {
  user: AuthUser
  logout: () => Promise<void>
}) {
  const allowedPage = useCallback(
    (value: string) =>
      navigation.some(
        (n) => n.id === value && (n.id !== "admin" || user.role === "admin")
      )
        ? value
        : "overview",
    [user.role]
  )
  const [page, setPage] = useState(() => allowedPage(location.hash.slice(1)))
  const [month, setMonth] = useState(localDate().slice(0, 7))
  const [version, setVersion] = useState(0)
  const [data, setData] = useState<WorkspaceData | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [pending, setPending] = useState(false)
  const [loadedRequest, setLoadedRequest] = useState<{
    month: string
    version: number
  } | null>(null)
  const loading =
    loadedRequest?.month !== month || loadedRequest?.version !== version
  const [mobileMenu, setMobileMenu] = useState(false)
  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  useEffect(() => {
    const onHash = () => {
      const value = location.hash.slice(1)
      setPage(allowedPage(value))
    }
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [allowedPage])
  useEffect(() => {
    let active = true
    Promise.all([
      api<Household>("/household"),
      apiAll<Budget>("/budgets"),
      apiAll<InventoryItem>("/inventory/items"),
      apiAll<ShoppingList>("/shopping-lists"),
      apiAll<ProductListing>("/products"),
      apiAll<Store>("/stores"),
      apiAll<Purchase>("/purchases"),
      apiAll<ShoppingPlan>("/shopping-plans"),
      api<VariableReport[]>(`/reports/variable-expenses?month=${month}`),
      api<Dashboard>(`/dashboard?month=${month}`),
    ])
      .then(
        async ([
          household,
          budgets,
          inventory,
          lists,
          products,
          stores,
          purchases,
          plans,
          reports,
          dashboard,
        ]) => {
          const selected = budgets.find((b) => b.month === month)
          const budget = selected
            ? await api<BudgetDetail>(`/budgets/${selected.id}`)
            : null
          if (active) {
            setData({
              household,
              budgets,
              inventory,
              lists,
              products,
              stores,
              purchases,
              plans,
              reports,
              dashboard,
              budget,
            })
            setLoadedRequest({ month, version })
          }
        }
      )
      .catch((e) => {
        if (active) {
          setError(e.message)
          setLoadedRequest({ month, version })
        }
      })
    return () => {
      active = false
    }
  }, [month, version])
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(""), 6000)
    return () => clearTimeout(t)
  }, [notice])
  const navigate = (id: string) => {
    location.hash = id
    setPage(id)
    setMobileMenu(false)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  const act: Workspace["act"] = async (work, message = "Saved") => {
    setPending(true)
    setError("")
    try {
      const result = await work()
      setNotice(message)
      refresh()
      return result
    } catch (e) {
      setError((e as Error).message)
      throw e
    } finally {
      setPending(false)
    }
  }
  const signOut = async () => {
    setPending(true)
    setError("")
    try {
      await logout()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPending(false)
    }
  }
  useEffect(() => {
    const reject = (event: PromiseRejectionEvent) => {
      if (event.reason instanceof Error) {
        event.preventDefault()
        setError(event.reason.message)
      }
    }
    window.addEventListener("unhandledrejection", reject)
    return () => window.removeEventListener("unhandledrejection", reject)
  }, [])
  const pages: Record<string, ReactNode> = {
    overview: <OverviewPage />,
    budget: <BudgetPage />,
    inventory: <InventoryPage />,
    lists: <ListsPage />,
    products: <ProductsPage />,
    stores: <StoresPage />,
    plans: <PlansPage />,
    purchases: <PurchasesPage />,
    assistant: <AssistantPage />,
    settings: <SettingsPage />,
    ...(user.role === "admin" ? { admin: <AdminPage /> } : {}),
  }
  return (
    <TooltipProvider>
      <div className="workspace">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <aside className={"sidebar " + (mobileMenu ? "is-open" : "")}>
          <button
            className="brand"
            onClick={() => navigate("overview")}
            aria-label="Homewise overview"
          >
            <span className="brand-mark">
              <svg
                width="25"
                height="25"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <path
                  d="M3 11L12 3l9 8v10H3z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
                <path d="M8 14c4-5 9-2 8 1-1 4-6 3-8-1Z" fill="currentColor" />
              </svg>
            </span>
            <span>
              homewise<span className="brand-dot">.</span>
            </span>
          </button>
          <p className="sidebar-caption">YOUR HOUSEHOLD</p>
          <nav aria-label="Main navigation">
            {navigation
              .filter((n) => n.id !== "admin" || user.role === "admin")
              .map((n, i) => (
                <button
                  className={
                    "nav-link " +
                    (page === n.id ? "active" : "") +
                    (i === 8 ? " nav-assistant" : "")
                  }
                  aria-current={page === n.id ? "page" : undefined}
                  onClick={() => navigate(n.id)}
                  key={n.id}
                >
                  <Icon path={n.icon} />
                  <span>{n.label}</span>
                  {n.id === "assistant" && <span className="ai-label">AI</span>}
                </button>
              ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="household-avatar">
              {data?.household.name?.slice(0, 1) ?? "H"}
            </div>
            <div>
              <strong>{user.name}</strong>
              <p>
                {user.role === "admin" ? "Administrator" : "Household account"}{" "}
                · NZD
              </p>
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="flex items-center gap-3">
              <Button
                size="icon"
                variant="ghost"
                className="mobile-toggle"
                aria-label="Toggle navigation"
                onClick={() => setMobileMenu((v) => !v)}
              >
                ☰
              </Button>
              <span className="breadcrumb">
                Workspace <span>/</span>{" "}
                <strong>{navigation.find((n) => n.id === page)?.label}</strong>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <label className="sr-only" htmlFor="budget-month">
                Budget month
              </label>
              <input
                id="budget-month"
                aria-label="Budget month"
                type="month"
                value={month}
                onChange={(e) => {
                  if (e.target.value) setMonth(e.target.value)
                }}
                className="month-picker"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Refresh workspace"
                onClick={refresh}
                disabled={loading || pending}
              >
                ↻
              </Button>
              <span className="account-role">
                {user.role === "admin" ? "Administrator" : "Household"}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => void signOut()}
              >
                Sign out
              </Button>
            </div>
          </header>
          <main id="main-content" tabIndex={-1}>
            <div className="eyebrow">A MORE THOUGHTFUL EVERYDAY</div>
            {error && (
              <div role="alert" className="error-banner">
                <div>
                  <strong>We couldn’t complete that request.</strong>
                  <p>{error}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setError("")
                    refresh()
                  }}
                >
                  Retry
                </Button>
              </div>
            )}
            {notice && (
              <div role="status" className="success-banner">
                ✓ {notice}
              </div>
            )}
            {data ? (
              <WorkspaceContext
                value={{
                  ...data,
                  user,
                  month,
                  pending,
                  act,
                  refresh,
                  navigate,
                }}
              >
                <div className={loading ? "opacity-70 transition-opacity" : ""}>
                  {pages[page] ?? pages.overview}
                </div>
              </WorkspaceContext>
            ) : loading ? (
              <div className="space-y-6">
                <Skeleton className="h-12 w-2/3" />
                <div className="metrics">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-36 rounded-2xl" />
                  ))}
                </div>
                <Skeleton className="h-80 rounded-2xl" />
              </div>
            ) : (
              <div className="empty-state">
                <h1>Connect your household workspace</h1>
                <p>
                  Start the API, check the SQL Server connection and run the
                  database seed. Then retry.
                </p>
                <Button onClick={refresh}>Retry connection</Button>
              </div>
            )}
            <footer className="workspace-footer">
              <span>
                homewise.{" "}
                <span className="ml-2">Less guesswork. More room to live.</span>
              </span>
              <span>NZD · New Zealand household prototype</span>
            </footer>
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}

export default function App() {
  const auth = useAuth()
  if (auth.loading)
    return (
      <div className="auth-loading" role="status">
        Opening your household…
      </div>
    )
  if (!auth.user) return <AuthPage />
  return (
    <HouseholdWorkspace
      key={auth.user.id}
      user={auth.user}
      logout={auth.logout}
    />
  )
}
