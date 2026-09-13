"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export function SystemSettingsClient() {
  const { toast } = useToast();
  
  // TODO: Backend persistence in future release - SystemSettings model not in V1
  const [settings, setSettings] = useState({
    seasonStart: "2026-07-01",
    seasonEnd: "2027-04-30",
    minCgpaFloor: "5.0",
    allowMultipleApplications: true,
    requireEmailVerification: true,
  });

  function updateSetting(field: string, value: string | boolean) {
    setSettings((prev) => ({ ...prev, [field]: value }));
  }

  function handleSave() {
    // TODO: Backend implementation - persist to SystemSettings model
    // For V1: Store in component state only (session-scoped)
    toast({
      title: "Settings saved",
      description: "Stored locally for this session — persistence coming in future update",
    });
  }

  return (
    <>
      {/* Placement Season */}
      <div className="card" style={{ maxWidth: 600, marginBottom: 20 }}>
        <h3 className="section-title" style={{ marginBottom: 12 }}>
          Placement Season
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="field">
            <label htmlFor="seasonStart">Season Start Date</label>
            <input
              id="seasonStart"
              type="date"
              className="input"
              value={settings.seasonStart}
              onChange={(e) => updateSetting("seasonStart", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="seasonEnd">Season End Date</label>
            <input
              id="seasonEnd"
              type="date"
              className="input"
              value={settings.seasonEnd}
              onChange={(e) => updateSetting("seasonEnd", e.target.value)}
            />
          </div>
        </div>
        <div className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
          Define the active placement season for the institution
        </div>
      </div>

      {/* Eligibility Defaults */}
      <div className="card" style={{ maxWidth: 600, marginBottom: 20 }}>
        <h3 className="section-title" style={{ marginBottom: 12 }}>
          Eligibility Defaults
        </h3>
        <div className="field" style={{ marginBottom: 16 }}>
          <label htmlFor="minCgpaFloor">Institution-wide Minimum CGPA Floor</label>
          <input
            id="minCgpaFloor"
            type="number"
            step="0.1"
            min="0"
            max="10"
            className="input"
            value={settings.minCgpaFloor}
            onChange={(e) => updateSetting("minCgpaFloor", e.target.value)}
            style={{ maxWidth: 200 }}
          />
          <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
            Students below this CGPA may not be eligible for most drives
          </div>
        </div>

        {/* Toggle: Multiple Applications */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
            borderTop: '1px solid var(--border)',
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>
              Allow Multiple Applications
            </div>
            <div className="text-muted" style={{ fontSize: 12 }}>
              Students can apply to multiple drives simultaneously
            </div>
          </div>
          <button
            type="button"
            className={`toggle-switch ${settings.allowMultipleApplications ? 'on' : ''}`}
            onClick={() =>
              updateSetting("allowMultipleApplications", !settings.allowMultipleApplications)
            }
            aria-label="Toggle multiple applications"
          >
            <span className="knob" />
          </button>
        </div>

        {/* Toggle: Email Verification */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
            borderTop: '1px solid var(--border)',
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>
              Require Email Domain Verification
            </div>
            <div className="text-muted" style={{ fontSize: 12 }}>
              Only allow official institution email addresses (@college.edu)
            </div>
          </div>
          <button
            type="button"
            className={`toggle-switch ${settings.requireEmailVerification ? 'on' : ''}`}
            onClick={() =>
              updateSetting("requireEmailVerification", !settings.requireEmailVerification)
            }
            aria-label="Toggle email verification"
          >
            <span className="knob" />
          </button>
        </div>
      </div>

      {/* Save Button */}
      <button type="button" className="btn btn-primary" onClick={handleSave}>
        Save Settings
      </button>

      {/* Developer Note */}
      <div
        className="card"
        style={{
          maxWidth: 600,
          marginTop: 20,
          backgroundColor: 'var(--surface-hover)',
          border: '1px dashed var(--border)',
        }}
      >
        <div style={{ fontSize: 12 }} className="text-muted">
          <strong>Note:</strong> System settings persistence is planned for a future release.
          Currently, changes are stored in browser session state only and will reset on page
          refresh. Backend implementation requires a <code>SystemSettings</code> model.
        </div>
      </div>
    </>
  );
}
