# CampusHire — Setup Guide

Welcome to CampusHire! This guide will help you set up the project on your local machine.

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18.x or higher ([Download](https://nodejs.org/))
- **npm** 9.x or higher (comes with Node.js)
- **Git** ([Download](https://git-scm.com/))
- A **code editor** (VS Code recommended)

---

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd CampusHire
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages including:
- Next.js, React, TypeScript
- Prisma (database ORM)
- Clerk (authentication)
- Tailwind CSS, shadcn/ui
- Vitest (testing framework)

### 3. Set Up Environment Variables

Create a `.env.local` file in the project root:

```bash
# Copy the example file
cp .env.example .env.local
```

Now edit `.env.local` and fill in the required values:

```env
# Database (Neon PostgreSQL)
DATABASE_URL="your-neon-postgresql-connection-string"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="your-clerk-publishable-key"
CLERK_SECRET_KEY="your-clerk-secret-key"
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/"
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL="/"
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL="/"

# Node Environment
NODE_ENV="development"
```

**Important**: Never commit `.env.local` to version control. It's already in `.gitignore`.

---

## 🔐 Getting Your API Keys

### Neon PostgreSQL (Database)

1. Go to [neon.tech](https://neon.tech) and sign up for a free account
2. Create a new project named "campushire" (or any name you prefer)
3. Once created, click on "Connection Details" in your project dashboard
4. Copy the connection string (format: `postgresql://user:password@host/database?sslmode=require`)
5. Paste it as the `DATABASE_URL` in your `.env.local` file

**Note**: If you want to use the existing production database, contact the project admin for the connection string.

### Clerk (Authentication)

1. Go to [clerk.com](https://clerk.com) and sign up for a free account
2. Create a new application named "CampusHire"
3. In the Clerk dashboard:
   - Go to **API Keys** section
   - Copy the **Publishable Key** → paste as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - Copy the **Secret Key** → paste as `CLERK_SECRET_KEY`
4. Configure authentication settings:
   - Go to **User & Authentication** → **Email, Phone, Username**
   - Enable **Email address** as the primary identifier
   - Enable **Email verification** (OTP code)
   - Disable password authentication (we use email OTP only)

**Note**: If you're joining an existing team, the project admin can add you to the existing Clerk application.

---

## 🗄️ Database Setup

### Option 1: Use Existing Database (Recommended for Team Members)

If the database migration has already been applied to a shared Neon database:

1. Get the `DATABASE_URL` from your project admin
2. Add it to your `.env.local` file
3. Run Prisma generate to create the client:
   ```bash
   npx prisma generate
   ```
4. Verify connection:
   ```bash
   npx prisma db pull
   ```

### Option 2: Set Up Your Own Database (For Independent Development)

If you want your own development database:

1. Create a new Neon project (see "Getting Your API Keys" above)
2. Add the connection string to `.env.local`
3. Run the database migration:
   ```bash
   npx prisma migrate dev
   ```
4. Verify the migration:
   ```bash
   npx prisma migrate status
   ```

You should see output indicating that all migrations have been applied.

### View Your Database (Optional)

To view and edit your database in a visual interface:

```bash
npx prisma studio
```

This opens a browser-based database admin tool at `http://localhost:5555`.

---

## 🏃 Running the Development Server

Start the Next.js development server:

```bash
npm run dev
```

The application will be available at:
- **Local**: [http://localhost:3000](http://localhost:3000)

You should see the CampusHire landing page.

---

## 🧪 Running Tests

Run the test suite:

```bash
# Run all tests once
npm run test

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch

# Run tests with UI
npm run test:ui
```

All 38 database schema invariant tests should pass.

---

## 🔨 Other Useful Commands

### Build for Production

```bash
npm run build
```

This creates an optimized production build. Use this to verify your changes don't break the build before committing.

### Lint Your Code

```bash
npm run lint
```

Runs ESLint to check for code quality issues.

### TypeScript Type Checking

```bash
npx tsc --noEmit
```

Checks for TypeScript type errors without generating files.

### Prisma Commands

```bash
# Generate Prisma Client (after schema changes)
npx prisma generate

# Create a new migration
npx prisma migrate dev --name your_migration_name

# Check migration status
npx prisma migrate status

# Reset database (⚠️ DELETES ALL DATA)
npx prisma migrate reset

# Open Prisma Studio (database GUI)
npx prisma studio

# Validate schema file
npx prisma validate
```

---

## 📁 Project Structure

```
CampusHire/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth route group (sign-in, sign-up)
│   ├── (student)/                # Student route group
│   ├── (admin)/                  # Department admin route group
│   ├── (super-admin)/            # Super admin route group
│   ├── api/                      # API routes
│   ├── globals.css               # Global styles with design tokens
│   ├── layout.tsx                # Root layout with ClerkProvider
│   └── page.tsx                  # Landing page
│
├── components/
│   ├── ui/                       # shadcn/ui components (generated)
│   └── shared/                   # Shared components (sidebar, topbar, etc.)
│
├── context/                      # Project documentation
│   ├── project-overview.md       # Product requirements
│   ├── architecture.md           # Technical architecture
│   ├── ui-context.md            # Design system
│   ├── code-standards.md        # Coding standards
│   ├── progress-tracker.md      # Implementation progress
│   └── specs/                   # Unit specifications
│
├── features/                     # Feature-based modules (to be added)
│   ├── auth/                    # Authentication flows
│   ├── students/                # Student profile management
│   ├── drives/                  # Drive posting & applications
│   └── ...
│
├── lib/                         # Shared utilities
│   ├── prisma.ts               # Prisma client singleton
│   ├── env.ts                  # Environment variable validation
│   ├── clerk.ts                # Clerk helper functions
│   └── __tests__/              # Unit tests
│
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── migrations/             # Database migrations
│
├── public/                     # Static assets
│
├── .env.local                  # Environment variables (create this, not in repo)
├── .env.example                # Environment variables template
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── tailwind.config.ts          # Tailwind CSS configuration
└── vitest.config.ts            # Vitest test configuration
```

---

## 🎨 Design System

CampusHire uses a warm, paper-like design system with custom color tokens. All colors and styles are defined in `app/globals.css` as CSS custom properties:

- **Primary Accent**: `--accent` (terracotta)
- **Background**: `--surface-0` (warm paper)
- **Cards**: `--surface-2` (white)
- **Text**: `--text-primary`, `--text-secondary`, `--text-muted`
- **Status Colors**: `--teal` (success), `--amber` (warning), `--red` (error)

Use these tokens instead of hardcoded colors. See `context/ui-context.md` for the complete design system.

---

## 👥 User Roles

CampusHire has three user roles:

1. **STUDENT**: Self-register, complete profile, view/apply to drives
2. **DEPT_ADMIN**: Manage students, post drives, bulk upload (assigned by super admin)
3. **SUPER_ADMIN**: Manage departments and admins, system oversight (seeded via script)

---

## 🗃️ Database Schema

The database includes:

**Core Models (Unit 02A)**:
- `User` — Application identity (linked to Clerk)
- `Department` — Academic departments
- `DepartmentAdmin` — Links admins to departments

**Student Models (Unit 02B, 02C)**:
- `Student` — Student core data
- `StudentAcademic` — Academic info (marks, CGPA, backlogs)
- `StudentPreferences` — Placement preferences
- `StudentSkill` — Skills (technical/soft)
- `StudentProject` — Projects portfolio
- `StudentExperience` — Work experience
- `StudentCertification` — Certifications

See `context/specs/02-database-and-student-foundation.md` for complete schema documentation.

---

## 🐛 Troubleshooting

### "DATABASE_URL not found" error

**Solution**: Make sure you've created `.env.local` and added the `DATABASE_URL`. The file must be in the project root directory.

### "Can't reach database server" error

**Solution**: 
1. Check that your `DATABASE_URL` is correct
2. Make sure you have internet connectivity (Neon is cloud-hosted)
3. Verify that the connection string includes `?sslmode=require`

### Prisma Client errors

**Solution**: Regenerate the Prisma Client:
```bash
npx prisma generate
```

### TypeScript errors after pulling updates

**Solution**: 
1. Delete `node_modules` and reinstall:
   ```bash
   rm -rf node_modules
   npm install
   ```
2. Regenerate Prisma Client:
   ```bash
   npx prisma generate
   ```

### Port 3000 already in use

**Solution**: Either:
1. Stop the process using port 3000, or
2. Run on a different port:
   ```bash
   npm run dev -- -p 3001
   ```

### Clerk authentication not working

**Solution**:
1. Verify your Clerk keys are correct in `.env.local`
2. Make sure keys start with `pk_test_` (publishable) and `sk_test_` (secret)
3. Check that the Clerk application is active in the Clerk dashboard
4. Clear browser cookies and try again

---

## 📚 Additional Resources

### Project Documentation
- **Product Overview**: `context/project-overview.md`
- **Architecture**: `context/architecture.md`
- **Code Standards**: `context/code-standards.md`
- **Progress Tracker**: `context/progress-tracker.md`
- **Database Setup**: `DATABASE_SETUP.md`

### External Documentation
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Clerk Documentation](https://clerk.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Vitest Documentation](https://vitest.dev/)

---

## ✅ Verification Checklist

Before you start development, verify that:

- [ ] Node.js 18+ is installed (`node --version`)
- [ ] Dependencies are installed (`npm install` completed)
- [ ] `.env.local` exists with all required keys
- [ ] Database connection works (`npx prisma db pull`)
- [ ] Prisma Client is generated (`npx prisma generate`)
- [ ] Development server starts (`npm run dev`)
- [ ] Tests pass (`npm run test`)
- [ ] Build succeeds (`npm run build`)
- [ ] You can access the app at `http://localhost:3000`

---

## 🤝 Contributing

### Before Making Changes

1. Create a new branch for your feature/fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Read the relevant documentation in `context/` folder

3. Follow the code standards in `context/code-standards.md`

### Before Committing

1. Run tests: `npm run test`
2. Run linter: `npm run lint`
3. Run type check: `npx tsc --noEmit`
4. Run build: `npm run build`

All checks should pass before you commit.

### Commit Message Format

Use clear, descriptive commit messages:

```
feat: add student profile completion calculation
fix: correct CGPA validation in academic form
docs: update setup guide with new environment variables
test: add tests for eligibility matching logic
```

### Creating a Pull Request

1. Push your branch to the remote repository
2. Create a pull request with a clear description of your changes
3. Reference any related issues or specifications
4. Wait for code review before merging

---

## 🆘 Getting Help

If you run into issues:

1. Check the troubleshooting section above
2. Search for similar issues in the project's issue tracker
3. Review the project documentation in the `context/` folder
4. Ask the team in your project's communication channel
5. Create a new issue with detailed information:
   - What you were trying to do
   - What happened
   - Error messages (full text)
   - Your environment (OS, Node version, etc.)

---

## 📝 Current Implementation Status

**Completed Units**:
- ✅ Unit 01 — Project Setup
- ✅ Unit 02 — Database & Student Foundation
  - ✅ Unit 02A — Core Database Schema
  - ✅ Unit 02B — Student Core Data Model
  - ✅ Unit 02C — Student Profile Structure

**Next Up**:
- ⏳ Unit 03 — Authentication & Role Synchronization
- ⏳ Unit 04 — Student Profile Management
- ⏳ Unit 05 — Excel Bulk Upload

See `context/progress-tracker.md` for detailed implementation progress.

---

## 🎉 You're Ready!

You should now have a fully functional local development environment for CampusHire. Happy coding! 🚀

If you have any questions or need help, don't hesitate to reach out to the team.

---

**Last Updated**: September 2026  
**Project Version**: 0.1.0 (Early Development)
