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
/**
 * 触发这个方法说明当前的children是对象类型
 * 处理children的key，将组件的slot属性赋予对应的h函数
 * @param children
 * @param slots
 */
function normalizeObjectSlots(children: any, slots: any) {
  // let slots = {};
  if (children)
    for (let key in children) {
      /**
       * value 为一个匿名函数
       */
      const value = children[key];
      /**
       * slots[key] 的值对应一个匿名函数
       * @param props
       * @returns
       */
      slots[key] = (props) => normalizeSlotValue(value(props));
    }
  // instance.slots = slots;
}

function normalizeSlotValue(value) {
  return Array.isArray(value) ? value : [value];
}
