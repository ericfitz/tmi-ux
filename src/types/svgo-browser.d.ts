declare module 'svgo/dist/svgo.browser.js' {
   
  // SEM@5d20e1d89e0d64098c87c0a30f949970ba2f1a5d: optimize an SVG string using the browser-targeted SVGO build (pure)
  export function optimize(svgString: string, config?: any): { data: string };
}
