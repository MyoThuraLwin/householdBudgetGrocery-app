import { useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const options = (values: string[]) =>
  values.map((value) => ({ value, label: value }))
export type FormValues = Record<string, string | boolean | string[]>
export type Field = {
  name: string
  label: string
  type?: string
  value?: string | number | boolean | string[] | null
  required?: boolean
  options?: { value: string; label: string }[]
  hint?: string
  min?: string
  step?: string
  render?: ReactNode
}
export function FormDialog({
  title,
  description = "Review the values before saving.",
  fields,
  onSubmit,
  children,
  label = "Save changes",
  disabled = false,
  triggerVariant = "outline",
}: {
  title: string
  description?: string
  fields: Field[]
  onSubmit: (values: FormValues) => Promise<unknown>
  children?: ReactNode
  label?: string
  disabled?: boolean
  triggerVariant?: "default" | "outline"
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  return (
    <>
      <Button
        variant={triggerVariant}
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {children ?? title}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) {
            setOpen(value)
            setError("")
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              const data: FormValues = Object.fromEntries(
                Array.from(form, ([name, value]) => [name, String(value)])
              )
              for (const field of fields)
                if (field.type === "checkbox")
                  data[field.name] = form.has(field.name)
                else if (field.type === "multiselect")
                  data[field.name] = form.getAll(field.name).map(String)
              setBusy(true)
              setError("")
              try {
                await onSubmit(data)
                setOpen(false)
              } catch (e) {
                setError((e as Error).message)
              } finally {
                setBusy(false)
              }
            }}
            className="space-y-4"
          >
            {fields.map((field) => (
              <div className="space-y-1.5" key={field.name}>
                {field.render ? (
                  field.render
                ) : (
                  <>
                    <Label htmlFor={"field-" + field.name}>{field.label}</Label>
                    {field.type === "multiselect" ? (
                      <div
                        role="group"
                        aria-label={field.label}
                        className="grid gap-2 rounded-xl border p-3"
                      >
                        {field.options?.map((option) => (
                          <label
                            key={option.value}
                            className="flex items-center gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              name={field.name}
                              value={option.value}
                              defaultChecked={
                                Array.isArray(field.value) &&
                                field.value.includes(option.value)
                              }
                              className="size-4 accent-primary"
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                    ) : field.options ? (
                      <select
                        id={"field-" + field.name}
                        name={field.name}
                        defaultValue={
                          field.value == null
                            ? field.options[0]?.value
                            : String(field.value)
                        }
                        required={field.required !== false}
                        className="native-select"
                      >
                        {field.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : field.type === "checkbox" ? (
                      <input
                        type="checkbox"
                        id={"field-" + field.name}
                        name={field.name}
                        defaultChecked={!!field.value}
                        className="size-4 accent-primary"
                      />
                    ) : field.type === "textarea" ? (
                      <textarea
                        id={"field-" + field.name}
                        name={field.name}
                        defaultValue={
                          field.value == null ? undefined : String(field.value)
                        }
                        rows={4}
                        className="native-select h-auto py-2"
                        required={field.required !== false}
                      />
                    ) : (
                      <Input
                        id={"field-" + field.name}
                        name={field.name}
                        type={field.type ?? "text"}
                        defaultValue={
                          field.value == null ? "" : String(field.value)
                        }
                        required={field.required !== false}
                        min={field.min}
                        step={
                          field.step ??
                          (field.type === "number" ? "0.01" : undefined)
                        }
                      />
                    )}
                    {field.hint && (
                      <p className="text-xs text-muted-foreground">
                        {field.hint}
                      </p>
                    )}
                  </>
                )}
              </div>
            ))}
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : label}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
export function DataTable({
  columns,
  rows,
  empty = "No records yet. Add your first record to get started.",
}: {
  columns: string[]
  rows: ReactNode[][]
  empty?: string
}) {
  const [page, setPage] = useState(0)
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(rows.length / 20) - 1)
  )
  return rows.length ? (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c}>{c}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows
            .slice(currentPage * 20, (currentPage + 1) * 20)
            .map((cells, i) => (
              <TableRow key={i}>
                {cells.map((c, j) => (
                  <TableCell key={j}>{c}</TableCell>
                ))}
              </TableRow>
            ))}
        </TableBody>
      </Table>
      {rows.length > 20 && (
        <div className="flex items-center justify-between border-t px-5 py-3 text-xs text-muted-foreground">
          <span>
            {currentPage * 20 + 1}–
            {Math.min((currentPage + 1) * 20, rows.length)} of {rows.length}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={(currentPage + 1) * 20 >= rows.length}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  ) : (
    <div className="empty-state">
      <span className="text-3xl text-primary">◇</span>
      <p>{empty}</p>
    </div>
  )
}
export function Panel({
  title,
  note,
  action,
  children,
}: {
  title: string
  note?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Card className="panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {note && <p>{note}</p>}
        </div>
        {action}
      </div>
      <CardContent className="px-0 pb-0">{children}</CardContent>
    </Card>
  )
}
export function Metric({
  label,
  value,
  note,
  accent = false,
}: {
  label: string
  value: ReactNode
  note?: string
  accent?: boolean
}) {
  return (
    <Card className={"metric " + (accent ? "metric-primary" : "")}>
      <CardContent className="p-5">
        <p className="text-sm opacity-75">{label}</p>
        <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
          {value}
        </div>
        {note && <p className="mt-3 text-xs opacity-70">{note}</p>}
      </CardContent>
    </Card>
  )
}
export function Status({ value }: { value: string }) {
  return (
    <Badge
      variant={
        ["expired", "failed", "needs review"].includes(value)
          ? "destructive"
          : ["approved", "confirmed", "fresh", "available"].includes(value)
            ? "default"
            : "secondary"
      }
      className="capitalize"
    >
      {value}
    </Badge>
  )
}
export function PageTitle({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}
