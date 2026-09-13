"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { updateCentralDriveApplicationFields } from "../actions/update-central-drive-application-fields";
import type { StoredApplicationField } from "../utils/application-fields";

interface CentralDriveFieldsToggleProps {
  driveId: string;
  fields: StoredApplicationField[];
}

export function CentralDriveFieldsToggle({
  driveId,
  fields,
}: CentralDriveFieldsToggleProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState(fields);

  // Selecting a different drive re-renders this component with new props
  useEffect(() => {
    setRows(fields);
  }, [fields]);

  function toggleField(key: string) {
    setRows((current) =>
      current.map((row) =>
        row.key === key ? { ...row, enabled: !row.enabled } : row
      )
    );
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateCentralDriveApplicationFields({
        driveId,
        fields: rows.map((row) => ({
          fieldKey: row.key,
          isEnabled: row.enabled,
        })),
      });

      if (result.success) {
        toast({
          title: "Configuration saved",
          description: "Application fields updated for this drive.",
        });
        router.refresh();
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      }
    });
  }

  return (
    <div>
      <div>
        {rows.map((row) => (
          <div className="pref-row" key={row.key}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span aria-hidden>{row.icon}</span>
              <span
                style={{
                  fontSize: 13,
                  color: row.required ? "var(--red)" : "var(--text-primary)",
                }}
              >
                {row.label}
                {row.required && (
                  <span aria-hidden style={{ marginLeft: 4 }}>
                    *
                  </span>
                )}
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={row.enabled}
              aria-label={`${row.label} ${row.enabled ? "enabled" : "disabled"}`}
              className={`toggle-switch ${row.enabled ? "on" : ""}`}
              onClick={() => toggleField(row.key)}
              disabled={isPending}
            >
              <span className="knob" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="btn btn-primary"
        style={{ marginTop: 16 }}
        onClick={handleSave}
        disabled={isPending}
      >
        {isPending ? "Saving…" : "Save Configuration"}
      </button>
    </div>
  );
}
