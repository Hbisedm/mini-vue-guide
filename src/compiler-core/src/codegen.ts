import { isString } from "../../shared";
import { NodeTypes } from "./ast";
import {
  CREATE_ELEMENT_VNODE,
  helperMapName,
  TO_DISPLAY_STRING,
} from "./runtimeHelpers";

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
    case NodeTypes.ELEMENT:
      genElement(node, context);
      break;
    case NodeTypes.COMPOUND_EXPRESSION:
      genCompoundExpression(node, context);
      break;
    default:
      break;
  }
}

function genCompoundExpression(node, context) {
  const { push } = context;
  const { children } = node;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (isString(child)) {
      push(child);
    } else {
      genNode(child, context);
    }
  }
}

function genElement(node: any, context: any) {
  const { push, helper } = context;
  const { tag, children, props } = node;
  push(`${helper(CREATE_ELEMENT_VNODE)}(`);
  // for (let i = 0; i < children.length; i++) {
  //   const child = children[i];
  //   genNode(child, context);
  // }
  // =>
  // const child = children[0];
  genNodeList(genNullable([tag, props, children]), context);
  push(")");
}

function genNodeList(nodes, context) {
  // Implement
  const { push } = context;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (isString(node)) {
      push(node);
    } else {
      genNode(node, context);
    }
    if (i < nodes.length - 1) {
      push(", ");
    }
  }
}

function genNullable(args: any) {
  // Implement
  return args.map((arg) => arg || "null");
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
