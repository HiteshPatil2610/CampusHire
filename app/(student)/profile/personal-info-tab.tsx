/**
 * Personal Information Tab Component
 * 
 * Form for editing personal information:
 * - Name
 * - Phone number
 * - Date of birth (with age calculation)
 * - Gender
 * - Address
 */

"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import DatePicker from "@/components/ui/date-picker";
import GenderToggle from "@/components/ui/gender-toggle";
import { useToast } from "@/components/ui/use-toast";
import { updatePersonalInfo } from "@/features/students/actions/update-personal-info";
import type { CompleteProfile } from "@/features/students/queries/get-complete-profile";

export interface PersonalInfoTabProps {
  student: CompleteProfile;
}

/**
 * Calculate age from date of birth
 */
function calculateAge(dobStr: string | null | undefined): number | null {
  if (!dobStr) return null;
  
  const birth = new Date(dobStr);
  if (isNaN(birth.getTime())) return null;
  
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age >= 0 ? age : null;
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDateToISO(date: Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split('T')[0];
}

/**
 * PersonalInfoTab - Personal information form
 */
export function PersonalInfoTab({ student }: PersonalInfoTabProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form state
  const [formData, setFormData] = React.useState({
    name: student.name || "",
    phoneNumber: student.phoneNumber || "",
    dateOfBirth: formatDateToISO(student.dateOfBirth),
    gender: student.gender || "",
    address: student.address || "",
  });

  const calculatedAge = calculateAge(formData.dateOfBirth);

  /**
   * Handle form field changes
   */
  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Cast gender to proper type for server action
      const dataToSubmit = {
        ...formData,
        gender: formData.gender as "" | "Male" | "Female" | "Other" | undefined,
      };

      const result = await updatePersonalInfo(dataToSubmit);

      if (result.success) {
        toast(result.message, "success");
      } else {
        toast(result.error, "error");
      }
    } catch (error) {
      console.error("Error updating personal info:", error);
      toast("An unexpected error occurred. Please try again.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3 className="text-xl font-semibold text-text-primary mb-6">
        Personal Information
      </h3>

      {/* Primary Email (Locked/Read-only) */}
      <div className="mb-6 p-4 bg-surface-1 border border-border rounded-lg">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✉️</span>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-text-primary">
                {student.email}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-light text-teal">
                🔒 Verified
              </span>
            </div>
            <p className="text-xs text-text-muted">
              This is your login email and cannot be changed here
            </p>
          </div>
        </div>
      </div>

      {/* Name and Date of Birth */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-text-primary mb-1">
            Full Name <span className="text-red">*</span>
          </label>
          <input
            id="name"
            type="text"
            required
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="Enter your full name"
            className="w-full px-3 py-2 border border-border rounded-lg bg-surface-2 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
          />
        </div>

        <div>
          <label htmlFor="dob" className="block text-sm font-medium text-text-primary mb-1">
            Date of Birth <span className="text-red">*</span>
          </label>
          <DatePicker
            value={formData.dateOfBirth}
            onChange={(value) => handleChange("dateOfBirth", value)}
            placeholder="Select date of birth"
          />
          {calculatedAge !== null && (
            <p className="text-xs text-text-secondary mt-1">
              🎂 Age: <strong>{calculatedAge} years old</strong>
            </p>
          )}
        </div>
      </div>

      {/* Phone Number and Gender */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-text-primary mb-1">
            Phone Number
          </label>
          <input
            id="phone"
            type="tel"
            value={formData.phoneNumber}
            onChange={(e) => handleChange("phoneNumber", e.target.value)}
            placeholder="10-digit mobile number"
            maxLength={10}
            className="w-full px-3 py-2 border border-border rounded-lg bg-surface-2 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
          />
          <p className="text-xs text-text-secondary mt-1">
            Enter 10-digit number without country code
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">
            Gender
          </label>
          <GenderToggle
            value={formData.gender}
            onChange={(value) => handleChange("gender", value)}
          />
        </div>
      </div>

      {/* Address */}
      <div className="mb-6">
        <label htmlFor="address" className="block text-sm font-medium text-text-primary mb-1">
          Current Address
        </label>
        <textarea
          id="address"
          rows={3}
          value={formData.address}
          onChange={(e) => handleChange("address", e.target.value)}
          placeholder="Enter your current residential address"
          className="w-full px-3 py-2 border border-border rounded-lg bg-surface-2 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent resize-none"
        />
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
