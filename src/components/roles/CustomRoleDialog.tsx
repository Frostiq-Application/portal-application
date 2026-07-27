import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "@/components/ui/icons";
import { toast } from "sonner";
import { apiError } from "@/lib/apiError";
import {
  useCreateCustomRoleMutation,
  useUpdateCustomRoleMutation,
  type CustomRole,
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

  const [create, { isLoading: creating }] = useCreateCustomRoleMutation();
  const [update, { isLoading: updating }] = useUpdateCustomRoleMutation();
  const saving = creating || updating;

  useEffect(() => {
    if (!open) return;
    setName(role?.name ?? "");
    setDescription(role?.description ?? "");
    setSelected(new Set(role?.permissions ?? []));
  }, [open, role]);

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
    const body = {
      name: name.trim(),
      description: description.trim() || undefined,
      permissions: [...selected],
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
            Pick exactly what this role can do. Members assigned to it get these
            permissions on top of their base access.
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

          <div className="flex items-center justify-between">
            <Label>Permissions</Label>
            <span className="text-xs text-muted-foreground">
              {selected.size} selected
            </span>
          </div>

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
