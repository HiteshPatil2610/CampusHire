import client from './client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StudentProfileOut {
  id: string; user_id: string; full_name: string; roll_number: string
  department_id: string; current_year: number; current_semester: number
  date_of_birth?: string; gender?: string; phone_number?: string
  alternate_email?: string; address?: string; profile_photo_url?: string
  profile_completion_percentage: number; created_at: string; updated_at: string
}

export interface SkillOut { id: string; name: string; category: string }

export interface StudentSkillOut { id: string; skill: SkillOut; proficiency_level?: string }

export interface ProjectOut {
  id: string; title: string; description?: string; project_link?: string
  start_date?: string; end_date?: string; technologies: SkillOut[]
}

export interface ExperienceOut {
  id: string; student_id: string; company_name: string; role_title: string
  start_date?: string; end_date?: string; description?: string; currently_working: boolean
}

export interface CertificationOut {
  id: string; student_id: string; title: string; issuing_organization?: string
  date_issued?: string; credential_url?: string
}

export interface EducationOut {
  id: string; student_id: string; education_level: string
  percentage?: number; cgpa?: number; board?: string; passing_year?: number
}

export interface AcademicRecordOut {
  id: string; student_id: string; semester: number; cgpa?: number
  active_backlogs: number; total_backlogs_cleared: number
}

export interface PreferencesOut {
  preferred_company_type: string; expected_package?: number
  willing_to_relocate: boolean; preferred_roles: string[]; preferred_locations: string[]
}

export interface FullProfileOut {
  profile: StudentProfileOut
  education: EducationOut[]
  academic_records: AcademicRecordOut[]
  skills: StudentSkillOut[]
  projects: ProjectOut[]
  experiences: ExperienceOut[]
  certifications: CertificationOut[]
  preferences?: PreferencesOut
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const studentApi = {
  getFullProfile: () =>
    client.get<FullProfileOut>('/student/profile'),

  updateProfile: (data: Partial<StudentProfileOut>) =>
    client.patch<StudentProfileOut>('/student/profile', data),

  upsertEducation: (items: Omit<EducationOut, 'id' | 'student_id'>[]) =>
    client.put<EducationOut[]>('/student/profile/education', items),

  upsertAcademicRecords: (items: Omit<AcademicRecordOut, 'id' | 'student_id'>[]) =>
    client.put<AcademicRecordOut[]>('/student/profile/academic-records', items),

  syncSkills: (items: { skill_name: string; category?: string; proficiency_level?: string }[]) =>
    client.put<StudentSkillOut[]>('/student/profile/skills', items),

  syncProjects: (items: { title: string; description?: string; project_link?: string; start_date?: string; end_date?: string; technologies: string[] }[]) =>
    client.put<ProjectOut[]>('/student/profile/projects', items),

  syncExperiences: (items: Omit<ExperienceOut, 'id' | 'student_id'>[]) =>
    client.put<ExperienceOut[]>('/student/profile/experience', items),

  syncCertifications: (items: Omit<CertificationOut, 'id' | 'student_id'>[]) =>
    client.put<CertificationOut[]>('/student/profile/certifications', items),

  updatePreferences: (data: Partial<PreferencesOut> & { preferred_roles?: string[]; preferred_locations?: string[] }) =>
    client.put<PreferencesOut>('/student/profile/preferences', data),
}
