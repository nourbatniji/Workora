// Excel export of the employee list (EM-09, FR-EM-9): one sheet, the filtered list, in the
// person's language. Arabic sheets read right to left, like the app.
import ExcelJS from 'exceljs';
import type { EmployeeListItem } from '@mdarj/shared';

type Lang = 'en' | 'ar';

const LABELS = {
  en: {
    sheet: 'Employees',
    code: 'Code',
    nameAr: 'Name (Arabic)',
    nameEn: 'Name (English)',
    jobTitle: 'Job title',
    employmentType: 'Employment type',
    status: 'Status',
    hireDate: 'Hire date',
    phone: 'Phone',
    full_time: 'Full time',
    part_time: 'Part time',
    trainee: 'Trainee',
    active: 'Active',
    suspended: 'Suspended',
    terminated: 'Terminated',
  },
  ar: {
    sheet: 'الموظفون',
    code: 'الكود',
    nameAr: 'الاسم بالعربية',
    nameEn: 'الاسم بالإنجليزية',
    jobTitle: 'المسمى الوظيفي',
    employmentType: 'نوع التوظيف',
    status: 'الحالة',
    hireDate: 'تاريخ التعيين',
    phone: 'الهاتف',
    full_time: 'دوام كامل',
    part_time: 'دوام جزئي',
    trainee: 'متدرب',
    active: 'نشط',
    suspended: 'موقوف',
    terminated: 'منتهية خدمته',
  },
} as const;

/** The workbook as bytes, ready to send */
export async function employeesWorkbook(
  rows: EmployeeListItem[],
  lang: Lang,
): Promise<Buffer> {
  const t = LABELS[lang];
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(t.sheet, {
    views: [{ rightToLeft: lang === 'ar', state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = [
    { header: t.code, key: 'code', width: 12 },
    { header: t.nameAr, key: 'nameAr', width: 26 },
    { header: t.nameEn, key: 'nameEn', width: 26 },
    { header: t.jobTitle, key: 'jobTitle', width: 20 },
    { header: t.employmentType, key: 'employmentType', width: 16 },
    { header: t.status, key: 'status', width: 14 },
    // A real date cell, so Excel can sort and filter by it
    {
      header: t.hireDate,
      key: 'hireDate',
      width: 14,
      style: { numFmt: 'yyyy-mm-dd' },
    },
    { header: t.phone, key: 'phone', width: 18 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow({
      code: row.code,
      nameAr: row.nameAr,
      nameEn: row.nameEn,
      // Missing values stay empty cells
      jobTitle: row.jobTitle
        ? lang === 'ar'
          ? row.jobTitle.nameAr
          : row.jobTitle.nameEn
        : null,
      employmentType: t[row.employmentType],
      status: t[row.status],
      hireDate: new Date(`${row.hireDate}T00:00:00.000Z`),
      phone: row.phone,
    });
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
