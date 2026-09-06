import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Seed departments
  const departments = [
    { name: "Computer Engineering", code: "COMP" },
    { name: "Information Technology", code: "IT" },
    { name: "Electronics and Telecommunication", code: "EXTC" },
    { name: "Mechanical Engineering", code: "MECH" },
    { name: "Chemical Engineering", code: "CHEM" },
    { name: "Instrumentation Engineering", code: "INST" },
  ];

  console.log("📚 Creating departments...");

  for (const dept of departments) {
    const existing = await prisma.department.findFirst({
      where: { code: dept.code },
    });

    if (existing) {
      console.log(`  ⏭️  Department ${dept.code} already exists, skipping...`);
      continue;
    }

    const created = await prisma.department.create({
      data: {
        name: dept.name,
        code: dept.code,
        isActive: true,
      },
    });

    console.log(`  ✅ Created department: ${created.name} (${created.code})`);
  }

  console.log("\n✨ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
