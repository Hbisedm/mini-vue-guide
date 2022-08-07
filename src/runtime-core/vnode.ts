import { ShapeFlags } from "./ShapeFlags";

export const Fragment = Symbol("Fragment");
export const Text = Symbol("Text");

export function createVNode(type, props?, children?) {
  const vnode = {
    type,
    props,
    key: props && props.key,
    children,
    el: null,
    shapeFlag: getShapeFlag(type),
  };

  if (typeof children === "string") {
    vnode.shapeFlag |= ShapeFlags.TEXT_CHILDREN;
  } else if (typeof Array.isArray(children)) {
    vnode.shapeFlag |= ShapeFlags.ARRAY_CHILDREN;
  }

  // 判断是不是slotChildren
  // 1. 组件类型
  // 2. chrildren为对象类型
  if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
    if (typeof vnode.children === "object") {
      vnode.shapeFlag |= ShapeFlags.SLOT_CHILDREN;
    }
  }

  return vnode;
}

function getShapeFlag(type) {
  if (typeof type === "string") {
    return ShapeFlags.ELEMENT;
  } else {
    return ShapeFlags.STATEFUL_COMPONENT;
  }
}

export function createTextVNode(text: string) {
  return createVNode(Text, {}, text);
}
