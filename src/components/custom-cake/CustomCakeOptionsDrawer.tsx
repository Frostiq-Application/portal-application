import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import {
  useCreateCustomCakeOptionMutation,
  useDeleteCustomCakeOptionMutation,
  useListCustomCakeOptionsQuery,
  useUpdateCustomCakeOptionMutation,
  CUSTOM_CAKE_FIELD_LABELS,
  CUSTOM_CAKE_OPTION_FIELDS,
  type CustomCakeOption,
} from "@/features/api/customCakeApi";
import { apiError } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Side drawer for managing every custom-cake form field in one place. Each field
 * is a collapsible section showing its options; shoppers pick from these when
 * requesting a custom cake. Add, toggle-active, and delete are all inline.
 */
export function CustomCakeOptionsDrawer({
  shopId,
  open,
  onOpenChange,
}: {
  shopId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useListCustomCakeOptionsQuery(shopId, {
    skip: !shopId || !open,
  });

  const byField = useMemo(() => {
    const map: Record<string, CustomCakeOption[]> = {};
    for (const f of CUSTOM_CAKE_OPTION_FIELDS) map[f] = [];
    for (const o of data ?? []) (map[o.fieldKey] ??= []).push(o);
    return map;
  }, [data]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>Custom cake form options</SheetTitle>
          <SheetDescription>
            Manage the choices shoppers pick from for each part of their custom
            cake. Changes save instantly.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {CUSTOM_CAKE_OPTION_FIELDS.map((f) => (
                <FieldSection
                  key={f}
                  shopId={shopId}
                  field={f}
                  options={byField[f] ?? []}
                />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FieldSection({
  shopId,
  field,
  options,
}: {
  shopId: string;
  field: string;
  options: CustomCakeOption[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [label, setLabel] = useState("");

  const [create, createState] = useCreateCustomCakeOptionMutation();
  const [update] = useUpdateCustomCakeOptionMutation();
  const [remove] = useDeleteCustomCakeOptionMutation();

  const fieldLabel = CUSTOM_CAKE_FIELD_LABELS[field] ?? field;
  const activeCount = options.filter((o) => o.isActive).length;

  const onAdd = async () => {
    if (!label.trim()) return;
    try {
      await create({ shopId, fieldKey: field, label: label.trim() }).unwrap();
      setLabel("");
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <span className="flex-1 text-sm font-medium">{fieldLabel}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {options.length === 0
            ? "None"
            : `${activeCount}/${options.length} active`}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div className="space-y-3 border-t px-4 py-3">
          <div className="flex gap-2">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onAdd()}
              placeholder={`New ${fieldLabel.toLowerCase()} option`}
            />
            <Button
              onClick={onAdd}
              disabled={createState.isLoading || !label.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {options.length === 0 ? (
            <p className="py-2 text-center text-sm text-muted-foreground">
              No {fieldLabel.toLowerCase()} options yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {options.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center gap-3 rounded-lg border p-2"
                >
                  <span
                    className={cn(
                      "flex-1 text-sm",
                      !o.isActive && "text-muted-foreground line-through",
                    )}
                  >
                    {o.label}
                  </span>
                  <Switch
                    checked={o.isActive}
                    onCheckedChange={(v) =>
                      update({ id: o.id, isActive: v })
                        .unwrap()
                        .catch((e) => toast.error(apiError(e)))
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      remove(o.id)
                        .unwrap()
                        .catch((e) => toast.error(apiError(e)))
                    }
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
