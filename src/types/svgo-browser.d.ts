declare module 'svgo/dist/svgo.browser.js' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function optimize(svgString: string, config?: any): { data: string };
}
