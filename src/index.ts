// 入口
export * from "./runtime-dom";
export * from "./reactivity";

import { registerRuntimeCompiler } from "./runtime-dom";
import { baseCompile } from "./compiler-core/src";
import * as runtimeDom from "./runtime-dom";

/**
 *  code => function 代码的字符串的逻辑实现
 * @param template
 * @returns
 */
function compileToFunction(template) {
  const { code } = baseCompile(template);
  // function代码字符串 => function
  const render = new Function("Vue", code)(runtimeDom);
  // 返回render函数
  return render;
}

registerRuntimeCompiler(compileToFunction);
