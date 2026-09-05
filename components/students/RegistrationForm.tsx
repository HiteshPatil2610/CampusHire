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
  });

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
      const result = await createStudent(formData);

      if (result.success) {
        // Refresh the page to show the dashboard
        router.refresh();
      } else {
        setError(result.error || "Failed to complete registration");
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
          Please provide your details to continue
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
            <label htmlFor="rollNumber" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
              Roll Number *
            </label>
            <input
              type="text"
              id="rollNumber"
              required
              value={formData.rollNumber}
              onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              placeholder="Enter your roll number"
            />
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
              Phone Number
            </label>
            <input
              type="tel"
              id="phoneNumber"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              placeholder="+91 9876543210"
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">Optional</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--accent)] text-white py-2.5 rounded-lg font-medium hover:bg-[var(--accent-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Completing Registration..." : "Complete Registration"}
          </button>
        </form>
      </div>
    </div>
  );
}
