/**
 * Mongolian Number to Words Converter
 * 
 * Converts numbers to Mongolian text (үсгээр)
 * Used for Padan PDF, invoices, and other financial documents
 */

/**
 * Convert number to Mongolian words (үсгээр)
 * Supports up to 999,999,999,999 (триллион хүртэл)
 * 
 * Format: "Нэг сая хоёр зуун гурван мянган дөрвөн зуун таван төгрөг 00 мөнгө"
 */
export function amountInWordsMNT(amount: number): string {
  // MNT policy: Round to integer төгрөг (no decimals in words)
  const integerPart = Math.round(amount);
  const decimalPart = 0; // Always 00 мөнгө (MNT doesn't use decimals in practice)

  // Mongolian number words
  const ones = [
    "", "нэг", "хоёр", "гурав", "дөрөв", "тав", "зургаа", "долоо", "найм", "ес"
  ];

  const tens = [
    "", "", "хорин", "гучин", "дөч", "тавь", "жар", "дал", "ная", "ер"
  ];

  const teens = [
    "арав", "арван нэг", "арван хоёр", "арван гурав", "арван дөрөв", 
    "арван тав", "арван зургаа", "арван долоо", "арван найм", "арван ес"
  ];

  const hundreds = [
    "", "нэг зуун", "хоёр зуун", "гурван зуун", "дөрвөн зуун", 
    "таван зуун", "зургаан зуун", "долоон зуун", "найман зуун", "есөн зуун"
  ];

  const thousands = ["мянга", "сая", "тэрбум", "триллион"];

  // Convert integer part (0-999)
  function convertThreeDigits(num: number): string {
    if (num === 0) return "";

    const h = Math.floor(num / 100);
    const t = Math.floor((num % 100) / 10);
    const o = num % 10;

    let result = "";

    if (h > 0) {
      result += hundreds[h];
      if (t > 0 || o > 0) result += " ";
    }

    if (t === 1) {
      result += teens[o];
    } else {
      if (t > 1) {
        result += tens[t];
        if (o > 0) result += " ";
      }
      if (o > 0) {
        result += ones[o];
      }
    }

    return result.trim();
  }

  // Split number into groups of 3 digits
  function splitIntoGroups(num: number): number[] {
    const groups: number[] = [];
    let remaining = num;

    while (remaining > 0) {
      groups.push(remaining % 1000);
      remaining = Math.floor(remaining / 1000);
    }

    return groups.reverse(); // Most significant first
  }

  // Handle zero case
  if (integerPart === 0 && decimalPart === 0) {
    return "Тэг төгрөг 00 мөнгө";
  }

  if (integerPart === 0) {
    return `Тэг төгрөг ${String(decimalPart).padStart(2, "0")} мөнгө`;
  }

  // Convert integer part
  const groups = splitIntoGroups(integerPart);
  const parts: string[] = [];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const groupValue = convertThreeDigits(group);

    if (groupValue) {
      const level = groups.length - i - 1; // 0=mянга, 1=сая, 2=тэрбум, 3=триллион

      if (level === 0) {
        // Мянга
        if (group === 1) {
          parts.push("мянга");
        } else {
          parts.push(`${groupValue} мянга`);
        }
      } else if (level === 1) {
        // Сая
        if (group === 1) {
          parts.push("нэг сая");
        } else {
          parts.push(`${groupValue} сая`);
        }
      } else if (level === 2) {
        // Тэрбум
        if (group === 1) {
          parts.push("нэг тэрбум");
        } else {
          parts.push(`${groupValue} тэрбум`);
        }
      } else if (level === 3) {
        // Триллион
        if (group === 1) {
          parts.push("нэг триллион");
        } else {
          parts.push(`${groupValue} триллион`);
        }
      } else {
        // Just the number (hundreds, tens, ones)
        parts.push(groupValue);
      }
    }
  }

  const integerWords = parts.join(" ");
  const decimalStr = String(decimalPart).padStart(2, "0");

  return `${integerWords} төгрөг ${decimalStr} мөнгө`;
}

/**
 * Simplified version for common amounts (< 1 million)
 */
export function simpleAmountInWordsMNT(amount: number): string {
  if (amount < 1000000) {
    return amountInWordsMNT(amount);
  }
  // For larger amounts, return formatted number + "төгрөг"
  return `${amount.toLocaleString("mn-MN")} төгрөг`;
}
