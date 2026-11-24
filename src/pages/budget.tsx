import type { Commitment } from "@/lib/models"
import { useWorkspace } from "@/context"
import { api, money, localDate } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { ExpenseInputs } from "@/components/expense-inputs"
import {
  FormDialog,
  DataTable,
  Metric,
  Panel,
  PageTitle,
  Status,
  options,
} from "@/components/workspace"

export function BudgetPage() {
  const w = useWorkspace()
  const b = w.budget
  const s = w.dashboard.summary
  const commitmentFields = (c?: Commitment) => [
    { name: "description", label: "Expense name", value: c?.description },
    {
      name: "expenseAmounts",
      label: "Expense amounts",
      render: <ExpenseInputs month={b?.month ?? w.month} commitment={c} />,
    },
    {
      name: "subcategory",
      label: "Subcategory (optional)",
      required: false,
      value: c?.subcategory,
    },
    {
      name: "recurring",
      label: "Recurring expense",
      type: "checkbox",
      value: c?.recurring ?? true,
    },
  ]
  return (
    <>
      <PageTitle
        title="Budget & expenses"
        description="A clear view of your commitments and the money available for groceries."
        action={
          <FormDialog
            title="Create monthly budget"
            fields={[
              { name: "month", label: "Month", type: "month", value: w.month },
              {
                name: "funds",
                label: "Monthly household funds (NZD)",
                type: "number",
                value: "4000",
                min: "0",
              },
              {
                name: "reserve",
                label: "Reserve (NZD)",
                type: "number",
                value: w.household.reserveDefault,
                min: "0",
              },
            ]}
            onSubmit={(v) =>
              w.act(() => api("/budgets", "POST", v), "Monthly budget created")
            }
          />
        }
      />
      {b && s ? (
        <>
          <div className="metrics">
            <Metric label="Household funds" value={money(s.funds)} />
            <Metric
              label="Planned commitments"
              value={money(s.planned)}
              note={`Actual recorded: ${money(s.actual)}`}
            />
            <Metric label="Reserved for later" value={money(s.outstanding)} />
            <Metric
              label="Available for groceries"
              value={money(s.remaining)}
              accent
              note={`Reserve protected: ${money(s.reserve)}`}
            />
          </div>
          <Panel
            title="Monthly commitments"
            note="Actual costs replace the corresponding plan. Unpaid amounts stay reserved."
            action={
              <div className="flex flex-wrap gap-2">
                <FormDialog
                  title="Edit budget"
                  fields={[
                    {
                      name: "funds",
                      label: "Household funds",
                      type: "number",
                      value: b.funds,
                      min: "0",
                    },
                    {
                      name: "reserve",
                      label: "Reserve",
                      type: "number",
                      value: b.reserve,
                      min: "0",
                    },
                    {
                      name: "completed",
                      label: "This month is complete",
                      type: "checkbox",
                      value: b.completed,
                    },
                  ]}
                  onSubmit={(v) =>
                    w.act(
                      () =>
                        api(`/budgets/${b.id}`, "PATCH", {
                          ...v,
                          revision: b.revision,
                        }),
                      "Budget updated"
                    )
                  }
                />
                <FormDialog
                  title="Add expense"
                  fields={commitmentFields()}
                  onSubmit={(v) =>
                    w.act(
                      () =>
                        api(`/budgets/${b.id}/commitments`, "POST", {
                          ...v,
                          revision: b.revision,
                        }),
                      "Expense added"
                    )
                  }
                />
              </div>
            }
          >
            <DataTable
              columns={[
                "Expense",
                "Planned",
                "Actual",
                "Outstanding",
                "Status",
                "Actions",
              ]}
              rows={b.commitments.map((c) => [
                <div>
                  <strong>{c.description}</strong>
                  <p className="text-xs text-muted-foreground capitalize">
                    {c.category}
                    {c.subcategory ? ` · ${c.subcategory}` : ""}
                  </p>
                </div>,
                money(c.planned),
                money(c.actualTotal),
                money(c.outstanding),
                <Status value={c.settlement} />,
                <div className="flex gap-2">
                  <FormDialog
                    title="Record actual expense"
                    fields={[
                      {
                        name: "amount",
                        label: "Actual payment (NZD)",
                        type: "number",
                        value: c.outstanding,
                        min: "0",
                      },
                      {
                        name: "incurredOn",
                        label: "Expense date",
                        type: "date",
                        value: localDate().startsWith(w.month)
                          ? localDate()
                          : w.month + "-01",
                      },
                      {
                        name: "settlement",
                        label: "Settlement",
                        options: options(["settled", "partial"]),
                      },
                      {
                        name: "outstanding",
                        label: "Amount still unpaid (NZD)",
                        type: "number",
                        value: "0",
                        min: "0",
                        hint: "For partial payments, enter what remains to be paid.",
                      },
                      {
                        name: "note",
                        label: "Note (optional)",
                        required: false,
                      },
                    ]}
                    onSubmit={(v) =>
                      w.act(
                        () =>
                          api(`/commitments/${c.id}/transactions`, "POST", {
                            ...v,
                            revision: c.revision,
                          }),
                        "Actual expense recorded"
                      )
                    }
                  >
                    Record actual
                  </FormDialog>
                  <FormDialog
                    title="Edit expense"
                    fields={commitmentFields(c)}
                    onSubmit={(v) =>
                      w.act(
                        () =>
                          api(`/commitments/${c.id}`, "PATCH", {
                            ...v,
                            revision: c.revision,
                          }),
                        "Expense updated"
                      )
                    }
                  >
                    Edit
                  </FormDialog>
                  <FormDialog
                    title="Remove expense"
                    description="Only expenses with no actual transactions can be deleted."
                    fields={[]}
                    label="Remove expense"
                    onSubmit={() =>
                      w.act(
                        () =>
                          api(`/commitments/${c.id}`, "DELETE", {
                            revision: c.revision,
                          }),
                        "Expense removed"
                      )
                    }
                  >
                    Remove
                  </FormDialog>
                </div>,
              ])}
            />
          </Panel>
          <Panel title="How your grocery budget is calculated">
            <div className="calculation">
              {[
                ["Household funds", s.funds],
                ["Less actual essential costs", s.actual],
                ["Less unpaid commitments", s.outstanding],
                ["Less protected reserve", s.reserve],
                ["Less confirmed grocery spending", s.grocerySpending],
                ["Remaining grocery budget", s.remaining],
              ].map(([name, value], i) => (
                <div key={name} className={i === 5 ? "calculation-total" : ""}>
                  <span>{name}</span>
                  <strong>{money(value)}</strong>
                </div>
              ))}
            </div>
          </Panel>
          {b.commitments.some((c) => c.transactions.length) && (
            <Panel
              title="Actual expense records"
              note="Corrections require you to review the outstanding commitment again."
            >
              <DataTable
                columns={["Expense", "Date", "Amount", "Note", "Correction"]}
                rows={b.commitments.flatMap((c) =>
                  c.transactions.map((t) => [
                    c.description,
                    t.incurredOn,
                    money(t.amount),
                    t.note || "—",
                    <FormDialog
                      title="Correct actual expense"
                      fields={[
                        {
                          name: "amount",
                          label: "Corrected amount",
                          type: "number",
                          value: t.amount,
                          min: "0",
                        },
                        {
                          name: "incurredOn",
                          label: "Date",
                          type: "date",
                          value: t.incurredOn,
                        },
                        {
                          name: "note",
                          label: "Correction note",
                          value: t.note,
                          required: false,
                        },
                        {
                          name: "outstanding",
                          label: "Outstanding commitment after correction",
                          type: "number",
                          value: c.outstanding,
                          min: "0",
                        },
                        {
                          name: "settlement",
                          label: "Settlement",
                          options: options(["settled", "partial"]),
                          value:
                            c.settlement === "settled" ? "settled" : "partial",
                        },
                      ]}
                      onSubmit={(v) =>
                        w.act(
                          () =>
                            api(`/expense-transactions/${t.id}`, "PATCH", {
                              ...v,
                              revision: t.revision,
                              commitmentRevision: c.revision,
                            }),
                          "Expense corrected"
                        )
                      }
                    >
                      Correct
                    </FormDialog>,
                  ])
                )}
              />
            </Panel>
          )}
        </>
      ) : (
        <Panel title="Set up this month">
          <div className="p-6 text-muted-foreground">
            Create a monthly budget to begin recording commitments and grocery
            spending.
          </div>
        </Panel>
      )}
      <Reports />
    </>
  )
}
export function Reports() {
  const w = useWorkspace()
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {w.reports.map((r) => (
        <Panel
          key={r.category}
          title={
            r.category === "electricity"
              ? "Electricity review"
              : "Transport review"
          }
          note={`${r.label} · ${r.monthsUsed} completed months in the recent average`}
        >
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div className="text-2xl font-semibold">{money(r.current)}</div>
              <Status
                value={
                  r.current === null
                    ? "not recorded"
                    : r.abovePlan
                      ? "above plan"
                      : "within plan"
                }
              />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
              <div>
                Planned
                <strong className="report-value">{money(r.planned)}</strong>
              </div>
              <div>
                Recent average
                <strong className="report-value">{money(r.average)}</strong>
              </div>
              <div>
                Monthly change
                <strong className="report-value">{money(r.change)}</strong>
              </div>
            </div>
            <div className="mt-5 flex h-20 items-end gap-4">
              {[...r.history].reverse().map((m) => (
                <div
                  key={m.month}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <div
                    className="w-full rounded-t-md bg-primary/25"
                    style={{
                      height: Math.max(
                        3,
                        Math.min(
                          60,
                          (Number(m.actual) /
                            Math.max(
                              ...r.history.map((x) => Number(x.actual)),
                              1
                            )) *
                            60
                        )
                      ),
                    }}
                    title={`${m.month}: ${money(m.actual)}`}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {m.month.slice(5)}
                  </span>
                </div>
              ))}
            </div>
            {r.abovePlan && (
              <p className="mt-3 text-xs text-amber-700">
                Spending is above plan. Review the remaining commitment and
                household budget.
              </p>
            )}
          </div>
        </Panel>
      ))}
    </div>
  )
}
export function SettingsPage() {
  const w = useWorkspace()
  const h = w.household
  return (
    <>
      <PageTitle
        title="Household settings"
        description="Preferences for your household, shopping and reminders."
      />
      <Panel
        title="Your household"
        action={
          <FormDialog
            title="Edit household settings"
            fields={[
              { name: "name", label: "Household name", value: h.name },
              {
                name: "location",
                label: "Location",
                value: h.location,
                required: false,
              },
              { name: "timezone", label: "Timezone", value: h.timezone },
              {
                name: "expiryWindowDays",
                label: "Expiry alert window (days)",
                type: "number",
                value: h.expiryWindowDays,
                step: "1",
                min: "0",
              },
              {
                name: "maxStores",
                label: "Maximum stores",
                type: "number",
                value: h.maxStores,
                step: "1",
                min: "1",
              },
              {
                name: "singleStore",
                label: "Prefer one-store shopping",
                type: "checkbox",
                value: h.singleStore,
              },
              {
                name: "eligibleStoreIds",
                label: "Eligible stores",
                type: "multiselect",
                required: false,
                options: w.stores.map((s) => ({ value: s.id, label: s.name })),
                value: JSON.parse(h.preferences).eligibleStoreIds ?? [],
                hint: "Leave all unchecked to allow any active store.",
              },
              {
                name: "reserveDefault",
                label: "Default reserve (NZD)",
                type: "number",
                value: h.reserveDefault,
                min: "0",
              },
              {
                name: "alertThreshold",
                label: "Above-average alert threshold (%)",
                type: "number",
                value: h.alertThreshold ?? "",
                required: false,
                min: "0",
              },
            ]}
            onSubmit={(v) =>
              w.act(
                () =>
                  api("/household", "PATCH", {
                    ...v,
                    expiryWindowDays: Number(v.expiryWindowDays),
                    maxStores: Number(v.maxStores),
                    alertThreshold: v.alertThreshold || null,
                    preferences: JSON.stringify({
                      ...JSON.parse(h.preferences),
                      eligibleStoreIds: v.eligibleStoreIds,
                    }),
                    revision: h.revision,
                  }),
                "Household settings saved"
              )
            }
          />
        }
      >
        <div className="calculation">
          {[
            ["Name", h.name],
            ["Location", h.location],
            ["Timezone", h.timezone],
            ["Currency", "NZD"],
            ["Expiry reminders", `${h.expiryWindowDays} days`],
            ["Recent expense average", `${h.averageMonths} completed months`],
            ["Maximum stores", h.maxStores],
            ["Single-store preference", h.singleStore ? "On" : "Off"],
            ["Database", "SQL Server 2022 · Windows authentication"],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Data and suggestions">
        <div className="p-5 text-sm text-muted-foreground">
          Price imports remain separate from household inventory. Product
          substitutions require your confirmation. An approved shopping plan
          affects spending and inventory only when you confirm the actual
          purchase.
        </div>
      </Panel>
    </>
  )
}
export function OverviewPage() {
  const w = useWorkspace()
  const d = w.dashboard
  const s = d.summary
  return (
    <>
      <PageTitle
        title="A little planning. More peace of mind."
        description={`Here's where your household stands this month, ${w.household.name}.`}
        action={
          <Button onClick={() => w.navigate(w.budget ? "lists" : "budget")}>
            {w.budget ? "Plan your next shop" : "Set up your monthly budget"}{" "}
            <span aria-hidden>↗</span>
          </Button>
        }
      />
      <div className="metrics">
        <Metric
          label="Available for groceries"
          value={money(s?.remaining)}
          note="After commitments, reserve and purchases"
          accent
        />
        <Metric
          label="Grocery spending"
          value={money(s?.grocerySpending)}
          note="Confirmed purchases this month"
        />
        <Metric
          label="Low-stock items"
          value={d.lowStock.length}
          note="Ready to add to your shopping list"
        />
        <Metric
          label="Use soon"
          value={d.expiring.length}
          note={`Items expiring within ${w.household.expiryWindowDays} days`}
        />
      </div>
      <div className="overview-grid">
        <Panel
          title="Your monthly budget"
          note="Every amount has a place."
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => w.navigate("budget")}
            >
              View budget ↗
            </Button>
          }
        >
          <div className="p-6">
            <div className="flex items-end justify-between">
              <span className="text-sm text-muted-foreground">
                Monthly household funds
              </span>
              <strong className="text-2xl">{money(s?.funds)}</strong>
            </div>
            <div className="budget-bar mt-6">
              {s &&
                [
                  [s.actual, "var(--primary)"],
                  [
                    s.outstanding,
                    "color-mix(in oklch,var(--primary),white 50%)",
                  ],
                  [s.reserve, "var(--border)"],
                  [s.grocerySpending, "var(--chart-3)"],
                ].map(([v, color], i) => (
                  <div
                    key={i}
                    style={{
                      width: `${Math.min(100, Math.max(0, (Number(v) / Math.max(Number(s.funds), 1)) * 100))}%`,
                      background: color,
                    }}
                  />
                ))}
            </div>
            <div className="calculation px-0 pb-0">
              {[
                ["Actual essential costs", s?.actual],
                ["Unpaid commitments", s?.outstanding],
                ["Protected reserve", s?.reserve],
                ["Grocery purchases", s?.grocerySpending],
                ["Still available", s?.remaining],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{money(value)}</strong>
                </div>
              ))}
            </div>
          </div>
        </Panel>
        <Panel
          title="Kitchen check-in"
          note="Use what you have. Buy what you need."
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => w.navigate("inventory")}
            >
              View inventory ↗
            </Button>
          }
        >
          <div className="divide-y px-5">
            {d.expiring.map((i) => (
              <div key={i.id} className="flex justify-between py-4">
                <div>
                  <strong>{i.name}</strong>
                  <p className="text-xs text-muted-foreground">
                    {Number(i.usable)} {i.unit} available
                  </p>
                </div>
                <Status value="use soon" />
              </div>
            ))}
            {d.lowStock.slice(0, 3).map((i) => (
              <div key={i.id} className="flex justify-between py-4">
                <div>
                  <strong>{i.name}</strong>
                  <p className="text-xs text-muted-foreground">
                    Below your minimum stock
                  </p>
                </div>
                <Status value="low stock" />
              </div>
            ))}
            {!d.expiring.length && !d.lowStock.length && (
              <div className="py-8 text-muted-foreground">
                Your kitchen is looking good.
              </div>
            )}
          </div>
        </Panel>
      </div>
      <Reports />
      <div className="quiet-note">
        {w.user.demo
          ? "Fictional sample household and store records are included for evaluation. You can edit them or import your own permitted data."
          : w.budget
            ? "Your records belong to your household. Add inventory and import permitted price observations to plan your next shop."
            : "Welcome to your household. Start by creating a monthly budget, then add the food you have at home."}
      </div>
    </>
  )
}
