import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Plus, Trash2, Save } from 'lucide-react'
import { studentApi } from '@/api/student'
import type { FullProfileOut, EducationOut, AcademicRecordOut, StudentSkillOut, ProjectOut, ExperienceOut, CertificationOut, PreferencesOut } from '@/api/student'
import { adminApi } from '@/api/admin'
import type { DepartmentOut } from '@/api/admin'
import { toast } from '@/store/toastStore'
import { getErrorMessage } from '@/utils/errors'
import Button from '@/components/common/Button'
import Input, { Select, Textarea } from '@/components/common/Input'
import { SkeletonCard } from '@/components/common/Skeleton'
import clsx from 'clsx'

type Tab = 'personal' | 'academic' | 'skills' | 'projects' | 'experience' | 'certifications' | 'preferences'

const TABS: { id: Tab; label: string }[] = [
  { id: 'personal',       label: 'Personal info' },
  { id: 'academic',       label: 'Academic info' },
  { id: 'skills',         label: 'Skills & links' },
  { id: 'projects',       label: 'Projects' },
  { id: 'experience',     label: 'Experience' },
  { id: 'certifications', label: 'Certifications' },
  { id: 'preferences',    label: 'Preferences' },
]

export default function StudentProfile() {
  const [activeTab, setActiveTab] = useState<Tab>('personal')
  const [data, setData]           = useState<FullProfileOut | null>(null)
  const [departments, setDepts]   = useState<DepartmentOut[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    Promise.all([
      studentApi.getFullProfile(),
      adminApi.listDepartments(),
    ]).then(([profRes, deptRes]) => {
      setData(profRes.data)
      setDepts(deptRes.data)
    }).catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="space-y-4"><SkeletonCard /><SkeletonCard /></div>
  if (!data)   return <p className="text-text-secondary text-sm">Could not load profile.</p>

  return (
    <div className="anim-fade-up">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">My Profile</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Profile {data.profile.profile_completion_percentage}% complete
          </p>
        </div>
        {/* Completion bar */}
        <div className="hidden sm:flex items-center gap-3">
          <div className="w-32 progress-track">
            <div className="progress-fill bg-accent" style={{ width: `${data.profile.profile_completion_percentage}%` }} />
          </div>
          <span className="text-xs font-medium text-accent">{data.profile.profile_completion_percentage}%</span>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* Sidebar tabs */}
        <aside className="hidden md:flex flex-col w-44 flex-shrink-0 gap-0.5 sticky top-6">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={clsx(
                'text-left px-3 py-2 rounded text-sm transition-all duration-150',
                activeTab === t.id
                  ? 'bg-accent-light text-accent-dark font-medium'
                  : 'text-text-secondary hover:bg-surface-1 hover:translate-x-0.5'
              )}
            >
              {t.label}
            </button>
          ))}
        </aside>

        {/* Mobile tab select */}
        <div className="md:hidden w-full mb-4">
          <select
            value={activeTab}
            onChange={e => setActiveTab(e.target.value as Tab)}
            className="ch-input"
          >
            {TABS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>

        {/* Tab panels */}
        <div className="flex-1 min-w-0 anim-fade-up">
          {activeTab === 'personal' && (
            <PersonalTab data={data} departments={departments} onSave={d => setData(d)} />
          )}
          {activeTab === 'academic' && (
            <AcademicTab data={data} onSave={d => setData(d)} />
          )}
          {activeTab === 'skills' && (
            <SkillsTab data={data} onSave={d => setData(d)} />
          )}
          {activeTab === 'projects' && (
            <ProjectsTab data={data} onSave={d => setData(d)} />
          )}
          {activeTab === 'experience' && (
            <ExperienceTab data={data} onSave={d => setData(d)} />
          )}
          {activeTab === 'certifications' && (
            <CertificationsTab data={data} onSave={d => setData(d)} />
          )}
          {activeTab === 'preferences' && (
            <PreferencesTab data={data} onSave={d => setData(d)} />
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   PERSONAL INFO TAB
───────────────────────────────────────────────────────────────────────────── */
function PersonalTab({ data, departments, onSave }: { data: FullProfileOut; departments: DepartmentOut[]; onSave: (d: FullProfileOut) => void }) {
  const p = data.profile
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      full_name:      p.full_name,
      phone_number:   p.phone_number ?? '',
      alternate_email:p.alternate_email ?? '',
      date_of_birth:  p.date_of_birth ?? '',
      gender:         p.gender ?? '',
      address:        p.address ?? '',
    }
  })
  const [saving, setSaving] = useState(false)

  const onSubmit = async (values: any) => {
    setSaving(true)
    try {
      await studentApi.updateProfile(values)
      const res = await studentApi.getFullProfile()
      onSave(res.data)
      toast.success('Personal info saved!')
    } catch (err) { toast.error(getErrorMessage(err)) }
    finally { setSaving(false) }
  }

  const genderOpts = [
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
    { value: 'Other', label: 'Other' },
    { value: 'Prefer not to say', label: 'Prefer not to say' },
  ]

  const dept = departments.find(d => d.id === p.department_id)

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <SectionHead title="Personal information" sub="Basic details from your registration." />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Full name" error={errors.full_name?.message as string}
          {...register('full_name', { required: 'Required' })} />
        <Input label="Phone number" type="tel" {...register('phone_number')} />
        <Input label="Alternate email" type="email" {...register('alternate_email')} />
        <Input label="Date of birth" type="date" {...register('date_of_birth')} />
        <Select label="Gender" options={genderOpts} placeholder="Select gender" {...register('gender')} />
        <div className="sm:col-span-2">
          <Textarea label="Address" rows={2} {...register('address')} />
        </div>
      </div>

      {/* Read-only info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-surface-1 rounded-xl">
        <ReadOnly label="Roll number" value={p.roll_number} />
        <ReadOnly label="Department" value={dept ? `${dept.department_name} (${dept.department_code})` : '—'} />
        <ReadOnly label="Year" value={`${p.current_year}${['st','nd','rd','th'][p.current_year - 1] ?? 'th'} Year, Sem ${p.current_semester}`} />
      </div>

      <SaveBtn loading={saving} />
    </form>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   ACADEMIC INFO TAB
───────────────────────────────────────────────────────────────────────────── */
function AcademicTab({ data, onSave }: { data: FullProfileOut; onSave: (d: FullProfileOut) => void }) {
  const [saving, setSaving] = useState(false)

  // Education: 10th, 12th
  const [edu, setEdu] = useState<Omit<EducationOut, 'id' | 'student_id'>[]>(
    data.education.length > 0 ? data.education : [
      { education_level: '10TH',  percentage: undefined, cgpa: undefined, board: '', passing_year: undefined },
      { education_level: '12TH',  percentage: undefined, cgpa: undefined, board: '', passing_year: undefined },
    ]
  )

  // Semester records
  const [sems, setSems] = useState<Omit<AcademicRecordOut, 'id' | 'student_id'>[]>(
    data.academic_records.length > 0
      ? data.academic_records
      : Array.from({ length: 8 }, (_, i) => ({ semester: i + 1, cgpa: undefined, active_backlogs: 0, total_backlogs_cleared: 0 }))
  )

  const save = async () => {
    setSaving(true)
    try {
      await studentApi.upsertEducation(edu as any)
      await studentApi.upsertAcademicRecords(sems as any)
      const res = await studentApi.getFullProfile()
      onSave(res.data)
      toast.success('Academic info saved!')
    } catch (err) { toast.error(getErrorMessage(err)) }
    finally { setSaving(false) }
  }

  const levelLabel: Record<string, string> = { '10TH': '10th Standard', '12TH': '12th / PUC', 'DIPLOMA': 'Diploma' }

  return (
    <div className="space-y-6">
      <SectionHead title="Academic information" sub="10th, 12th and semester-wise CGPA." />

      {/* Education cards */}
      <div className="space-y-3">
        {edu.map((e, i) => (
          <div key={i} className="bg-surface-2 border border-border rounded-xl p-4">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">{levelLabel[e.education_level] ?? e.education_level}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Input label="Board / University" value={e.board ?? ''} onChange={v => { const n=[...edu]; n[i]={...n[i],board:v.target.value}; setEdu(n) }} />
              <Input label="Passing year" type="number" value={e.passing_year ?? ''} onChange={v => { const n=[...edu]; n[i]={...n[i],passing_year:+v.target.value}; setEdu(n) }} />
              <Input label="Percentage (%)" type="number" step="0.01" value={e.percentage ?? ''} onChange={v => { const n=[...edu]; n[i]={...n[i],percentage:+v.target.value}; setEdu(n) }} />
              <Input label="CGPA" type="number" step="0.01" value={e.cgpa ?? ''} onChange={v => { const n=[...edu]; n[i]={...n[i],cgpa:+v.target.value}; setEdu(n) }} />
            </div>
          </div>
        ))}
      </div>

      {/* Semester records */}
      <div>
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Semester-wise CGPA</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {sems.map((s, i) => (
            <div key={i} className="bg-surface-1 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-text-secondary">Semester {s.semester}</p>
              <Input
                label="CGPA"
                type="number" step="0.01" min="0" max="10"
                placeholder="0.00"
                value={s.cgpa ?? ''}
                onChange={v => { const n=[...sems]; n[i]={...n[i],cgpa:v.target.value?+v.target.value:undefined as any}; setSems(n) }}
              />
              <Input
                label="Active backlogs"
                type="number" min="0"
                value={s.active_backlogs}
                onChange={v => { const n=[...sems]; n[i]={...n[i],active_backlogs:+v.target.value}; setSems(n) }}
              />
            </div>
          ))}
        </div>
      </div>

      <SaveBtn loading={saving} onClick={save} />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   SKILLS TAB
───────────────────────────────────────────────────────────────────────────── */
function SkillsTab({ data, onSave }: { data: FullProfileOut; onSave: (d: FullProfileOut) => void }) {
  const [saving, setSaving] = useState(false)
  const [techInput, setTechInput] = useState('')
  const [softInput, setSoftInput] = useState('')
  const [techSkills, setTechSkills] = useState<string[]>(
    data.skills.filter(s => s.skill.category === 'TECHNICAL').map(s => s.skill.name)
  )
  const [softSkills, setSoftSkills] = useState<string[]>(
    data.skills.filter(s => s.skill.category !== 'TECHNICAL').map(s => s.skill.name)
  )

  const addTag = (input: string, setter: (v: string[]) => void, list: string[]) => {
    const val = input.trim()
    if (val && !list.includes(val)) setter([...list, val])
  }

  const save = async () => {
    setSaving(true)
    try {
      const items = [
        ...techSkills.map(n => ({ skill_name: n, category: 'TECHNICAL' })),
        ...softSkills.map(n => ({ skill_name: n, category: 'SOFT' })),
      ]
      await studentApi.syncSkills(items)
      const res = await studentApi.getFullProfile()
      onSave(res.data)
      toast.success('Skills saved!')
    } catch (err) { toast.error(getErrorMessage(err)) }
    finally { setSaving(false) }
  }

  const TagInput = ({ label, input, setInput, tags, setTags }: any) => (
    <div>
      <p className="ch-label">{label}</p>
      <div className="flex flex-wrap gap-2 p-2.5 border border-border-strong rounded-lg min-h-[44px]">
        {tags.map((t: string) => (
          <span key={t} className="flex items-center gap-1 bg-surface-1 text-text-primary text-xs px-2 py-1 rounded-md">
            {t}
            <button type="button" onClick={() => setTags(tags.filter((x: string) => x !== t))} className="text-text-muted hover:text-danger ml-0.5">×</button>
          </span>
        ))}
        <input
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(input, setTags, tags); setInput('') } }}
          placeholder="Type & press Enter"
          className="border-none outline-none text-xs flex-1 min-w-[120px] bg-transparent"
        />
      </div>
      <p className="text-xs text-text-muted mt-1">Press Enter or comma to add</p>
    </div>
  )

  return (
    <div className="space-y-5">
      <SectionHead title="Skills & links" sub="Technical skills, soft skills and your online profiles." />
      <TagInput label="Technical skills" input={techInput} setInput={setTechInput} tags={techSkills} setTags={setTechSkills} />
      <TagInput label="Soft skills" input={softInput} setInput={setSoftInput} tags={softSkills} setTags={setSoftSkills} />
      <SaveBtn loading={saving} onClick={save} />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   PROJECTS TAB
───────────────────────────────────────────────────────────────────────────── */
function ProjectsTab({ data, onSave }: { data: FullProfileOut; onSave: (d: FullProfileOut) => void }) {
  const [saving, setSaving] = useState(false)
  const blank = () => ({ title: '', description: '', project_link: '', start_date: '', end_date: '', technologies: [] as string[], _techInput: '' })
  const [items, setItems] = useState(
    data.projects.length > 0
      ? data.projects.map(p => ({ title: p.title, description: p.description ?? '', project_link: p.project_link ?? '', start_date: p.start_date ?? '', end_date: p.end_date ?? '', technologies: p.technologies.map(t => t.name), _techInput: '' }))
      : [blank()]
  )

  const update = (i: number, field: string, val: any) => {
    setItems(prev => { const n = [...prev]; (n[i] as any)[field] = val; return n })
  }
  const addTech = (i: number) => {
    const val = items[i]._techInput.trim()
    if (val && !items[i].technologies.includes(val)) {
      update(i, 'technologies', [...items[i].technologies, val])
      update(i, '_techInput', '')
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      await studentApi.syncProjects(items.map(({ _techInput, ...p }) => p))
      const res = await studentApi.getFullProfile()
      onSave(res.data)
      toast.success('Projects saved!')
    } catch (err) { toast.error(getErrorMessage(err)) }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <SectionHead title="Projects"sub="Showcase your technical projects." action={
        <Button size="sm" icon={<Plus size={13} />} onClick={() => setItems([...items, blank()])}>Add project</Button>
      } />
      {items.map((p, i) => (
        <div key={i} className="bg-surface-2 border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-text-secondary">Project {i + 1}</p>
            {items.length > 1 && (
              <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-text-muted hover:text-danger">
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <Input label="Project title" value={p.title} onChange={e => update(i, 'title', e.target.value)} />
          <Textarea label="Description" value={p.description} onChange={e => update(i, 'description', e.target.value)} />
          <Input label="Project link (URL)" value={p.project_link} onChange={e => update(i, 'project_link', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start date" type="date" value={p.start_date} onChange={e => update(i, 'start_date', e.target.value)} />
            <Input label="End date" type="date" value={p.end_date} onChange={e => update(i, 'end_date', e.target.value)} />
          </div>
          {/* Tech tags */}
          <div>
            <p className="ch-label">Technologies used</p>
            <div className="flex flex-wrap gap-1.5 p-2 border border-border-strong rounded-lg">
              {p.technologies.map(t => (
                <span key={t} className="flex items-center gap-1 bg-purple-light text-purple text-xs px-2 py-0.5 rounded">
                  {t}<button type="button" onClick={() => update(i, 'technologies', p.technologies.filter(x => x !== t))} className="ml-0.5">×</button>
                </span>
              ))}
              <input
                value={p._techInput}
                onChange={e => update(i, '_techInput', e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTech(i) }}}
                placeholder="Add tech…" className="border-none outline-none text-xs flex-1 min-w-[100px] bg-transparent"
              />
            </div>
          </div>
        </div>
      ))}
      <SaveBtn loading={saving} onClick={save} />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   EXPERIENCE TAB
───────────────────────────────────────────────────────────────────────────── */
function ExperienceTab({ data, onSave }: { data: FullProfileOut; onSave: (d: FullProfileOut) => void }) {
  const [saving, setSaving] = useState(false)
  const blank = () => ({ company_name: '', role_title: '', start_date: '', end_date: '', description: '', currently_working: false })
  const [items, setItems] = useState(
    data.experiences.length > 0
      ? data.experiences.map(e => ({ company_name: e.company_name, role_title: e.role_title, start_date: e.start_date ?? '', end_date: e.end_date ?? '', description: e.description ?? '', currently_working: e.currently_working }))
      : [blank()]
  )

  const update = (i: number, f: string, v: any) => setItems(prev => { const n=[...prev]; (n[i] as any)[f]=v; return n })

  const save = async () => {
    setSaving(true)
    try {
      await studentApi.syncExperiences(items as any)
      const res = await studentApi.getFullProfile(); onSave(res.data)
      toast.success('Experience saved!')
    } catch (err) { toast.error(getErrorMessage(err)) }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <SectionHead title="Experience" sub="Internships and work experience." action={
        <Button size="sm" icon={<Plus size={13} />} onClick={() => setItems([...items, blank()])}>Add entry</Button>
      } />
      {items.map((e, i) => (
        <div key={i} className="bg-surface-2 border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-text-secondary">Entry {i + 1}</p>
            {items.length > 1 && <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-text-muted hover:text-danger"><Trash2 size={14} /></button>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Company name" value={e.company_name} onChange={ev => update(i, 'company_name', ev.target.value)} />
            <Input label="Role / Title" value={e.role_title} onChange={ev => update(i, 'role_title', ev.target.value)} />
            <Input label="Start date" type="date" value={e.start_date} onChange={ev => update(i, 'start_date', ev.target.value)} />
            {!e.currently_working && <Input label="End date" type="date" value={e.end_date} onChange={ev => update(i, 'end_date', ev.target.value)} />}
          </div>
          <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
            <input type="checkbox" checked={e.currently_working} onChange={ev => update(i, 'currently_working', ev.target.checked)} className="rounded" />
            Currently working here
          </label>
          <Textarea label="Description" value={e.description} onChange={ev => update(i, 'description', ev.target.value)} />
        </div>
      ))}
      <SaveBtn loading={saving} onClick={save} />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   CERTIFICATIONS TAB
───────────────────────────────────────────────────────────────────────────── */
function CertificationsTab({ data, onSave }: { data: FullProfileOut; onSave: (d: FullProfileOut) => void }) {
  const [saving, setSaving] = useState(false)
  const blank = () => ({ title: '', issuing_organization: '', date_issued: '', credential_url: '' })
  const [items, setItems] = useState(
    data.certifications.length > 0
      ? data.certifications.map(c => ({ title: c.title, issuing_organization: c.issuing_organization ?? '', date_issued: c.date_issued ?? '', credential_url: c.credential_url ?? '' }))
      : [blank()]
  )

  const update = (i: number, f: string, v: string) => setItems(prev => { const n=[...prev]; (n[i] as any)[f]=v; return n })

  const save = async () => {
    setSaving(true)
    try {
      await studentApi.syncCertifications(items as any)
      const res = await studentApi.getFullProfile(); onSave(res.data)
      toast.success('Certifications saved!')
    } catch (err) { toast.error(getErrorMessage(err)) }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <SectionHead title="Certifications" sub="Professional certifications and courses." action={
        <Button size="sm" icon={<Plus size={13} />} onClick={() => setItems([...items, blank()])}>Add entry</Button>
      } />
      {items.map((c, i) => (
        <div key={i} className="bg-surface-2 border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-text-secondary">Certification {i + 1}</p>
            {items.length > 1 && <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-text-muted hover:text-danger"><Trash2 size={14} /></button>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Title" value={c.title} onChange={e => update(i, 'title', e.target.value)} />
            <Input label="Issuing organization" value={c.issuing_organization} onChange={e => update(i, 'issuing_organization', e.target.value)} />
            <Input label="Date issued" type="date" value={c.date_issued} onChange={e => update(i, 'date_issued', e.target.value)} />
            <Input label="Credential URL" type="url" value={c.credential_url} onChange={e => update(i, 'credential_url', e.target.value)} />
          </div>
        </div>
      ))}
      <SaveBtn loading={saving} onClick={save} />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   PREFERENCES TAB
───────────────────────────────────────────────────────────────────────────── */
function PreferencesTab({ data, onSave }: { data: FullProfileOut; onSave: (d: FullProfileOut) => void }) {
  const [saving, setSaving] = useState(false)
  const p = data.preferences
  const [companyType, setCompanyType] = useState(p?.preferred_company_type ?? 'NO_PREFERENCE')
  const [pkg, setPkg] = useState(p?.expected_package?.toString() ?? '')
  const [relocate, setRelocate] = useState(p?.willing_to_relocate ?? true)
  const [roleInput, setRoleInput] = useState('')
  const [locInput, setLocInput] = useState('')
  const [roles, setRoles] = useState<string[]>(p?.preferred_roles ?? [])
  const [locs, setLocs] = useState<string[]>(p?.preferred_locations ?? [])

  const companyOpts = [
    { value: 'PRODUCT', label: 'Product company' },
    { value: 'SERVICE', label: 'Service company' },
    { value: 'STARTUP', label: 'Startup' },
    { value: 'NO_PREFERENCE', label: 'No preference' },
  ]

  const addTag = (input: string, setter: (v: string[]) => void, list: string[]) => {
    const val = input.trim()
    if (val && !list.includes(val)) setter([...list, val])
  }

  const save = async () => {
    setSaving(true)
    try {
      await studentApi.updatePreferences({ preferred_company_type: companyType, expected_package: pkg ? +pkg : undefined, willing_to_relocate: relocate, preferred_roles: roles, preferred_locations: locs })
      const res = await studentApi.getFullProfile(); onSave(res.data)
      toast.success('Preferences saved!')
    } catch (err) { toast.error(getErrorMessage(err)) }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      <SectionHead title="Placement preferences" sub="Help us match you with the right drives." />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select label="Preferred company type" options={companyOpts} value={companyType} onChange={e => setCompanyType(e.target.value)} />
        <Input label="Expected package (LPA)" type="number" step="0.5" value={pkg} onChange={e => setPkg(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
        <input type="checkbox" checked={relocate} onChange={e => setRelocate(e.target.checked)} className="rounded" />
        Willing to relocate
      </label>
      {/* Roles */}
      <div>
        <p className="ch-label">Preferred roles</p>
        <div className="flex flex-wrap gap-2 p-2.5 border border-border-strong rounded-lg min-h-[44px]">
          {roles.map(r => <span key={r} className="flex items-center gap-1 bg-teal-light text-teal text-xs px-2 py-0.5 rounded">{r}<button onClick={() => setRoles(roles.filter(x => x !== r))}>×</button></span>)}
          <input value={roleInput} onChange={e => setRoleInput(e.target.value)} onKeyDown={e => { if (e.key==='Enter'){e.preventDefault();addTag(roleInput,setRoles,roles);setRoleInput('')}}} placeholder="Add role…" className="border-none outline-none text-xs flex-1 min-w-[100px] bg-transparent" />
        </div>
      </div>
      {/* Locations */}
      <div>
        <p className="ch-label">Preferred locations</p>
        <div className="flex flex-wrap gap-2 p-2.5 border border-border-strong rounded-lg min-h-[44px]">
          {locs.map(l => <span key={l} className="flex items-center gap-1 bg-amber-light text-amber text-xs px-2 py-0.5 rounded">{l}<button onClick={() => setLocs(locs.filter(x => x !== l))}>×</button></span>)}
          <input value={locInput} onChange={e => setLocInput(e.target.value)} onKeyDown={e => { if (e.key==='Enter'){e.preventDefault();addTag(locInput,setLocs,locs);setLocInput('')}}} placeholder="Add city…" className="border-none outline-none text-xs flex-1 min-w-[100px] bg-transparent" />
        </div>
      </div>
      <SaveBtn loading={saving} onClick={save} />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   SHARED HELPERS
───────────────────────────────────────────────────────────────────────────── */
function SectionHead({ title, sub, action }: { title: string; sub: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
      <div>
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
        <p className="text-xs text-text-secondary mt-0.5">{sub}</p>
      </div>
      {action}
    </div>
  )
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-text-muted mb-0.5">{label}</p>
      <p className="text-sm font-medium text-text-primary">{value}</p>
    </div>
  )
}

function SaveBtn({ loading, onClick }: { loading: boolean; onClick?: () => void }) {
  return (
    <div className="flex justify-end pt-2">
      <Button variant="primary" size="md" loading={loading} onClick={onClick} icon={<Save size={14} />}>
        Save changes
      </Button>
    </div>
  )
}
