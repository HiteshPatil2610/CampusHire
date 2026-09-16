"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createStudent, getActiveDepartments } from "@/features/students/actions/registration";

interface Department {
  id: string;
  name: string;
  code: string;
}

export function RegistrationForm() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    rollNumber: "",
    departmentId: "",
    phoneNumber: "",
    entryType: "" as "" | "REGULAR" | "DIPLOMA",
  });

  // A lateral-entry student may not have been issued a roll number yet, so
  // they may leave it blank here and supply it from their profile later.
  // Everyone else must provide one now.
  const isDiploma = formData.entryType === "DIPLOMA";

  // Load departments on mount
  useEffect(() => {
    async function loadDepartments() {
      const depts = await getActiveDepartments();
      setDepartments(depts);
    }
    loadDepartments();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!formData.entryType) {
        setError("Please tell us how you joined the programme");
        setLoading(false);
        return;
      }

      const result = await createStudent({
        ...formData,
        entryType: formData.entryType,
        rollNumber: formData.rollNumber.trim() || undefined,
      });

      if (result.success) {
        // Either outcome is a re-render of the same route: an approved
        // student gets the dashboard, one awaiting review gets the waiting
        // screen. The server decides which, so the client just refreshes.
        router.refresh();
      } else {
        setError(result.error || "Failed to submit your details");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-0)] p-6">
      <div className="w-full max-w-md bg-[var(--surface-2)] rounded-xl border border-[var(--border)] p-8">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-2">
          Complete Your Profile
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Please provide your details to continue. If your college has already
          added you to its placement roster, you will get access straight away
          — otherwise your department admin will confirm your request.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-[var(--red-light)] border border-[var(--red)] text-[var(--red)] text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
              Full Name *
            </label>
            <input
              type="text"
              id="name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              placeholder="Enter your full name"
            />
          </div>

          <div>
            <label htmlFor="entryType" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
              How did you join this programme? *
            </label>
            <select
              id="entryType"
              required
              value={formData.entryType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  entryType: e.target.value as "" | "REGULAR" | "DIPLOMA",
                })
              }
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
            >
              <option value="">Select an option</option>
              <option value="REGULAR">Regular — after 12th / HSC</option>
              <option value="DIPLOMA">Lateral entry — after Diploma</option>
            </select>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {isDiploma
                ? "Your profile will ask for diploma marks instead of 12th, starting from semester 3."
                : "This decides which academic records your profile asks for. It cannot be changed later."}
            </p>
          </div>

          <div>
            <label htmlFor="rollNumber" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
              Roll Number {isDiploma ? "" : "*"}
            </label>
            <input
              type="text"
              id="rollNumber"
              required={!isDiploma}
              value={formData.rollNumber}
              onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              placeholder={isDiploma ? "Leave blank if not issued yet" : "Enter your roll number"}
            />
            {isDiploma && (
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Optional for now — you can add it from your profile. You will
                not be able to apply to any drive until you do.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="department" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
              Department *
            </label>
            <select
              id="department"
              required
              value={formData.departmentId}
              onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
            >
              <option value="">Select your department</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name} ({dept.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
              Phone Number *
            </label>
            <input
              type="tel"
              id="phoneNumber"
              required
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              placeholder="+91 9876543210"
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Used by your placement cell to reach you about drives.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--accent)] text-white py-2.5 rounded-lg font-medium hover:bg-[var(--accent-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Submitting..." : "Submit details"}
          </button>
        </form>
      </div>
    </div>
  );
}
