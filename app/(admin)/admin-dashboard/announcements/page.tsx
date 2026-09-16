import { requireDepartmentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AnnouncementsClient } from "./announcements-client";

// Every query here is scoped to the signed-in admin's department, so this
// page can never be prerendered - it has no meaning without a session.
export const dynamic = 'force-dynamic';


export default async function AnnouncementsPage() {
  const { department } = await requireDepartmentAdmin();

  // Fetch recent announcements sent by this dept
  const recentAnnouncements = await prisma.notification.findMany({
    where: {
      type: "ADMIN",
      resourceType: "ANNOUNCEMENT",
      resourceId: department.id,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      title: true,
      message: true,
      createdAt: true,
    },
  });

  // Count recipients for each (all non-pending students in dept)
  const studentCount = await prisma.student.count({
    where: {
      departmentId: department.id,
      isPending: false,
      userId: { not: null },
    },
  });

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Announcements</h1>
        <p className="text-secondary" style={{ fontSize: 13, margin: "4px 0 0" }}>
          Send notifications to all students in {department.name} department
        </p>
      </div>

      <AnnouncementsClient
        departmentName={department.name}
        studentCount={studentCount}
        recentAnnouncements={recentAnnouncements}
      />
    </div>
  );
}
