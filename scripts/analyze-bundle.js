const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const path = require('path');

// Simple script to analyze the webpack bundle
const analyzer = new BundleAnalyzerPlugin({
    analyzerMode: 'static',
    reportFilename: path.resolve(__dirname, '../bundle-report.html'),
    openAnalyzer: false,
    generateStatsFile: true,
    statsFilename: path.resolve(__dirname, '../bundle-stats.json'),
});

console.log('Bundle analysis will be generated after the next build with stats.');
console.log('Run: ng build --configuration=production --stats-json');
console.log('Then: npx webpack-bundle-analyzer dist/tmi-ux/stats.json');