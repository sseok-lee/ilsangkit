import { Prisma } from '@prisma/client';
import { kstCalendarToday } from '../lib/kstDate.js';
import type { DateWindow, PeriodMonths } from '../types/housingRedesign.js';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function subtractUtcMonthsClamped(date: Date, months: PeriodMonths): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const targetMonthIndex = year * 12 + (month - 1) - months;
  const targetYear = Math.floor(targetMonthIndex / 12);
  const targetMonth = (targetMonthIndex % 12) + 1;
  const targetDay = Math.min(day, daysInUtcMonth(targetYear, targetMonth));

  return new Date(Date.UTC(targetYear, targetMonth - 1, targetDay));
}

function parseDateWindowBoundary(value: string): { year: number; month: number } {
  if (!DATE_ONLY_PATTERN.test(value)) {
    throw new Error(`Invalid date boundary: ${value}`);
  }

  const [year, month, day] = value.split('-').map(Number);
  const daysInMonth = daysInUtcMonth(year, month);
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > daysInMonth) {
    throw new Error(`Invalid date boundary: ${value}`);
  }

  return { year, month };
}

function validateTableAlias(alias: string | undefined): void {
  if (alias !== undefined && !/^[a-z][a-z0-9_]*$/i.test(alias)) {
    throw new Error(`Invalid table alias: ${alias}`);
  }
}

export function getMarketWindow(now: Date): DateWindow {
  const today = kstCalendarToday(now);

  return {
    from: formatDate(addUtcDays(today, -29)),
    to: formatDate(today),
  };
}

export function getDetailWindow(now: Date, months: PeriodMonths): DateWindow {
  const today = kstCalendarToday(now);

  return {
    from: formatDate(subtractUtcMonthsClamped(today, months)),
    to: formatDate(today),
  };
}

export function normalizeExactArea(value: string): string {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value)) {
    throw new Error('Invalid exact area');
  }

  const area = new Prisma.Decimal(value);
  if (area.lte(0)) {
    throw new Error('Invalid exact area');
  }

  return area.toFixed(2);
}

export function exactDealDateFilter(window: DateWindow, alias?: string): Prisma.Sql {
  const from = parseDateWindowBoundary(window.from);
  const to = parseDateWindowBoundary(window.to);

  validateTableAlias(alias);
  const prefix = alias ? `${alias}.` : '';
  const yCol = Prisma.raw(`${prefix}dealYear`);
  const mCol = Prisma.raw(`${prefix}dealMonth`);
  const dCol = Prisma.raw(`${prefix}dealDay`);

  const exactDealDate = Prisma.sql`CASE WHEN ${yCol} BETWEEN 1 AND 9999
    AND ${mCol} BETWEEN 1 AND 12
    AND ${dCol} IS NOT NULL
    AND ${dCol} >= 1
    AND ${dCol} <= DAY(LAST_DAY(CONCAT(${yCol}, '-', LPAD(${mCol}, 2, '0'), '-01')))
    THEN STR_TO_DATE(CONCAT(${yCol}, '-', LPAD(${mCol}, 2, '0'), '-', LPAD(${dCol}, 2, '0')), '%Y-%m-%d')
    ELSE NULL END`;

  return Prisma.sql`(${yCol} > ${from.year} OR (${yCol} = ${from.year} AND ${mCol} >= ${from.month}))
    AND (${yCol} < ${to.year} OR (${yCol} = ${to.year} AND ${mCol} <= ${to.month}))
    AND ${exactDealDate} BETWEEN ${window.from} AND ${window.to}`;
}
