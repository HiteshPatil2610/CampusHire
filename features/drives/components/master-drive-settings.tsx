"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import {
  DEPARTMENT_EDITABLE_FIELDS,
  DEPARTMENT_EDITABLE_FIELD_LABELS,
  normalizeEditableFields,
  type DepartmentEditableField,
} from "../domain/drive-lifecycle";
import {
  saveMasterPipeline,
  setDepartmentEditPermissions,
} from "../actions/manage-master-drive";
import { masterPipelineStages } from "@/features/recruitment/domain/master-pipeline";
import { STAGE_TYPE_LABELS, validatePipelineStages } from "@/features/recruitment/domain/pipeline";
import {
  PipelineEditor,
  fromStageDrafts,
  toStageDrafts,
  type StageDraft,
} from "@/features/recruitment/components/pipeline-editor";
import type { MasterDriveStatus } from "@prisma/client";

/**
 * The Super Admin's settings on an existing master drive: which details
 * departments may edit (LOCKED / EDITABLE), and the master recruitment
 * pipeline. Both are saved by audited server actions that re-validate
 * everything; nothing here is trusted.
 */
export function MasterDriveSettings({
  drive,
}: {
  drive: {
    id: string;
    lifecycleStatus: MasterDriveStatus;
    departmentEditableFields: string[];
    masterPipeline: string | null;
    selectionRounds: string;
  };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const frozen = drive.lifecycleStatus === "CANCELLED" || drive.lifecycleStatus === "ARCHIVED";

  const [editable, setEditable] = useState<DepartmentEditableField[]>(() =>
    normalizeEditableFields(drive.departmentEditableFields)
  );
  const permissionsDirty =
    normalizeEditableFields(editable).join() !==
    normalizeEditableFields(drive.departmentEditableFields).join();

  const current = masterPipelineStages(drive);
  const [editingPipeline, setEditingPipeline] = useState(false);
  const [drafts, setDrafts] = useState<StageDraft[]>([]);

  const report = (result: { success: boolean; error?: string; message?: string; errors?: string[] }, title: string) => {
    if (!result.success) {
      toast({
        title: "Could not save",
        description: [result.error, ...(result.errors ?? [])].filter(Boolean).join(" "),
        variant: "destructive",
      });
      return false;
    }
    toast({ title, description: result.message });
    router.refresh();
    return true;
  };

  const savePermissions = () =>
    startTransition(async () => {
      report(
        await setDepartmentEditPermissions({ driveId: drive.id, editableFields: editable }),
        "Permissions saved"
      );
    });

  const savePipeline = () =>
    startTransition(async () => {
      const ok = report(
        await saveMasterPipeline({ driveId: drive.id, stages: fromStageDrafts(drafts) }),
        "Recruitment stages saved"
      );
      if (ok) setEditingPipeline(false);
    });

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="section-title" style={{ marginBottom: 4 }}>
          Department edit permissions
        </h3>
        <p className="text-muted" style={{ fontSize: 12, marginBottom: 12 }}>
          What an assigned department may change for its own students. Locked details always show
          your value. Locking a detail a department has already changed puts your value back — on
          drives it has not published yet. Published drives never change.
        </p>
        <div style={{ display: "grid", gap: 6 }}>
          {DEPARTMENT_EDITABLE_FIELDS.map((field) => {
            const isEditable = editable.includes(field);
            return (
              <label
                key={field}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}
              >
                <span>{DEPARTMENT_EDITABLE_FIELD_LABELS[field]}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={`badge ${isEditable ? "badge-teal" : "badge-gray"}`} style={{ fontSize: 10 }}>
                    {isEditable ? "EDITABLE" : "LOCKED"}
                  </span>
                  <input
                    type="checkbox"
                    checked={isEditable}
                    disabled={frozen || isPending}
                    onChange={(e) =>
                      setEditable((list) =>
                        e.target.checked ? [...list, field] : list.filter((entry) => entry !== field)
                      )
                    }
                  />
                </span>
              </label>
            );
          })}
        </div>
        {!frozen && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ marginTop: 12 }}
            disabled={isPending || !permissionsDirty}
            onClick={savePermissions}
          >
            Save permissions
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <h3 className="section-title" style={{ margin: 0 }}>
            Recruitment stages
          </h3>
          {!frozen && !editingPipeline && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={isPending}
              onClick={() => {
                setDrafts(toStageDrafts(current));
                setEditingPipeline(true);
              }}
            >
              Edit stages
            </button>
          )}
        </div>
        <p className="text-muted" style={{ fontSize: 12, margin: "4px 0 12px" }}>
          Every department&apos;s drive starts from these. A department proposes changes for your
          approval on the Pipeline Requests page. Saving here also updates departments that have
          not published and have not changed their stages.
        </p>

        {editingPipeline ? (
          <div style={{ display: "grid", gap: 10 }}>
            <PipelineEditor drafts={drafts} onChange={setDrafts} />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={isPending || !validatePipelineStages(fromStageDrafts(drafts)).ok}
                onClick={savePipeline}
              >
                {isPending ? "Saving…" : "Save stages"}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={isPending}
                onClick={() => setEditingPipeline(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, display: "grid", gap: 4 }}>
            {current.map((stage) => (
              <li key={stage.sortOrder} style={{ opacity: stage.isEnabled ? 1 : 0.55 }}>
                <strong>{stage.name}</strong>{" "}
                <span className="text-muted" style={{ fontSize: 11 }}>
                  {STAGE_TYPE_LABELS[stage.stageType]}
                  {!stage.visibleToStudents && " · hidden from students"}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  );
}
