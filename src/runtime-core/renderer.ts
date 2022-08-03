import { Fragment, Text } from "./vnode";
import { isObject } from "./../shared/index";
import { createComponentInstance, setupComponent } from "./component";
import { ShapeFlags } from "./ShapeFlags";
import { createAppAPI } from "./createApp";
import { effect } from "../reactivity/effect";

export function createRenderer(options) {
  const { createElement, patchProp, insert } = options;

  /**
   * 处理第一个App
   * @param vnode
   * @param container
   */
  function render(vnode, container) {
    // patch
    console.log("render 正在执行 ---->");
    patch(null, vnode, container, null);
  }
  /*
  处理elememt、component、Fragment、Text的虚拟节点
  */
  function patch(n1, n2: any, container: any, parentComponent) {
    //去处理
    console.log("<---当前处理的vnode ");
    console.log(n2);
    console.log("当前处理的vnode ----> ");
    const { type, shapeFlag } = n2;
    switch (type) {
      case Fragment:
        processFragment(n1, n2, container, parentComponent);
        break;
      case Text:
        processText(n1, n2, container);
        break;
      default:
        // 判断是不是element
        // if (typeof vnode.type === "string") {
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(n1, n2, container, parentComponent);
          // } else if (typeof vnode.type === "object") {
        } else if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
          processComponent(n1, n2, container, parentComponent);
        }
        break;
    }
  }
  function processText(n1, n2: any, container: any) {
    const { children } = n2;
    const textNode = (n2.el = document.createTextNode(children));
    container.append(textNode);
  }
  function processFragment(n1, n2: any, container: any, parentComponent) {
    mountChildren(n2, container, parentComponent);
  }
  function mountChildren(vnode, container, parentComponent) {
    vnode.children.forEach((v) => {
      patch(null, v, container, parentComponent);
    });
  }
  function processElement(n1, n2: any, container: any, parentComponent) {
    if (!n1) {
      mountElement(n2, container, parentComponent);
    } else {
      console.log("old", n1);
      console.log("new", n2);
    }
  }
  function mountElement(vnode: any, container: any, parentComponent) {
    const el = (vnode.el = createElement(vnode.type));

    const { children, props, shapeFlag } = vnode;
    // if (typeof children === "string") {
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      el.textContent = children;
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      mountChildren(vnode, el, parentComponent);
      // children.forEach((item) => {
      //   if (isObject(item)) {
      //     patch(item, el, parentComponent);
      //   }
      // });
    }

    /**
     * 判断是不是事件处理
     * @param eventName 事件名
     * @returns
     */
    for (const key in props) {
      console.log("<---- props ---->");
      const val = props[key];
      // const isOn = (eventName) => /^on[A-Z]/.test(eventName);
      // if (isOn(key)) {
      //   const eventName = key.slice(2).toLowerCase();
      //   console.log("<---- addEventListener run ---->");
      //   console.log(`eventName => ${eventName},
      // event handler func => ${val}`);
      //   el.addEventListener(eventName, val);
      // } else {
      //   el.setAttribute(key, val);
      // }
      patchProp(el, key, val);
    }
    // container.append(el);
    insert(el, container);
  }
  function processComponent(n1, n2: any, container: any, parentComponent) {
    mountComponent(n2, container, parentComponent);
  }
  function mountComponent(initialVNode: any, container: any, parentComponent) {
    const instance = createComponentInstance(initialVNode, parentComponent);

    setupComponent(instance);
    setupRenderEffect(instance, initialVNode, container);
  }
  function setupRenderEffect(instance: any, initialVNode, container) {
    effect(() => {
      if (!instance.isMounted) {
        const { proxy } = instance;
        const subTree = (instance.subTree = instance.render.call(proxy));
        console.log("instance");
        console.log(instance);
        patch(null, subTree, container, instance);
        /** 组件对应的根element元素遍历后赋予真实$el */
        initialVNode.el = subTree.el;
        instance.isMounted = true;
      } else {
        console.log("update");
        const { proxy } = instance;
        const subTree = instance.render.call(proxy);
        const prevSubTree = instance.subTree;
        instance.subTree = subTree;
        console.log("curr", subTree);
        console.log("prev", prevSubTree);
        patch(prevSubTree, subTree, container, instance);
        /** 组件对应的根element元素遍历后赋予真实$el */
      }
    });
  }
  return {
    createApp: createAppAPI(render),
  };
}
