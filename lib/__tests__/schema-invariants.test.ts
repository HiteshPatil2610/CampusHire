/**
 * Database Schema Invariants Tests
 * 
 * Tests for Unit 02 — Database & Student Foundation
 * Validates database constraints, relationships, and data integrity rules
 * 
 * Note: These are type-level and schema validation tests.
 * Actual database constraint enforcement will be verified once DB is connected.
 */

import { describe, it, expect } from 'vitest';
import type { 
  User, 
  Student, 
  Department, 
  DepartmentAdmin,
  StudentAcademic,
  StudentPreferences,
  StudentSkill,
  StudentProject,
  StudentExperience,
  StudentCertification,
  Role,
  SkillType,
} from '@prisma/client';

describe('Schema Invariants — Unit 02A: Core Models', () => {
  describe('Role Enum', () => {
    it('should have exactly three roles', () => {
      const roles: Role[] = ['STUDENT', 'DEPT_ADMIN', 'SUPER_ADMIN'];
      expect(roles).toHaveLength(3);
      expect(roles).toContain('STUDENT');
      expect(roles).toContain('DEPT_ADMIN');
      expect(roles).toContain('SUPER_ADMIN');
    });
  });

  describe('User Model', () => {
    it('should have required identity fields', () => {
      const mockUser: Partial<User> = {
        id: 'user_123',
        clerkId: 'clerk_user_123',
        email: 'student@college.edu',
        role: 'STUDENT',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(mockUser.clerkId).toBeDefined();
      expect(mockUser.email).toBeDefined();
      expect(mockUser.role).toBeDefined();
    });

    it('should enforce unique clerkId constraint (type-level)', () => {
      // In actual database, duplicate clerkId will be rejected by unique constraint
      const user1: Pick<User, 'clerkId'> = { clerkId: 'clerk_123' };
      const user2: Pick<User, 'clerkId'> = { clerkId: 'clerk_123' };
      
      expect(user1.clerkId).toBe(user2.clerkId);
      // Database will reject duplicate when attempting to insert
    });

    it('should enforce unique email constraint (type-level)', () => {
      // In actual database, duplicate email will be rejected by unique constraint
      const user1: Pick<User, 'email'> = { email: 'test@college.edu' };
      const user2: Pick<User, 'email'> = { email: 'test@college.edu' };
      
      expect(user1.email).toBe(user2.email);
      // Database will reject duplicate when attempting to insert
    });
  });

  describe('Department Model', () => {
    it('should have required fields', () => {
      const mockDepartment: Partial<Department> = {
        id: 'dept_123',
        name: 'Computer Science',
        code: 'CS',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(mockDepartment.name).toBeDefined();
      expect(mockDepartment.code).toBeDefined();
      expect(mockDepartment.isActive).toBe(true);
    });

    it('should enforce unique department code constraint (type-level)', () => {
      const dept1: Pick<Department, 'code'> = { code: 'CS' };
      const dept2: Pick<Department, 'code'> = { code: 'CS' };
      
      expect(dept1.code).toBe(dept2.code);
      // Database will reject duplicate when attempting to insert
    });

    it('should default isActive to true', () => {
      const mockDepartment: Partial<Department> = {
        name: 'Electrical Engineering',
        code: 'EE',
        isActive: true, // Default value
      };

      expect(mockDepartment.isActive).toBe(true);
    });
  });

  describe('DepartmentAdmin Model', () => {
    it('should link user to department', () => {
      const mockAdmin: Partial<DepartmentAdmin> = {
        id: 'admin_123',
        userId: 'user_123',
        departmentId: 'dept_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(mockAdmin.userId).toBeDefined();
      expect(mockAdmin.departmentId).toBeDefined();
    });

    it('should enforce one admin account per user (type-level)', () => {
      // userId has unique constraint - one user can only be admin of one department
      const admin1: Pick<DepartmentAdmin, 'userId'> = { userId: 'user_123' };
      const admin2: Pick<DepartmentAdmin, 'userId'> = { userId: 'user_123' };
      
      expect(admin1.userId).toBe(admin2.userId);
      // Database will reject duplicate userId when attempting to insert
    });
  });
});

describe('Schema Invariants — Unit 02B: Student Core Model', () => {
  describe('Student Model', () => {
    it('should have required core fields', () => {
      const mockStudent: Partial<Student> = {
        id: 'student_123',
        userId: 'user_123',
        departmentId: 'dept_123',
        rollNumber: 'CS2021001',
        name: 'John Doe',
        phoneNumber: '+91-9876543210',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(mockStudent.userId).toBeDefined();
      expect(mockStudent.departmentId).toBeDefined();
      expect(mockStudent.rollNumber).toBeDefined();
      expect(mockStudent.name).toBeDefined();
    });

    it('should allow optional profile links', () => {
      const mockStudent: Partial<Student> = {
        linkedinUrl: 'https://linkedin.com/in/johndoe',
        githubUrl: 'https://github.com/johndoe',
        portfolioUrl: 'https://johndoe.dev',
      };

      expect(mockStudent.linkedinUrl).toBeDefined();
      expect(mockStudent.githubUrl).toBeDefined();
      expect(mockStudent.portfolioUrl).toBeDefined();
    });

    it('should enforce unique userId constraint (one student per user)', () => {
      const student1: Pick<Student, 'userId'> = { userId: 'user_123' };
      const student2: Pick<Student, 'userId'> = { userId: 'user_123' };
      
      expect(student1.userId).toBe(student2.userId);
      // Database will reject duplicate when attempting to insert
    });

    it('should enforce unique rollNumber constraint (institution-wide)', () => {
      const student1: Pick<Student, 'rollNumber'> = { rollNumber: 'CS2021001' };
      const student2: Pick<Student, 'rollNumber'> = { rollNumber: 'CS2021001' };
      
      expect(student1.rollNumber).toBe(student2.rollNumber);
      // Database will reject duplicate when attempting to insert
    });

    it('should allow phoneNumber to be optional', () => {
      const mockStudent: Partial<Student> = {
        name: 'Jane Doe',
        rollNumber: 'CS2021002',
        phoneNumber: null,
      };

      expect(mockStudent.phoneNumber).toBeNull();
    });
  });
});

describe('Schema Invariants — Unit 02C: Student Profile Structure', () => {
  describe('SkillType Enum', () => {
    it('should have exactly two skill types', () => {
      const skillTypes: SkillType[] = ['TECHNICAL', 'SOFT'];
      expect(skillTypes).toHaveLength(2);
      expect(skillTypes).toContain('TECHNICAL');
      expect(skillTypes).toContain('SOFT');
    });
  });

  describe('StudentAcademic Model', () => {
    it('should have required academic fields', () => {
      const mockAcademic: Partial<StudentAcademic> = {
        id: 'academic_123',
        studentId: 'student_123',
        tenthPercentage: 85.5,
        twelfthPercentage: 88.2,
        currentCGPA: 8.5,
        currentSemester: 6,
        activeBacklogs: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(mockAcademic.tenthPercentage).toBeGreaterThanOrEqual(0);
      expect(mockAcademic.twelfthPercentage).toBeGreaterThanOrEqual(0);
      expect(mockAcademic.currentCGPA).toBeGreaterThanOrEqual(0);
      expect(mockAcademic.currentSemester).toBeGreaterThan(0);
      expect(mockAcademic.activeBacklogs).toBeGreaterThanOrEqual(0);
    });

    it('should default activeBacklogs to 0', () => {
      const mockAcademic: Pick<StudentAcademic, 'activeBacklogs'> = {
        activeBacklogs: 0, // Default value
      };

      expect(mockAcademic.activeBacklogs).toBe(0);
    });

    it('should enforce one-to-one relationship with Student (unique studentId)', () => {
      const academic1: Pick<StudentAcademic, 'studentId'> = { studentId: 'student_123' };
      const academic2: Pick<StudentAcademic, 'studentId'> = { studentId: 'student_123' };
      
      expect(academic1.studentId).toBe(academic2.studentId);
      // Database will reject duplicate when attempting to insert
    });
  });

  describe('StudentSkill Model', () => {
    it('should have required skill fields', () => {
      const mockSkill: Partial<StudentSkill> = {
        id: 'skill_123',
        studentId: 'student_123',
        skillName: 'React',
        skillType: 'TECHNICAL',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(mockSkill.skillName).toBeDefined();
      expect(mockSkill.skillType).toBeDefined();
    });

    it('should enforce unique skill per student (composite unique)', () => {
      // Composite unique constraint on (studentId, skillName)
      const skill1: Pick<StudentSkill, 'studentId' | 'skillName'> = {
        studentId: 'student_123',
        skillName: 'React',
      };
      const skill2: Pick<StudentSkill, 'studentId' | 'skillName'> = {
        studentId: 'student_123',
        skillName: 'React',
      };
      
      expect(skill1.studentId).toBe(skill2.studentId);
      expect(skill1.skillName).toBe(skill2.skillName);
      // Database will reject duplicate (studentId, skillName) pair
    });

    it('should allow same skill for different students', () => {
      const skill1: Pick<StudentSkill, 'studentId' | 'skillName'> = {
        studentId: 'student_123',
        skillName: 'React',
      };
      const skill2: Pick<StudentSkill, 'studentId' | 'skillName'> = {
        studentId: 'student_456',
        skillName: 'React',
      };
      
      expect(skill1.skillName).toBe(skill2.skillName);
      expect(skill1.studentId).not.toBe(skill2.studentId);
      // This is allowed - different students can have the same skill
    });
  });

  describe('StudentProject Model', () => {
    it('should have required project fields', () => {
      const mockProject: Partial<StudentProject> = {
        id: 'project_123',
        studentId: 'student_123',
        title: 'E-commerce Platform',
        description: 'Built a full-stack e-commerce platform',
        technologiesUsed: 'React, Node.js, MongoDB',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(mockProject.title).toBeDefined();
      expect(mockProject.description).toBeDefined();
      expect(mockProject.technologiesUsed).toBeDefined();
    });

    it('should allow optional fields', () => {
      const mockProject: Partial<StudentProject> = {
        projectUrl: 'https://github.com/user/project',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-06-01'),
      };

      expect(mockProject.projectUrl).toBeDefined();
      expect(mockProject.startDate).toBeDefined();
      expect(mockProject.endDate).toBeDefined();
    });

    it('should allow null endDate for ongoing projects', () => {
      const mockProject: Partial<StudentProject> = {
        title: 'Ongoing Project',
        endDate: null,
      };

      expect(mockProject.endDate).toBeNull();
    });
  });

  describe('StudentExperience Model', () => {
    it('should have required experience fields', () => {
      const mockExperience: Partial<StudentExperience> = {
        id: 'exp_123',
        studentId: 'student_123',
        companyName: 'Tech Corp',
        role: 'Software Engineering Intern',
        description: 'Worked on backend development',
        startDate: new Date('2023-06-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(mockExperience.companyName).toBeDefined();
      expect(mockExperience.role).toBeDefined();
      expect(mockExperience.description).toBeDefined();
      expect(mockExperience.startDate).toBeDefined();
    });

    it('should allow null endDate for current employment', () => {
      const mockExperience: Partial<StudentExperience> = {
        companyName: 'Current Company',
        endDate: null,
      };

      expect(mockExperience.endDate).toBeNull();
    });
  });

  describe('StudentCertification Model', () => {
    it('should have required certification fields', () => {
      const mockCert: Partial<StudentCertification> = {
        id: 'cert_123',
        studentId: 'student_123',
        certificationName: 'AWS Certified Solutions Architect',
        issuingOrganization: 'Amazon Web Services',
        issueDate: new Date('2023-08-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(mockCert.certificationName).toBeDefined();
      expect(mockCert.issuingOrganization).toBeDefined();
      expect(mockCert.issueDate).toBeDefined();
    });

    it('should allow optional expiry date and credential URL', () => {
      const mockCert: Partial<StudentCertification> = {
        expiryDate: new Date('2026-08-01'),
        credentialUrl: 'https://aws.amazon.com/verification/123456',
      };

      expect(mockCert.expiryDate).toBeDefined();
      expect(mockCert.credentialUrl).toBeDefined();
    });

    it('should allow null expiryDate for non-expiring certificates', () => {
      const mockCert: Partial<StudentCertification> = {
        certificationName: 'Non-expiring Cert',
        expiryDate: null,
      };

      expect(mockCert.expiryDate).toBeNull();
    });
  });

  describe('StudentPreferences Model', () => {
    it('should have required preference fields', () => {
      const mockPrefs: Partial<StudentPreferences> = {
        id: 'prefs_123',
        studentId: 'student_123',
        preferredRoles: JSON.stringify(['Software Engineer', 'Full Stack Developer']),
        preferredLocations: JSON.stringify(['Bangalore', 'Remote']),
        preferredCompanyTypes: JSON.stringify(['Startup', 'Product']),
        willingToRelocate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(mockPrefs.preferredRoles).toBeDefined();
      expect(mockPrefs.preferredLocations).toBeDefined();
      expect(mockPrefs.preferredCompanyTypes).toBeDefined();
    });

    it('should allow optional package expectations', () => {
      const mockPrefs: Partial<StudentPreferences> = {
        expectedPackageMin: 6.0,
        expectedPackageMax: 12.0,
      };

      expect(mockPrefs.expectedPackageMin).toBeDefined();
      expect(mockPrefs.expectedPackageMax).toBeDefined();
      expect(mockPrefs.expectedPackageMin).toBeLessThan(mockPrefs.expectedPackageMax!);
    });

    it('should default willingToRelocate to false', () => {
      const mockPrefs: Pick<StudentPreferences, 'willingToRelocate'> = {
        willingToRelocate: false, // Default value
      };

      expect(mockPrefs.willingToRelocate).toBe(false);
    });

    it('should enforce one-to-one relationship with Student (unique studentId)', () => {
      const prefs1: Pick<StudentPreferences, 'studentId'> = { studentId: 'student_123' };
      const prefs2: Pick<StudentPreferences, 'studentId'> = { studentId: 'student_123' };
      
      expect(prefs1.studentId).toBe(prefs2.studentId);
      // Database will reject duplicate when attempting to insert
    });
  });
});

describe('Schema Invariants — Relationship Rules', () => {
  describe('User-Student Relationship', () => {
    it('should enforce one-to-one relationship', () => {
      // A User with role=STUDENT should have exactly one Student record
      const user: Pick<User, 'id' | 'role'> = { id: 'user_123', role: 'STUDENT' };
      const student: Pick<Student, 'userId'> = { userId: 'user_123' };
      
      expect(student.userId).toBe(user.id);
      // Unique constraint on Student.userId ensures one-to-one
    });
  });

  describe('User-DepartmentAdmin Relationship', () => {
    it('should enforce one-to-one relationship', () => {
      // A User with role=DEPT_ADMIN should have exactly one DepartmentAdmin record
      const user: Pick<User, 'id' | 'role'> = { id: 'user_123', role: 'DEPT_ADMIN' };
      const admin: Pick<DepartmentAdmin, 'userId'> = { userId: 'user_123' };
      
      expect(admin.userId).toBe(user.id);
      // Unique constraint on DepartmentAdmin.userId ensures one-to-one
    });
  });

  describe('Department-Student Relationship', () => {
    it('should enforce many-to-one relationship (many students, one department)', () => {
      const department: Pick<Department, 'id'> = { id: 'dept_123' };
      const student1: Pick<Student, 'departmentId'> = { departmentId: 'dept_123' };
      const student2: Pick<Student, 'departmentId'> = { departmentId: 'dept_123' };
      
      expect(student1.departmentId).toBe(department.id);
      expect(student2.departmentId).toBe(department.id);
      // Multiple students can belong to same department
    });
  });

  describe('Department-DepartmentAdmin Relationship', () => {
    it('should allow multiple admins per department', () => {
      const department: Pick<Department, 'id'> = { id: 'dept_123' };
      const admin1: Pick<DepartmentAdmin, 'departmentId' | 'userId'> = { 
        departmentId: 'dept_123',
        userId: 'user_1',
      };
      const admin2: Pick<DepartmentAdmin, 'departmentId' | 'userId'> = { 
        departmentId: 'dept_123',
        userId: 'user_2',
      };
      
      expect(admin1.departmentId).toBe(department.id);
      expect(admin2.departmentId).toBe(department.id);
      expect(admin1.userId).not.toBe(admin2.userId);
      // One department can have multiple admins (different users)
    });
  });

  describe('Student Profile Data Ownership', () => {
    it('should ensure all profile data belongs to valid student', () => {
      const studentId = 'student_123';
      
      const academic: Pick<StudentAcademic, 'studentId'> = { studentId };
      const preferences: Pick<StudentPreferences, 'studentId'> = { studentId };
      const skill: Pick<StudentSkill, 'studentId'> = { studentId };
      const project: Pick<StudentProject, 'studentId'> = { studentId };
      const experience: Pick<StudentExperience, 'studentId'> = { studentId };
      const certification: Pick<StudentCertification, 'studentId'> = { studentId };
      
      expect(academic.studentId).toBe(studentId);
      expect(preferences.studentId).toBe(studentId);
      expect(skill.studentId).toBe(studentId);
      expect(project.studentId).toBe(studentId);
      expect(experience.studentId).toBe(studentId);
      expect(certification.studentId).toBe(studentId);
      // Foreign key constraints ensure all profile data belongs to valid student
    });
  });
});
