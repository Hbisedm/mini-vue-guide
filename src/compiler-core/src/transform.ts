export function transform(root, options) {
  const context = createContext(root, options);
  // 深度遍历
  traverseNodes(root, context);
}

function traverseNodes(root: any, context) {
  // Implement
  const { nodeTransforms } = context;
  nodeTransforms.forEach((transform) => {
    transform(root);
  });
  const children = root.children;
  if (children) {
    for (let i = 0; i < children.length; i++) {
      const node = children[i];
      traverseNodes(node, context);
    }
  }
}
function createContext(root: any, options: any) {
  const context = {
    root,
    nodeTransforms: options.nodesTransforms || [],
  };
  return context;
}
