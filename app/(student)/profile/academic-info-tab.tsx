/**
 * Academic Information Tab Component
 * 
 * Form for editing academic information:
 * - 10th standard: percentage, board, year
 * - 12th standard: percentage, board, year
 * - Current CGPA and semester
 * - Active backlogs
 * - Semester-wise marks (optional)
 */

"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { updateAcademicInfo } from "@/features/students/actions/update-academic-info";
import type { CompleteProfile } from "@/features/students/queries/get-complete-profile";
import type { SemesterMark } from "@/features/students/schemas/profile-schemas";
import { parseSemesterMarks } from "@/features/students/schemas/profile-schemas";

export interface AcademicInfoTabProps {
  student: CompleteProfile;
}

const SEMESTER_OPTIONS = [
  { value: 1, label: '1st semester' },
  { value: 2, label: '2nd semester' },
  { value: 3, label: '3rd semester' },
  { value: 4, label: '4th semester' },
  { value: 5, label: '5th semester' },
  { value: 6, label: '6th semester' },
  { value: 7, label: '7th semester' },
  { value: 8, label: '8th semester' },
];

/**
 * AcademicInfoTab - Academic information form
 */
export function AcademicInfoTab({ student }: AcademicInfoTabProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Parse semester marks from JSON string
  const initialSemesterMarks = React.useMemo(() => {
    return parseSemesterMarks(student.academic?.semesterMarks);
  }, [student.academic?.semesterMarks]);

  // Form state
  const [formData, setFormData] = React.useState({
    tenthPercentage: student.academic?.tenthPercentage || 0,
    tenthBoard: student.academic?.tenthBoard || "",
    tenthYear: student.academic?.tenthYear || undefined,
    twelfthPercentage: student.academic?.twelfthPercentage || 0,
    twelfthBoard: student.academic?.twelfthBoard || "",
    twelfthYear: student.academic?.twelfthYear || undefined,
    currentCGPA: student.academic?.currentCGPA || 0,
    currentSemester: student.academic?.currentSemester || 7,
    activeBacklogs: student.academic?.activeBacklogs || 0,
  });

  const [semesterMarks, setSemesterMarks] = React.useState<SemesterMark[]>(initialSemesterMarks);

  /**
   * Handle form field changes
   */
  const handleChange = (field: keyof typeof formData, value: string | number | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  /**
   * Handle adding a new semester
   */
  const handleAddSemester = () => {
    const maxAllowedSem = Math.max(1, formData.currentSemester - 1);
    
    if (semesterMarks.length >= maxAllowedSem) {
      toast(
        `Cannot add results beyond Semester ${maxAllowedSem} (one below your current semester).`,
        "warning"
      );
      return;
    }

    const nextSemIndex = semesterMarks.length + 1;
    const newSem: SemesterMark = {
      label: `Sem ${nextSemIndex}`,
      sgpa: 0,
      verified: false,
    };

    setSemesterMarks(prev => [...prev, newSem]);
    toast(`Added Sem ${nextSemIndex} result row.`, "info");
  };

  /**
   * Handle semester SGPA change
   */
  const handleSemesterChange = (index: number, sgpa: number) => {
    setSemesterMarks(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], sgpa };
      return updated;
    });
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Prepare data with semester marks as JSON string
      const dataToSubmit = {
        ...formData,
        semesterMarks: semesterMarks.length > 0 ? JSON.stringify(semesterMarks) : "",
      };

      const result = await updateAcademicInfo(dataToSubmit);

      if (result.success) {
        toast(result.message, "success");
      } else {
        toast(result.error, "error");
      }
    } catch (error) {
      console.error("Error updating academic info:", error);
      toast("An unexpected error occurred. Please try again.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const maxAllowedSem = Math.max(1, formData.currentSemester - 1);

  return (
    <form onSubmit={handleSubmit}>
      <h3 className="text-xl font-semibold text-text-primary mb-6">
        Academic Credentials
      </h3>

      {/* 10th and 12th Sub-cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* 10th Standard Card */}
        <div className="bg-surface-1 border border-border rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <strong className="text-sm font-semibold text-text-primary">
              10th Secondary School
            </strong>
            <span className="text-xs font-semibold text-red">* Required</span>
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor="tenth" className="block text-xs font-medium text-text-primary mb-1">
                Percentage / CGPA *
              </label>
              <input
                id="tenth"
                type="number"
                step="0.01"
                min="0"
                max="100"
                required
                value={formData.tenthPercentage}
                onChange={(e) => handleChange("tenthPercentage", parseFloat(e.target.value) || 0)}
                placeholder="e.g., 92"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div>
              <label htmlFor="tenthBoard" className="block text-xs font-medium text-text-primary mb-1">
                Board & Year
              </label>
              <input
                id="tenthBoard"
                type="text"
                value={formData.tenthBoard}
                onChange={(e) => handleChange("tenthBoard", e.target.value)}
                placeholder="e.g., CBSE"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent mb-2"
              />
              <input
                id="tenthYear"
                type="number"
                min="1990"
                max={new Date().getFullYear()}
                value={formData.tenthYear || ""}
                onChange={(e) => handleChange("tenthYear", parseInt(e.target.value) || undefined)}
                placeholder="Year (e.g., 2019)"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>
        </div>

        {/* 12th Standard Card */}
        <div className="bg-surface-1 border border-border rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <strong className="text-sm font-semibold text-text-primary">
              12th Higher Secondary / Diploma
            </strong>
            <span className="text-xs font-semibold text-red">* Required</span>
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor="twelfth" className="block text-xs font-medium text-text-primary mb-1">
                Percentage / CGPA *
              </label>
              <input
                id="twelfth"
                type="number"
                step="0.01"
                min="0"
                max="100"
                required
                value={formData.twelfthPercentage}
                onChange={(e) => handleChange("twelfthPercentage", parseFloat(e.target.value) || 0)}
                placeholder="e.g., 89"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div>
              <label htmlFor="twelfthBoard" className="block text-xs font-medium text-text-primary mb-1">
                Board & Year
              </label>
              <input
                id="twelfthBoard"
                type="text"
                value={formData.twelfthBoard}
                onChange={(e) => handleChange("twelfthBoard", e.target.value)}
                placeholder="e.g., CBSE"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent mb-2"
              />
              <input
                id="twelfthYear"
                type="number"
                min="1990"
                max={new Date().getFullYear()}
                value={formData.twelfthYear || ""}
                onChange={(e) => handleChange("twelfthYear", parseInt(e.target.value) || undefined)}
                placeholder="Year (e.g., 2021)"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Current CGPA & Semester */}
      <div className="bg-surface-2 border border-border rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="cgpa" className="block text-sm font-medium text-text-primary mb-1">
              Current Cumulative CGPA *
            </label>
            <input
              id="cgpa"
              type="number"
              step="0.01"
              min="0"
              max="10"
              required
              value={formData.currentCGPA}
              onChange={(e) => handleChange("currentCGPA", parseFloat(e.target.value) || 0)}
              placeholder="8.4"
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label htmlFor="semester" className="block text-sm font-medium text-text-primary mb-1">
              Current Semester *
            </label>
            <select
              id="semester"
              required
              value={formData.currentSemester}
              onChange={(e) => handleChange("currentSemester", parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {SEMESTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Semester Breakdown Section */}
      <div className="bg-surface-2 border border-border rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-semibold text-text-primary">Semester Grade Breakdown</h4>
          <span className="text-xs px-2 py-1 rounded bg-accent-light text-accent-dark font-medium">
            {semesterMarks.length} of {maxAllowedSem} recorded
          </span>
        </div>

        <p className="text-xs text-text-secondary mb-4">
          ℹ️ You can add results up to Semester {maxAllowedSem} (one below your current semester)
        </p>

        {/* Semester Grid */}
        {semesterMarks.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {semesterMarks.map((sem, idx) => (
              <div
                key={idx}
                className="bg-surface-1 border border-border rounded-lg p-3"
              >
                <div className="flex justify-between items-center mb-2">
                  <strong className="text-sm">{sem.label}</strong>
                  {sem.verified ? (
                    <span className="text-xs text-teal font-semibold">✓ Verified</span>
                  ) : (
                    <span className="text-xs text-text-muted">Pending</span>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-text-secondary mb-1">SGPA</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={sem.sgpa}
                    onChange={(e) => handleSemesterChange(idx, parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 text-sm border border-border rounded bg-surface-2 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={semesterMarks.length >= maxAllowedSem}
          onClick={handleAddSemester}
        >
          + Add Semester Result
        </Button>
        {semesterMarks.length >= maxAllowedSem && (
          <p className="text-xs text-amber mt-2">
            Maximum semester results reached for your current semester.
          </p>
        )}
      </div>

      {/* Backlogs */}
      <div className="bg-surface-1 border border-border rounded-lg p-4 mb-6">
        <h4 className="font-semibold text-text-primary mb-3 text-sm">
          Backlog History & Academic Standing
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="backlogs" className="block text-sm font-medium text-text-primary mb-1">
              Active Backlogs *
            </label>
            <input
              id="backlogs"
              type="number"
              min="0"
              required
              value={formData.activeBacklogs}
              onChange={(e) => handleChange("activeBacklogs", parseInt(e.target.value) || 0)}
              placeholder="0"
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-border">
        <Button
          type="submit"
          disabled={isSubmitting}
          variant="primary"
        >
          {isSubmitting ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
