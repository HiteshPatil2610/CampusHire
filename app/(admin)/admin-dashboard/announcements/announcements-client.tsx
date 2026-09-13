"use client";

import { useState, useTransition } from "react";
import { broadcastDepartmentNotification } from "@/features/notifications/actions/broadcast-department-notification";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface Announcement {
  id: string;
  title: string;
  message: string;
  createdAt: Date;
}

interface AnnouncementsClientProps {
  departmentName: string;
  studentCount: number;
  recentAnnouncements: Announcement[];
}

export function AnnouncementsClient({
  departmentName,
  studentCount,
  recentAnnouncements,
}: AnnouncementsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({ title: "", message: "" });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.title.trim() || !form.message.trim()) {
      toast({
        title: "Error",
        description: "Title and message are required",
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      const result = await broadcastDepartmentNotification({
        title: form.title.trim(),
        message: form.message.trim(),
      });

      if (result.success) {
        toast({
          title: "Announcement sent!",
          description: `Notification sent to ${result.count} student${result.count !== 1 ? "s" : ""} in ${departmentName}`,
        });
        setForm({ title: "", message: "" });
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
      {/* Compose Form */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="section-title">Send New Announcement</h3>
        <p className="text-secondary" style={{ fontSize: 13, marginBottom: 16 }}>
          Broadcast notification to all {studentCount} registered student{studentCount !== 1 ? "s" : ""} in {departmentName}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Announcement Title *</label>
            <input
              required
              maxLength={200}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Important: Drive Schedule Update"
            />
          </div>

          <div className="field" style={{ marginBottom: 16 }}>
            <label>Message *</label>
            <textarea
              required
              maxLength={2000}
              rows={4}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Enter your announcement message..."
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "0.5px solid var(--border-strong)", fontSize: 13 }}
            />
            <span className="text-muted" style={{ fontSize: 11 }}>
              {form.message.length}/2000 characters
            </span>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isPending}
          >
            {isPending ? "Sending..." : `Send to all ${departmentName} students`}
          </button>
        </form>
      </div>

      {/* Recent Announcements */}
      <div className="card">
        <h3 className="section-title">Recent Announcements</h3>

        {recentAnnouncements.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-secondary)" }}>
            No announcements sent yet
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {recentAnnouncements.map((announcement) => (
              <div
                key={announcement.id}
                style={{
                  padding: "12px 14px",
                  background: "var(--surface-1)",
                  border: "0.5px solid var(--border)",
                  borderRadius: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{announcement.title}</div>
                  <span className="text-muted" style={{ fontSize: 11 }}>
                    {new Date(announcement.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="text-secondary" style={{ fontSize: 12 }}>
                  {announcement.message}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
