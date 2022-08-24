import { TO_DISPLAY_STRING } from "./runtimeHelpers";
import { NodeTypes } from "./ast";

export function transform(root, options = {}) {
  const context = createContext(root, options);
  // 深度遍历
  traverseNodes(root, context);
  // 方便生成代码阶段调用转换后的ast树
  genCode(root);

  root.helpers = [...context.helpers.keys()];
}

function genCode(root) {
  const child = root.children[0];
  if (child.type === NodeTypes.ELEMENT) {
    root.codegenNode = child.codegenNode;
  } else {
    root.codegenNode = root.children[0];
  }
}

function traverseNodes(node: any, context) {
  const { nodeTransforms } = context;
  // 对节点进行用户自义定插件处理
  const exitFns: any = [];
  nodeTransforms.forEach((transform) => {
    const onExit = transform(node, context);
    if (onExit) exitFns.push(onExit);
  });

  // 处理不同类型
  switch (node.type) {
    case NodeTypes.INTERPOLATION:
      context.helper(TO_DISPLAY_STRING);
      break;
    case NodeTypes.ROOT:
    case NodeTypes.ELEMENT:
      traverseChildren(node, context);
      break;
    default:
      break;
  }
  let i = exitFns.length;
  //倒序执行
  while (i--) {
    exitFns[i]();
  }
}
function traverseChildren(root: any, context: any) {
  const children = root.children;
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    traverseNodes(node, context);
  }
}

function createContext(root: any, options: any) {
  const context = {
    root,
    nodeTransforms: options.nodeTransforms || [],
    helpers: new Map(),
    helper(key) {
      context.helpers.set(key, 1);
    },
  };
  return context;
}
