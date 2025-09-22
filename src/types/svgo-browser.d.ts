declare module 'svgo/dist/svgo.browser.js' {
  export function optimize(svgString: string, config?: any): { data: string };
}
