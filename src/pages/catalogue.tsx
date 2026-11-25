import type { ImportPreview, PriceObservation } from "@/lib/models"
import { useEffect, useRef, useState } from "react"
import { useWorkspace } from "@/context"
import { api, apiAll, money, quantity } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { productCategories } from "@/lib/product-categories"
import {
  FormDialog,
  DataTable,
  Panel,
  PageTitle,
  Status,
  options,
} from "@/components/workspace"

export function ProductsPage() {
  const w = useWorkspace()
  const [search, setSearch] = useState("")
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [history, setHistory] = useState<PriceObservation[]>([])
  const [sources, setSources] = useState<{ id: string; name: string }[] | null>(
    null
  )
  const [sourceError, setSourceError] = useState("")
  const [sourceVersion, setSourceVersion] = useState(0)
  const [selectedSource, setSelectedSource] = useState("")
  const [templateFormat, setTemplateFormat] = useState<"csv" | "json">("csv")
  const [inStock, setInStock] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const lastUpload = useRef<{ format: "csv" | "json"; content: string } | null>(
    null
  )
  const importKey = useRef(crypto.randomUUID())
  const previewUpload = async (
    file: { format: "csv" | "json"; content: string },
    confirmed: boolean
  ) => {
    const result = await api<ImportPreview>("/price-imports/preview", "POST", {
      ...file,
      defaultAvailability: confirmed ? "available" : "unknown",
    })
    importKey.current = crypto.randomUUID()
    setPreview(result)
  }
  useEffect(() => {
    let cancelled = false
    apiAll<{ id: string; name: string }>("/data-sources").then(
      (result) => {
        if (!cancelled) {
          setSources(result)
          setSourceError("")
        }
      },
      (error: Error) => {
        if (!cancelled) setSourceError(error.message)
      }
    )
    return () => {
      cancelled = true
    }
  }, [sourceVersion])
  const templateSource = selectedSource || sources?.[0]?.name || ""
  const downloadTemplate = async () => {
    const query = new URLSearchParams({ format: templateFormat })
    if (templateSource) query.set("source", templateSource)
    const path = `/price-imports/template?${query}`
    const content =
      templateFormat === "csv"
        ? (await api<{ csv: string }>(path)).csv
        : JSON.stringify((await api<{ rows: unknown[] }>(path)).rows, null, 2)
    const blob = new Blob([content], {
      type:
        templateFormat === "csv"
          ? "text/csv;charset=utf-8"
          : "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `grocery-price-template.${templateFormat}`
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <>
      <PageTitle
        title="Products & prices"
        description="Add your prices. Find a better-value shop."
      />
      <Panel
        title="1. Register a data source"
        note={
          sources?.length
            ? "Ready for your next import"
            : "Start here to unlock file upload"
        }
        action={
          <FormDialog
            title="Register data source"
            triggerVariant="default"
            disabled={w.pending}
            description="Register where the data comes from and your permission to use it. The source name must match the source column in your file."
            label="Register source"
            fields={[
              {
                name: "name",
                label: "Source name",
                hint: "Use this exact name in the source column. Templates can fill it in for you.",
              },
              {
                name: "type",
                label: "Source type",
                options: options([
                  "user",
                  "fixture",
                  "licensed",
                  "official",
                  "authorised-api",
                ]),
              },
              {
                name: "permission",
                label: "Permission or licence notes",
                type: "textarea",
              },
              {
                name: "freshnessDays",
                label: "Freshness threshold (days)",
                type: "number",
                value: "7",
                step: "1",
                min: "1",
              },
            ]}
            onSubmit={(v) =>
              w.act(async () => {
                const source = await api<{ id: string; name: string }>(
                  "/data-sources",
                  "POST",
                  {
                    ...v,
                    freshnessDays: Number(v.freshnessDays),
                  }
                )
                setSelectedSource(source.name)
                setSources((current) => [...(current ?? []), source])
                setSourceError("")
                setSourceVersion((current) => current + 1)
              }, "Data source registered")
            }
          />
        }
      >
        <div className="px-5 pb-5 text-sm">
          {sourceError ? (
            <div
              role="alert"
              className="mt-3 flex flex-wrap items-center gap-3 text-destructive"
            >
              <p>Could not load registered sources: {sourceError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSourceVersion((current) => current + 1)}
              >
                Retry
              </Button>
            </div>
          ) : sources === null ? (
            <p className="mt-3 text-muted-foreground" role="status">
              Loading registered sources…
            </p>
          ) : sources.length ? (
            <div className="flex flex-wrap items-center gap-3">
              <label
                htmlFor="template-source"
                className="text-muted-foreground"
              >
                Your source
              </label>
              <select
                id="template-source"
                className="native-select max-w-full min-w-0 flex-1 sm:max-w-sm"
                value={templateSource}
                disabled={w.pending}
                onChange={(event) => setSelectedSource(event.target.value)}
              >
                {sources.map((source) => (
                  <option key={source.id} value={source.name}>
                    {source.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="mt-3 font-medium text-primary">
              Register where your price data comes from.
            </p>
          )}
        </div>
      </Panel>
      <Panel
        title="Import permitted price data"
        note="Step 2 · Download, fill in, then upload"
      >
        <div className="space-y-5 p-5 pt-0">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="template-format"
                className="block text-sm font-medium"
              >
                Template format (with sample records)
              </label>
              <select
                id="template-format"
                className="native-select"
                value={templateFormat}
                disabled={w.pending}
                onChange={(event) =>
                  setTemplateFormat(event.target.value as "csv" | "json")
                }
              >
                <option value="csv">CSV (.csv)</option>
                <option value="json">JSON (.json)</option>
              </select>
            </div>
            <Button
              variant="outline"
              disabled={w.pending}
              onClick={() =>
                void w.act(downloadTemplate, "Template downloaded")
              }
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4" />
              </svg>
              Download template
            </Button>
          </div>
          {!sources?.length && (
            <p className="text-sm text-muted-foreground">
              Register a source to fill its name into your template.
            </p>
          )}
          <div className="rounded-2xl border-2 border-dashed border-primary/25 bg-primary/5 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-background text-primary shadow-sm">
                  <svg
                    aria-hidden="true"
                    className="size-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  >
                    <path d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4" />
                  </svg>
                </span>
                <div>
                  <h3 className="font-medium">Upload your price file</h3>
                  <p
                    id="price-file-help"
                    className="mt-1 text-sm text-muted-foreground"
                  >
                    CSV or JSON · up to 1,000 records
                  </p>
                </div>
              </div>
              <Button
                disabled={w.pending || !sources?.length || !!sourceError}
                onClick={() => fileInput.current?.click()}
              >
                Choose file
              </Button>
            </div>
            <label className="mt-5 flex cursor-pointer items-start gap-3 border-t border-primary/10 pt-4 text-sm">
              <Checkbox
                checked={inStock}
                onCheckedChange={(checked) => {
                  setInStock(checked)
                  if (lastUpload.current && preview && !preview.committed) {
                    const file = lastUpload.current
                    setPreview(null)
                    void w.act(
                      () => previewUpload(file, checked),
                      "Import preview updated"
                    )
                  }
                }}
                disabled={w.pending}
                className="mt-0.5"
              />
              <span>
                Products without stock details were in stock when checked
                <span className="mt-1 block text-muted-foreground">
                  Leave unchecked if unsure.
                </span>
              </span>
            </label>
            {!sources?.length && (
              <p className="mt-3 text-sm text-primary">
                Complete step 1 to enable upload.
              </p>
            )}
            <Input
              ref={fileInput}
              id="price-file"
              type="file"
              accept=".csv,.json"
              className="hidden"
              tabIndex={-1}
              aria-label="Select a CSV or JSON price file"
              aria-describedby="price-file-help"
              disabled={w.pending || !sources?.length || !!sourceError}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file)
                  void w.act(async () => {
                    const upload = {
                      format: file.name.toLowerCase().endsWith(".csv")
                        ? ("csv" as const)
                        : ("json" as const),
                      content: await file.text(),
                    }
                    lastUpload.current = upload
                    setPreview(null)
                    await previewUpload(upload, inStock)
                  }, "Import preview ready")
                event.target.value = ""
              }}
            />
          </div>
          <details className="group text-sm">
            <summary className="w-fit cursor-pointer font-medium text-primary">
              How to fill your file
            </summary>
            <dl className="mt-4 grid gap-4 rounded-xl bg-muted/40 p-4 text-muted-foreground">
              <div>
                <dt className="font-medium text-foreground">
                  Price date (priceDate)
                </dt>
                <dd>
                  The date you checked the price, e.g. 2026-11-26 or 26/11/2026.
                  It helps flag old prices. Use the actual date, not the upload
                  date.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Category</dt>
                <dd>
                  Use the same category as the kitchen item:{" "}
                  {productCategories.join(", ")}. New categories are accepted
                  and appear in the kitchen category choices; existing items
                  keep their category.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">
                  Stock status (optional availability column)
                </dt>
                <dd>
                  Use available, not available (or unavailable), or unknown.
                  Without this column, use the stock confirmation above. Unknown
                  stock needs “Include unknown availability” when comparing
                  shopping plans.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Sample data</dt>
                <dd>
                  The template has 10 fictional prices across two example
                  supermarkets. Replace the examples, keeping the source name
                  matched to your registered source.
                </dd>
              </div>
            </dl>
          </details>
        </div>
        {preview && (
          <div className="border-t p-5">
            <div className="flex items-center justify-between">
              <div>
                <strong>{preview.count} rows reviewed</strong>
                <p className="text-sm text-muted-foreground">
                  {preview.errors.length} validation errors ·{" "}
                  {preview.committed ? "Committed" : "Not yet imported"}
                </p>
              </div>
              <Button
                disabled={
                  w.pending || preview.errors.length > 0 || preview.committed
                }
                onClick={() =>
                  void w.act(
                    async () =>
                      setPreview(
                        await api<ImportPreview>(
                          `/price-imports/${preview.id}/commit`,
                          "POST",
                          { revision: preview.revision },
                          importKey.current
                        )
                      ),
                    "Price snapshots imported"
                  )
                }
              >
                Commit import
              </Button>
            </div>
            {preview.errors.map((e) => (
              <p
                key={e.row + e.message}
                className="mt-2 text-xs text-destructive"
              >
                Row {e.row}: {e.message}
              </p>
            ))}
            {preview.result && (
              <p className="mt-2 text-sm">
                {preview.result.imported} snapshots imported ·{" "}
                {preview.result.duplicates} duplicates skipped
              </p>
            )}
            {!!preview.unknownStockCount && (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                {preview.unknownStockCount} products have unknown stock. To use
                these in shopping plans, select “Include unknown availability”
                when comparing.
              </p>
            )}
          </div>
        )}
      </Panel>
      <Panel
        title="Price observations"
        note={`${w.products.length} store prices`}
        action={
          <Input
            aria-label="Search products"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        }
      >
        <DataTable
          columns={[
            "Product",
            "Store",
            "Package",
            "Price",
            "Unit price",
            "Stock",
            "Price checked / source",
            "History",
          ]}
          rows={w.products
            .filter((p) =>
              p.product.name.toLowerCase().includes(search.toLowerCase())
            )
            .map((p) => {
              return [
                <div>
                  <strong>{p.product.name}</strong>
                  <p className="text-xs text-muted-foreground">
                    {p.product.brand} · {p.product.category}
                  </p>
                </div>,
                p.store.name,
                `${quantity(p.packageQuantity)} ${p.unit}`,
                money(p.price),
                p.price === null ? "—" : `${money(p.unitPrice)}/${p.baseUnit}`,
                <Status value={p.availability} />,
                <div className="text-xs">
                  {p.observedAt
                    ? new Date(p.observedAt).toLocaleDateString("en-NZ")
                    : "Unknown"}{" "}
                  {p.stale && <Status value="stale" />}
                  <p className="text-muted-foreground">
                    {p.source ?? "No source"}
                  </p>
                </div>,
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={w.pending}
                  onClick={() =>
                    void w.act(
                      async () =>
                        setHistory(
                          await api<PriceObservation[]>(
                            `/products/${p.productId}/prices`
                          )
                        ),
                      "Price history loaded"
                    )
                  }
                >
                  History
                </Button>,
              ]
            })}
          empty="Your price collection starts here. Upload a file above to compare stores."
        />
      </Panel>
      {history.length > 0 && (
        <Panel
          title="Price history"
          action={
            <Button variant="ghost" onClick={() => setHistory([])}>
              Close
            </Button>
          }
        >
          <DataTable
            columns={["Store", "Observed", "Price", "Source"]}
            rows={history.map((p) => [
              p.listing.store.name,
              new Date(p.observedAt).toLocaleString("en-NZ"),
              money(p.price),
              p.source.name,
            ])}
          />
        </Panel>
      )}
    </>
  )
}
export function StoresPage() {
  const w = useWorkspace()
  return (
    <>
      <PageTitle
        title="Store costs"
        description="Include the costs between a shelf price and your actual shopping total."
        action={
          <FormDialog
            title="Add store"
            fields={[
              { name: "name", label: "Store name" },
              { name: "retailer", label: "Retailer" },
              {
                name: "location",
                label: "Location",
                value: w.household.location,
                required: false,
              },
            ]}
            onSubmit={(v) =>
              w.act(() => api("/stores", "POST", v), "Store added")
            }
          />
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        {w.stores.map((store) => (
          <Panel
            key={store.id}
            title={store.name}
            note={`${store.retailer} · ${store.location}`}
            action={
              <FormDialog
                title="Set fulfilment costs"
                fields={[
                  {
                    name: "mode",
                    label: "Fulfilment mode",
                    options: options(["pickup", "delivery"]),
                  },
                  {
                    name: "minimum",
                    label: "Minimum merchandise order (NZD)",
                    type: "number",
                    min: "0",
                    value: "0",
                  },
                  {
                    name: "delivery",
                    label: "Delivery charge (blank = unknown)",
                    type: "number",
                    min: "0",
                    value: "0",
                    required: false,
                  },
                  {
                    name: "freeThreshold",
                    label: "Free delivery threshold (optional)",
                    type: "number",
                    min: "0",
                    required: false,
                  },
                  {
                    name: "travel",
                    label: "Travel cost per visited store (NZD)",
                    type: "number",
                    min: "0",
                    value: "0",
                  },
                  {
                    name: "source",
                    label: "Rule source or assumption",
                    value: "User-entered assumption",
                  },
                ]}
                onSubmit={(v) => {
                  const old = store.rules.find((r) => r.mode === v.mode)
                  return w.act(
                    () =>
                      api(`/stores/${store.id}/fulfilment-rules`, "PUT", {
                        ...v,
                        delivery: v.delivery || null,
                        freeThreshold: v.freeThreshold || null,
                        revision: old?.revision,
                      }),
                    "Store costs saved"
                  )
                }}
              >
                Set costs
              </FormDialog>
            }
          >
            <DataTable
              columns={["Mode", "Minimum", "Delivery", "Free above", "Travel"]}
              rows={store.rules.map((r) => [
                <Status value={r.mode} />,
                money(r.minimum),
                r.delivery === null ? "Unknown" : money(r.delivery),
                money(r.freeThreshold),
                money(r.travel),
              ])}
            />
            <div className="px-5 pb-4 text-xs text-muted-foreground">
              {store.rules.map((r) => (
                <p key={r.id}>
                  {r.mode}: {r.source} ·{" "}
                  {new Date(r.observedAt).toLocaleDateString("en-NZ")}
                </p>
              ))}
            </div>
          </Panel>
        ))}
      </div>
      <p className="quiet-note">
        Charges apply once per used store. Free-delivery thresholds use the
        merchandise subtotal. Travel values are your assumptions; this
        application does not calculate routes.
      </p>
    </>
  )
}
