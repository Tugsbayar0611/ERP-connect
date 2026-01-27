/**
 * Монголын онцлог валидаци функцүүд
 */

/**
 * Монголын Регистрийн дугаар (РД) валидаци
 * Формат: 2 үсэг (кирилл) + 8 оронтой тоо = 10 тэмдэгт
 * Жишээ: ИБ99061111, УА12345678
 * 
 * Алгоритм:
 * 1. Эхний 2 тэмдэгт: кирилл үсэг (А-Я)
 * 2. Дараагийн 8 тэмдэгт: тоо (0-9)
 * 3. Нийт 10 тэмдэгт
 */
export function validateMongolianNationalId(rd: string): { valid: boolean; error?: string } {
  if (!rd || typeof rd !== "string") {
    return { valid: false, error: "РД оруулах шаардлагатай" };
  }
  
  // Урт шалгах
  if (rd.length !== 10) {
    return { valid: false, error: `РД нь яг 10 тэмдэгт байх ёстой. Одоо ${rd.length} тэмдэгт байна.` };
  }
  
  // Эхний 2 тэмдэгт: кирилл үсэг байх ёстой
  const firstTwo = rd.substring(0, 2);
  const cyrillicRegex = /^[А-ЯЁ]{2}$/;
  if (!cyrillicRegex.test(firstTwo)) {
    return { valid: false, error: "РД-ийн эхний 2 тэмдэгт нь кирилл үсэг байх ёстой (жишээ: ИБ, УА, БА)" };
  }
  
  // Дараагийн 8 тэмдэгт: тоо байх ёстой
  const lastEight = rd.substring(2);
  if (!/^\d{8}$/.test(lastEight)) {
    return { valid: false, error: "РД-ийн сүүлийн 8 тэмдэгт нь тоо байх ёстой (жишээ: 99061111)" };
  }
  
  return { valid: true };
}

/**
 * Монголын ХХОАТ-ын дугаар валидаци
 * Формат: 7 оронтой тоо
 */
export function validateMongolianVATNo(vatNo: string): boolean {
  if (!vatNo || typeof vatNo !== "string") return false;
  
  // Зөвхөн тоо байх ёстой
  if (!/^\d+$/.test(vatNo)) return false;
  
  // 7 оронтой байх ёстой
  return vatNo.length === 7;
}

/**
 * Монголын утасны дугаар валидаци
 * Формат: 8 оронтой (99112233) эсвэл 10 оронтой (9911223344)
 */
export function validateMongolianPhone(phone: string): boolean {
  if (!phone || typeof phone !== "string") return false;
  
  // Бүх тоо, зураас, зайг арилгах
  const cleaned = phone.replace(/[\s-]/g, "");
  
  // 8 эсвэл 10 оронтой байх ёстой
  if (cleaned.length !== 8 && cleaned.length !== 10) return false;
  
  // Зөвхөн тоо байх ёстой
  return /^\d+$/.test(cleaned);
}

/**
 * ХХОАТ тооцоолол (ердийн хувь)
 * Монголд: 10% (ердийн), 5% (зарим бараа), 0% (татваргүй)
 */
export function calculateMongolianVAT(base: number, rate: number = 10): number {
  return Math.round(base * rate) / 100;
}

/**
 * ХХОАТ тооцоолол (шатлал) - Хувь хүний орлогын албан татвар
 * Монголын 2024 оны шатлал:
 * - 0 - 1,200,000₮: 0%
 * - 1,200,001 - 2,400,000₮: 10%
 * - 2,400,001 - 4,200,000₮: 20%
 * - 4,200,001₮+: 25%
 * 
 * @param grossIncome - Нийт орлого (сарын)
 * @returns { tax: number, breakdown: Array<{ bracket: string, amount: number, rate: number, tax: number }> }
 */
export function calculateMongolianIncomeTax(grossIncome: number): {
  tax: number;
  breakdown: Array<{ bracket: string; amount: number; rate: number; tax: number }>;
} {
  // Progressive tax brackets (шатлал)
  const brackets = [
    { min: 0, max: 1200000, rate: 0 },
    { min: 1200000, max: 2400000, rate: 10 },
    { min: 2400000, max: 4200000, rate: 20 },
    { min: 4200000, max: Infinity, rate: 25 },
  ];

  let totalTax = 0;
  const breakdown: Array<{ bracket: string; amount: number; rate: number; tax: number }> = [];

  for (let i = 0; i < brackets.length; i++) {
    const bracket = brackets[i];
    
    // Энэ шатлалд хэдэн мөнгө байгааг тооцоолох
    if (grossIncome <= bracket.min) break;
    
    const taxableInBracket = Math.min(
      grossIncome - bracket.min,
      bracket.max === Infinity ? grossIncome - bracket.min : bracket.max - bracket.min
    );
    
    if (taxableInBracket > 0) {
      const taxInBracket = Math.round((taxableInBracket * bracket.rate) / 100);
      totalTax += taxInBracket;
      
      breakdown.push({
        bracket: bracket.max === Infinity 
          ? `${(bracket.min + 1).toLocaleString()}₮+`
          : `${(bracket.min + 1).toLocaleString()}₮ - ${bracket.max.toLocaleString()}₮`,
        amount: taxableInBracket,
        rate: bracket.rate,
        tax: taxInBracket,
      });
    }
  }

  return {
    tax: totalTax,
    breakdown,
  };
}

/**
 * ХХОАТ хөнгөлөлт тооцоолол
 * Монголын хууль:
 * - Цалин 16,000₮ хүртэл: Хөнгөлөлт 16,000₮
 * - Цалин 20,000₮ хүртэл: Хөнгөлөлт 20,000₮
 * - Цалин 20,000₮-аас дээш: Хөнгөлөлт 20,000₮ (дээд хязгаар)
 * 
 * @param grossSalary - Нийт цалин (сарын)
 * @returns Хөнгөлөлтийн дүн
 */
export function calculatePITDeduction(grossSalary: number): number {
  if (grossSalary <= 16000) {
    return 16000;
  } else if (grossSalary <= 20000) {
    return 20000;
  } else {
    return 20000; // Max deduction
  }
}

/**
 * НДШ тооцоолол (Нийгмийн даатгалын шимтгэл)
 * Ажилтан: 11% (цалингаас)
 * Ажил олгогч: 12.5% (цалингаас)
 * 
 * НДШ дээд хязгаар: Хөдөлмөрийн хөлсний доод хэмжээ × 3
 * 2024 он: 420,000₮ × 3 = 1,260,000₮
 * 
 * @param grossSalary - Нийт цалин (сарын)
 * @param employeeRate - Ажилтны хувь (default: 11%)
 * @param employerRate - Ажил олгогчийн хувь (default: 12.5%)
 * @param minimumWage - Хөдөлмөрийн хөлсний доод хэмжээ (default: 420,000₮)
 * @returns { employee: number, employer: number, total: number, shiBase: number, shiCap: number }
 */
export function calculateMongolianSocialInsurance(
  grossSalary: number,
  employeeRate: number = 11,
  employerRate: number = 12.5,
  minimumWage: number = 420000
): { 
  employee: number; 
  employer: number; 
  total: number;
  shiBase: number; // НДШ тооцоолох суурь (cap-тай)
  shiCap: number; // НДШ дээд хязгаар
} {
  // НДШ дээд хязгаар: Хөдөлмөрийн хөлсний доод хэмжээ × 3
  const shiCap = minimumWage * 3; // 1,260,000₮ (2024 он)
  
  // НДШ тооцоолох суурь (cap-тай)
  const shiBase = Math.min(grossSalary, shiCap);
  
  const employee = Math.round(shiBase * employeeRate) / 100;
  const employer = Math.round(shiBase * employerRate) / 100;
  
  return {
    employee,
    employer,
    total: employee + employer,
    shiBase,
    shiCap,
  };
}
