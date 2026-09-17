import { config } from "dotenv";
import { resolve } from "path";

// .env.local overrides DATABASE_URL in this project; load it first so this
// script targets the same database the running app uses.
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { prisma } from "../lib/prisma";

const departments = [
  { name: "Computer Engineering", code: "COMP" },
  { name: "Information Technology", code: "IT" },
  { name: "Electronics and Telecommunication", code: "EXTC" },
  { name: "Mechanical Engineering", code: "MECH" },
  { name: "Instrumentation Engineering", code: "INSTRU" },
  { name: "Chemical Engineering", code: "CHEM" },
];

async function main() {
  for (const dept of departments) {
    const result = await prisma.department.upsert({
      where: { code: dept.code },
      update: {},
      create: dept,
    });
    console.log(`${result.code} — ${result.name}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
