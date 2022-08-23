import { NodeTypes } from "../ast";

/**
 * 专用处理插值的插件
 * @param node
 */
export function transformExpression(node) {
  if (node.type === NodeTypes.INTERPOLATION) {
    processExpression(node.content);
  }
}

function processExpression(node) {
  node.content = `_ctx.${node.content}`;
  return node;
}
