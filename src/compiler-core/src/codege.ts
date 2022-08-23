import { NodeTypes } from "./ast";
import { helperMapName, TO_DISPLAY_STRING } from "./runtimeHelpers";

export function generate(ast) {
  const context = createCodegenContext();
  const { push } = context;

  getFunctionPreamble(ast, context);

  const functionName = "render";
  const args = ["_ctx", "_cache"];
  const signature = args.join(",");

  push(`function ${functionName}(${signature}){`);
  push("return ");
  genNode(ast.codegenNode, context);
  push("}");

  return {
    code: context.code,
  };
}
/**
 * 处理前导码
 * @param ast
 * @param context
 */
function getFunctionPreamble(ast: any, context: any) {
  const { push } = context;
  const VueBinding = "Vue";
  // const helpers = ["toDisplayString"];
  const aliasHelper = (s) => `${helperMapName[s]}: _${helperMapName[s]}`;
  if (ast.helpers.length > 0) {
    push(
      `const { ${ast.helpers.map(aliasHelper).join(", ")} } from ${VueBinding}`
    );
  }
  push("\n");
  push("return ");
}

function createCodegenContext() {
  const context = {
    code: "",
    push(source) {
      context.code += source;
    },
    helper(key) {
      return `_${helperMapName[key]}`;
    },
  };
  return context;
}

function genNode(node: any, context) {
  switch (node.type) {
    case NodeTypes.TEXT:
      getText(node, context);
      break;
    case NodeTypes.INTERPOLATION:
      gedInterpolation(node, context);
      break;
    case NodeTypes.SIMPLE_EXPRESSION:
      genExpression(node, context);
      break;
    default:
      break;
  }
}

function genExpression(node, context) {
  // Implement
  const { push } = context;
  console.log(node);
  push(`${node.content}`);
}

function gedInterpolation(node, context: any) {
  /**
   * 插值 {{ 表达式类型的content }}
   */
  const { push, helper } = context;
  push(`${helper(TO_DISPLAY_STRING)}(`);
  // 处理表达式类型 ,使用统一的入口
  genNode(node.content, context);
  push(")");
}

function getText(node, context: any) {
  const { push } = context;
  push(`'${node.content}'`);
}
