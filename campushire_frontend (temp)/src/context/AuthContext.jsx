import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { STUDENT, DEPT_ADMIN, SUPER_ADMIN } from '../data/mockData';

const AUTH_STORAGE_KEY = 'ch_auth_session_v1';

const DEFAULT_ACCOUNTS = {
  student: {
    id: 'usr_student_01',
    name: STUDENT.name,
    email: STUDENT.email,
    role: 'student',
    rollNo: STUDENT.rollNo,
    department: STUDENT.department,
    cgpa: STUDENT.cgpa,
    initials: 'AS',
    avatar: null,
  },
  admin: {
    id: 'usr_admin_01',
    name: DEPT_ADMIN.name,
    email: DEPT_ADMIN.email,
    role: 'admin',
    department: DEPT_ADMIN.department,
    initials: 'DA',
    avatar: null,
  },
  superadmin: {
    id: 'usr_superadmin_01',
    name: SUPER_ADMIN.name,
    email: SUPER_ADMIN.email,
    role: 'superadmin',
    department: 'TPO Central',
    initials: 'TH',
    avatar: null,
  },
};

function getStoredSession() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.token && parsed?.user) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to parse stored session:', err);
  }
  // Default to student demo user
  return {
    token: 'mock_jwt_token_student_session',
    user: DEFAULT_ACCOUNTS.student,
    role: 'student',
  };
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(getStoredSession);

  // Sync token to localStorage
  useEffect(() => {
    try {
      if (session?.token) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch (err) {
      console.warn('Storage sync error:', err);
    }
  }, [session]);

  const login = useCallback(async (email, password, forcedRole = null) => {
    // Determine role from forcedRole, email prefix, or match
    let determinedRole = forcedRole;
    if (!determinedRole) {
      const lower = (email || '').toLowerCase();
      if (lower.includes('tpo') || lower.includes('super')) {
        determinedRole = 'superadmin';
      } else if (lower.includes('admin')) {
        determinedRole = 'admin';
      } else {
        determinedRole = 'student';
      }
    }

    const baseUser = DEFAULT_ACCOUNTS[determinedRole] || DEFAULT_ACCOUNTS.student;
    let userDepartment = baseUser.department;
    if (determinedRole === 'admin') {
      const lower = (email || '').toLowerCase();
      if (lower.includes('ece')) userDepartment = 'ECE';
      else if (lower.includes('mech')) userDepartment = 'Mech';
      else if (lower.includes('civil')) userDepartment = 'Civil';
      else if (lower.includes('it')) userDepartment = 'IT';
      else userDepartment = 'CSE';
    }

    const user = {
      ...baseUser,
      email: email || baseUser.email,
      department: userDepartment || baseUser.department,
    };

    const newSession = {
      token: `jwt_${determinedRole}_${Date.now()}`,
      user,
      role: determinedRole,
    };

    setSession(newSession);
    return newSession;
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }, []);

  const switchRole = useCallback((role) => {
    if (!DEFAULT_ACCOUNTS[role]) return;
    const user = DEFAULT_ACCOUNTS[role];
    const newSession = {
      token: `jwt_${role}_${Date.now()}`,
      user,
      role,
    };
    setSession(newSession);
  }, []);

  const setDepartment = useCallback((dept) => {
    setSession((prev) => {
      if (!prev || !prev.user) return prev;
      return {
        ...prev,
        user: {
          ...prev.user,
          department: dept,
        },
      };
    });
  }, []);

  const value = {
    session,
    user: session?.user || null,
    role: session?.role || null,
    token: session?.token || null,
    isAuthenticated: !!session?.token,
    login,
    logout,
    switchRole,
    setDepartment,
    availableAccounts: DEFAULT_ACCOUNTS,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
