/** @type {import('tailwindcss').Config} */
module.exports = {
  // 类名全部以字符串形式出现在 index.html 的打印样式与 src 下的模板字符串里，
  // 因此扫描这两处即可覆盖。新增组件目录时记得同步这里。
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx,vue}'],
  theme: {
    extend: {}
  },
  plugins: []
};
