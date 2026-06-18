/**
 * Payslip PDF generator using jsPDF.
 * One payslip per page; can also be batched.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { query } from "@/lib/db";
import type { PayrollRun, Payslip } from "@/services/payroll";
import { intlLocale } from "@/lib/intl";
import { money } from "@/lib/money";

const MARGIN = 15;
const PAGE_WIDTH = 210;
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

const fmtKES = (n: number) => money(n);

interface BusinessInfo { name: string; address: string | null; phone: string | null; kra_pin: string | null; }

async function getBusinessInfo(): Promise<BusinessInfo> {
  const rows = await query<{ key: string; value: string }>(
    `SELECT key, value FROM settings
     WHERE key IN ('business.name','business.address','business.phone','business.kra_pin')`,
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    name: map["business.name"] || "Your Business",
    address: map["business.address"] || null,
    phone: map["business.phone"] || null,
    kra_pin: map["business.kra_pin"] || null,
  };
}

interface PayslipForPdf extends Payslip {
  employee_name: string;
  employee_number: string;
}

function renderPayslip(pdf: jsPDF, payslip: PayslipForPdf, run: PayrollRun, business: BusinessInfo, startY = MARGIN) {
  let y = startY;

  // Header
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(business.name, MARGIN, y + 6);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  let bizY = y + 11;
  if (business.address) { pdf.text(business.address, MARGIN, bizY); bizY += 4; }
  if (business.phone) { pdf.text(business.phone, MARGIN, bizY); bizY += 4; }
  if (business.kra_pin) { pdf.text(`PIN: ${business.kra_pin}`, MARGIN, bizY); bizY += 4; }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("PAYSLIP", PAGE_WIDTH - MARGIN, y + 6, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`${MONTHS[run.period_month - 1]} ${run.period_year}`, PAGE_WIDTH - MARGIN, y + 12, { align: "right" });

  y = Math.max(bizY, y + 18) + 4;

  // Divider
  pdf.setDrawColor(180);
  pdf.setLineWidth(0.3);
  pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 5;

  // Employee info
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(100);
  pdf.text("EMPLOYEE", MARGIN, y);
  pdf.text("PAY PERIOD", MARGIN + 90, y);
  y += 4;

  pdf.setTextColor(0);
  pdf.setFontSize(11);
  pdf.text(payslip.employee_name, MARGIN, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`${MONTHS[run.period_month - 1]} ${run.period_year}`, MARGIN + 90, y);
  y += 5;

  pdf.setFontSize(9);
  pdf.text(`Employee #: ${payslip.employee_number}`, MARGIN, y);
  if (run.paid_at) pdf.text(`Paid: ${new Date(run.paid_at).toLocaleDateString(intlLocale())}`, MARGIN + 90, y);
  y += 8;

  // Earnings table
  const earnings: Array<[string, number]> = [
    ["Base Salary", payslip.base_salary],
    ...(payslip.overtime > 0 ? [["Overtime", payslip.overtime]] as Array<[string, number]> : []),
    ...(payslip.commission > 0 ? [["Commission", payslip.commission]] as Array<[string, number]> : []),
    ...(payslip.bonus > 0 ? [["Bonus", payslip.bonus]] as Array<[string, number]> : []),
    ...(payslip.allowances > 0 ? [["Allowances", payslip.allowances]] as Array<[string, number]> : []),
    ...(payslip.other_earnings > 0 ? [["Other earnings", payslip.other_earnings]] as Array<[string, number]> : []),
  ];

  autoTable(pdf, {
    startY: y,
    head: [["Earnings", "Amount (KES)"]],
    body: [
      ...earnings.map(([k, v]) => [k, v.toFixed(2)]),
      [{ content: "Gross Pay", styles: { fontStyle: "bold" } }, { content: payslip.gross_pay.toFixed(2), styles: { fontStyle: "bold" } }],
    ],
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1.5 },
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontSize: 8, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right", font: "courier", cellWidth: 40 } },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = (pdf as any).lastAutoTable.finalY + 4;

  // Statutory Deductions
  autoTable(pdf, {
    startY: y,
    head: [["Statutory Deductions", "Amount (KES)"]],
    body: [
      ["PAYE (Income Tax)", payslip.paye.toFixed(2)],
      ["NSSF", payslip.nssf_employee.toFixed(2)],
      ["SHIF (Social Health)", payslip.shif.toFixed(2)],
      ["Housing Levy", payslip.housing_levy_employee.toFixed(2)],
    ],
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1.5 },
    headStyles: { fillColor: [220, 38, 38], textColor: 255, fontSize: 8, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right", font: "courier", cellWidth: 40 } },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = (pdf as any).lastAutoTable.finalY + 4;

  // Other deductions if any
  const hasOther = payslip.advances > 0 || payslip.loans > 0 || payslip.other_deductions > 0;
  if (hasOther) {
    autoTable(pdf, {
      startY: y,
      head: [["Other Deductions", "Amount (KES)"]],
      body: [
        ...(payslip.advances > 0 ? [["Advances", payslip.advances.toFixed(2)]] : []),
        ...(payslip.loans > 0 ? [["Loans", payslip.loans.toFixed(2)]] : []),
        ...(payslip.other_deductions > 0 ? [["Other", payslip.other_deductions.toFixed(2)]] : []),
      ],
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 1.5 },
      headStyles: { fillColor: [245, 158, 11], textColor: 255, fontSize: 8, fontStyle: "bold" },
      columnStyles: { 1: { halign: "right", font: "courier", cellWidth: 40 } },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = (pdf as any).lastAutoTable.finalY + 4;
  }

  // Net Pay box
  pdf.setFillColor(245, 245, 245);
  pdf.rect(MARGIN, y, PAGE_WIDTH - 2 * MARGIN, 12, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("NET PAY", MARGIN + 4, y + 7);
  pdf.setFont("courier", "bold");
  pdf.setFontSize(14);
  pdf.text(fmtKES(payslip.net_pay), PAGE_WIDTH - MARGIN - 4, y + 8, { align: "right" });
  y += 16;

  // Employer-side info
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(100);
  pdf.text(
    `Employer-side contributions: NSSF ${payslip.nssf_employer.toFixed(0)} · Housing ${payslip.housing_levy_employer.toFixed(0)} · NITA ${payslip.nita_levy.toFixed(0)}`,
    MARGIN, y,
  );
  y += 8;

  // Signature lines
  pdf.setFontSize(8);
  pdf.setTextColor(0);
  pdf.text("_____________________", MARGIN, y);
  pdf.text("_____________________", PAGE_WIDTH - MARGIN - 50, y);
  y += 4;
  pdf.setTextColor(100);
  pdf.text("Employee Signature", MARGIN, y);
  pdf.text("Authorized Signature", PAGE_WIDTH - MARGIN - 50, y);
  y += 8;

  // Footer
  pdf.setFontSize(7);
  pdf.text(
    "This payslip is computer-generated and is valid without signature.",
    PAGE_WIDTH / 2, y, { align: "center" },
  );
  pdf.text(
    `Generated ${new Date().toLocaleString(intlLocale())}`,
    PAGE_WIDTH / 2, y + 4, { align: "center" },
  );

  return y;
}

export async function downloadPayslipPdf(payslip: PayslipForPdf, run: PayrollRun) {
  const business = await getBusinessInfo();
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  renderPayslip(pdf, payslip, run, business);
  pdf.save(`payslip-${payslip.employee_number}-${run.period_year}-${String(run.period_month).padStart(2, "0")}.pdf`);
}

export async function downloadPayrollRunPdf(payslips: PayslipForPdf[], run: PayrollRun) {
  const business = await getBusinessInfo();
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  payslips.forEach((p, idx) => {
    if (idx > 0) pdf.addPage();
    renderPayslip(pdf, p, run, business);
  });
  pdf.save(`payroll-${run.period_year}-${String(run.period_month).padStart(2, "0")}.pdf`);
}

export async function previewPayslipPdf(payslip: PayslipForPdf, run: PayrollRun) {
  const business = await getBusinessInfo();
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  renderPayslip(pdf, payslip, run, business);
  pdf.output("dataurlnewwindow");
}
