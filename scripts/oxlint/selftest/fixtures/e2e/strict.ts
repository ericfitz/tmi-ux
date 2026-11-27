export class Holder {
  value = 1;
  method(): number {
    return this.value;
  }
}

export function missingReturnType() {
  return 1;
}

export function unsafe(input: any): number {
  const a = input.deep;
  input.call();
  Math.max(input);
  const cast = {} as any;
  const m = new Holder().method;
  return [a, cast, m].length;
}

export function unsafeReturn(input: any): number {
  return input;
}

export type Redundant = string | any;

export function complex(n: number): number {
  let r = 0;
  if (n === 1) r++;
  if (n === 2) r++;
  if (n === 3) r++;
  if (n === 4) r++;
  if (n === 5) r++;
  if (n === 6) r++;
  if (n === 7) r++;
  if (n === 8) r++;
  if (n === 9) r++;
  if (n === 10) r++;
  if (n === 11) r++;
  if (n === 12) r++;
  if (n === 13) r++;
  if (n === 14) r++;
  if (n === 15) r++;
  if (n === 16) r++;
  if (n === 17) r++;
  if (n === 18) r++;
  if (n === 19) r++;
  if (n === 20) r++;
  return r;
}

export class WithStatic {
  static make(): number {
    return 1;
  }
}

export const staticRef = WithStatic.make;

export const mapped = [1].map(n => n + 1);

export const iife = (function () {
  return 1;
})();
