/**
 * Mongolian Localization (Монгол хэл)
 * 
 * ERP системийн Монгол хэлний орчуулга
 */

export const mn = {
  // Common
  common: {
    save: 'Хадгалах',
    cancel: 'Цуцлах',
    delete: 'Устгах',
    edit: 'Засах',
    add: 'Нэмэх',
    create: 'Үүсгэх',
    update: 'Шинэчлэх',
    search: 'Хайх',
    filter: 'Шүүлт',
    export: 'Экспорт',
    import: 'Импорт',
    print: 'Хэвлэх',
    close: 'Хаах',
    confirm: 'Баталгаажуулах',
    back: 'Буцах',
    next: 'Дараах',
    previous: 'Өмнөх',
    yes: 'Тийм',
    no: 'Үгүй',
    loading: 'Уншиж байна...',
    noData: 'Мэдээлэл олдсонгүй',
    actions: 'Үйлдэл',
    status: 'Төлөв',
    date: 'Огноо',
    amount: 'Дүн',
    total: 'Нийт',
    description: 'Тайлбар',
    notes: 'Тэмдэглэл',
    success: 'Амжилттай',
    error: 'Алдаа',
    warning: 'Анхааруулга',
    info: 'Мэдээлэл',
  },

  // Navigation
  nav: {
    dashboard: 'Хянах самбар',
    employees: 'Ажилчид',
    departments: 'Хэлтсүүд',
    attendance: 'Ирц',
    payroll: 'Цалин',
    products: 'Бараа бүтээгдэхүүн',
    contacts: 'Харилцагчид',
    customers: 'Худалдан авагчид',
    suppliers: 'Нийлүүлэгчид',
    sales: 'Борлуулалт',
    salesOrders: 'Борлуулалтын захиалга',
    purchase: 'Худалдан авалт',
    purchaseOrders: 'Худалдан авалтын захиалга',
    inventory: 'Агуулах',
    warehouses: 'Агуулахууд',
    invoices: 'Нэхэмжлэх',
    documents: 'Баримт бичиг',
    reports: 'Тайлан',
    settings: 'Тохиргоо',
    // Accounting
    accounting: 'Санхүү',
    accounts: 'Данс',
    journals: 'Журнал',
    journalEntries: 'Журналын бичилт',
    taxCodes: 'Татварын код',
    payments: 'Төлбөр',
  },

  // Dashboard
  dashboard: {
    title: 'Хянах самбар',
    totalEmployees: 'Нийт ажилтан',
    totalProducts: 'Нийт бараа',
    totalSales: 'Нийт борлуулалт',
    totalRevenue: 'Нийт орлого',
    recentOrders: 'Сүүлийн захиалгууд',
    recentInvoices: 'Сүүлийн нэхэмжлэхүүд',
    pendingPayments: 'Хүлээгдэж буй төлбөр',
    lowStock: 'Бага үлдэгдэлтэй бараа',
  },

  // Employees
  employees: {
    title: 'Ажилчид',
    addEmployee: 'Ажилтан нэмэх',
    firstName: 'Нэр',
    lastName: 'Овог',
    email: 'И-мэйл',
    phone: 'Утас',
    department: 'Хэлтэс',
    position: 'Албан тушаал',
    hireDate: 'Ажилд орсон огноо',
    salary: 'Цалин',
    status: {
      active: 'Ажиллаж байгаа',
      inactive: 'Ажлаас гарсан',
      onLeave: 'Чөлөөтэй',
    },
  },

  // Payroll
  payroll: {
    title: 'Цалин',
    runPayroll: 'Цалин бодох',
    period: 'Тооцоолох үе',
    baseSalary: 'Үндсэн цалин',
    grossSalary: 'Нийт цалин',
    netSalary: 'Гарт олгох',
    overtime: 'Илүү цаг',
    bonus: 'Урамшуулал',
    allowance: 'Нэмэгдэл',
    deductions: 'Суутгал',
    // Mongolian specific
    socialInsurance: 'НДШ',
    pensionContribution: 'Тэтгэвэр',
    healthInsurance: 'ЭМДШ',
    unemploymentInsurance: 'Ажилгүйдэл',
    pit: 'ХХОАТ',
    employeeContribution: 'Ажилтны хувь',
    employerContribution: 'Ажил олгогчийн хувь',
  },

  // Products
  products: {
    title: 'Бараа бүтээгдэхүүн',
    addProduct: 'Бараа нэмэх',
    name: 'Нэр',
    sku: 'Барааны код',
    barcode: 'Бар код',
    category: 'Ангилал',
    salePrice: 'Зарах үнэ',
    costPrice: 'Өртөг',
    unit: 'Хэмжих нэгж',
    stockQuantity: 'Үлдэгдэл',
    units: {
      piece: 'ш',
      kg: 'кг',
      liter: 'л',
      meter: 'м',
      box: 'хайрцаг',
      pack: 'багц',
    },
  },

  // Contacts
  contacts: {
    title: 'Харилцагчид',
    addContact: 'Харилцагч нэмэх',
    companyName: 'Байгууллагын нэр',
    firstName: 'Нэр',
    lastName: 'Овог',
    email: 'И-мэйл',
    phone: 'Утас',
    address: 'Хаяг',
    city: 'Хот',
    district: 'Дүүрэг',
    // Mongolian specific
    regNo: 'Регистрийн дугаар',
    vatNo: 'ХХОАТ дугаар',
    bankName: 'Банкны нэр',
    bankAccount: 'Дансны дугаар',
    type: {
      customer: 'Худалдан авагч',
      supplier: 'Нийлүүлэгч',
      both: 'Хоёулаа',
    },
  },

  // Sales
  sales: {
    title: 'Борлуулалт',
    newOrder: 'Шинэ захиалга',
    orderNumber: 'Захиалгын дугаар',
    orderDate: 'Захиалгын огноо',
    customer: 'Худалдан авагч',
    deliveryDate: 'Хүргэлтийн огноо',
    subtotal: 'Дүн',
    tax: 'ХХОАТ',
    discount: 'Хөнгөлөлт',
    total: 'Нийт дүн',
    status: {
      draft: 'Ноорог',
      quotation: 'Үнийн санал',
      sent: 'Илгээсэн',
      confirmed: 'Баталгаажсан',
      invoiced: 'Нэхэмжлэгдсэн',
      cancelled: 'Цуцлагдсан',
    },
    paymentStatus: {
      unpaid: 'Төлөгдөөгүй',
      partial: 'Хэсэгчлэн төлсөн',
      paid: 'Төлсөн',
    },
  },

  // Purchase
  purchase: {
    title: 'Худалдан авалт',
    newOrder: 'Шинэ захиалга',
    orderNumber: 'Захиалгын дугаар',
    orderDate: 'Захиалгын огноо',
    supplier: 'Нийлүүлэгч',
    expectedDate: 'Хүлээгдэж буй огноо',
    status: {
      draft: 'Ноорог',
      sent: 'Илгээсэн',
      confirmed: 'Баталгаажсан',
      received: 'Хүлээн авсан',
      cancelled: 'Цуцлагдсан',
    },
  },

  // Invoices
  invoices: {
    title: 'Нэхэмжлэх',
    newInvoice: 'Шинэ нэхэмжлэх',
    invoiceNumber: 'Нэхэмжлэхийн дугаар',
    invoiceDate: 'Нэхэмжлэхийн огноо',
    dueDate: 'Төлбөрийн хугацаа',
    contact: 'Харилцагч',
    subtotal: 'Дүн',
    tax: 'ХХОАТ',
    total: 'Нийт дүн',
    paidAmount: 'Төлсөн дүн',
    balance: 'Үлдэгдэл',
    type: {
      sales: 'Борлуулалт',
      purchase: 'Худалдан авалт',
    },
    status: {
      draft: 'Ноорог',
      sent: 'Илгээсэн',
      posted: 'Бичигдсэн',
      paid: 'Төлсөн',
      cancelled: 'Цуцлагдсан',
    },
    paymentMethod: {
      cash: 'Бэлэн мөнгө',
      bankTransfer: 'Банкаар шилжүүлэх',
      qrCode: 'QR код',
      qpay: 'QPay',
      socialpay: 'SocialPay',
    },
    // e-Barimt
    ebarimt: {
      register: 'e-Barimt бүртгэх',
      billId: 'Баримтын дугаар',
      lottery: 'Сугалааны дугаар',
      qrCode: 'QR код',
    },
  },

  // Inventory
  inventory: {
    title: 'Агуулах',
    warehouse: 'Агуулах',
    stockLevel: 'Үлдэгдэл',
    stockMovement: 'Хөдөлгөөн',
    product: 'Бараа',
    quantity: 'Тоо хэмжээ',
    reserved: 'Захиалсан',
    available: 'Боломжит',
    movementType: {
      in: 'Орлого',
      out: 'Зарлага',
      adjustment: 'Тохируулга',
      transfer: 'Шилжүүлэг',
    },
  },

  // Accounting
  accounting: {
    title: 'Санхүү',
    // Chart of Accounts
    accounts: {
      title: 'Дансны төлөвлөгөө',
      code: 'Дансны код',
      name: 'Дансны нэр',
      type: 'Төрөл',
      types: {
        asset: 'Хөрөнгө',
        liability: 'Өр төлбөр',
        equity: 'Өөрийн хөрөнгө',
        income: 'Орлого',
        expense: 'Зардал',
      },
    },
    // Journals
    journals: {
      title: 'Журнал',
      code: 'Журналын код',
      name: 'Журналын нэр',
      type: 'Төрөл',
      types: {
        sales: 'Борлуулалт',
        purchase: 'Худалдан авалт',
        bank: 'Банк',
        cash: 'Бэлэн мөнгө',
        general: 'Ерөнхий',
      },
    },
    // Journal Entries
    journalEntries: {
      title: 'Журналын бичилт',
      entryNumber: 'Бичилтийн дугаар',
      entryDate: 'Огноо',
      debit: 'Дебит',
      credit: 'Кредит',
      status: {
        draft: 'Ноорог',
        posted: 'Бичигдсэн',
        cancelled: 'Цуцлагдсан',
        reversed: 'Буцаагдсан',
      },
      post: 'Бичих',
      reverse: 'Буцаах',
    },
    // Tax
    taxCodes: {
      title: 'Татварын код',
      code: 'Код',
      name: 'Нэр',
      rate: 'Хувь',
      type: 'Төрөл',
      types: {
        vat: 'НӨАТ',
        incomeTax: 'Орлогын татвар',
      },
    },
    // Payments
    payments: {
      title: 'Төлбөр',
      paymentNumber: 'Төлбөрийн дугаар',
      paymentDate: 'Огноо',
      amount: 'Дүн',
      type: {
        payment: 'Төлбөр (гарах)',
        receipt: 'Хүлээн авах (орох)',
      },
      method: {
        cash: 'Бэлэн мөнгө',
        bankTransfer: 'Банкаар',
        qpay: 'QPay',
        socialpay: 'SocialPay',
      },
    },
  },

  // Reports
  reports: {
    title: 'Тайлан',
    trialBalance: 'Эргэлтийн баланс',
    balanceSheet: 'Баланс',
    profitAndLoss: 'Ашиг алдагдал',
    cashFlow: 'Мөнгөн урсгал',
    // VAT Report
    vatReport: 'НӨАТ тайлан',
    outputVat: 'Борлуулалтын НӨАТ',
    inputVat: 'Худалдан авалтын НӨАТ',
    netVat: 'Цэвэр НӨАТ',
    vatPayable: 'Төлөх НӨАТ',
    vatReceivable: 'Буцаан авах НӨАТ',
    // Date filters
    startDate: 'Эхлэх огноо',
    endDate: 'Дуусах огноо',
    asOfDate: 'Байдлаар',
    period: 'Үе',
    // Summary
    totalAssets: 'Нийт хөрөнгө',
    totalLiabilities: 'Нийт өр төлбөр',
    totalEquity: 'Нийт өөрийн хөрөнгө',
    totalIncome: 'Нийт орлого',
    totalExpenses: 'Нийт зардал',
    netProfit: 'Цэвэр ашиг',
    netLoss: 'Цэвэр алдагдал',
  },

  // Settings
  settings: {
    title: 'Тохиргоо',
    company: 'Байгууллага',
    companyName: 'Байгууллагын нэр',
    legalName: 'Албан нэр',
    regNo: 'Регистрийн дугаар',
    vatNo: 'ХХОАТ дугаар',
    address: 'Хаяг',
    currency: 'Валют',
    timezone: 'Цагийн бүс',
    // e-Barimt settings
    ebarimt: {
      title: 'e-Barimt тохиргоо',
      posNo: 'POS дугаар',
      merchantId: 'Merchant ID',
      branchNo: 'Салбарын дугаар',
      apiKey: 'API түлхүүр',
    },
    // QPay settings
    qpay: {
      title: 'QPay тохиргоо',
      username: 'Хэрэглэгчийн нэр',
      invoiceCode: 'Invoice код',
      callbackUrl: 'Callback URL',
    },
    // Bank settings
    bank: {
      title: 'Банкны тохиргоо',
      bankName: 'Банкны нэр',
      accountNumber: 'Дансны дугаар',
    },
  },

  // Validation messages
  validation: {
    required: 'Заавал бөглөнө үү',
    invalidEmail: 'И-мэйл хаяг буруу байна',
    invalidPhone: 'Утасны дугаар буруу байна',
    minLength: '{{min}} тэмдэгтээс дээш байх ёстой',
    maxLength: '{{max}} тэмдэгтээс бага байх ёстой',
    minValue: '{{min}}-ээс дээш байх ёстой',
    maxValue: '{{max}}-ээс бага байх ёстой',
    positiveNumber: 'Эерэг тоо байх ёстой',
    invalidDate: 'Огноо буруу байна',
    invalidRegNo: 'Регистрийн дугаар буруу байна',
    invalidVatNo: 'ХХОАТ дугаар буруу байна',
  },

  // Error messages
  errors: {
    generic: 'Алдаа гарлаа. Дахин оролдоно уу.',
    network: 'Сүлжээний алдаа. Интернет холболтоо шалгана уу.',
    unauthorized: 'Нэвтрэх эрхгүй байна.',
    forbidden: 'Хандах эрхгүй байна.',
    notFound: 'Олдсонгүй.',
    serverError: 'Серверийн алдаа гарлаа.',
    validationError: 'Баталгаажуулалтын алдаа.',
  },

  // Success messages
  success: {
    created: 'Амжилттай үүсгэлээ',
    updated: 'Амжилттай шинэчлэлээ',
    deleted: 'Амжилттай устгалаа',
    saved: 'Амжилттай хадгаллаа',
    posted: 'Амжилттай бичлээ',
    reversed: 'Амжилттай буцаалаа',
    sent: 'Амжилттай илгээлээ',
    imported: 'Амжилттай импортлолоо',
    exported: 'Амжилттай экспортлолоо',
  },

  // Mongolian banks
  banks: {
    khanbank: 'Хаан банк',
    golomt: 'Голомт банк',
    tdb: 'Худалдаа хөгжлийн банк',
    statebank: 'Төрийн банк',
    xacbank: 'Хас банк',
    bogdbank: 'Богд банк',
    capitron: 'Капитрон банк',
    chinggis: 'Чингис хаан банк',
    arig: 'Ариг банк',
    ub: 'Улаанбаатар хотын банк',
  },
};

export type MongolianTranslations = typeof mn;

// Helper function to get nested translation
export function t(key: string, params?: Record<string, string | number>): string {
  const keys = key.split('.');
  let value: any = mn;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return key; // Return key if translation not found
    }
  }

  if (typeof value !== 'string') {
    return key;
  }

  // Replace parameters
  if (params) {
    return value.replace(/\{\{(\w+)\}\}/g, (_, param) => 
      String(params[param] ?? `{{${param}}}`)
    );
  }

  return value;
}

// Export default
export default mn;
