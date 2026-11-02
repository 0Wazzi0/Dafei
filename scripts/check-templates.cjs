/**
 * 校验所有 Vue 组件的 template 字符串能否被编译。
 *
 * 为什么需要这个检查：本项目用 defineComponent + template 字符串写组件，
 * - vite build 走的是运行时编译，不会检查模板内容；
 * - tsc 看不到模板里的表达式；
 * 因此模板里写错语法（比如误用 TypeScript 的 as 断言、标签不匹配、
 * 事件名拼错）只会在实际打开界面时崩溃。
 *
 * 用法：npm run check:templates
 */
const fs = require('fs');
const path = require('path');
const { compile } = require('@vue/compiler-dom');

const COMPONENT_DIR = path.join(__dirname, '..', 'src', 'components');

/** 从组件源码里取出 template 字符串的内容 */
const extractTemplate = (source) => {
  const marker = 'template: `';
  const start = source.indexOf(marker);
  if (start < 0) return null;

  const bodyStart = start + marker.length;
  const bodyEnd = source.lastIndexOf('`\n});');
  if (bodyEnd < bodyStart) return null;

  return source.slice(bodyStart, bodyEnd);
};

const main = () => {
  const files = fs.readdirSync(COMPONENT_DIR).filter((name) => name.endsWith('.tsx'));
  let failed = 0;
  let checked = 0;

  for (const file of files) {
    const source = fs.readFileSync(path.join(COMPONENT_DIR, file), 'utf8').replace(/\r\n/g, '\n');
    const template = extractTemplate(source);

    if (template === null) {
      console.log(`SKIP  ${file}`);
      continue;
    }

    checked += 1;
    try {
      const { code } = compile(template);
      console.log(`OK    ${file}  模板 ${template.length} 字符 -> 编译后 ${code.length} 字符`);
    } catch (error) {
      failed += 1;
      console.log(`FAIL  ${file}`);
      console.log(`      ${String(error.message).split('\n')[0]}`);
    }
  }

  console.log('');
  if (failed > 0) {
    console.error(`${failed} 个组件模板编译失败`);
    process.exit(1);
  }
  console.log(`全部通过：${checked} 个组件模板`);
};

main();
