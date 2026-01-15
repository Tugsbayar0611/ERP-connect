import { z } from 'zod';
import {
  insertUserSchema, users,
  insertEmployeeSchema, employees,
  insertDepartmentSchema, departments,
  insertAttendanceDaySchema, attendanceDays,
  insertPayrollRunSchema, payrollRuns,
  insertTenantSchema, tenants,
  insertDocumentSchema, documents
} from './schema';

type SafeUser = Omit<typeof users.$inferSelect, "passwordHash">;
const safeUserSchema = z.custom<SafeUser>();

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/auth/login',
      input: z.object({
        username: z.string(),
        password: z.string(),
      }),
      responses: {
        200: safeUserSchema,
        401: errorSchemas.unauthorized,
      }
    },
    logout: {
      method: 'POST' as const,
      path: '/api/auth/logout',
      responses: {
        200: z.void(),
      }
    },
    me: {
      method: 'GET' as const,
      path: '/api/auth/me',
      responses: {
        200: safeUserSchema,
        401: errorSchemas.unauthorized,
      }
    }
  },
  employees: {
    list: {
      method: 'GET' as const,
      path: '/api/employees',
      responses: {
        200: z.array(z.custom<typeof employees.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/employees/:id',
      responses: {
        200: z.custom<typeof employees.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/employees',
      input: insertEmployeeSchema,
      responses: {
        201: z.custom<typeof employees.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/employees/:id',
      input: insertEmployeeSchema.partial(),
      responses: {
        200: z.custom<typeof employees.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    }
  },
  departments: {
    list: {
      method: 'GET' as const,
      path: '/api/departments',
      responses: {
        200: z.array(z.custom<typeof departments.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/departments',
      input: insertDepartmentSchema,
      responses: {
        201: z.custom<typeof departments.$inferSelect>(),
      }
    }
  },
  attendance: {
    list: {
      method: 'GET' as const,
      path: '/api/attendance',
      responses: {
        200: z.array(z.custom<typeof attendanceDays.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/attendance',
      input: insertAttendanceDaySchema,
      responses: {
        201: z.custom<typeof attendanceDays.$inferSelect>(),
      }
    }
  },
  payroll: {
    list: {
      method: 'GET' as const,
      path: '/api/payroll-runs',
      responses: {
        200: z.array(z.custom<typeof payrollRuns.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/payroll-runs',
      input: insertPayrollRunSchema,
      responses: {
        201: z.custom<typeof payrollRuns.$inferSelect>(),
      }
    }
  },
  documents: {
    list: {
      method: 'GET' as const,
      path: '/api/documents',
      responses: {
        200: z.array(z.custom<typeof import('./schema').documents.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/documents',
      input: insertDocumentSchema,
      responses: {
        201: z.custom<typeof documents.$inferSelect>(),
      }
    }
  },
  stats: {
    get: {
      method: 'GET' as const,
      path: '/api/stats',
      responses: {
        200: z.object({
          totalEmployees: z.number(),
          activeEmployees: z.number(),
          totalDepartments: z.number(),
          monthlyPayroll: z.number(),
        })
      }
    }
  },
  company: {
    get: {
      method: 'GET' as const,
      path: '/api/company',
      responses: {
        200: z.custom<typeof tenants.$inferSelect>(),
        404: errorSchemas.notFound
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}