/**
 * Utilitário de porcentagens para o Label OS.
 * Aceita vírgula ou ponto como separador decimal (pt-BR e en-US).
 */

/** Converte string ou number para float. Retorna 0 se inválido. */
export function parsePercentageInput(value: string | number): number {
  if (typeof value === "number") return isNaN(value) ? 0 : value;
  const normalized = value.replace(",", ".");
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}

/** Formata número em pt-BR com até 2 casas decimais, sem zeros desnecessários. */
export function formatPercentage(value: number): string {
  const formatted = value.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${formatted}%`;
}

/** Soma array de valores usando parsePercentageInput, arredondado em 2 casas. */
export function sumPercentages(values: (string | number)[]): number {
  const sum = values.reduce<number>(
    (acc, v) => acc + parsePercentageInput(v),
    0,
  );
  return Math.round(sum * 100) / 100;
}

/** Compara dois valores com tolerância de 0.01 para evitar erro de ponto flutuante. */
export function isPercentageEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= 0.01;
}
