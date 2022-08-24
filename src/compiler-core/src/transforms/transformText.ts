import { NodeTypes } from "../ast";
import { isText } from "../utils";

export function transformText(node) {
  return () => {
    if (node.type === NodeTypes.ELEMENT) {
      let currentContainer;
      const { children } = node;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        // 如果是的话， 进行 `+`的操作
        if (isText(child)) {
          for (let j = i + 1; j < children.length; j++) {
            const next = children[j];
            if (isText(next)) {
              // init
              if (!currentContainer) {
                // 更新 Text or插值为复合类型
                currentContainer = children[i] = {
                  type: NodeTypes.COMPOUND_EXPRESSION,
                  children: [child],
                };
              }
              currentContainer.children.push(" + ");
              currentContainer.children.push(next);
              children.splice(j, 1);
              j--;
            } else {
              currentContainer = undefined;
              break;
            }
          }
        }
      }
    }
  };
}
