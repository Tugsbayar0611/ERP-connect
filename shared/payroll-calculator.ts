/**
 * Монголын цалингийн тооцоолол (Allowances болон Advances-тай)
 */

import {
  calculateMongolianSocialInsurance,
  calculateMongolianIncomeTax,
  calculatePITDeduction,
} from "./mongolian-validators";

export interface Allowance {
  id: string;
  code: string;
  name: string;
  amount: number;
  isTaxable: boolean;
  isSHI: boolean; // НДШ тооцох эсэх
  isPIT: boolean; // ХХОАТ тооцох эсэх
}

export interface SalaryAdvance {
  id: string;
  amount: number;
  deductedAmount: number;
  deductionType: "monthly" | "one-time";
  monthlyDeductionAmount?: number;
}

export interface PayrollCalculationInput {
  baseSalary: number; // Үндсэн цалин
  allowances?: Allowance[]; // Нэмэгдлүүд
  advances?: SalaryAdvance[]; // Урьдчилгаа/зээл
  otherDeductions?: { description: string; amount: number }[]; // Бусад суутгал (Meal, Supplies etc.)
  overtimeHours?: number; // Илүү цаг
  overtimeRate?: number; // Илүү цагийн хувь (default: 50% = 1.5x)
  bonus?: number; // Урамшуулал
  minimumWage?: number; // Хөдөлмөрийн хөлсний доод хэмжээ (default: 550,000₮)
  employeeSHIRate?: number; // Ажилтны НДШ хувь (default: 11.5%)
  employerSHIRate?: number; // Ажил олгогчийн НДШ хувь (default: 12.5%)
}

export interface PayrollCalculationResult {
  // Орлого
  baseSalary: number;
  allowances: {
    taxable: number; // Татвартай нэмэгдэл
    nonTaxable: number; // Татваргүй нэмэгдэл
    shiBase: number; // НДШ тооцоолох суурь (isSHI=true allowances)
    pitBase: number; // ХХОАТ тооцоолох суурь (isPIT=true allowances)
  };
  overtime: number;
  bonus: number;
  grossPay: number; // Нийт орлого (base + allowances + overtime + bonus)

  // Суутгал
  shi: {
    employee: number; // Ажилтны НДШ
    employer: number; // Ажил олгогчийн НДШ
    total: number;
    base: number; // НДШ тооцоолох суурь (cap-тай)
    cap: number; // НДШ дээд хязгаар
  };
  pit: {
    tax: number; // ХХОАТ
    deduction: number; // Хөнгөлөлт
    taxableIncome: number; // Татвартай орлого
    breakdown: Array<{ bracket: string; amount: number; rate: number; tax: number }>;
  };
  advances: {
    total: number; // Нийт урьдчилгаа
    deducted: number; // Энэ сард хасах дүн
    remaining: number; // Үлдсэн дүн
  };
  otherDeductions: {
    total: number;
    items: { description: string; amount: number }[];
  };

  // Эцсийн дүн
  totalDeductions: number; // Нийт суутгал (SHI + PIT + Advances + Other)
  netPay: number; // Цэвэр цалин
}

/**
 * Монголын цалингийн бүрэн тооцоолол
 */
export function calculateMongolianPayroll(input: PayrollCalculationInput): PayrollCalculationResult {
  const {
    baseSalary,
    allowances = [],
    advances = [],
    otherDeductions = [],
    overtimeHours = 0,
    overtimeRate = 1.5, // 50% нэмэгдэл = 1.5x
    bonus = 0,
    minimumWage = 550000, // 2025 оны доод хэмжээ
    employeeSHIRate = 11.5, // 2025 он: 11.5%
    employerSHIRate = 12.5, // 2025 он: 12.5%
  } = input;

  // ==========================================
  // 1. ОРЛОГО ТООЦООЛОЛ
  // ==========================================

  // Илүү цагийн цалин (цагт цалин × илүү цагийн хувь)
  const hourlyRate = baseSalary / 176; // Сарын 176 цаг (22 ажлын өдөр × 8 цаг)
  const overtime = Math.round(overtimeHours * hourlyRate * overtimeRate);

  // Нэмэгдлүүдийг ангилах
  let taxableAllowances = 0; // Татвартай нэмэгдэл
  let nonTaxableAllowances = 0; // Татваргүй нэмэгдэл
  let shiBaseAllowances = 0; // НДШ тооцоолох суурь (isSHI=true)
  let pitBaseAllowances = 0; // ХХОАТ тооцоолох суурь (isPIT=true)

  for (const allowance of allowances) {
    const amount = allowance.amount;

    if (allowance.isSHI) {
      shiBaseAllowances += amount;
    }
    if (allowance.isPIT) {
      pitBaseAllowances += amount;
    }
    if (allowance.isTaxable) {
      taxableAllowances += amount;
    } else {
      nonTaxableAllowances += amount;
    }
  }

  // Нийт орлого (Gross Pay)
  const grossPay = baseSalary + taxableAllowances + nonTaxableAllowances + overtime + bonus;

  // ==========================================
  // 2. НДШ ТООЦООЛОЛ
  // ==========================================

  // НДШ тооцоолох суурь = baseSalary + shiBaseAllowances + overtime + bonus (User requested: Base + Bonus + Overtime)
  const shiCalculationBase = baseSalary + shiBaseAllowances + overtime + bonus;
  const shiResult = calculateMongolianSocialInsurance(
    shiCalculationBase,
    employeeSHIRate,
    employerSHIRate,
    minimumWage
  );

  // ==========================================
  // 3. ХХОАТ ТООЦООЛОЛ
  // ==========================================

  // ХХОАТ тооцоолох суурь = (baseSalary + pitBaseAllowances + overtime + bonus) - НДШ (ажилтны)
  // User requested: (TotalGross - SHI) * 0.10. We use Taxable Gross here effectively.
  const pitCalculationBase = (baseSalary + pitBaseAllowances + overtime + bonus) - shiResult.employee;

  // Хөнгөлөлт
  const pitDeduction = calculatePITDeduction(pitCalculationBase);
  const taxableIncome = Math.max(0, pitCalculationBase - pitDeduction);

  // ХХОАТ тооцоолол (шатлал)
  const pitResult = calculateMongolianIncomeTax(taxableIncome);

  // ==========================================
  // 4. УРЬДЧИЛГАА/ЗЭЭЛ СУУТГАЛ
  // ==========================================

  let totalAdvanceAmount = 0;
  let advanceDeductionThisMonth = 0;
  let remainingAdvanceAmount = 0;

  for (const advance of advances) {
    totalAdvanceAmount += advance.amount;
    remainingAdvanceAmount += advance.amount - advance.deductedAmount;

    if (advance.deductionType === "monthly" && advance.monthlyDeductionAmount) {
      // Сар бүр тогтмол суутгал
      const remaining = advance.amount - advance.deductedAmount;
      advanceDeductionThisMonth += Math.min(remaining, advance.monthlyDeductionAmount);
    } else if (advance.deductionType === "one-time") {
      // Нэг удаагийн суутгал (үлдсэн дүнг бүгдийг нь хасах)
      const remaining = advance.amount - advance.deductedAmount;
      advanceDeductionThisMonth += remaining;
    }
  }

  // ==========================================
  // 5. ЭЦСИЙН ДҮН
  // ==========================================

  // Other Deductions
  const totalOtherDeductions = otherDeductions.reduce((sum, item) => sum + item.amount, 0);

  const totalDeductions = shiResult.employee + pitResult.tax + advanceDeductionThisMonth + totalOtherDeductions;
  const netPay = grossPay - totalDeductions;

  return {
    baseSalary,
    allowances: {
      taxable: taxableAllowances,
      nonTaxable: nonTaxableAllowances,
      shiBase: shiBaseAllowances,
      pitBase: pitBaseAllowances,
    },
    overtime,
    bonus,
    grossPay,

    shi: {
      employee: shiResult.employee,
      employer: shiResult.employer,
      total: shiResult.total,
      base: shiResult.shiBase,
      cap: shiResult.shiCap,
    },
    pit: {
      tax: pitResult.tax,
      deduction: pitDeduction,
      taxableIncome,
      breakdown: pitResult.breakdown,
    },
    advances: {
      total: totalAdvanceAmount,
      deducted: advanceDeductionThisMonth,
      remaining: remainingAdvanceAmount,
    },
    otherDeductions: {
      total: totalOtherDeductions,
      items: otherDeductions
    },

    totalDeductions,
    netPay,
  };
}
