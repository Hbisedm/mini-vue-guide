import { Fragment } from "./../vnode";
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
      console.log("slot 正在执行 -----------------------------------------");
      console.log(slot(props));
      console.log("slot 正在执行-----------------------------------------");
      const vnode = createVNode(Fragment, {}, slot(props));
      return vnode;
    }
  }
}
