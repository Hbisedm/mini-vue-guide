import { createVNode } from "./vnode";

export function createAppAPI(render) {
  // 传入APP组件
  return function createApp(rootComponent) {
    return {
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
