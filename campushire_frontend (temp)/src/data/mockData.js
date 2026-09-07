/* ============================================================
   CampusHire — Mock / Seed Data (mockData.js)
   Single source of truth for all demo content
   ============================================================ */

/* ── Student ──────────────────────────────────────────────── */
export const STUDENT = {
  id: 'CS0142',
  name: 'Aditi Sharma',
  initials: 'AS',
  email: 'aditi.sharma@college.edu',
  personalEmail: 'aditi.personal@gmail.com',
  phone: '98765 43210',
  dob: '2004-03-12',
  gender: 'Female',
  address: 'Flat 402, Green Glen Layout, Bellandur, Bengaluru',
  department: 'CSE',
  year: '4th',
  rollNo: 'CS0142',
  linkedin: 'https://linkedin.com/in/aditi-sharma-cs',
  github: 'https://github.com/aditisharma',
  portfolio: 'https://aditi-portfolio.dev',

  // Academic
  cgpa: 8.4,
  semester: '7th',
  tenth: '92%',
  tenthBoard: 'CBSE, 2019',
  twelfth: '89%',
  twelfthBoard: 'CBSE, 2021',
  activeBacklogs: 'No',
  backlogHistory: 0,
  semesters: [
    { label: 'Sem 1', sgpa: 8.1, verified: true },
    { label: 'Sem 2', sgpa: 8.3, verified: true },
    { label: 'Sem 3', sgpa: 8.6, verified: true },
    { label: 'Sem 4', sgpa: 8.4, verified: true },
    { label: 'Sem 5', sgpa: 8.5, verified: true },
    { label: 'Sem 6', sgpa: 8.5, verified: true }
  ],

  // Skills
  technicalSkills: ['Java', 'React', 'SQL', 'TypeScript', 'Node.js', 'Git', 'Data Structures', 'Spring Boot'],
  softSkills: ['Public Speaking', 'Team Leadership', 'Problem Solving', 'Technical Writing'],

  // Projects
  projects: [
    {
      id: 1,
      title: 'Campus event scheduler',
      description: 'A React + Node app to schedule and manage campus club events with calendar sync and RSVP notifications.',
      tech: 'React, Node.js, MongoDB, Express',
      link: 'https://github.com/aditisharma/campus-events'
    },
    {
      id: 2,
      title: 'Decentralized Peer Credential Verifier',
      description: 'Built cryptographic credential verification for academic marksheets reducing manual verification by 80%.',
      tech: 'Solidity, Web3.js, React, Ethereum',
      link: 'https://github.com/aditisharma/cred-verifier'
    }
  ],

  // Experience
  experience: [
    {
      id: 1,
      company: 'InnoTech Labs',
      role: 'Full Stack Engineering Intern',
      start: '2025-06-01',
      end: '2025-08-15',
      description: 'Developed 6 REST endpoints handling 10k daily requests and optimized SQL queries reducing latency by 35%.'
    }
  ],

  // Certifications
  certifications: [
    {
      id: 1,
      title: 'AWS Certified Cloud Practitioner',
      issuer: 'Amazon Web Services',
      date: '2025-02-10',
      link: 'https://aws.amazon.com/verify/AWS-CCP-9812'
    },
    {
      id: 2,
      title: 'Meta Frontend Developer Professional',
      issuer: 'Coursera / Meta',
      date: '2024-11-20',
      link: 'https://coursera.org/verify/META-FE-449'
    }
  ],

  // Preferences
  preferredRoles: ['Frontend Developer', 'Software Engineer', 'Product roles', 'Full Stack Developer'],
  preferredLocations: ['Bangalore', 'Hyderabad', 'Remote', 'Pune'],
  companyType: 'Product',
  expectedPackage: '8-12 LPA',
  relocate: 'Yes',
  workMode: ['On-site'],
  attachedFiles: {
    tenthMarksheet: '10th_marksheet_verified.pdf',
    twelfthMarksheet: '12th_marksheet_verified.pdf',
    'sem-1': 'sem1_gradecard.pdf',
    'sem-2': 'sem2_gradecard.pdf',
    'sem-3': 'sem3_gradecard.pdf',
    'sem-4': 'sem4_gradecard.pdf',
    'sem-5': 'sem5_gradecard.pdf',
    'sem-6': 'sem6_gradecard.pdf',
    'exp-1': 'InnoTech_Offer_Certificate.pdf'
  },

  // Scores
  profileCompletion: 72,
  readinessScore: 78,
  resumeScore: 64,
  placementBadge: 'Ready for TCS & Infosys'
};

/* ── Dept Admin ───────────────────────────────────────────── */
export const DEPT_ADMIN = {
  name: 'Prof. S. R. Deshmukh',
  initials: 'SD',
  email: 'cse.admin@college.edu',
  role: 'CSE Dept Admin',
  department: 'CSE'
};

/* ── Super Admin ──────────────────────────────────────────── */
export const SUPER_ADMIN = {
  name: 'Dr. V. K. Raman',
  initials: 'VR',
  email: 'tpo.head@college.edu',
  role: 'Chief Placement Officer'
};

/* ── Students List (Admin) ────────────────────────────────── */
export const STUDENTS_LIST = [
  // Computer Engineering / COMPS / CSE
  {
    id: 'CS0142',
    name: 'Aditi Sharma',
    roll: 'CS0142',
    dept: 'CSE',
    year: '4th',
    cgpa: 8.4,
    readiness: 78,
    email: 'aditi.sharma@college.edu',
    phone: '98765 43210',
    backlogs: 0,
    status: 'eligible',
    tenth: '92%',
    twelfth: '89%',
    resumeScore: 64,
    skills: ['Java', 'React', 'SQL', 'TypeScript', 'Data Structures'],
    github: 'https://github.com/aditisharma',
    linkedin: 'https://linkedin.com/in/aditi-sharma-cs',
  },
  {
    id: 'CS0143',
    name: 'Rohan Mehta',
    roll: 'CS0143',
    dept: 'CSE',
    year: '4th',
    cgpa: 7.1,
    readiness: 52,
    email: 'rohan.mehta@college.edu',
    phone: '98231 11223',
    backlogs: 1,
    status: 'attention_needed',
    tenth: '81%',
    twelfth: '74%',
    resumeScore: 58,
    skills: ['Python', 'Django', 'PostgreSQL'],
    github: 'https://github.com/rohanmehta',
    linkedin: 'https://linkedin.com/in/rohan-mehta',
  },
  {
    id: 'CS0145',
    name: 'Ananya Sen',
    roll: 'CS0145',
    dept: 'CSE',
    year: '4th',
    cgpa: 9.2,
    readiness: 92,
    email: 'ananya.sen@college.edu',
    phone: '99345 67890',
    backlogs: 0,
    status: 'placed',
    tenth: '96%',
    twelfth: '94%',
    resumeScore: 91,
    skills: ['Go', 'Kubernetes', 'C++', 'System Design', 'React'],
    github: 'https://github.com/ananyasen',
    linkedin: 'https://linkedin.com/in/ananya-sen',
  },
  {
    id: 'CS0146',
    name: 'Rahul Verma',
    roll: 'CS0146',
    dept: 'CSE',
    year: '3rd',
    cgpa: 7.8,
    readiness: 71,
    email: 'rahul.verma@college.edu',
    phone: '97654 32198',
    backlogs: 0,
    status: 'eligible',
    tenth: '86%',
    twelfth: '82%',
    resumeScore: 72,
    skills: ['JavaScript', 'Node.js', 'Express', 'MongoDB'],
    github: 'https://github.com/rahulverma',
    linkedin: 'https://linkedin.com/in/rahul-verma',
  },
  {
    id: 'CS0148',
    name: 'Siddharth Joshi',
    roll: 'CS0148',
    dept: 'CSE',
    year: '4th',
    cgpa: 8.7,
    readiness: 84,
    email: 'siddharth.j@college.edu',
    phone: '98112 33445',
    backlogs: 0,
    status: 'eligible',
    tenth: '90%',
    twelfth: '88%',
    resumeScore: 82,
    skills: ['Flutter', 'Dart', 'Firebase', 'Cloud Functions'],
    github: 'https://github.com/siddharthj',
    linkedin: 'https://linkedin.com/in/siddharth-joshi',
  },
  {
    id: 'CS0152',
    name: 'Neha Kulkarni',
    roll: 'CS0152',
    dept: 'CSE',
    year: '4th',
    cgpa: 6.9,
    readiness: 48,
    email: 'neha.k@college.edu',
    phone: '98901 23456',
    backlogs: 0,
    status: 'attention_needed',
    tenth: '78%',
    twelfth: '72%',
    resumeScore: 50,
    skills: ['HTML/CSS', 'Basic Java', 'SQL'],
    github: '',
    linkedin: '',
  },

  // Information Technology (IT)
  {
    id: 'IT0051',
    name: 'Sneha Roy',
    roll: 'IT0051',
    dept: 'IT',
    year: '4th',
    cgpa: 8.6,
    readiness: 81,
    email: 'sneha.roy@college.edu',
    phone: '98200 45678',
    backlogs: 0,
    status: 'eligible',
    tenth: '91%',
    twelfth: '87%',
    resumeScore: 79,
    skills: ['Python', 'AWS', 'Docker', 'Linux', 'Security'],
  },
  {
    id: 'IT0054',
    name: 'Ayush Deshmukh',
    roll: 'IT0054',
    dept: 'IT',
    year: '3rd',
    cgpa: 7.4,
    readiness: 66,
    email: 'ayush.d@college.edu',
    phone: '98333 77889',
    backlogs: 0,
    status: 'eligible',
    tenth: '84%',
    twelfth: '80%',
    resumeScore: 68,
    skills: ['Networking', 'SQL Server', 'Java', 'Spring'],
  },

  // Electronics & Communication (ECE)
  {
    id: 'EC0087',
    name: 'Priya Nair',
    roll: 'EC0087',
    dept: 'ECE',
    year: '3rd',
    cgpa: 8.9,
    readiness: 85,
    email: 'priya.nair@college.edu',
    phone: '98450 12345',
    backlogs: 0,
    status: 'eligible',
    tenth: '94%',
    twelfth: '92%',
    resumeScore: 84,
    skills: ['VLSI Design', 'Verilog', 'Embedded C', 'MATLAB', 'ARM Cortex'],
  },
  {
    id: 'EC0092',
    name: 'Tanvi Iyer',
    roll: 'EC0092',
    dept: 'ECE',
    year: '4th',
    cgpa: 8.2,
    readiness: 80,
    email: 'tanvi.iyer@college.edu',
    phone: '98670 98765',
    backlogs: 0,
    status: 'placed',
    tenth: '89%',
    twelfth: '86%',
    resumeScore: 81,
    skills: ['Signal Processing', 'Microcontrollers', 'Python', 'C++'],
  },
  {
    id: 'EC0095',
    name: 'Nikhil Rao',
    roll: 'EC0095',
    dept: 'ECE',
    year: '4th',
    cgpa: 6.8,
    readiness: 45,
    email: 'nikhil.rao@college.edu',
    phone: '98199 11224',
    backlogs: 2,
    status: 'attention_needed',
    tenth: '76%',
    twelfth: '70%',
    resumeScore: 49,
    skills: ['Circuit Design', 'Arduino', 'IoT'],
  },

  // Mechanical (Mech)
  {
    id: 'ME0021',
    name: 'Karan Das',
    roll: 'ME0021',
    dept: 'Mech',
    year: '2nd',
    cgpa: 5.8,
    readiness: 34,
    email: 'karan.das@college.edu',
    phone: '98211 44556',
    backlogs: 3,
    status: 'attention_needed',
    tenth: '72%',
    twelfth: '65%',
    resumeScore: 42,
    skills: ['AutoCAD', 'SolidWorks', 'Thermodynamics'],
  },
  {
    id: 'ME0025',
    name: 'Amit Patel',
    roll: 'ME0025',
    dept: 'Mech',
    year: '4th',
    cgpa: 8.3,
    readiness: 79,
    email: 'amit.patel@college.edu',
    phone: '98334 55667',
    backlogs: 0,
    status: 'eligible',
    tenth: '88%',
    twelfth: '85%',
    resumeScore: 78,
    skills: ['Ansys FEA', 'SolidWorks', 'CFD', 'Manufacturing Processes', 'Python'],
  },
  {
    id: 'ME0029',
    name: 'Vikram Gaikwad',
    roll: 'ME0029',
    dept: 'Mech',
    year: '4th',
    cgpa: 8.8,
    readiness: 88,
    email: 'vikram.g@college.edu',
    phone: '98777 88990',
    backlogs: 0,
    status: 'placed',
    tenth: '92%',
    twelfth: '90%',
    resumeScore: 86,
    skills: ['Automotive Powertrain', 'Mechatronics', 'CATIA', 'Robotics'],
  },

  // Civil Engineering (Civil)
  {
    id: 'CV0014',
    name: 'Sameer Kulkarni',
    roll: 'CV0014',
    dept: 'Civil',
    year: '4th',
    cgpa: 7.3,
    readiness: 65,
    email: 'sameer.k@college.edu',
    phone: '98920 11223',
    backlogs: 0,
    status: 'eligible',
    tenth: '82%',
    twelfth: '79%',
    resumeScore: 66,
    skills: ['Structural Analysis', 'STAAD Pro', 'AutoCAD Civil 3D', 'Surveying'],
  },
  {
    id: 'CV0018',
    name: 'Pooja Jadhav',
    roll: 'CV0018',
    dept: 'Civil',
    year: '4th',
    cgpa: 8.7,
    readiness: 83,
    email: 'pooja.j@college.edu',
    phone: '98222 33441',
    backlogs: 0,
    status: 'eligible',
    tenth: '90%',
    twelfth: '87%',
    resumeScore: 82,
    skills: ['Revit Architecture', 'ETABS', 'Geotechnical Engineering', 'BIM'],
  },
  {
    id: 'CV0022',
    name: 'Rajesh Shinde',
    roll: 'CV0022',
    dept: 'Civil',
    year: '3rd',
    cgpa: 6.4,
    readiness: 41,
    email: 'rajesh.s@college.edu',
    phone: '98666 44332',
    backlogs: 2,
    status: 'attention_needed',
    tenth: '74%',
    twelfth: '68%',
    resumeScore: 45,
    skills: ['Concrete Technology', 'Site Estimation', 'Costing'],
  },
];

/* ── Drives ───────────────────────────────────────────────── */
export const DRIVES = [
  {
    id: 1,
    company: 'TCS',
    role: 'Associate Software Engineer',
    package: '3.6 – 7.0 LPA',
    minCgpa: 6.5,
    maxBacklogs: 0,
    departments: ['CSE', 'ECE'],
    date: '2026-08-12',
    deadline: '2026-08-08',
    status: 'Open',
    applicants: 212,
    rounds: 'Aptitude → Technical → HR',
    ctc: '3.6 – 7.0 LPA',
    applied: true
  },
  {
    id: 2,
    company: 'Infosys',
    role: 'Systems Engineer / Specialist Programmer',
    package: '6.5 – 9.5 LPA',
    minCgpa: 7.0,
    maxBacklogs: 0,
    departments: ['CSE', 'ECE'],
    date: '2026-08-20',
    deadline: '2026-08-16',
    status: 'Open',
    applicants: 96,
    rounds: 'Online Test → Tech Interview → HR',
    ctc: '6.5 – 9.5 LPA',
    applied: false
  },
  {
    id: 3,
    company: 'Wipro',
    role: 'Project Engineer',
    package: '4.0 – 6.5 LPA',
    minCgpa: 6.0,
    maxBacklogs: 1,
    departments: ['CSE', 'ECE', 'Mech'],
    date: '2026-07-18',
    deadline: '2026-07-12',
    status: 'Closed',
    applicants: 184,
    rounds: 'Aptitude → HR',
    ctc: '4.0 – 6.5 LPA',
    applied: true
  },
  {
    id: 4,
    company: 'Accenture',
    role: 'Advanced Application Engineering Analyst',
    package: '6.5 – 11 LPA',
    minCgpa: 7.0,
    maxBacklogs: 0,
    departments: ['CSE', 'ECE', 'Mech'],
    date: '2026-09-02',
    deadline: '2026-08-28',
    status: 'Upcoming',
    applicants: 142,
    rounds: 'Online Assessment → Technical Interview → HR',
    ctc: '6.5 – 11 LPA',
    applied: false
  }
];

/* ── Notifications ────────────────────────────────────────── */
export const NOTIFICATIONS = [
  { id: 1, text: 'TCS drive — eligibility list published',              time: '10m ago',  read: false },
  { id: 2, text: 'Placement cell — resume review deadline extended',    time: '2h ago',   read: false },
  { id: 3, text: 'Your CGPA update was verified by CSE Admin',          time: '1d ago',   read: true }
];

/* ── Deadlines ────────────────────────────────────────────── */
export const DEADLINES = [
  { id: 1, event: 'TCS application closes',     date: 'Aug 12' },
  { id: 2, event: 'Aptitude assessment window', date: 'Aug 15' }
];

/* ── MCQ Questions ────────────────────────────────────────── */
export const QUESTIONS = [
  {
    id: 1,
    category: 'Quantitative Aptitude',
    text: 'A train 180m long crosses a standing pole in 9 seconds. What is the speed of the train in km/h?',
    options: ['54 km/h', '72 km/h', '64 km/h', '80 km/h'],
    correct: 1
  },
  {
    id: 2,
    category: 'Data Structures & Algorithms',
    text: 'What is the worst-case time complexity of searching in a Balanced Binary Search Tree (AVL Tree)?',
    options: ['O(1)', 'O(n)', 'O(log n)', 'O(n log n)'],
    correct: 2
  },
  {
    id: 3,
    category: 'Core CS (DBMS & SQL)',
    text: 'Which normal form ensures that no non-prime attribute is transitively dependent on the primary key?',
    options: ['1NF', '2NF', '3NF', 'BCNF'],
    correct: 2
  },
  {
    id: 4,
    category: 'Technical Coding Fundamentals',
    text: 'In JavaScript / TypeScript, which keyword creates a block-scoped variable that cannot be reassigned?',
    options: ['var', 'let', 'const', 'static'],
    correct: 2
  }
];

/* ── Department Matrix (Super Admin) ─────────────────────── */
export const DEPT_MATRIX = [
  { dept: 'Computer Science (CSE)', students: 486, avgCompletion: 88, avgReadiness: 78, placed: 142, rate: 76 },
  { dept: 'Electronics & Comm (ECE)', students: 380, avgCompletion: 84, avgReadiness: 75, placed: 98,  rate: 68 },
  { dept: 'Mechanical (Mech)',        students: 324, avgCompletion: 76, avgReadiness: 68, placed: 64,  rate: 58 },
  { dept: 'Civil Engineering',        students: 290, avgCompletion: 72, avgReadiness: 64, placed: 48,  rate: 52 }
];

/* ── Excel Upload rows ────────────────────────────────────── */
export const EXCEL_ROWS = [
  { row: 2, name: 'Simran Kaur',    email: 'simran@college.edu',    roll: 'CS0210', valid: true,  issue: '' },
  { row: 3, name: 'Arjun Rao',      email: 'arjun@college.edu',     roll: 'CS0211', valid: true,  issue: '' },
  { row: 4, name: 'Neha Joshi',     email: 'cs0212@college.edu',    roll: 'CS0210', valid: false, issue: 'Duplicate roll no. (CS0210)' },
  { row: 5, name: 'Vikram Singh',   email: '',                      roll: 'CS0213', valid: false, issue: 'Missing email address' },
  { row: 6, name: 'Deepak Sharma',  email: 'deepak.s@college.edu',  roll: 'CS0214', valid: true,  issue: '' },
  { row: 7, name: 'Meera Patel',    email: 'meera.p@college.edu',   roll: 'CS0215', valid: true,  issue: '' }
];

/* ── Central Drives (posted by Super Admin, visible to all Dept Admins) ── */
export const CENTRAL_DRIVES = [
  {
    id: 'cd_1',
    company: 'TCS',
    role: 'Associate Software Engineer',
    ctc: '3.6 – 7.0 LPA',
    minCgpa: 6.5,
    maxBacklogs: 0,
    departments: ['CSE', 'ECE'],
    date: '2026-08-12',
    deadline: '2026-08-08',
    status: 'Open',
    applicants: 48,
    rounds: 'Aptitude → Technical → HR',
    jd: 'TCS is hiring freshers for the role of Associate Software Engineer through its Digital and Ninja tracks. Candidates will be assessed on aptitude, coding, and communication.',
    postedBy: 'Super Admin',
    postedAt: 'Aug 1, 2026',
    adminConfig: {
      venue: 'Main Auditorium, Block A',
      reportingTime: '09:00 AM',
      contactPerson: 'Prof. S. R. Deshmukh',
      contactPhone: '98000 12345',
      additionalNotes: 'Carry 2 copies of resume and college ID. Formal dress code mandatory.',
      configured: true
    },
    applicationFields: [
      { key: 'name',       label: 'Full Name',          source: 'profile', required: true,  enabled: true  },
      { key: 'rollNo',     label: 'Roll Number',         source: 'profile', required: true,  enabled: true  },
      { key: 'cgpa',       label: 'Current CGPA',        source: 'profile', required: true,  enabled: true  },
      { key: 'resume',     label: 'Resume (PDF)',         source: 'resume',  required: true,  enabled: true  },
      { key: 'backlogs',   label: 'Active Backlogs',      source: 'profile', required: true,  enabled: true  },
      { key: 'phone',      label: 'Phone Number',         source: 'profile', required: true,  enabled: true  },
      { key: 'skills',     label: 'Technical Skills',     source: 'profile', required: false, enabled: true  },
      { key: 'projects',   label: 'Projects',             source: 'profile', required: false, enabled: false },
      { key: 'linkedin',   label: 'LinkedIn Profile',     source: 'profile', required: false, enabled: false },
      { key: 'github',     label: 'GitHub Profile',       source: 'profile', required: false, enabled: false },
      { key: 'photo',      label: 'Passport Photo',       source: 'upload',  required: false, enabled: false },
      { key: 'tenthPct',   label: '10th Percentage',      source: 'profile', required: false, enabled: true  },
      { key: 'twelfthPct', label: '12th Percentage',      source: 'profile', required: false, enabled: true  },
      { key: 'address',    label: 'Current Address',      source: 'profile', required: false, enabled: false },
    ]
  },
  {
    id: 'cd_2',
    company: 'Infosys',
    role: 'Systems Engineer / Specialist Programmer',
    ctc: '6.5 – 9.5 LPA',
    minCgpa: 7.0,
    maxBacklogs: 0,
    departments: ['CSE', 'IT'],
    date: '2026-08-20',
    deadline: '2026-08-16',
    status: 'Open',
    applicants: 36,
    rounds: 'Online Test → Tech Interview → HR',
    jd: 'Infosys is looking for bright engineers to join its Systems Engineer and Specialist Programmer tracks. Strong coding and problem-solving skills required.',
    postedBy: 'Super Admin',
    postedAt: 'Aug 3, 2026',
    adminConfig: {
      venue: '',
      reportingTime: '',
      contactPerson: '',
      contactPhone: '',
      additionalNotes: '',
      configured: false
    },
    applicationFields: [
      { key: 'name',       label: 'Full Name',          source: 'profile', required: true,  enabled: true  },
      { key: 'rollNo',     label: 'Roll Number',         source: 'profile', required: true,  enabled: true  },
      { key: 'cgpa',       label: 'Current CGPA',        source: 'profile', required: true,  enabled: true  },
      { key: 'resume',     label: 'Resume (PDF)',         source: 'resume',  required: true,  enabled: true  },
      { key: 'backlogs',   label: 'Active Backlogs',      source: 'profile', required: true,  enabled: true  },
      { key: 'phone',      label: 'Phone Number',         source: 'profile', required: true,  enabled: true  },
      { key: 'skills',     label: 'Technical Skills',     source: 'profile', required: false, enabled: false },
      { key: 'projects',   label: 'Projects',             source: 'profile', required: false, enabled: false },
      { key: 'linkedin',   label: 'LinkedIn Profile',     source: 'profile', required: false, enabled: false },
      { key: 'github',     label: 'GitHub Profile',       source: 'profile', required: false, enabled: false },
      { key: 'photo',      label: 'Passport Photo',       source: 'upload',  required: false, enabled: false },
      { key: 'tenthPct',   label: '10th Percentage',      source: 'profile', required: false, enabled: false },
      { key: 'twelfthPct', label: '12th Percentage',      source: 'profile', required: false, enabled: false },
      { key: 'address',    label: 'Current Address',      source: 'profile', required: false, enabled: false },
    ]
  },
  {
    id: 'cd_3',
    company: 'Accenture',
    role: 'Advanced Application Engineering Analyst',
    ctc: '6.5 – 11 LPA',
    minCgpa: 7.0,
    maxBacklogs: 0,
    departments: ['CSE', 'ECE', 'Mech'],
    date: '2026-09-02',
    deadline: '2026-08-28',
    status: 'Upcoming',
    applicants: 52,
    rounds: 'Online Assessment → Technical Interview → HR',
    jd: 'Accenture Cloud Engineering track for freshers. Strong fundamentals in cloud, data structures, and communication skills expected.',
    postedBy: 'Super Admin',
    postedAt: 'Aug 6, 2026',
    adminConfig: {
      venue: '',
      reportingTime: '',
      contactPerson: '',
      contactPhone: '',
      additionalNotes: '',
      configured: false
    },
    applicationFields: [
      { key: 'name',       label: 'Full Name',          source: 'profile', required: true,  enabled: true  },
      { key: 'rollNo',     label: 'Roll Number',         source: 'profile', required: true,  enabled: true  },
      { key: 'cgpa',       label: 'Current CGPA',        source: 'profile', required: true,  enabled: true  },
      { key: 'resume',     label: 'Resume (PDF)',         source: 'resume',  required: true,  enabled: true  },
      { key: 'backlogs',   label: 'Active Backlogs',      source: 'profile', required: true,  enabled: true  },
      { key: 'phone',      label: 'Phone Number',         source: 'profile', required: true,  enabled: true  },
      { key: 'skills',     label: 'Technical Skills',     source: 'profile', required: false, enabled: false },
      { key: 'projects',   label: 'Projects',             source: 'profile', required: false, enabled: false },
      { key: 'linkedin',   label: 'LinkedIn Profile',     source: 'profile', required: false, enabled: false },
      { key: 'github',     label: 'GitHub Profile',       source: 'profile', required: false, enabled: false },
      { key: 'photo',      label: 'Passport Photo',       source: 'upload',  required: false, enabled: false },
      { key: 'tenthPct',   label: '10th Percentage',      source: 'profile', required: false, enabled: false },
      { key: 'twelfthPct', label: '12th Percentage',      source: 'profile', required: false, enabled: false },
      { key: 'address',    label: 'Current Address',      source: 'profile', required: false, enabled: false },
    ]
  },
  {
    id: 'cd_4',
    company: 'L&T Construction',
    role: 'Graduate Engineer Trainee - Structural & Site Planning',
    ctc: '6.0 – 8.5 LPA',
    minCgpa: 6.8,
    maxBacklogs: 0,
    departments: ['Civil', 'Mech'],
    date: '2026-09-10',
    deadline: '2026-09-05',
    status: 'Open',
    applicants: 28,
    rounds: 'Technical Aptitude → Core Technical → Site Assessment',
    jd: 'Larsen & Toubro recruitment for major metro and civil projects. Targeted at Civil and Mechanical engineering branches.',
    postedBy: 'Super Admin',
    postedAt: 'Aug 8, 2026',
    adminConfig: {
      venue: 'Civil CAD Lab & Drawing Hall C',
      reportingTime: '09:00 AM',
      contactPerson: 'Prof. A. N. Patil',
      contactPhone: '98222 33441',
      additionalNotes: 'Bring drafting pencils and engineering calculator.',
      configured: true
    },
    applicationFields: [
      { key: 'name',       label: 'Full Name',          source: 'profile', required: true,  enabled: true  },
      { key: 'rollNo',     label: 'Roll Number',         source: 'profile', required: true,  enabled: true  },
      { key: 'cgpa',       label: 'Current CGPA',        source: 'profile', required: true,  enabled: true  },
      { key: 'resume',     label: 'Resume (PDF)',         source: 'resume',  required: true,  enabled: true  },
      { key: 'phone',      label: 'Phone Number',         source: 'profile', required: true,  enabled: true  },
    ]
  },
  {
    id: 'cd_5',
    company: 'Texas Instruments',
    role: 'Embedded Firmware & Analog Design Engineer',
    ctc: '16.0 – 24.0 LPA',
    minCgpa: 7.5,
    maxBacklogs: 0,
    departments: ['ECE'],
    date: '2026-09-15',
    deadline: '2026-09-10',
    status: 'Upcoming',
    applicants: 19,
    rounds: 'Online Domain Test (Circuits + C) → Technical Round 1 → HR',
    jd: 'Premier VLSI and embedded design opening for Electronics and Communication engineering specialists.',
    postedBy: 'Super Admin',
    postedAt: 'Aug 10, 2026',
    adminConfig: {
      venue: 'VLSI Research Lab 3',
      reportingTime: '10:00 AM',
      contactPerson: 'Dr. S. K. Kulkarni',
      contactPhone: '98450 12345',
      additionalNotes: 'Requires basic C programming and CMOS basics.',
      configured: true
    },
    applicationFields: [
      { key: 'name',       label: 'Full Name',          source: 'profile', required: true,  enabled: true  },
      { key: 'rollNo',     label: 'Roll Number',         source: 'profile', required: true,  enabled: true  },
      { key: 'cgpa',       label: 'Current CGPA',        source: 'profile', required: true,  enabled: true  },
      { key: 'resume',     label: 'Resume (PDF)',         source: 'resume',  required: true,  enabled: true  },
    ]
  },
  {
    id: 'cd_6',
    company: 'Tata Motors',
    role: 'Graduate Engineer Trainee - EV Powertrain & Testing',
    ctc: '7.0 – 9.2 LPA',
    minCgpa: 6.8,
    maxBacklogs: 0,
    departments: ['Mech'],
    date: '2026-09-20',
    deadline: '2026-09-14',
    status: 'Open',
    applicants: 22,
    rounds: 'Automotive Core Test → Design Simulation → Panel Interview',
    jd: 'Electric vehicle powertrain research and vehicle dynamics testing. Reserved strictly for Mechanical department engineers.',
    postedBy: 'Super Admin',
    postedAt: 'Aug 12, 2026',
    adminConfig: {
      venue: 'Automobile Engineering Workshop',
      reportingTime: '09:30 AM',
      contactPerson: 'Prof. R. M. Shinde',
      contactPhone: '98334 55667',
      additionalNotes: 'Safety shoes required for workshop access.',
      configured: true
    },
    applicationFields: [
      { key: 'name',       label: 'Full Name',          source: 'profile', required: true,  enabled: true  },
      { key: 'rollNo',     label: 'Roll Number',         source: 'profile', required: true,  enabled: true  },
      { key: 'cgpa',       label: 'Current CGPA',        source: 'profile', required: true,  enabled: true  },
      { key: 'resume',     label: 'Resume (PDF)',         source: 'resume',  required: true,  enabled: true  },
    ]
  },
  {
    id: 'cd_7',
    company: 'UltraTech Cement',
    role: 'Graduate Civil Engineer - Concrete Technology & Planning',
    ctc: '5.8 – 7.5 LPA',
    minCgpa: 6.5,
    maxBacklogs: 0,
    departments: ['Civil'],
    date: '2026-09-25',
    deadline: '2026-09-18',
    status: 'Open',
    applicants: 18,
    rounds: 'Aptitude → Technical Interview → Site Practical',
    jd: 'Quality assurance, batching plant operations, and project estimation. Exclusive to Civil engineering students.',
    postedBy: 'Super Admin',
    postedAt: 'Aug 14, 2026',
    adminConfig: {
      venue: 'Concrete Technology Lab',
      reportingTime: '10:00 AM',
      contactPerson: 'Prof. V. B. Jadhav',
      contactPhone: '98920 11223',
      additionalNotes: 'Field kit provided at site.',
      configured: true
    },
    applicationFields: [
      { key: 'name',       label: 'Full Name',          source: 'profile', required: true,  enabled: true  },
      { key: 'rollNo',     label: 'Roll Number',         source: 'profile', required: true,  enabled: true  },
      { key: 'cgpa',       label: 'Current CGPA',        source: 'profile', required: true,  enabled: true  },
      { key: 'resume',     label: 'Resume (PDF)',         source: 'resume',  required: true,  enabled: true  },
    ]
  }
];
