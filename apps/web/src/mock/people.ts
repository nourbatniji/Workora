// Mock employees for Nile Bakeries Co. (42 employees in total; these are the ones the screens show).
// Names and job titles are stored in both languages, like name_ar / name_en in the SRS.

export type Locale = 'ar' | 'en';
export type Localized = Record<Locale, string>;

export type ShiftKey = 'morning' | 'evening' | 'night';
export type EmploymentType = 'fullTime' | 'partTime' | 'trainee';

export type Employee = {
  id: string;
  code: string;
  name: Localized;
  jobTitle: Localized;
  shift: ShiftKey;
  type: EmploymentType;
  /** Monthly base salary in EGP */
  baseSalary: number;
};

/** Shift templates (FR-SH-1). The night shift crosses midnight. */
export const SHIFTS: Record<
  ShiftKey,
  { start: string; end: string; hours: number; lateGrace: number }
> = {
  morning: { start: '06:00', end: '14:00', hours: 8, lateGrace: 10 },
  evening: { start: '14:00', end: '22:00', hours: 8, lateGrace: 10 },
  night: { start: '22:00', end: '06:00', hours: 8, lateGrace: 10 },
};

const t = (ar: string, en: string): Localized => ({ ar, en });

const BAKER = t('خباز', 'Baker');
const PASTRY = t('شيف حلويات', 'Pastry chef');
const CASHIER = t('كاشير', 'Cashier');
const DRIVER = t('سائق توصيل', 'Delivery driver');
const SUPERVISOR = t('مشرف وردية', 'Shift supervisor');
const PACKER = t('عامل تعبئة', 'Packer');
const ACCOUNTANT = t('محاسب', 'Accountant');
const STOREKEEPER = t('أمين مخزن', 'Storekeeper');
const CLEANER = t('عامل نظافة', 'Cleaner');

export const EMPLOYEES: Employee[] = [
  {
    id: 'ahmed',
    code: 'E-001',
    name: t('أحمد حسن', 'Ahmed Hassan'),
    jobTitle: SUPERVISOR,
    shift: 'morning',
    type: 'fullTime',
    baseSalary: 12000,
  },
  {
    id: 'mona',
    code: 'E-004',
    name: t('منى عبد الله', 'Mona Abdallah'),
    jobTitle: CASHIER,
    shift: 'morning',
    type: 'fullTime',
    baseSalary: 7000,
  },
  {
    id: 'karim',
    code: 'E-007',
    name: t('كريم سمير', 'Karim Samir'),
    jobTitle: BAKER,
    shift: 'night',
    type: 'fullTime',
    baseSalary: 8500,
  },
  {
    id: 'hany',
    code: 'E-009',
    name: t('هاني فؤاد', 'Hany Fouad'),
    jobTitle: DRIVER,
    shift: 'evening',
    type: 'fullTime',
    baseSalary: 7500,
  },
  {
    id: 'sara',
    code: 'E-011',
    name: t('سارة علي', 'Sara Ali'),
    jobTitle: PASTRY,
    shift: 'morning',
    type: 'fullTime',
    baseSalary: 9500,
  },
  {
    id: 'mahmoud',
    code: 'E-012',
    name: t('محمود رجب', 'Mahmoud Ragab'),
    jobTitle: BAKER,
    shift: 'night',
    type: 'fullTime',
    baseSalary: 8500,
  },
  {
    id: 'youssef',
    code: 'E-015',
    name: t('يوسف عادل', 'Youssef Adel'),
    jobTitle: PACKER,
    shift: 'night',
    type: 'fullTime',
    baseSalary: 6000,
  },
  {
    id: 'noura',
    code: 'E-018',
    name: t('نورا إبراهيم', 'Noura Ibrahim'),
    jobTitle: ACCOUNTANT,
    shift: 'morning',
    type: 'fullTime',
    baseSalary: 11000,
  },
  {
    id: 'omar',
    code: 'E-021',
    name: t('عمر خالد', 'Omar Khaled'),
    jobTitle: BAKER,
    shift: 'night',
    type: 'fullTime',
    baseSalary: 8000,
  },
  {
    id: 'islam',
    code: 'E-023',
    name: t('إسلام طارق', 'Islam Tarek'),
    jobTitle: STOREKEEPER,
    shift: 'evening',
    type: 'fullTime',
    baseSalary: 7000,
  },
  {
    id: 'rehab',
    code: 'E-026',
    name: t('رحاب مصطفى', 'Rehab Mostafa'),
    jobTitle: CASHIER,
    shift: 'evening',
    type: 'partTime',
    baseSalary: 4200,
  },
  {
    id: 'mostafa',
    code: 'E-029',
    name: t('مصطفى جمال', 'Mostafa Gamal'),
    jobTitle: DRIVER,
    shift: 'night',
    type: 'fullTime',
    baseSalary: 7200,
  },
  {
    id: 'yasmine',
    code: 'E-031',
    name: t('ياسمين شريف', 'Yasmine Sherif'),
    jobTitle: PASTRY,
    shift: 'morning',
    type: 'trainee',
    baseSalary: 4500,
  },
  {
    id: 'abdelrahman',
    code: 'E-034',
    name: t('عبد الرحمن سيد', 'Abdelrahman Sayed'),
    jobTitle: PACKER,
    shift: 'night',
    type: 'trainee',
    baseSalary: 4500,
  },
  {
    id: 'mariam',
    code: 'E-037',
    name: t('مريم وليد', 'Mariam Walid'),
    jobTitle: CASHIER,
    shift: 'evening',
    type: 'fullTime',
    baseSalary: 7000,
  },
  {
    id: 'hossam',
    code: 'E-040',
    name: t('حسام ناصر', 'Hossam Nasser'),
    jobTitle: CLEANER,
    shift: 'evening',
    type: 'fullTime',
    baseSalary: 5000,
  },
];

export function employeeById(id: string): Employee {
  const employee = EMPLOYEES.find((e) => e.id === id);
  if (!employee) throw new Error(`Unknown mock employee: ${id}`);
  return employee;
}

/**
 * Avatar text. English: first letters of the first two words ("KS").
 * Arabic: first letter only, because two Arabic letters side by side join into a word,
 * and some pairs make words nobody wants on screen.
 */
export function initials(name: string, locale: Locale): string {
  const words = name.split(' ');
  if (locale === 'ar') return words[0][0];
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join('');
}
