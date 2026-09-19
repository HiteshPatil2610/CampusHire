/**
 * Application Fields Catalog
 * 
 * Defines the catalog of student profile fields that department admins
 * can require when students apply for a campus recruitment drive.
 * All information is pre-filled from the student's profile.
 * 
 * Note: Resume-related fields removed in V1 (resume builder deferred)
 */

export interface ApplicationFieldDef {
  key: string;
  label: string;
  source: "profile" | "student_input" | "upload";
  category: string;
  icon: string;
  description?: string;
  defaultRequired: boolean;
}

/**
 * Which catalog fields a department may let students edit on the application.
 *
 * Exactly the set that was hard-coded as `EDITABLE_FIELD_KEYS` before field
 * permissions became configurable, and each defaults to EDITABLE — so every
 * existing drive behaves identically until a department changes it.
 *
 * Every other catalog field is read-only, full stop: registrar-owned records
 * (roll number, CGPA, backlogs, department, 10th/12th) because the applicant
 * must not be able to restate them, and structured or verified records
 * (projects, certifications, photo, date of birth, gender) because a free-text
 * edit box cannot represent them faithfully.
 */
export const EDITABLE_CAPABLE_KEYS: ReadonlySet<string> = new Set([
  "name",
  "email",
  "personalEmail",
  "phone",
  "linkedin",
  "github",
  "portfolio",
  "skills",
  "softSkills",
  "address",
]);

export const AVAILABLE_STUDENT_FIELDS: ApplicationFieldDef[] = [
  {
    key: "name",
    label: "Full Name",
    source: "profile",
    category: "Basic Identity",
    icon: "👤",
    description: "Student full legal name as registered in college records",
    defaultRequired: true,
  },
  {
    key: "rollNo",
    label: "Roll Number / PRN",
    source: "profile",
    category: "Basic Identity",
    icon: "🪪",
    description: "Official college roll number or registration ID",
    defaultRequired: true,
  },
  {
    key: "email",
    label: "College Domain Email",
    source: "profile",
    category: "Contact Info",
    icon: "✉️",
    description: "Verified official college email address",
    defaultRequired: true,
  },
  {
    key: "personalEmail",
    label: "Alternate / Personal Email",
    source: "profile",
    category: "Contact Info",
    icon: "📧",
    description: "Secondary email for external communication",
    defaultRequired: false,
  },
  {
    key: "phone",
    label: "Mobile Contact Number",
    source: "profile",
    category: "Contact Info",
    icon: "📞",
    description: "Primary mobile number for SMS and test alerts",
    defaultRequired: true,
  },
  {
    key: "cgpa",
    label: "Current Cumulative CGPA",
    source: "profile",
    category: "Academic Records",
    icon: "🎓",
    description: "Latest aggregate CGPA calculated across all semesters",
    defaultRequired: true,
  },
  {
    key: "backlogs",
    label: "Active Backlog Count",
    source: "profile",
    category: "Academic Records",
    icon: "⚠️",
    description: "Current uncleared backlogs as verified by dept admin",
    defaultRequired: true,
  },
  {
    key: "department",
    label: "Department / Branch",
    source: "profile",
    category: "Academic Records",
    icon: "🏛️",
    description: "Engineering department (CSE, IT, ECE, Mech, Civil, etc.)",
    defaultRequired: true,
  },
  {
    key: "tenthPct",
    label: "10th Standard Percentage",
    source: "profile",
    category: "Academic Records",
    icon: "📜",
    description: "10th Secondary School board examination percentage",
    defaultRequired: false,
  },
  {
    key: "twelfthPct",
    label: "12th / Diploma Percentage",
    source: "profile",
    category: "Academic Records",
    icon: "📜",
    description: "12th Higher Secondary / Polytechnic diploma percentage",
    defaultRequired: false,
  },
  {
    key: "skills",
    label: "Technical Skills List",
    source: "profile",
    category: "Technical Profile",
    icon: "💻",
    description: "Languages, frameworks, and databases from student profile",
    defaultRequired: false,
  },
  {
    key: "softSkills",
    label: "Soft Skills & Strengths",
    source: "profile",
    category: "Technical Profile",
    icon: "🗣️",
    description: "Communication, team leadership, and interpersonal skills",
    defaultRequired: false,
  },
  {
    key: "github",
    label: "GitHub Profile URL",
    source: "profile",
    category: "Documents & Portfolios",
    icon: "🐙",
    description: "Public GitHub developer URL showing active code repositories",
    defaultRequired: false,
  },
  {
    key: "linkedin",
    label: "LinkedIn Profile URL",
    source: "profile",
    category: "Documents & Portfolios",
    icon: "🔗",
    description: "Public professional LinkedIn URL for recruiter review",
    defaultRequired: false,
  },
  {
    key: "portfolio",
    label: "Portfolio / Website URL",
    source: "profile",
    category: "Documents & Portfolios",
    icon: "🌐",
    description: "Personal domain or project live showcase link",
    defaultRequired: false,
  },
  {
    key: "projects",
    label: "Academic & Capstone Projects",
    source: "profile",
    category: "Technical Profile",
    icon: "📁",
    description: "List of featured projects with descriptions and tech stacks",
    defaultRequired: false,
  },
  {
    key: "certifications",
    label: "Industry Certifications",
    source: "profile",
    category: "Technical Profile",
    icon: "🎖️",
    description: "AWS, Google Cloud, Oracle, or Cisco verified credentials",
    defaultRequired: false,
  },
  {
    key: "photo",
    label: "Passport Size Photo",
    source: "upload",
    category: "Documents & Portfolios",
    icon: "🖼️",
    description: "Formal digital passport photograph for admit card",
    defaultRequired: false,
  },
  {
    key: "dob",
    label: "Date of Birth",
    source: "profile",
    category: "Basic Identity",
    icon: "🎂",
    description: "Verified date of birth for age compliance checks",
    defaultRequired: false,
  },
  {
    key: "gender",
    label: "Gender",
    source: "profile",
    category: "Basic Identity",
    icon: "⚧️",
    description: "Demographic information for diversity hiring initiatives",
    defaultRequired: false,
  },
  {
    key: "address",
    label: "Current Living Address",
    source: "profile",
    category: "Contact Info",
    icon: "🏠",
    description: "Residential address and city of residence",
    defaultRequired: false,
  },
];

export interface FieldPreset {
  name: string;
  description: string;
  keys: string[];
}

export const FIELD_PRESETS: Record<string, FieldPreset> = {
  standard: {
    name: "Standard Drive (Default)",
    description:
      "Essential academic and identity fields required for almost all campus drives.",
    keys: [
      "name",
      "rollNo",
      "email",
      "phone",
      "cgpa",
      "backlogs",
      "department",
    ],
  },
  technical: {
    name: "Technical & Product Engineering",
    description:
      "Standard fields plus GitHub, coding skills, and academic project links.",
    keys: [
      "name",
      "rollNo",
      "email",
      "phone",
      "cgpa",
      "backlogs",
      "department",
      "skills",
      "github",
      "projects",
      "tenthPct",
      "twelfthPct",
    ],
  },
  full: {
    name: "Comprehensive Profile",
    description:
      "All identity, contact, academic percentages, portfolios, and certification records.",
    keys: [
      "name",
      "rollNo",
      "email",
      "phone",
      "cgpa",
      "backlogs",
      "department",
      "tenthPct",
      "twelfthPct",
      "skills",
      "github",
      "linkedin",
      "portfolio",
      "projects",
      "certifications",
      "photo",
    ],
  },
};
