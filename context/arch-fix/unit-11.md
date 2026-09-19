You are continuing implementation of the existing CampusHire codebase.

IMPORTANT PROJECT STATE:

The project has already completed ARCH-FIX1 phases P1 through P8.

Those completed phases established the current:
- authentication and authorization
- department isolation
- unified drive architecture
- Master Drive / Department Drive structure
- department assignment
- drive lifecycle
- publish/lock behavior
- department overrides
- eligibility foundation
- application field configuration
- existing student registration/access-request workflow
- existing Excel import
- existing dashboards
- existing notifications/audit infrastructure where applicable

DO NOT rebuild these systems from scratch.

Before changing anything:

1. Inspect the current codebase.
2. Inspect the current Prisma schema and migrations.
3. Inspect the existing implementation of the relevant domain.
4. Identify what is already implemented.
5. Reuse existing models, actions, queries, schemas, utilities, components, authorization helpers and UI patterns.
6. Extend existing systems instead of creating duplicate systems.
7. Check all callers before changing shared contracts.
8. Do not rename/restructure working architecture unless required by a verified defect.
9. Do not implement unrelated future phases.
10. Do not assume the old architecture still exists; the current code is the source of truth.

DATABASE SAFETY:

- Never run `prisma migrate dev` against the connected Neon database.
- Never run database reset commands.
- Never use destructive reset flags.
- Never drop tables/columns/data automatically.
- Never delete production data automatically.
- Inspect migration history before changing schema.
- Check live-schema compatibility before risky migrations.
- For destructive or irreversible changes:
  1. inspect dependencies,
  2. produce an impact/dry-run report,
  3. explain exactly what would change,
  4. stop for confirmation before executing it.
- Prefer additive migrations.
- Use the project's established migration/deployment process.
- Preserve existing data.

AUTHORIZATION:

Every server-side mutation must enforce authorization independently of the UI.

Never trust:
- IDs from the client
- department IDs from the client
- role claims alone
- editable/read-only flags from the client
- eligibility results from the client
- application field values from the client

After implementation:

- run relevant tests
- run TypeScript checks
- run lint where appropriate
- verify affected Server Actions/routes
- verify authorization
- verify database integrity
- inspect for duplicate architecture
- report exactly what changed
- report migrations
- report tests performed
- report unresolved issues

Do not claim something was verified unless you actually verified it.



Perform the final production-readiness verification of CampusHire.

IMPORTANT:

This is primarily a verification and defect-fixing phase.

Do not introduce new architecture unless required to fix a verified defect.

Do not claim verification without actually testing it.

==================================================
1. STUDENT END-TO-END
==================================================

Verify:

Clerk signup
→ CampusHire User
→ master student matching
→ direct access OR access request
→ Admin approval/rejection
→ Student dashboard
→ eligible drives
→ drive details
→ application form
→ auto-filled fields
→ editable/read-only fields
→ acknowledgement
→ submission
→ ApplicationSnapshot
→ confirmation
→ My Applications
→ recruitment status
→ placement status

==================================================
2. DEPARTMENT ADMIN END-TO-END
==================================================

Verify:

Login
→ own department
→ student roster
→ access requests
→ assigned drives
→ configure drive
→ auto-fill configuration
→ eligibility
→ batch selection
→ recruitment review
→ preview
→ publish
→ locked published drive
→ eligible students
→ applications
→ recruitment stages
→ stage transitions
→ placement
→ exports
→ audit/activity

==================================================
3. SUPER ADMIN END-TO-END
==================================================

Verify:

Login
→ departments
→ Admin invitations
→ Admin management
→ Master Drive
→ Admin permissions
→ recruitment pipeline
→ department assignment
→ department status monitoring
→ published drive modification
→ applications
→ placement/global reports
→ stage approval
→ announcements
→ audit logs
→ system settings

==================================================
4. CRITICAL BUSINESS RULES
==================================================

Verify all of the following:

1. A placed student is permanently excluded from future placement drives.

2. Placement is checked before other eligibility rules.

3. Batch targeting works.

4. Department isolation works.

5. Unpublished drives are inaccessible to students.

6. Students cannot access another department's drives.

7. Duplicate applications are blocked.

8. Submitted applications cannot be edited.

9. Submitted applications cannot be withdrawn.

10. ApplicationSnapshot remains immutable.

11. Eligibility used by listing/application/notification is consistent.

12. Department Admin cannot modify a published Department Drive.

13. Super Admin can modify a published drive according to the defined rules.

14. Normal permitted configuration changes do not require approval.

15. Department Admin recruitment pipeline changes require Super Admin approval.

16. Admin cannot approve their own stage change request.

17. Rejected stage requests do not become active.

18. Dynamic recruitment stages work without hard-coded stage names.

19. Notifications are scoped correctly.

20. Unpublished drives do not notify students.

21. Placed students do not receive future placement-drive notifications.

22. Announcement targeting works.

23. Admin invitation does not use plaintext passwords.

24. Disabled Admins cannot access protected functionality.

25. Audit history is preserved.

==================================================
5. SECURITY TESTS
==================================================

Attempt direct unauthorized operations for:

- cross-department student
- cross-department drive
- cross-department application
- cross-department placement
- unpublished drive
- forged eligibility
- forged batch
- forged read-only application field
- duplicate application
- application edit
- withdrawal
- unauthorized stage transition
- unauthorized stage approval
- unauthorized published-drive modification
- unauthorized notification access
- disabled admin
- arbitrary department assignment during invitation

Test Server Actions directly where practical.

==================================================
6. DATABASE VERIFICATION
==================================================

Verify:

- foreign keys
- unique constraints
- relevant indexes
- migration state
- no orphan Department Drives
- no orphan Application Snapshots
- assignment/configuration consistency
- placement consistency
- stage/pipeline consistency
- notification recipient integrity
- audit records

Do not modify production data merely to make a test pass.

==================================================
7. LEGACY FIELD REVIEW
==================================================

Inspect legacy fields.

For each candidate:

- search all readers
- search all writers
- verify backfill
- verify replacement
- verify fallback usage
- verify historical data

Do NOT drop anything automatically.

If safe cleanup is possible, provide a migration plan.

==================================================
8. TEST SUITE
==================================================

Run:

- unit tests
- integration tests
- authorization tests
- application tests
- eligibility tests
- placement tests
- recruitment tests
- notification tests
- invitation tests
- database tests
- TypeScript check
- lint
- production build

Fix verified failures where appropriate.

==================================================
9. REGRESSION CHECK
==================================================

Ensure existing working functionality still works:

- Clerk authentication
- Clerk webhook
- role synchronization
- student roster matching
- student access requests
- Excel import
- profile completion
- package/Decimal formatting
- student dashboard
- Department Admin dashboard
- Super Admin dashboard
- existing audit logs
- existing notifications

==================================================
10. FINAL REPORT
==================================================

Produce a structured final report:

A. Implemented
B. Verified
C. Tests passed
D. Tests failed
E. Security findings
F. Database/migration state
G. Legacy fields remaining
H. Performance findings
I. Remaining issues
J. Manual verification still required
K. Production-readiness concerns

Do not say "production ready" unless the evidence supports it.

If something could not be tested, explicitly state:

NOT VERIFIED

rather than assuming it works.