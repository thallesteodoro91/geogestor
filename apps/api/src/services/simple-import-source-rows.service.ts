import { z } from 'zod';

export const sourceRowNumbersSchema = z.array(z.number().int().min(2).max(1_000_000)).min(1).max(500);

export function sourceRowsMatch(rows: unknown[], numbers: number[]) {
  return numbers.length === rows.length && numbers.every((number, index) => index === 0 || number > numbers[index - 1]);
}
