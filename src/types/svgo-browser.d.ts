declare module 'svgo/browser' {
  export function optimize(svgString: string, config?: any): { data: string };
}