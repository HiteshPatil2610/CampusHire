/**
 * Performance test data.
 *
 * Fills the database with enough volume to see how the app behaves at the
 * scale it is actually being built for (~500 students) rather than the handful
 * of rows it holds today. Without this, every timing measures fixed per-request
 * overhead and nothing about how the queries scale.
 *
 * Everything written here is namespaced so it can be removed again:
 *   - departments   code starts with "SD"
 *   - students      email ends with "@seed.test"
 *   - drives        companyName starts with "[seed]"
 * Nothing outside those namespaces is created.
 *
 *   npx tsx scripts/seed-perf-data.ts            seed (idempotent)
 *   npx tsx scripts/seed-perf-data.ts --clear    remove everything seeded
 *
 * Optionally give it a real, signed-in student account:
 *
 *   npx tsx scripts/seed-perf-data.ts --student you@example.com
 *
 * That account is handed the academic record and roll number it needs to see
 * drives at all, plus a few applications, so the dashboard renders with real
 * content. Omit it and only the namespaced rows are created.
 *
 * This writes to whatever DATABASE_URL points at. It is a development tool.
 */
import { config } from 'dotenv';
// Env lives in two files and the split matters: .env.local holds the
// hand-managed keys (Clerk, Blob) while .env is written by the Neon CLI and
// owns DATABASE_URL. Load .env first, then .env.local, both with override, so
// .env.local wins over .env AND both win over a value exported in the shell.
// Without override dotenv keeps whatever is already in process.env, and a
// forgotten machine-level CLERK_SECRET_KEY silently aims these scripts at a
// different Clerk application than the files name — which read as every User
// row being "orphaned". This deliberately differs from `next dev`, where the
// shell still wins; if the app and these scripts ever disagree, clear the shell.
config({ path: ".env", override: true });
config({ path: ".env.local", override: true });
import { PrismaClient, Prisma } from '@prisma/client';
import { setEligibleDepartments } from '@/features/drives/utils/eligible-departments';

const prisma = new PrismaClient();

/**
 * A real signed-in student to make browsable, passed with `--student <email>`.
 * Optional: without it the script seeds only its own namespaced rows, which is
 * what you want on a fresh database where nobody has signed up yet.
 */
const TARGET_EMAIL = (() => {
  const i = process.argv.indexOf('--student');
  return i !== -1 ? process.argv[i + 1] : undefined;
})();

const SEED_DEPT_PREFIX = 'SD';
const SEED_EMAIL_DOMAIN = '@seed.test';
const SEED_DRIVE_PREFIX = '[seed]';

const DEPARTMENTS = [
  { code: 'SD01', name: 'Seed — Mechanical' },
  { code: 'SD02', name: 'Seed — Civil' },
  { code: 'SD03', name: 'Seed — Electronics' },
  { code: 'SD04', name: 'Seed — Information Technology' },
];

const STUDENTS_PER_DEPARTMENT = 100; // 4 seeded depts + COMP => ~500 students
const DRIVES_PER_DEPARTMENT = 6;
const COMPANIES = [
  'Acme Systems', 'Borealis Tech', 'Cobalt Labs', 'Deltaforge', 'Everline',
  'Fathom Analytics', 'Gridpoint', 'Helix Robotics', 'Ionic Works', 'Juniper Dynamics',
];
const ROLES = ['Software Engineer', 'Data Analyst', 'QA Engineer', 'Systems Engineer', 'Product Intern'];

/** Deterministic pseudo-random so reruns produce the same shape. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

async function clear() {
  console.log('Removing seeded data...\n');

  const seededStudents = await prisma.student.findMany({
    where: { email: { endsWith: SEED_EMAIL_DOMAIN } },
    select: { id: true },
  });
  const seededDrives = await prisma.drive.findMany({
    where: { companyName: { startsWith: SEED_DRIVE_PREFIX } },
    select: { id: true },
  });
  const studentIds = seededStudents.map((s) => s.id);
  const driveIds = seededDrives.map((d) => d.id);

  // Applications first: Drive restricts deletion while any reference it.
  const apps = await prisma.driveApplication.deleteMany({
    where: { OR: [{ studentId: { in: studentIds } }, { driveId: { in: driveIds } }] },
  });
  console.log(`  applications  ${apps.count}`);

  const configs = await prisma.driveDepartmentConfig.deleteMany({ where: { driveId: { in: driveIds } } });
  console.log(`  drive configs ${configs.count}`);

  const drives = await prisma.drive.deleteMany({ where: { id: { in: driveIds } } });
  console.log(`  drives        ${drives.count}`);

  // StudentAcademic and the rest cascade from Student.
  const students = await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  console.log(`  students      ${students.count}`);

  const depts = await prisma.department.deleteMany({
    where: { code: { startsWith: SEED_DEPT_PREFIX } },
  });
  console.log(`  departments   ${depts.count}`);

  console.log('\nAn account passed with --student keeps the academic record it was given.');
  console.log('Done.\n');
}

async function seed() {
  console.log('Seeding performance test data...\n');

  // --- Optional: make one real signed-in account browsable.
  let target: { id: string; departmentId: string } | null = null;
  if (TARGET_EMAIL) {
    const found = await prisma.student.findUnique({
      where: { email: TARGET_EMAIL },
      include: { academic: true },
    });
    if (!found) {
      console.log(`  no student with email ${TARGET_EMAIL} - skipping that step`);
    } else {
      target = { id: found.id, departmentId: found.departmentId };
      if (!found.academic) {
        await prisma.studentAcademic.create({
          data: {
            studentId: found.id,
            tenthPercentage: 88.5, tenthBoard: 'CBSE', tenthYear: 2019,
            twelfthPercentage: 84.2, twelfthBoard: 'CBSE', twelfthYear: 2021,
            currentCGPA: 8.1, currentSemester: 7, activeBacklogs: 0, pastBacklogCount: 0,
          },
        });
        console.log(`  academic record created for ${TARGET_EMAIL} (CGPA 8.1)`);
      }
      if (!found.rollNumber) {
        // A student with no roll number is blocked from applying to any drive.
        await prisma.student.update({ where: { id: found.id }, data: { rollNumber: 'SEED900' } });
        console.log('  roll number set to SEED900 (required before applying)');
      }
    }
  }

  // --- Departments
  // Seed into whatever real departments already exist, plus the namespaced
  // ones below. On a fresh database there are none, and the SD* departments
  // alone give enough spread to exercise the per-department queries.
  const existing = await prisma.department.findMany({
    where: { NOT: { code: { startsWith: SEED_DEPT_PREFIX } } },
  });
  const departments = [...existing];
  for (const d of DEPARTMENTS) {
    const dept = await prisma.department.upsert({
      where: { code: d.code },
      update: {},
      create: { code: d.code, name: d.name, isActive: true },
    });
    departments.push(dept);
  }
  console.log(`  departments: ${departments.length} (${existing.length} existing + ${DEPARTMENTS.length} seeded)`);

  // --- Students
  const rand = rng(42);
  let created = 0;
  for (const dept of departments) {
    const rows: Prisma.StudentCreateManyInput[] = [];
    for (let i = 0; i < STUDENTS_PER_DEPARTMENT; i++) {
      const email = `${dept.code.toLowerCase()}.s${String(i).padStart(3, '0')}${SEED_EMAIL_DOMAIN}`;
      rows.push({
        departmentId: dept.id,
        email,
        name: `Seed Student ${dept.code}-${i}`,
        rollNumber: `${dept.code}S${String(i).padStart(3, '0')}`,
        isPending: rand() < 0.15,          // some still un-registered
        optedIn: rand() > 0.08,            // a few opted out
        entryType: rand() < 0.2 ? 'DIPLOMA' : 'REGULAR',
        expectedPassoutYear: 2026,
      });
    }
    const res = await prisma.student.createMany({ data: rows, skipDuplicates: true });
    created += res.count;
  }
  console.log(`  students: ${created} created`);

  // --- Academic records for every seeded student that lacks one
  const needAcademic = await prisma.student.findMany({
    where: { email: { endsWith: SEED_EMAIL_DOMAIN }, academic: { is: null } },
    select: { id: true, entryType: true },
  });
  if (needAcademic.length) {
    const academics: Prisma.StudentAcademicCreateManyInput[] = needAcademic.map((s) => {
      const diploma = s.entryType === 'DIPLOMA';
      return {
        studentId: s.id,
        tenthPercentage: 60 + rand() * 38,
        tenthBoard: 'State Board',
        tenthYear: 2019,
        twelfthPercentage: diploma ? null : 55 + rand() * 43,
        twelfthBoard: diploma ? null : 'State Board',
        twelfthYear: diploma ? null : 2021,
        diplomaPercentage: diploma ? 60 + rand() * 35 : null,
        diplomaBoard: diploma ? 'MSBTE' : null,
        diplomaYear: diploma ? 2021 : null,
        currentCGPA: Number((5.5 + rand() * 4.4).toFixed(2)),
        currentSemester: 7,
        activeBacklogs: rand() < 0.75 ? 0 : Math.floor(rand() * 4),
        pastBacklogCount: Math.floor(rand() * 3),
      };
    });
    await prisma.studentAcademic.createMany({ data: academics, skipDuplicates: true });
    console.log(`  academic records: ${academics.length} created`);
  }

  // --- Drives
  const now = Date.now();
  const day = 86_400_000;
  let driveCount = 0;
  for (const dept of departments) {
    for (let i = 0; i < DRIVES_PER_DEPARTMENT; i++) {
      const company = `${SEED_DRIVE_PREFIX} ${COMPANIES[(driveCount + i) % COMPANIES.length]}`;
      const open = i % 3 !== 0; // two thirds open, one third closed
      const deadline = new Date(now + (open ? (3 + i * 5) * day : -(5 + i * 3) * day));
      const central = i % 4 === 0;
      const eligible = central
        ? departments.slice(0, 3).map((d) => d.id)
        : [dept.id];

      const existing = await prisma.drive.findFirst({
        where: { companyName: company, departmentId: central ? null : dept.id, roleName: ROLES[i % ROLES.length] },
        select: { id: true },
      });
      if (existing) continue;

      await prisma.$transaction(async (tx) => {
        const created = await tx.drive.create({
          data: {
            companyName: company,
            roleName: ROLES[i % ROLES.length],
            packageOffered: 4 + Math.round(rand() * 20),
            packageDisplay: null,
            selectionRounds: JSON.stringify(['Aptitude', 'Technical', 'HR']),
            driveDate: new Date(deadline.getTime() + 7 * day),
            applicationDeadline: deadline,
            applyMethod: 'IN_APP',
            minCGPA: Number((6 + rand() * 2.5).toFixed(1)),
            maxActiveBacklogs: Math.floor(rand() * 3),
            isCentralDrive: central,
            departmentId: central ? null : dept.id,
          },
        });
        await setEligibleDepartments(tx, created.id, eligible);
      });
      driveCount++;
    }
  }
  console.log(`  drives: ${driveCount} created`);

  // --- Applications
  const allSeedDrives = await prisma.drive.findMany({
    where: { companyName: { startsWith: SEED_DRIVE_PREFIX } },
    select: { id: true, eligibleDepartmentLinks: { select: { departmentId: true } } },
  });
  const seedStudents = await prisma.student.findMany({
    where: { email: { endsWith: SEED_EMAIL_DOMAIN }, isPending: false },
    select: { id: true, departmentId: true },
  });

  const existingApps = await prisma.driveApplication.count({
    where: { drive: { companyName: { startsWith: SEED_DRIVE_PREFIX } } },
  });
  if (existingApps > 0) {
    console.log(`  applications: ${existingApps} already present, skipped`);
  } else {
    const apps: Prisma.DriveApplicationCreateManyInput[] = [];
    const STAGES = ['APPLIED', 'APTITUDE', 'INTERVIEW', 'OFFER'] as const;
    for (const drive of allSeedDrives) {
      const eligibleDepts = drive.eligibleDepartmentLinks.map((l) => l.departmentId);
      const pool = seedStudents.filter((s) => eligibleDepts.includes(s.departmentId));
      for (const s of pool) {
        if (rand() > 0.35) continue; // about a third of eligible students apply
        const r = rand();
        const stage = r < 0.5 ? 'APPLIED' : STAGES[Math.floor(r * STAGES.length)];
        const status = r < 0.08 ? 'SELECTED' : r < 0.25 ? 'REJECTED' : 'IN_PROGRESS';
        apps.push({ studentId: s.id, driveId: drive.id, stage, status });
      }
    }
    // Chunked: a single createMany of tens of thousands of rows can exceed
    // the parameter limit on the wire.
    let total = 0;
    for (let i = 0; i < apps.length; i += 2000) {
      const res = await prisma.driveApplication.createMany({
        data: apps.slice(i, i + 2000),
        skipDuplicates: true,
      });
      total += res.count;
    }
    console.log(`  applications: ${total} created`);
  }

  // --- Give the target student something to look at
  if (target) {
    const targetDrives = await prisma.drive.findMany({
      where: {
        companyName: { startsWith: SEED_DRIVE_PREFIX },
        eligibleDepartmentLinks: { some: { departmentId: target.departmentId } },
      },
      select: { id: true },
      take: 3,
    });
    for (const d of targetDrives) {
      await prisma.driveApplication.upsert({
        where: { studentId_driveId: { studentId: target.id, driveId: d.id } },
        update: {},
        create: { studentId: target.id, driveId: d.id, stage: 'APPLIED', status: 'IN_PROGRESS' },
      });
    }
    console.log(`  applications for ${TARGET_EMAIL}: ${targetDrives.length}`);
  }

  console.log('\nDone.\n');
}

(async () => {
  try {
    if (process.argv.includes('--clear')) await clear();
    else await seed();

    const [students, drives, apps, depts] = await Promise.all([
      prisma.student.count(),
      prisma.drive.count(),
      prisma.driveApplication.count(),
      prisma.department.count(),
    ]);
    console.log(`Totals now — students ${students}, drives ${drives}, applications ${apps}, departments ${depts}`);
  } finally {
    await prisma.$disconnect();
  }
})();
