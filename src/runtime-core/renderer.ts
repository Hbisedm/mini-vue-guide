import { isObject } from "./../shared/index";
import { createComponentInstance, setupComponent } from "./component";

export function render(vnode, container) {
  // patch
  patch(vnode, container);
}
function patch(vnode: any, container: any) {
  //去处理组件
  console.log("vnode : ");
  console.log(vnode);

  // 判断是不是element
  if (typeof vnode.type === "string") {
    processElement(vnode, container);
  } else if (typeof vnode.type === "object") {
    processComponent(vnode, container);
  }
}
function processElement(vnode: any, container: any) {
  mountElement(vnode, container);
}
function mountElement(vnode: any, container: any) {
  const el = (vnode.el = document.createElement(vnode.type));

  const { children, props } = vnode;
  if (typeof children === "string") {
    el.textContent = children;
  } else {
    children.forEach((item) => {
      if (isObject(item)) {
        patch(item, el);
      }
    });
  }

  for (const key in props) {
    const val = props[key];
    el.setAttribute(key, val);
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
