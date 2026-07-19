import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  useCreateCustomCakeOptionMutation,
  useDeleteCustomCakeOptionMutation,
  useListCustomCakeOptionsQuery,
  useUpdateCustomCakeOptionMutation,
  CUSTOM_CAKE_FIELD_LABELS,
  CUSTOM_CAKE_OPTION_FIELDS,
} from "@/features/api/customCakeApi";
import { apiError } from "@/lib/apiError";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export function CustomCakeOptionsDialog({
  shopId,
  open,
  onOpenChange,
}: {
  shopId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [field, setField] = useState<string>(CUSTOM_CAKE_OPTION_FIELDS[0]);
  const [label, setLabel] = useState("");

  const { data, isLoading } = useListCustomCakeOptionsQuery(shopId, {
    skip: !shopId || !open,
  });
  const [create, createState] = useCreateCustomCakeOptionMutation();
  const [update] = useUpdateCustomCakeOptionMutation();
  const [remove] = useDeleteCustomCakeOptionMutation();

  const forField = useMemo(
    () => (data ?? []).filter((o) => o.fieldKey === field),
    [data, field],
  );

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Custom cake form options</DialogTitle>
          <DialogDescription>
            Manage the dropdown choices shoppers pick from when requesting a
            custom cake.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Select value={field} onValueChange={setField}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CUSTOM_CAKE_OPTION_FIELDS.map((f) => (
                <SelectItem key={f} value={f}>
                  {CUSTOM_CAKE_FIELD_LABELS[f] ?? f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onAdd()}
              placeholder={`New ${(CUSTOM_CAKE_FIELD_LABELS[field] ?? field).toLowerCase()} option`}
            />
            <Button onClick={onAdd} disabled={createState.isLoading}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : forField.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No options for this field yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {forField.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center gap-3 rounded-lg border p-2"
                >
                  <span className="flex-1 text-sm">{o.label}</span>
                  <Switch
                    checked={o.isActive}
                    onCheckedChange={(v) =>
                      update({ id: o.id, isActive: v }).unwrap().catch((e) =>
                        toast.error(apiError(e)),
                      )
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      remove(o.id).unwrap().catch((e) => toast.error(apiError(e)))
                    }
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
