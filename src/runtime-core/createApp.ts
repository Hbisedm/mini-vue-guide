import { createVNode } from "./vnode";

export function createAppAPI(render) {
  // 传入APP组件                目的是创建根的虚拟节点
  return function createApp(rootComponent) {
    return {
      /** rootContainer 根Dom节点 */
      mount(rootContainer) {
        // 先转为VNode
        // component -> vNode
        // 未来的所有逻辑操作，都基于这个VNode
        const vnode = createVNode(rootComponent);
        render(vnode, rootContainer);
      },
    };
  };
}
