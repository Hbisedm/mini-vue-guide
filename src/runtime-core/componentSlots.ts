import { ShapeFlags } from "./ShapeFlags";

/**
 * 初始化Slot
 * @param instance
 * @param children
 */
export function initSlots(instance, children) {
  //   instance.slots = Array.isArray(children) ? children : [children];
  // 判断当前组件是不是含有slot
  const { vnode } = instance;
  if (vnode.shapeFlag & ShapeFlags.SLOT_CHILDREN) {
    normalizeObjectSlots(children, instance.slots);
  }
}
function normalizeObjectSlots(children: any, slots: any) {
  // let slots = {};
  if(children)
  for (let key in children) {
    const value = children[key];
    slots[key] = (props) => normalizeSlotValue(value(props));
  }
  // instance.slots = slots;
}

function normalizeSlotValue(value) {
  return Array.isArray(value) ? value : [value];
}
