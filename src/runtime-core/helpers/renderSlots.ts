import { createVNode } from "../vnode";

/**
 * 将传入的Slot 转为 Vnode
 * @param slots Array
 * @returns
 */

export function renderSlots(slots: Object, name: string, props) {
  let slot = slots[name];
  if (slot) {
    if (typeof slot === "function") {
      const vnode = createVNode("div", {}, slot(props));
      return vnode;
    }
  }
}
