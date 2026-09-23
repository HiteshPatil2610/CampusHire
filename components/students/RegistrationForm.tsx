"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createStudent, getActiveDepartments } from "@/features/students/actions/registration";
import { batchLabel, selectablePassoutYears } from "@/features/students/utils/batch";

interface Department {
  id: string;
  name: string;
  code: string;
}

const inputClass =
  "w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent";
const labelClass = "block text-sm font-medium text-[var(--text-primary)] mb-1.5";
const hintClass = "text-xs text-[var(--text-muted)] mt-1";

/**
 * First-time student verification. The details are checked against the
 * roster the department imported, by MIS number; the email is the one the
 * student signed up with and is not asked for again.
 */
export function RegistrationForm() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    misNumber: "",
    prnNumber: "",
    name: "",
    rollNumber: "",
    departmentId: "",
    expectedPassoutYear: "",
    phoneNumber: "",
    entryType: "" as "" | "REGULAR" | "DIPLOMA",
  });

  const isDiploma = formData.entryType === "DIPLOMA";

  useEffect(() => {
    getActiveDepartments().then(setDepartments);
  }, []);

  const set = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setFormData({ ...formData, [field]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.entryType) {
      setError("Please tell us how you joined the programme");
      return;
    }
    if (!formData.expectedPassoutYear) {
      setError("Please choose your batch");
      return;
    }

    setLoading(true);
    try {
      const result = await createStudent({
        ...formData,
        entryType: formData.entryType,
        expectedPassoutYear: Number(formData.expectedPassoutYear),
        prnNumber: formData.prnNumber.trim() || undefined,
      });

      if (result.success) {
        // Either outcome is a re-render of the same route: an approved
        // student gets the dashboard, one awaiting review gets the waiting
        // screen. The server decides which, so the client just refreshes.
        router.refresh();
      } else {
        setError(result.error || "Failed to submit your details");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-0)] p-6">
      <div className="w-full max-w-md bg-[var(--surface-2)] rounded-xl border border-[var(--border)] p-8">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-2">
          Verify your student record
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Enter your details exactly as your college has them. If they match
          your department&apos;s roster you get access straight away —
          otherwise your department admin will confirm your request.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-[var(--red-light)] border border-[var(--red)] text-[var(--red)] text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="misNumber" className={labelClass}>MIS Number *</label>
            <input
              type="text"
              id="misNumber"
              required
              value={formData.misNumber}
              onChange={(e) => setFormData({ ...formData, misNumber: e.target.value.toUpperCase() })}
              className={inputClass}
              placeholder="Your MIS number"
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="name" className={labelClass}>Full Name *</label>
            <input
              type="text"
              id="name"
              required
              value={formData.name}
              onChange={set("name")}
              className={inputClass}
              placeholder="As on your college records"
            />
          </div>

          <div>
            <label htmlFor="rollNumber" className={labelClass}>Roll Number *</label>
            <input
              type="text"
              id="rollNumber"
              required
              value={formData.rollNumber}
              onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value.toUpperCase() })}
              className={inputClass}
              placeholder="Enter your roll number"
            />
          </div>

          <div>
            <label htmlFor="department" className={labelClass}>Department *</label>
            <select
              id="department"
              required
              value={formData.departmentId}
              onChange={set("departmentId")}
              className={inputClass}
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
            <label htmlFor="batch" className={labelClass}>Batch *</label>
            <select
              id="batch"
              required
              value={formData.expectedPassoutYear}
              onChange={set("expectedPassoutYear")}
              className={inputClass}
            >
              <option value="">Select your batch</option>
              {selectablePassoutYears().map((year) => (
                <option key={year} value={year}>
                  {batchLabel(year)} (passing out {year})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="entryType" className={labelClass}>How did you join this programme? *</label>
            <select
              id="entryType"
              required
              value={formData.entryType}
              onChange={set("entryType")}
              className={inputClass}
            >
              <option value="">Select an option</option>
              <option value="REGULAR">Regular — after 12th / HSC</option>
              <option value="DIPLOMA">Lateral entry — after Diploma</option>
            </select>
            <p className={hintClass}>
              {isDiploma
                ? "Your profile will ask for diploma marks instead of 12th, starting from semester 3."
                : "This decides which academic records your profile asks for. It cannot be changed later."}
            </p>
          </div>

          <div>
            <label htmlFor="phoneNumber" className={labelClass}>Phone Number *</label>
            <input
              type="tel"
              id="phoneNumber"
              required
              value={formData.phoneNumber}
              onChange={set("phoneNumber")}
              className={inputClass}
              placeholder="9876543210"
            />
            <p className={hintClass}>Used by your placement cell to reach you about drives.</p>
          </div>

          <div>
            <label htmlFor="prnNumber" className={labelClass}>PRN Number (optional)</label>
            <input
              type="text"
              id="prnNumber"
              value={formData.prnNumber}
              onChange={(e) => setFormData({ ...formData, prnNumber: e.target.value.toUpperCase() })}
              className={inputClass}
              placeholder="University PRN, if you have one"
              autoComplete="off"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--accent)] text-white py-2.5 rounded-lg font-medium hover:bg-[var(--accent-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Verifying..." : "Verify and continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
