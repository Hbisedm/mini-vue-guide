import { NodeTypes } from "./ast";

/**
 * 判断当前节点是不是Text类型or插值类型
 * @param node
 * @returns
 */
export function isText(node) {
  return node.type === NodeTypes.TEXT || node.type === NodeTypes.INTERPOLATION;
}
