/**
 * Mongolian Payroll Calculation Module
 * 
 * Монголын хууль тогтоомжийн дагуу цалин бодох модуль.
 * 
 * Татвар, шимтгэлийн хувь (2024 оны байдлаар):
 * - ХХОАТ (Хувь хүний орлогын албан татвар): 10%
 * - НДШ (Нийгмийн даатгалын шимтгэл):
 *   - Ажилтан: 12.5% (Тэтгэврийн 7% + ҮОМШ 1% + Тэтгэмж 0.5% + Ажилгүйдэл 0.5% + ЭМДШ 3.5%)
 *   - Ажил олгогч: 13.5% (Тэтгэврийн 8.5% + ҮОМШ 1% + Тэтгэмж 1% + Ажилгүйдэл 0.5% + ЭМДШ 2.5%)
 */

// Social Insurance rates (as of 2024)
export const SOCIAL_INSURANCE_RATES = {
  employee: {
    pension: 0.07,           // Тэтгэвэр 7%
    healthInsurance: 0.035,  // ЭМДШ 3.5%
    unemployment: 0.005,     // Ажилгүйдэл 0.5%
    benefit: 0.005,          // Тэтгэмж 0.5%
    workplace: 0.01,         // ҮОМШ 1%
    total: 0.125,            // Нийт 12.5%
  },
  employer: {
    pension: 0.085,          // Тэтгэвэр 8.5%
    healthInsurance: 0.025,  // ЭМДШ 2.5%
    unemployment: 0.005,     // Ажилгүйдэл 0.5%
    benefit: 0.01,           // Тэтгэмж 1%
    workplace: 0.01,         // ҮОМШ 1%
    total: 0.135,            // Нийт 13.5%
  },
};

// Personal Income Tax rate
export const PIT_RATE = 0.10; // 10%

// Minimum wage (as of 2024)
export const MINIMUM_WAGE = 660000; // ₮660,000

// Maximum social insurance base (32 times minimum wage)
export const MAX_SOCIAL_INSURANCE_BASE = MINIMUM_WAGE * 32; // ₮21,120,000

// Tax exemption threshold
export const TAX_EXEMPTION = 0; // Currently no basic exemption in Mongolia

export interface PayrollInput {
  baseSalary: number;        // Үндсэн цалин
  overtime?: number;         // Илүү цаг
  bonus?: number;            // Урамшуулал
  allowance?: number;        // Нэмэгдэл (унаа, хоол гэх мэт)
  deductions?: number;       // Бусад суутгал (зээл, торгууль гэх мэт)
  taxExempt?: boolean;       // Татвараас чөлөөлөгдсөн эсэх
}

export interface PayrollResult {
  // Gross earnings
  grossSalary: number;       // Нийт цалин (татварын өмнөх)
  baseSalary: number;
  overtime: number;
  bonus: number;
  allowance: number;

  // Social Insurance (Employee portion)
  socialInsurance: {
    pension: number;         // Тэтгэвэр 7%
    healthInsurance: number; // ЭМДШ 3.5%
    unemployment: number;    // Ажилгүйдэл 0.5%
    benefit: number;         // Тэтгэмж 0.5%
    workplace: number;       // ҮОМШ 1%
    total: number;           // Нийт 12.5%
  };

  // Social Insurance (Employer portion)
  employerContribution: {
    pension: number;
    healthInsurance: number;
    unemployment: number;
    benefit: number;
    workplace: number;
    total: number;
  };

  // Taxable income
  taxableIncome: number;     // Татвар ногдуулах орлого

  // Personal Income Tax
  pit: number;               // ХХОАТ (10%)

  // Other deductions
  otherDeductions: number;

  // Net salary
  netSalary: number;         // Гарт олгох цалин

  // Summary
  totalDeductions: number;   // Нийт суутгал
  totalEmployerCost: number; // Ажил олгогчийн нийт зардал
}

/**
 * Calculate Mongolian payroll
 * 
 * @param input - Payroll input data
 * @returns Complete payroll calculation
 */
export function calculatePayroll(input: PayrollInput): PayrollResult {
  const baseSalary = input.baseSalary || 0;
  const overtime = input.overtime || 0;
  const bonus = input.bonus || 0;
  const allowance = input.allowance || 0;
  const otherDeductions = input.deductions || 0;

  // Calculate gross salary
  const grossSalary = baseSalary + overtime + bonus + allowance;

  // Social insurance base (capped at maximum)
  const socialInsuranceBase = Math.min(grossSalary, MAX_SOCIAL_INSURANCE_BASE);

  // Employee social insurance contributions
  const employeeSI = {
    pension: Math.round(socialInsuranceBase * SOCIAL_INSURANCE_RATES.employee.pension),
    healthInsurance: Math.round(socialInsuranceBase * SOCIAL_INSURANCE_RATES.employee.healthInsurance),
    unemployment: Math.round(socialInsuranceBase * SOCIAL_INSURANCE_RATES.employee.unemployment),
    benefit: Math.round(socialInsuranceBase * SOCIAL_INSURANCE_RATES.employee.benefit),
    workplace: Math.round(socialInsuranceBase * SOCIAL_INSURANCE_RATES.employee.workplace),
    total: 0,
  };
  employeeSI.total = employeeSI.pension + employeeSI.healthInsurance + 
                     employeeSI.unemployment + employeeSI.benefit + employeeSI.workplace;

  // Employer social insurance contributions
  const employerSI = {
    pension: Math.round(socialInsuranceBase * SOCIAL_INSURANCE_RATES.employer.pension),
    healthInsurance: Math.round(socialInsuranceBase * SOCIAL_INSURANCE_RATES.employer.healthInsurance),
    unemployment: Math.round(socialInsuranceBase * SOCIAL_INSURANCE_RATES.employer.unemployment),
    benefit: Math.round(socialInsuranceBase * SOCIAL_INSURANCE_RATES.employer.benefit),
    workplace: Math.round(socialInsuranceBase * SOCIAL_INSURANCE_RATES.employer.workplace),
    total: 0,
  };
  employerSI.total = employerSI.pension + employerSI.healthInsurance + 
                     employerSI.unemployment + employerSI.benefit + employerSI.workplace;

  // Taxable income = Gross - Employee SI - Tax Exemption
  let taxableIncome = grossSalary - employeeSI.total - TAX_EXEMPTION;
  taxableIncome = Math.max(0, taxableIncome); // Cannot be negative

  // Personal Income Tax (PIT/ХХОАТ)
  let pit = 0;
  if (!input.taxExempt) {
    pit = Math.round(taxableIncome * PIT_RATE);
  }

  // Total deductions
  const totalDeductions = employeeSI.total + pit + otherDeductions;

  // Net salary
  const netSalary = grossSalary - totalDeductions;

  // Total employer cost
  const totalEmployerCost = grossSalary + employerSI.total;

  return {
    grossSalary,
    baseSalary,
    overtime,
    bonus,
    allowance,
    socialInsurance: employeeSI,
    employerContribution: employerSI,
    taxableIncome,
    pit,
    otherDeductions,
    netSalary,
    totalDeductions,
    totalEmployerCost,
  };
}

/**
 * Generate payslip earnings breakdown
 */
export function generateEarningsBreakdown(result: PayrollResult): Array<{
  code: string;
  name: string;
  amount: number;
}> {
  const earnings = [];

  if (result.baseSalary > 0) {
    earnings.push({ code: 'BASE', name: 'Үндсэн цалин', amount: result.baseSalary });
  }
  if (result.overtime > 0) {
    earnings.push({ code: 'OT', name: 'Илүү цаг', amount: result.overtime });
  }
  if (result.bonus > 0) {
    earnings.push({ code: 'BONUS', name: 'Урамшуулал', amount: result.bonus });
  }
  if (result.allowance > 0) {
    earnings.push({ code: 'ALLOW', name: 'Нэмэгдэл', amount: result.allowance });
  }

  return earnings;
}

/**
 * Generate payslip deductions breakdown
 */
export function generateDeductionsBreakdown(result: PayrollResult): Array<{
  code: string;
  name: string;
  amount: number;
}> {
  const deductions = [];

  deductions.push({
    code: 'SI_PENSION',
    name: 'НДШ - Тэтгэвэр (7%)',
    amount: result.socialInsurance.pension,
  });
  deductions.push({
    code: 'SI_HEALTH',
    name: 'НДШ - ЭМДШ (3.5%)',
    amount: result.socialInsurance.healthInsurance,
  });
  deductions.push({
    code: 'SI_UNEMP',
    name: 'НДШ - Ажилгүйдэл (0.5%)',
    amount: result.socialInsurance.unemployment,
  });
  deductions.push({
    code: 'SI_BENEFIT',
    name: 'НДШ - Тэтгэмж (0.5%)',
    amount: result.socialInsurance.benefit,
  });
  deductions.push({
    code: 'SI_WORK',
    name: 'НДШ - ҮОМШ (1%)',
    amount: result.socialInsurance.workplace,
  });
  
  if (result.pit > 0) {
    deductions.push({
      code: 'PIT',
      name: 'ХХОАТ (10%)',
      amount: result.pit,
    });
  }

  if (result.otherDeductions > 0) {
    deductions.push({
      code: 'OTHER',
      name: 'Бусад суутгал',
      amount: result.otherDeductions,
    });
  }

  return deductions;
}

/**
 * Calculate overtime rate based on when overtime occurred
 */
export function calculateOvertimeRate(
  hourlyRate: number,
  hours: number,
  type: 'regular' | 'night' | 'holiday' | 'nightHoliday'
): number {
  // Mongolian Labor Law overtime rates
  const rates = {
    regular: 1.5,      // Энгийн илүү цаг 150%
    night: 1.5,        // Шөнийн илүү цаг 150%
    holiday: 2.0,      // Амралтын өдөр 200%
    nightHoliday: 2.0, // Шөнийн амралтын өдөр 200%
  };

  return Math.round(hourlyRate * hours * rates[type]);
}

/**
 * Format currency in Mongolian Tugrik
 */
export function formatMNT(amount: number): string {
  return new Intl.NumberFormat('mn-MN', {
    style: 'currency',
    currency: 'MNT',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Monthly payroll report generator
 */
export interface MonthlyPayrollReport {
  period: string;
  employees: Array<{
    employeeId: string;
    employeeName: string;
    grossSalary: number;
    socialInsurance: number;
    pit: number;
    netSalary: number;
  }>;
  totals: {
    grossSalary: number;
    employeeSI: number;
    employerSI: number;
    pit: number;
    netSalary: number;
    totalCost: number;
  };
}

export function generateMonthlyReport(
  period: string,
  payrollResults: Array<{ employeeId: string; employeeName: string; result: PayrollResult }>
): MonthlyPayrollReport {
  const employees = payrollResults.map(p => ({
    employeeId: p.employeeId,
    employeeName: p.employeeName,
    grossSalary: p.result.grossSalary,
    socialInsurance: p.result.socialInsurance.total,
    pit: p.result.pit,
    netSalary: p.result.netSalary,
  }));

  const totals = {
    grossSalary: payrollResults.reduce((sum, p) => sum + p.result.grossSalary, 0),
    employeeSI: payrollResults.reduce((sum, p) => sum + p.result.socialInsurance.total, 0),
    employerSI: payrollResults.reduce((sum, p) => sum + p.result.employerContribution.total, 0),
    pit: payrollResults.reduce((sum, p) => sum + p.result.pit, 0),
    netSalary: payrollResults.reduce((sum, p) => sum + p.result.netSalary, 0),
    totalCost: payrollResults.reduce((sum, p) => sum + p.result.totalEmployerCost, 0),
  };

  return { period, employees, totals };
}

/**
 * Social Insurance Declaration (НДШ тайлан) for submission
 */
export interface SocialInsuranceDeclaration {
  employerRegNo: string;     // Ажил олгогчийн РД
  period: string;            // Тайлант үе (YYYY-MM)
  employees: Array<{
    registerNo: string;       // Иргэний РД
    socialInsuranceNo: string;// НД-ийн дугаар
    fullName: string;
    salary: number;
    employeeContribution: number;
    employerContribution: number;
  }>;
  totalEmployeeContribution: number;
  totalEmployerContribution: number;
  grandTotal: number;
}

/**
 * PIT Declaration (ХХОАТ тайлан) for submission
 */
export interface PITDeclaration {
  employerTIN: string;       // Ажил олгогчийн ТТД
  period: string;            // Тайлант үе (YYYY-MM)
  employees: Array<{
    registerNo: string;       // Иргэний РД
    tin: string;              // Татвар төлөгчийн дугаар
    fullName: string;
    grossIncome: number;
    socialInsurance: number;
    taxableIncome: number;
    taxAmount: number;
  }>;
  totalTax: number;
}
