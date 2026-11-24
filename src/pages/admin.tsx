import type { AdminSummary } from "@/lib/models"
import { useEffect, useState } from "react"
import { api, apiAll, type AuthUser } from "@/lib/api"
import { useWorkspace } from "@/context"
import { useAuth } from "@/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DataTable,
  FormDialog,
  Metric,
  Panel,
  PageTitle,
  Status,
  options,
} from "@/components/workspace"

type ManagedUser = AuthUser & { household: { name: string; location: string } }
export function AdminPage() {
  const w = useWorkspace()
  const auth = useAuth()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [summary, setSummary] = useState<AdminSummary | null>(null)
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let active = true
    Promise.all([
      apiAll<ManagedUser>("/admin/users"),
      api<AdminSummary>("/admin/summary"),
    ])
      .then(([u, s]) => {
        if (active) {
          setUsers(u)
          setSummary(s)
          setError("")
        }
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
    return () => {
      active = false
    }
  }, [version])
  const act = async (work: () => Promise<unknown>, message: string) =>
    w.act(async () => {
      const result = await work()
      setVersion((v) => v + 1)
      return result
    }, message)
  return (
    <>
      <PageTitle
        title="Administration"
        description="Manage accounts, access and sign-in sessions. Household financial records stay private."
        action={
          <FormDialog
            title="Create managed account"
            fields={[
              { name: "name", label: "Name" },
              { name: "email", label: "Email", type: "email" },
              { name: "householdName", label: "Household name" },
              {
                name: "password",
                label: "Initial password (at least 12 characters)",
                type: "password",
              },
              {
                name: "role",
                label: "Role",
                options: options(["household", "admin"]),
              },
            ]}
            onSubmit={(v) =>
              act(
                () => api("/admin/users", "POST", v),
                "Managed account created"
              )
            }
          />
        }
      />
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {summary && (
        <div className="metrics">
          <Metric label="User accounts" value={summary.users} />
          <Metric label="Active accounts" value={summary.activeUsers} />
          <Metric label="Administrators" value={summary.admins} />
          <Metric label="Active sign-ins" value={summary.sessions} />
        </div>
      )}
      <Panel
        title="Accounts & access"
        note="Role changes, deactivation and password replacement revoke existing sessions."
        action={
          <Input
            aria-label="Search accounts"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        }
      >
        <DataTable
          columns={["User", "Household", "Role", "Status", "Manage"]}
          rows={users
            .filter((u) =>
              (u.name + " " + u.email)
                .toLowerCase()
                .includes(search.toLowerCase())
            )
            .map((u) => [
              <div>
                <strong>{u.name}</strong>
                <p className="text-xs text-muted-foreground">{u.email}</p>
                {u.demo && <Status value="demo" />}
              </div>,
              u.household.name,
              <Status value={u.role} />,
              <Status value={u.active ? "active" : "disabled"} />,
              <div className="flex flex-wrap gap-2">
                <FormDialog
                  title="Manage account"
                  description={
                    u.id === auth.user?.id
                      ? "You can rename your account; you cannot disable or demote your own administrator."
                      : "Changing role or active state signs this user out immediately."
                  }
                  fields={[
                    { name: "name", label: "Name", value: u.name },
                    {
                      name: "role",
                      label: "Role",
                      value: u.role,
                      options: options(["household", "admin"]),
                    },
                    {
                      name: "active",
                      label: "Account is active",
                      type: "checkbox",
                      value: u.active,
                    },
                  ]}
                  onSubmit={(v) =>
                    act(
                      () =>
                        api(`/admin/users/${u.id}`, "PATCH", {
                          ...v,
                          revision: u.revision,
                        }),
                      "Account updated"
                    )
                  }
                >
                  Edit access
                </FormDialog>
                <FormDialog
                  title="Revoke sign-in sessions"
                  description={`End all current sign-ins for ${u.email}. They can sign in again if their account remains active.`}
                  fields={[]}
                  label="Revoke sessions"
                  onSubmit={() =>
                    act(
                      () =>
                        api(`/admin/users/${u.id}/revoke-sessions`, "POST", {
                          revision: u.revision,
                        }),
                      "Sessions revoked"
                    )
                  }
                >
                  Sign out user
                </FormDialog>
                <FormDialog
                  title="Replace account password"
                  description="Share the replacement password with the account owner. Existing sessions will end."
                  fields={[
                    {
                      name: "password",
                      label: "New password (at least 12 characters)",
                      type: "password",
                    },
                  ]}
                  label="Replace password"
                  onSubmit={(v) =>
                    act(
                      () =>
                        api(`/admin/users/${u.id}/password`, "POST", {
                          ...v,
                          revision: u.revision,
                        }),
                      "Password replaced and sessions revoked"
                    )
                  }
                >
                  Password
                </FormDialog>
              </div>,
            ])}
        />
      </Panel>
      {summary && summary.audit.length > 0 && (
        <Panel title="Recent management activity">
          <DataTable
            columns={["When", "Action", "Account"]}
            rows={summary.audit.map((a) => [
              new Date(a.createdAt).toLocaleString("en-NZ"),
              a.action,
              users.find((u) => u.id === a.targetId)?.email ?? a.targetId,
            ])}
          />
        </Panel>
      )}
      <Button variant="outline" onClick={() => setVersion((v) => v + 1)}>
        Refresh administration
      </Button>
    </>
  )
}
