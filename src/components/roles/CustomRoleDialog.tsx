import { useMemo, useState } from "react";
import { Loader2 } from "@/components/ui/icons";
import { toast } from "sonner";
import { apiError } from "@/lib/apiError";
import {
  useCreateCustomRoleMutation,
  useUpdateCustomRoleMutation,
  type CustomRole,
  type CustomRoleMode,
} from "@/features/api/rolesApi";
import { PERMISSION_CATALOG } from "@/config/permissions";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

/** Flat list of catalog rows keyed for label lookup. */
const CATALOG_ROWS = PERMISSION_CATALOG.flatMap((g) =>
  g.rows.map((r) => ({ ...r, group: g.group })),
);

export function CustomRoleDialog({
  role,
  open,
  onOpenChange,
}: {
  role: CustomRole | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const editing = !!role;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<CustomRoleMode>("extend");

  const [create, { isLoading: creating }] = useCreateCustomRoleMutation();
  const [update, { isLoading: updating }] = useUpdateCustomRoleMutation();
  const saving = creating || updating;

  // Seeded during render rather than in an effect so the fields are correct on
  // first paint instead of flashing the previous role's values for a frame.
  const seedKey = open ? (role?.id ?? "new") : null;
  const [seeded, setSeeded] = useState<string | null>(null);
  if (seedKey !== seeded) {
    setSeeded(seedKey);
    setName(role?.name ?? "");
    setDescription(role?.description ?? "");
    setSelected(new Set(role?.permissions ?? []));
    setMode(role?.mode ?? "extend");
  }

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const grouped = useMemo(() => {
    const map = new Map<string, typeof CATALOG_ROWS>();
    for (const row of CATALOG_ROWS) {
      const list = map.get(row.group) ?? [];
      list.push(row);
      map.set(row.group, list);
    }
    return [...map.entries()];
  }, []);

  const submit = async () => {
    if (name.trim().length < 2) return toast.error("Name is required");
    if (mode === "restrict" && selected.size === 0) {
      return toast.error(
        "Tick at least one permission. A restricted role with none can't reach any page.",
      );
    }
    const body = {
      name: name.trim(),
      description: description.trim() || undefined,
      permissions: [...selected],
      mode,
    };
    try {
      if (editing) {
        await update({ id: role.id, body }).unwrap();
        toast.success("Role updated");
      } else {
        await create(body).unwrap();
        toast.success("Role created");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit role" : "New custom role"}</DialogTitle>
          <DialogDescription>
            Pick exactly what this role can do. Members assigned to it see only
            the pages their permissions cover.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Branch Manager"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          {/* The distinction that decides whether this role can take a page
              away, so it's stated in plain terms rather than as a mode switch
              with a doc link. */}
          <div className="grid gap-1.5">
            <Label>Access</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  {
                    value: "extend" as const,
                    title: "Add to their role",
                    blurb:
                      "Keeps everything their role normally has, plus what you tick.",
                  },
                  {
                    value: "restrict" as const,
                    title: "Only what's ticked",
                    blurb:
                      "Replaces their role's access entirely. Use this for a chef or rider.",
                  },
                ] satisfies {
                  value: CustomRoleMode;
                  title: string;
                  blurb: string;
                }[]
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMode(opt.value)}
                  className={cn(
                    "rounded-lg border p-2.5 text-left transition-colors",
                    mode === opt.value
                      ? "border-primary/50 bg-primary/5"
                      : "hover:bg-muted/50",
                  )}
                >
                  <p className="text-sm font-medium">{opt.title}</p>
                  <p className="text-xs text-muted-foreground">{opt.blurb}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label>Permissions</Label>
            <span className="text-xs text-muted-foreground">
              {selected.size} selected
            </span>
          </div>

          {mode === "restrict" && selected.size === 0 && (
            <p className="rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Nothing ticked. A restricted role with no permissions can&rsquo;t
              open a single page. Tick what this person actually needs.
            </p>
          )}

          <div className="space-y-4">
            {grouped.map(([group, rows]) => (
              <div key={group}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group}
                </p>
                <div className="space-y-1">
                  {rows.map((row) => {
                    const checked = selected.has(row.key);
                    return (
                      <label
                        key={row.key}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 transition-colors",
                          checked
                            ? "border-primary/40 bg-primary/5"
                            : "hover:bg-muted/50",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggle(row.key)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{row.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Save changes" : "Create role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
