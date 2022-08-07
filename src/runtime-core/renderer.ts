import { Fragment, Text } from "./vnode";
import { EMPTY_OBJ, isObject } from "./../shared/index";
import { createComponentInstance, setupComponent } from "./component";
import { ShapeFlags } from "./ShapeFlags";
import { createAppAPI } from "./createApp";
import { effect } from "../reactivity/effect";

export function createRenderer(options) {
  const {
    createElement: hostCreateElement,
    patchProp: hostPatchProp,
    remove: hostRemove,
    insert: hostInsert,
    setElementText: hostSetElementText,
  } = options;

  /**
   * 处理第一个App
   * @param vnode
   * @param container
   */
  function render(vnode, container) {
    // patch
    console.log("render 正在执行 入口 ---->");
    patch(null, vnode, container, null, null);
  }
  /*
  处理elememt、component、Fragment、Text的虚拟节点
  */
  function patch(n1, n2: any, container: any, parentComponent, anchor) {
    //去处理
    console.log("<---当前处理的vnode ");
    console.log(n2);
    console.log("当前处理的vnode ----> ");
    const { type, shapeFlag } = n2;
    switch (type) {
      case Fragment:
        processFragment(n1, n2, container, parentComponent, anchor);
        break;
      case Text:
        processText(n1, n2, container);
        break;
      default:
        // 判断是不是element
        // if (typeof vnode.type === "string") {
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(n1, n2, container, parentComponent, anchor);
          // } else if (typeof vnode.type === "object") {
        } else if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
          processComponent(n1, n2, container, parentComponent, anchor);
        }
        break;
    }
  }
  function processText(n1, n2: any, container: any) {
    const { children } = n2;
    const textNode = (n2.el = document.createTextNode(children));
    container.append(textNode);
  }
  function processFragment(
    n1,
    n2: any,
    container: any,
    parentComponent,
    anchor
  ) {
    mountChildren(n2.children, container, parentComponent, anchor);
  }
  function mountChildren(children, container, parentComponent, anchor) {
    children.forEach((v) => {
      patch(null, v, container, parentComponent, anchor);
    });
  }
  function processElement(
    n1,
    n2: any,
    container: any,
    parentComponent,
    anchor
  ) {
    if (!n1) {
      mountElement(n2, container, parentComponent, anchor);
    } else {
      patchElement(n1, n2, container, parentComponent, anchor);
    }
  }
  function patchElement(n1, n2, container, parentComponent, anchor) {
    console.log("old", n1);
    console.log("new", n2);
    const oldProps = n1.props || EMPTY_OBJ;
    const newProps = n2.props || EMPTY_OBJ;
    const el = (n2.el = n1.el);
    patchChildren(n1, n2, el, parentComponent, anchor);
    patchProps(el, oldProps, newProps);
  }
  function patchChildren(n1, n2, container, parentComponent, anchor) {
    // Implement
    const prevShapeFlag = n1.shapeFlag;
    const c1 = n1.children;
    const { shapeFlag } = n2;
    const c2 = n2.children;
    /** 新的子node 是 文本 */
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // 删除旧数组children
        unmountChildren(n1.children);
      }
      if (c1 !== c2) {
        // 添加新文本
        hostSetElementText(container, c2);
      }
    } else {
      /** 新的孩子节点是数组 */
      if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
        /** 清空旧的文本节点 */
        hostSetElementText(container, "");
        /** 加入新的数组节点 */
        mountChildren(n2.children, container, parentComponent, anchor);
      } else {
        // array 2 array  diff
        patchKeyedChildren(c1, c2, container, parentComponent, anchor);
      }
    }
  }
  function patchKeyedChildren(
    c1,
    c2,
    container,
    parentComponent,
    parentAnchor
  ) {
    const l1 = c1.length;
    const l2 = c2.length;
    let e1 = l1 - 1;
    let e2 = l2 - 1;
    let i = 0;

    let isSameVNodeType = (n1, n2) => {
      return n1.type === n2.type && n1.key === n2.key;
    };

    while (i <= e1 && i <= e2) {
      const n1 = c1[i];
      const n2 = c2[i];
      if (isSameVNodeType(n1, n2)) {
        patch(n1, n2, container, parentComponent, parentAnchor);
      } else {
        break;
      }
      i++;
    }
    console.log("left");
    /** 左边遍历后 当前的index指针位置代表前面是新旧节点相等的 */
    console.log(i);
    while (i <= e1 && i <= e2) {
      const n1 = c1[e1];
      const n2 = c2[e2];
      if (isSameVNodeType(n1, n2)) {
        patch(n1, n2, container, parentComponent, parentAnchor);
      } else {
        break;
      }
      e1--;
      e2--;
    }
    console.log("right");
    console.log(i);
    /** 右边遍历完毕代表e1，e2的后面是新旧节点相等的部分 */
    console.log(e1);
    console.log(e2);
    /**
     * 左侧or右侧添加
     * 新的比老的多的情况
     * 无论是左侧还是右侧添加，双端检测后 i > e1
     */
    if (i > e1) {
      /** 判断i是否小于新的最后指针 */
      if (i <= e2) {
        const nextPos = e2 + 1;
        /**
         * 判断要前插还是后插
         *
         * */
        const anchor = nextPos < l2 ? c2[nextPos].el : null;
        while (i <= e2) {
          const n2 = c2[i];
          patch(null, n2, container, parentComponent, anchor);
          i++;
        }
      }
    } else if (i > e2) {
      /** 老的比新的多的情况，删除 */
      while (i <= e1) {
        const n1 = c1[i].el;
        hostRemove(n1);
        i++;
      }
    }
  }

  /**
   * 遍历删除子元素
   * @param children
   */
  function unmountChildren(children: any) {
    for (const key in children) {
      const el = children[key];
      // remove
      hostRemove(el);
    }
  }
  function patchProps(el, oldProps, newProps) {
    if (oldProps !== newProps) {
      for (const key in newProps) {
        const prevProp = oldProps[key];
        const nextProp = newProps[key];
        hostPatchProp(el, key, prevProp, nextProp);
      }
      // 第一次初始化的时候，不需要对比老节点
      if (oldProps !== EMPTY_OBJ) {
        for (const key in oldProps) {
          if (!(key in newProps)) {
            hostPatchProp(el, key, oldProps[key], null);
          }
        }
      }
    }
  }
  function mountElement(vnode: any, container: any, parentComponent, anchor) {
    const el = (vnode.el = hostCreateElement(vnode.type));

    const { children, props, shapeFlag } = vnode;
    // if (typeof children === "string") {
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      el.textContent = children;
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      mountChildren(vnode.children, el, parentComponent, anchor);
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
      hostPatchProp(el, key, null, val);
    }
    // container.append(el);
    hostInsert(el, container, anchor);
  }
  function processComponent(
    n1,
    n2: any,
    container: any,
    parentComponent,
    anchor
  ) {
    mountComponent(n2, container, parentComponent, anchor);
  }
  function mountComponent(
    initialVNode: any,
    container: any,
    parentComponent,
    anchor
  ) {
    const instance = createComponentInstance(initialVNode, parentComponent);

    setupComponent(instance);
    setupRenderEffect(instance, initialVNode, container, anchor);
  }
  function setupRenderEffect(instance: any, initialVNode, container, anchor) {
    effect(() => {
      if (!instance.isMounted) {
        const { proxy } = instance;
        const subTree = (instance.subTree = instance.render.call(proxy));
        console.log("instance");
        console.log(instance);
        patch(null, subTree, container, instance, anchor);
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
        patch(prevSubTree, subTree, container, instance, anchor);
        /** 组件对应的根element元素遍历后赋予真实$el */
      }
    });
  }
  return {
    createApp: createAppAPI(render),
  };
}
