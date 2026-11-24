import type { AssistantResult, Purchase, PurchaseLine } from "@/lib/models"
import { useRef, useState } from "react"
import { useWorkspace } from "@/context"
import { api, money, quantity, localDate } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  FormDialog,
  DataTable,
  Panel,
  PageTitle,
  Metric,
  Status,
  options,
  type Field,
} from "@/components/workspace"

export function PlansPage() {
  const w = useWorkspace()
  const [expanded, setExpanded] = useState("")
  return (
    <>
      <PageTitle
        title="Shopping plans"
        description="Compare the whole shop. Review the trade-offs. Choose what works for you."
        action={
          <FormDialog
            title="Compare shopping plans"
            description="Prices, whole packages and configured store charges are calculated by the API."
            disabled={!w.budget || !w.lists.length || !w.stores.length}
            label="Find shopping plans"
            fields={[
              {
                name: "listId",
                label: "Shopping list",
                options: w.lists.map((l) => ({ value: l.id, label: l.name })),
              },
              {
                name: "mode",
                label: "Fulfilment",
                options: options(["pickup", "delivery"]),
              },
              {
                name: "chosenStoreId",
                label: "Selected-store baseline",
                options: w.stores.map((s) => ({ value: s.id, label: s.name })),
              },
              {
                name: "storeIds",
                label: "Eligible stores for this shop",
                type: "multiselect",
                options: w.stores
                  .filter((s) => s.active)
                  .map((s) => ({ value: s.id, label: s.name })),
                value: JSON.parse(w.household.preferences).eligibleStoreIds
                  ?.length
                  ? JSON.parse(w.household.preferences).eligibleStoreIds
                  : w.stores.filter((s) => s.active).map((s) => s.id),
                hint: "Choose the stores you can use. Your household's eligible-store setting also applies.",
              },
              {
                name: "maxStores",
                label: "Maximum stores",
                type: "number",
                min: "1",
                step: "1",
                value: String(w.household.maxStores),
              },
              {
                name: "allowStale",
                label: "Include stale prices (requires acknowledgement)",
                type: "checkbox",
              },
              {
                name: "allowUnknown",
                label: "Include unknown availability (conditional plan)",
                type: "checkbox",
              },
            ]}
            onSubmit={(v) =>
              w.act(async () => {
                if (!w.budget) throw new Error("Create a monthly budget first.")
                const l = w.lists.find((l) => l.id === v.listId)!
                const result = await api<{ id: string }>(
                  "/optimisations",
                  "POST",
                  {
                    ...v,
                    maxStores: Number(v.maxStores),
                    listRevision: l.revision,
                    budgetId: w.budget.id,
                    budgetRevision: w.budget.revision,
                  }
                )
                setExpanded(result.id)
                return result
              }, "Shopping plans calculated")
            }
          />
        }
      />
      {w.plans.length === 0 && (
        <Panel title="Your first shopping plan">
          <div className="p-6 text-muted-foreground">
            Create a budget and a matched shopping list, then compare shopping
            plans. Review store costs before running your comparison.
          </div>
        </Panel>
      )}
      {w.plans.map((p) => (
        <Panel
          key={p.id}
          title={p.listName}
          note={`${new Date(p.createdAt).toLocaleString("en-NZ")} · ${p.searchComplete ? "Search completed" : "Best known result — search limit reached"} · ${p.runtimeMs} ms`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Status
                value={
                  p.purchaseState === "confirmed"
                    ? "purchased"
                    : p.needsReview
                      ? "needs review"
                      : p.state
                }
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(expanded === p.id ? "" : p.id)}
              >
                {expanded === p.id ? "Hide details" : "Review plan"}
              </Button>
            </div>
          }
        >
          <div className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">
                  {p.best ? "Best complete plan" : "No complete feasible plan"}
                </p>
                <strong className="text-3xl tracking-tight">
                  {money(p.best?.total)}
                </strong>
                <span className="ml-3 text-sm text-muted-foreground">
                  {p.best?.storeCount ?? 0} stores · Budget{" "}
                  {money(p.availableBudget)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={w.pending}
                  onClick={() =>
                    void w.act(async () => {
                      const result = await api<{ id: string }>(
                        `/optimisations/${p.id}/recalculate`,
                        "POST",
                        {}
                      )
                      setExpanded(result.id)
                    }, "New comparison calculated")
                  }
                >
                  Recalculate
                </Button>
                {p.state !== "approved" && (
                  <FormDialog
                    title="Approve shopping plan"
                    description="Approval saves your decision. Spending and inventory change only after confirming the actual purchase."
                    disabled={!p.best?.withinBudget || p.needsReview}
                    fields={[
                      {
                        name: "acknowledgeWarnings",
                        label:
                          "I reviewed price freshness, availability and assumptions",
                        type: "checkbox",
                        value: true,
                      },
                    ]}
                    label="Approve plan"
                    onSubmit={(v) =>
                      w.act(
                        () =>
                          api(`/shopping-plans/${p.id}/approve`, "POST", {
                            ...v,
                            revision: p.revision,
                          }),
                        "Plan approved"
                      )
                    }
                  />
                )}
                {p.state === "approved" && (
                  <Button
                    size="sm"
                    disabled={w.pending || (p.needsReview && !p.purchaseId)}
                    onClick={() =>
                      void w.act(async () => {
                        await api(
                          `/shopping-plans/${p.id}/purchase-draft`,
                          "POST",
                          { revision: p.revision }
                        )
                        w.navigate("purchases")
                      }, "Purchase draft is ready for review")
                    }
                  >
                    {p.purchaseState === "confirmed"
                      ? "View purchase"
                      : "Review actual purchase"}
                  </Button>
                )}
              </div>
            </div>
            {p.missing.length > 0 && (
              <p className="mt-4 text-sm text-amber-700">
                {p.missing.length} unmatched item(s). Review catalogue mappings,
                availability, units and store selection.
              </p>
            )}
            {p.needsReview && (
              <p className="mt-4 text-sm text-amber-700">
                Inputs have changed since this calculation. Recalculate before
                approval.
              </p>
            )}
            {p.best && !p.best.withinBudget && (
              <p className="mt-4 text-sm text-destructive">
                This complete plan exceeds the grocery budget by{" "}
                {money(-Number(p.best.remaining))}. Review priorities or adjust
                your budget.
              </p>
            )}
          </div>
          {expanded === p.id && (
            <div className="border-t">
              <DataTable
                columns={[
                  "Comparison",
                  "Total payable",
                  "Stores",
                  "Coverage",
                  "Feasibility",
                ]}
                rows={(
                  [
                    ["Selected store", p.chosen],
                    ["Cheapest single store", p.single],
                    ["Item-by-item cheapest", p.itemByItem],
                    ["Constrained multi-store", p.best],
                  ] as const
                ).map(([label, value]) => [
                  label,
                  money(value?.total),
                  value?.storeCount ?? "—",
                  value?.coverage ?? "—",
                  value ? (
                    value.feasible ? (
                      <Status
                        value={
                          value.withinBudget ? "within budget" : "above budget"
                        }
                      />
                    ) : (
                      value.warnings.join("; ")
                    )
                  ) : (
                    "No feasible plan"
                  ),
                ])}
              />
              {p.best && (
                <>
                  <h3 className="px-5 pt-5 font-semibold">
                    Recommended allocation
                  </h3>
                  <DataTable
                    columns={[
                      "Item",
                      "Store",
                      "Packs",
                      "Purchased / excess",
                      "Cost",
                      "Observation",
                    ]}
                    rows={p.best.allocations.map((a) => [
                      a.name,
                      a.storeName,
                      a.packs,
                      `${quantity(a.purchased)} ${a.unit} / +${quantity(a.excess)}`,
                      money(a.cost),
                      <div className="text-xs">
                        {new Date(a.observedAt).toLocaleDateString("en-NZ")} ·{" "}
                        {a.stale ? "Stale" : "Recent"}
                        <p className="text-muted-foreground">{a.source}</p>
                      </div>,
                    ])}
                  />
                  <DataTable
                    columns={[
                      "Store total",
                      "Merchandise",
                      "Delivery",
                      "Travel",
                      "Payable",
                    ]}
                    rows={p.best.stores.map((s) => [
                      s.name,
                      money(s.subtotal),
                      money(s.delivery),
                      money(s.travel),
                      money(s.total),
                    ])}
                  />
                </>
              )}
              {p.deferrals.length > 0 && (
                <div className="space-y-3 p-5">
                  <h3 className="font-semibold">
                    Optional deferrals for your review
                  </h3>
                  {p.deferrals.map((d, i) => (
                    <div key={i} className="rounded-xl border p-4 text-sm">
                      <p>
                        Postpone:{" "}
                        <strong>
                          {d.deferred
                            .map(
                              (id: string) =>
                                p.listItems.find((x) => x.id === id)?.name
                            )
                            .join(", ")}
                        </strong>
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        Reduced basket: {money(d.plan.total)} ·{" "}
                        {d.plan.withinBudget
                          ? "Within budget"
                          : "Still above budget"}
                        . This is a different basket, not an equivalent-basket
                        saving.
                      </p>
                      <Button
                        className="mt-3"
                        size="sm"
                        variant="outline"
                        onClick={() => w.navigate("lists")}
                      >
                        Review list and apply changes
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <p className="quiet-note m-5">
                {p.restriction} Delivery and travel assumptions are saved with
                each result. Historical prices are not presented as current.
              </p>
            </div>
          )}
        </Panel>
      ))}
    </>
  )
}
const lineFields = (
  w: ReturnType<typeof useWorkspace>,
  line?: PurchaseLine
): Field[] => [
  { name: "name", label: "Item name", value: line?.name },
  { name: "category", label: "Category", value: line?.category ?? "Pantry" },
  {
    name: "quantity",
    label: "Purchased quantity (not number of packs)",
    type: "number",
    min: "0.000001",
    step: "0.000001",
    value: line?.quantity ?? "1",
  },
  {
    name: "unit",
    label: "Unit",
    options: options(["kg", "g", "l", "ml", "each"]),
    value: line?.unit ?? "kg",
  },
  {
    name: "lineCost",
    label: "Actual line cost (NZD)",
    type: "number",
    value: line?.lineCost ?? "0",
    min: "0",
  },
  {
    name: "expiryDate",
    label: "Expiry / best-before date (optional)",
    type: "date",
    required: false,
    value: line?.expiryDate ?? "",
  },
  {
    name: "inventoryItemId",
    label: "Add to existing inventory item",
    options: [
      { value: "", label: "Create a new inventory item" },
      ...w.inventory.map((i) => ({
        value: i.id,
        label: `${i.name} (${i.unit})`,
      })),
    ],
    value: line?.inventoryItemId ?? "",
    required: false,
  },
]
export function PurchasesPage() {
  const w = useWorkspace()
  const confirmKeys = useRef(new Map<string, string>())
  const draftBody = (p: Purchase, changes: Record<string, unknown> = {}) => ({
    budgetId: p.budgetId,
    purchasedOn: p.purchasedOn,
    storeName: p.storeName,
    delivery: p.delivery,
    travel: p.travel,
    revision: p.revision,
    lines: p.lines,
    ...changes,
  })
  return (
    <>
      <PageTitle
        title="Grocery purchases"
        description="Record what you actually paid. Confirm once to update both stock and spending."
        action={
          <FormDialog
            title="Record grocery purchase"
            disabled={!w.budget}
            fields={[
              { name: "storeName", label: "Store (optional)", required: false },
              {
                name: "purchasedOn",
                label: "Purchase date",
                type: "date",
                value: localDate().startsWith(w.month)
                  ? localDate()
                  : w.month + "-01",
              },
              ...lineFields(w),
            ]}
            onSubmit={(v) => {
              if (!w.budget) throw new Error("Create a monthly budget first.")
              const budgetId = w.budget.id
              const { storeName, purchasedOn, ...line } = v
              return w.act(
                () =>
                  api("/purchases", "POST", {
                    budgetId,
                    purchasedOn,
                    storeName,
                    lines: [
                      {
                        ...line,
                        expiryDate: line.expiryDate || null,
                        inventoryItemId: line.inventoryItemId || null,
                      },
                    ],
                  }),
                "Purchase draft created"
              )
            }}
          />
        }
      />
      {!w.purchases.length && (
        <Panel title="Your purchase history">
          <div className="p-6 text-muted-foreground">
            Start with a manual purchase or create a purchase draft from an
            approved shopping plan.
          </div>
        </Panel>
      )}
      {w.purchases.map((p) => (
        <Panel
          key={p.id}
          title={p.storeName || "Grocery purchase"}
          note={`${p.purchasedOn} · ${p.lines.length} items`}
          action={<Status value={p.state} />}
        >
          <DataTable
            columns={["Item", "Purchased", "Actual cost", "Expiry", "Edit"]}
            rows={p.lines.map((l) => [
              l.name,
              `${quantity(l.quantity)} ${l.unit}`,
              money(l.lineCost),
              l.expiryDate ?? "Not recorded",
              p.state === "draft" ? (
                <div className="flex gap-2">
                  <FormDialog
                    title="Edit purchased item"
                    fields={lineFields(w, l)}
                    onSubmit={(v) =>
                      w.act(
                        () =>
                          api(
                            `/purchases/${p.id}`,
                            "PATCH",
                            draftBody(p, {
                              lines: p.lines.map((x) =>
                                x.id === l.id
                                  ? {
                                      ...v,
                                      productId: l.productId,
                                      expiryDate: v.expiryDate || null,
                                      inventoryItemId:
                                        v.inventoryItemId || null,
                                    }
                                  : x
                              ),
                            })
                          ),
                        "Purchase item updated"
                      )
                    }
                  >
                    Edit
                  </FormDialog>
                  {p.lines.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void w.act(
                          () =>
                            api(
                              `/purchases/${p.id}`,
                              "PATCH",
                              draftBody(p, {
                                lines: p.lines.filter((x) => x.id !== l.id),
                              })
                            ),
                          "Purchase line removed"
                        )
                      }
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ) : (
                "Recorded"
              ),
            ])}
          />
          <div className="flex flex-wrap items-center justify-between gap-4 border-t p-5">
            <div>
              <strong className="text-xl">{money(p.adjustedTotal)}</strong>
              <p className="text-xs text-muted-foreground">
                Delivery {money(p.delivery)} · Travel {money(p.travel)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {p.state === "draft" ? (
                <>
                  <FormDialog
                    title="Add purchased item"
                    fields={lineFields(w)}
                    onSubmit={(v) =>
                      w.act(
                        () =>
                          api(
                            `/purchases/${p.id}`,
                            "PATCH",
                            draftBody(p, {
                              lines: [
                                ...p.lines,
                                {
                                  ...v,
                                  expiryDate: v.expiryDate || null,
                                  inventoryItemId: v.inventoryItemId || null,
                                },
                              ],
                            })
                          ),
                        "Purchase item added"
                      )
                    }
                  />
                  <FormDialog
                    title="Edit purchase details"
                    fields={[
                      {
                        name: "storeName",
                        label: "Store",
                        value: p.storeName,
                        required: false,
                      },
                      {
                        name: "purchasedOn",
                        label: "Purchase date",
                        type: "date",
                        value: p.purchasedOn,
                      },
                      {
                        name: "delivery",
                        label: "Actual delivery charge",
                        type: "number",
                        min: "0",
                        value: p.delivery,
                      },
                      {
                        name: "travel",
                        label: "Actual travel cost",
                        type: "number",
                        min: "0",
                        value: p.travel,
                      },
                    ]}
                    onSubmit={(v) =>
                      w.act(
                        () =>
                          api(`/purchases/${p.id}`, "PATCH", draftBody(p, v)),
                        "Purchase details updated"
                      )
                    }
                  />
                  <FormDialog
                    title="Confirm actual purchase"
                    description={`Record ${money(p.total)} of grocery spending and add these purchased quantities to inventory. Review all quantities and dates first.`}
                    fields={[
                      {
                        name: "chargesNotRecordedElsewhere",
                        label:
                          "These delivery/travel charges are not already recorded as essential expenses",
                        type: "checkbox",
                      },
                    ]}
                    label="Confirm purchase"
                    onSubmit={(v) => {
                      if (!confirmKeys.current.has(p.id))
                        confirmKeys.current.set(p.id, crypto.randomUUID())
                      return w.act(
                        () =>
                          api(
                            `/purchases/${p.id}/confirm`,
                            "POST",
                            { ...v, revision: p.revision },
                            confirmKeys.current.get(p.id)
                          ),
                        "Purchase confirmed — budget and inventory updated"
                      )
                    }}
                  />
                </>
              ) : (
                <FormDialog
                  title="Record purchase adjustment"
                  description="Enter a signed spending correction. Stock corrections can be included against a purchased batch. Already-consumed stock cannot be reversed below zero."
                  fields={[
                    { name: "reason", label: "Reason" },
                    {
                      name: "amount",
                      label: "Spending change (negative for refund)",
                      type: "number",
                      value: "0",
                    },
                    {
                      name: "batchId",
                      label: "Purchased batch to reconcile (optional)",
                      options: [
                        {
                          value: "",
                          label: "No stock change — financial adjustment only",
                        },
                        ...w.inventory.flatMap((i) =>
                          i.batches
                            .filter((b) =>
                              p.lines.some((l) => l.id === b.purchaseLineId)
                            )
                            .map((b) => ({
                              value: b.id,
                              label: `${i.name} · ${quantity(b.quantity)} ${i.unit}`,
                            }))
                        ),
                      ],
                      required: false,
                    },
                    {
                      name: "stockDelta",
                      label: "Stock change (negative to remove; optional)",
                      type: "number",
                      value: "0",
                      step: "0.000001",
                      required: false,
                    },
                  ]}
                  onSubmit={(v) => {
                    const batch = w.inventory
                      .flatMap((i) => i.batches)
                      .find((b) => b.id === v.batchId)
                    return w.act(
                      () =>
                        api(
                          `/purchases/${p.id}/adjustments`,
                          "POST",
                          {
                            revision: p.revision,
                            reason: v.reason,
                            amount: v.amount,
                            movements:
                              batch && Number(v.stockDelta) !== 0
                                ? [
                                    {
                                      batchId: batch.id,
                                      revision: batch.revision,
                                      quantity: v.stockDelta,
                                    },
                                  ]
                                : [],
                          },
                          crypto.randomUUID()
                        ),
                      "Purchase adjustment recorded"
                    )
                  }}
                />
              )}
            </div>
          </div>
          {p.adjustments.map((a) => (
            <p className="px-5 pb-3 text-xs text-muted-foreground" key={a.id}>
              {a.reason}: {money(a.amount)} ·{" "}
              {new Date(a.createdAt).toLocaleDateString("en-NZ")}
            </p>
          ))}
        </Panel>
      ))}
    </>
  )
}
export function AssistantPage() {
  const w = useWorkspace()
  const [result, setResult] = useState<AssistantResult | null>(null)
  return (
    <>
      <PageTitle
        title="Your household assistant"
        description="A little context to help you make your next decision."
      />
      <div className="assistant-intro">
        <div className="assistant-symbol">✳</div>
        <h2>Make sense of your household.</h2>
        <p>
          Explain spending changes, find ideas for ingredients you already have,
          or explore affordable alternatives. You stay in control of every
          change.
        </p>
        <FormDialog
          title="Ask your assistant"
          disabled={!w.budget}
          fields={[
            {
              name: "action",
              label: "How can I help?",
              options: [
                { value: "spending", label: "Explain my household spending" },
                { value: "meals", label: "Meal ideas from my inventory" },
                {
                  value: "alternatives",
                  label: "Find affordable product alternatives",
                },
              ],
            },
            {
              name: "listId",
              label: "Shopping list (for alternatives)",
              options: [
                { value: "", label: "No shopping list" },
                ...w.lists.map((l) => ({ value: l.id, label: l.name })),
              ],
              required: false,
            },
          ]}
          onSubmit={(v) =>
            w.act(async () => {
              if (!w.budget) throw new Error("Create a monthly budget first.")
              setResult(
                await api<AssistantResult>("/assistant/requests", "POST", {
                  ...v,
                  listId: v.listId || undefined,
                  budgetId: w.budget.id,
                })
              )
            }, "Assistant response validated")
          }
        />
      </div>
      {result && (
        <>
          <Panel
            title="Spending context"
            note="Financial figures below come from application calculations."
          >
            <div className="grid gap-4 p-5 sm:grid-cols-3">
              <Metric
                label="Actual essential costs"
                value={money(result.verifiedBudget.actual)}
              />
              <Metric
                label="Unpaid commitments"
                value={money(result.verifiedBudget.outstanding)}
              />
              <Metric
                label="Remaining grocery budget"
                value={money(result.verifiedBudget.remaining)}
                accent
              />
            </div>
            <p className="px-5 pb-5 text-sm leading-7 whitespace-pre-wrap">
              {result.explanation}
            </p>
          </Panel>
          {result.meals.map((m) => (
            <Panel
              key={m.name}
              title={m.name}
              note="General meal idea — check ingredient labels, dietary requirements and food condition."
            >
              <div className="p-5 text-sm">
                <p>
                  <strong>From your kitchen:</strong>{" "}
                  {m.ingredientIds
                    .map(
                      (id: string) => w.inventory.find((i) => i.id === id)?.name
                    )
                    .join(", ")}
                </p>
                {m.additionalIngredients.length > 0 && (
                  <p className="mt-2">
                    <strong>Additional ingredients:</strong>{" "}
                    {m.additionalIngredients.join(", ")}
                  </p>
                )}
                <p className="mt-3 leading-7 whitespace-pre-wrap">{m.steps}</p>
              </div>
            </Panel>
          ))}
          {result.alternatives.map((a, index) => (
            <Panel
              key={index}
              title={
                w.products.find((p) => p.productId === a.productId)?.product
                  .name ?? "Product alternative"
              }
              note={a.reason}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                  <strong>Calculated saving: {money(a.verifiedSaving)}</strong>
                  <p className="text-xs text-muted-foreground">
                    {a.assumption}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    disabled={w.pending}
                    onClick={() =>
                      void w.act(async () => {
                        await api(
                          `/assistant/suggestions/${result.id}/apply`,
                          "POST",
                          {
                            revision: result.revision,
                            listRevision: result.listRevision,
                            alternativeIndex: index,
                          },
                          crypto.randomUUID()
                        )
                        setResult(null)
                        w.navigate("lists")
                      }, "Alternative applied — recalculate your shopping plan")
                    }
                  >
                    Apply to list
                  </Button>
                  <Button
                    variant="outline"
                    disabled={w.pending}
                    onClick={() =>
                      void w.act(
                        async () =>
                          setResult(
                            await api<AssistantResult>(
                              `/assistant/suggestions/${result.id}/reject`,
                              "POST",
                              {
                                revision: result.revision,
                                alternativeIndex: index,
                              }
                            )
                          ),
                        "Suggestion rejected"
                      )
                    }
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </Panel>
          ))}
        </>
      )}
      <p className="quiet-note">
        An AI provider must be configured in the API environment. Your API
        credentials stay on the backend. Financial calculations and normal
        shopping tools work independently of AI.
      </p>
    </>
  )
}
