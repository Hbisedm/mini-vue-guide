import { isObject } from "./../shared/index";
import { createComponentInstance, setupComponent } from "./component";
import { ShapeFlags } from "./ShapeFlags";

/**
 * 处理第一个App
 * @param vnode
 * @param container
 */
export function render(vnode, container) {
  // patch
  patch(vnode, container);
}
/*
处理elememt与component的虚拟节点
*/
function patch(vnode: any, container: any) {
  //去处理
  console.log("vnode : ");
  console.log(vnode);

  // 判断是不是element
  // if (typeof vnode.type === "string") {
  if (vnode.shapeFlag & ShapeFlags.ELEMENT) {
    processElement(vnode, container);
    // } else if (typeof vnode.type === "object") {
  } else if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
    processComponent(vnode, container);
  }
}
function processElement(vnode: any, container: any) {
  mountElement(vnode, container);
}
function mountElement(vnode: any, container: any) {
  const el = (vnode.el = document.createElement(vnode.type));

  const { children, props, shapeFlag } = vnode;
  // if (typeof children === "string") {
  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    el.textContent = children;
  } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    children.forEach((item) => {
      if (isObject(item)) {
        patch(item, el);
      }
    });
  }

  /**
   * 判断是不是事件处理
   * @param eventName 事件名
   * @returns
   */
  const isOn = (eventName) => /^on[A-Z]/.test(eventName);

  for (const key in props) {
    const val = props[key];
    if (isOn(key)) {
      const eventName = key.slice(2).toLowerCase();
      el.addEventListener(eventName, val);
    } else {
      el.setAttribute(key, val);
    }
  }
  container.append(el);
}
function processComponent(vnode: any, container: any) {
  mountComponent(vnode, container);
}

function mountComponent(initialVNode: any, container: any) {
  const instance = createComponentInstance(initialVNode);

  setupComponent(instance);
  setupRenderEffect(instance, initialVNode, container);
}
function setupRenderEffect(instance: any, initialVNode, container) {
  const { proxy } = instance;
  const subTree = instance.render.call(proxy);
  console.log("instance");
  console.log(instance);
  patch(subTree, container);
  /* 组件对应的根element元素遍历后赋予真实$el */
  initialVNode.el = subTree.el;
}
