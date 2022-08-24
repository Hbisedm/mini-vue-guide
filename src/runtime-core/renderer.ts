import { Fragment, Text } from "./vnode";
import { EMPTY_OBJ, isObject } from "./../shared/index";
import { createComponentInstance, setupComponent } from "./component";
import { ShapeFlags } from "./ShapeFlags";
import { createAppAPI } from "./createApp";
import { effect } from "../reactivity/effect";
import { shouldUpdateComponent } from "./componentUpdateUtils";
import { queueJobs } from "./scheduler";

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
    const { shapeFlag, children } = n2;
    const c2 = children;
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
        // array 2 array  diff 双端对比算法
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
    } else {
      /** 老数组中间不一样的开始指针 */
      let s1 = i;
      /** 新数组数组中间不一样的开始指针 */
      let s2 = i;
      /**
       * 新数组中间不一样的节点映射表
       * prop.key: index
       */
      const keyToNewIndexMap = new Map();

      /** 声明新结点的总个数 */
      let toBePatched = e2 - s2 + 1;
      /**
       * 声明一个映射表， key: 新数组中间节点的索引(从零开始算)   =   value: 老节点的索引
       * (ab)cde(fg)
       * (ab)ecd(fg)
       * [0: 5(4+1), 1: 3(2+1), 2: 4(3+1)]
       */
      const newIndexToOldIndexMap = new Array(toBePatched);
      /**
       * 初始化都是0,0是有逻辑意义的,代表着这个新节点在老节点中是没有的意义
       */
      for (let i = 0; i < toBePatched; i++) {
        newIndexToOldIndexMap[i] = 0;
      }
      /**
       * patch一次自增1
       * 记录作用
       * */
      let patched = 0;
      let moved = false;
      let maxNewIndexSoFar = 0;
      /** 得到新节点的map映射 */
      for (let i = s2; i <= e2; i++) {
        const nextChild = c2[i];
        keyToNewIndexMap.set(nextChild.key, i);
      }
      /**
       * 查看老节点是否有在新节点中
       * */
      for (let i = s1; i <= e1; i++) {
        /** 当前老节点的虚拟节点 */
        const prevChild = c1[i];
        /**
         * 删除操作
         * 若patched的个数大于等于toBePatch说明后面老节点多余的部分都是要移除的
         * */
        if (patched >= toBePatched) {
          hostRemove(prevChild.el);
          continue;
        }
        /** 新节点的下标 */
        let newIndex;
        /** 老节点的props有key的情况 */
        if (prevChild.key != null) {
          newIndex = keyToNewIndexMap.get(prevChild.key);
        } else {
          /**
           * 没有key的话，就遍历整个新的数组中间部分， 这也是key的重要作用，这样遍历就消耗更多性能了。
           */
          for (let j = s2; j <= e2; j++) {
            if (isSameVNodeType(prevChild, c2[j])) {
              newIndex = j;
              break;
            }
          }
        }
        /**
         * 若newIndex 为 undefined 说明 在新数组的keyToNewIndexMap中没有找到对应的索引
         * 或者是 没有key的情况下，老节点遍历后也找不到一样的节点
         */
        if (newIndex === undefined) {
          hostRemove(prevChild.el);
        } else {
          /**
           * 若一直是递增的话，就是 1, 2, 3
           * 若里面改变了 就是 3, 1, 2 等同于 newIndex < maxNewIndexSoFar => 需要移动
           */
          if (newIndex >= maxNewIndexSoFar) {
            maxNewIndexSoFar = newIndex;
          } else {
            moved = true;
          }
          /**
           * 给newIndexToOldIndexMap填充值，
           * 这里的＋1是为了防止i为0的情况，以为i为0的逻辑意义上面已经定死了。
           */
          newIndexToOldIndexMap[newIndex - s2] = i + 1;
          /**
           * 新旧节点进行patch,这里这是patch下，不会更换他的位置
           */
          patch(prevChild, c2[newIndex], container, parentComponent, null);
          patched++;
        }
      }
      /**
       * 生成 最长递增子序列
       * 这个newIndexToOldIndexMap映射表很重要
       * 返回value为递增的索引数组
       * getSequence([0: 5, 1: 3, 2: 4])
       * 返回就是[1, 2]
       * 判断需不需要moved，需要才是调用getSequence
       */
      const increasingNewIndexSequence = moved
        ? getSequence(newIndexToOldIndexMap)
        : [];
      /** 最长递增子序列的结束索引 因为是索引索引要减一嘛 */
      let j = increasingNewIndexSequence.length - 1;
      for (let i = toBePatched - 1; i >= 0; i--) {
        /** 在新数组中找锚点，
         * 如果是正序遍历新数组的话，会造成锚点可能是个不确定的元素，
         * 倒序就不会出现这个情况
         */
        const nextIndex = i + s2;
        const nextChild = c2[nextIndex];
        const anchor = nextIndex + 1 < l2 ? c2[nextIndex + 1].el : null;

        /**
         * 创建节点 newIndexToOldIndexMap中为0的表示是创建的节点
         */
        if (newIndexToOldIndexMap[i] === 0) {
          patch(null, nextChild, container, parentComponent, anchor);
        }

        /** 判断需要更换位置的情况下，才进行移动 */
        if (moved) {
          /**
           * 遍历是遍历新数组中间的vnode，然后跟稳定的最长递增子序列做匹配
           * j < 0 说明 稳定的序列已经遍历完毕了，剩下的都是不稳定的序列
           */
          if (j < 0 || i !== increasingNewIndexSequence[j]) {
            console.log("移动位置");
            hostInsert(nextChild.el, container, anchor);
          } else {
            j--;
          }
        }
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
    if (!n1) {
      /** init */
      mountComponent(n2, container, parentComponent, anchor);
    } else {
      /** update */
      updateComponent(n1, n2);
    }
  }
  /**
   * 更新组件
   * 重新生成vnode，patch
   * @param n1
   * @param n2
   */
  function updateComponent(n1, n2) {
    /** 拿到老节点的组件实例 */
    const instance = (n2.component = n1.component);
    /**
     * 判断需不需要更新
     */
    if (shouldUpdateComponent(n1, n2)) {
      /** 将组件实例的next赋值为新的vnode */
      instance.next = n2;
      /** update为effect包裹的副作用函数 */
      instance.update();
    } else {
      /** 不需要更新的处理逻辑 */
      n2.el = n1.el;
      instance.vnode = n2;
    }
  }
  function mountComponent(
    initialVNode: any,
    container: any,
    parentComponent,
    anchor
  ) {
    const instance = (initialVNode.component = createComponentInstance(
      initialVNode,
      parentComponent
    ));

    /**
     * 安装组件逻辑
     * 执行完毕后，
     * 处理了组件的props slot
     * instance.proxy = instance的一个代理
     * instance.setupState = 此时有setup的返回值的代理对象，
     * instance.render = 组件的render函数
     * */
    setupComponent(instance);
    /** 组件渲染副作用函数 */
    setupRenderEffect(instance, initialVNode, container, anchor);
  }
  function setupRenderEffect(instance: any, initialVNode, container, anchor) {
    /**
     * 使用effect监控里面的响应式对象
     * effect的返回值，再次调用，可以执行里面的回调函数
     */
    instance.update = effect(
      () => {
        // 第一次进来时(init)，这个isMounted为false
        if (!instance.isMounted) {
          const { proxy } = instance;
          /** 让instance的代理去执行组件的定义的render函数 返回的是一个subTree虚拟节点 */
          const subTree = (instance.subTree = instance.render.call(
            proxy,
            proxy
          ));
          /** 调用patch方法挂载这个虚拟节点树 */
          patch(null, subTree, container, instance, anchor);
          /** 挂载后 subTree树会带有个el真实节点的属性 */
          /** 组件对应的根element元素遍历后赋予真实$el */
          initialVNode.el = subTree.el;
          instance.isMounted = true;
        } else {
          console.log("update");
          /** update component VNode */
          const { next, vnode } = instance;
          /** next不为空 说明可以更新组件 */
          if (next) {
            next.el = vnode.el;
            updateComponentPreRender(instance, next);
          }

          const { proxy } = instance;
          const subTree = instance.render.call(proxy, proxy);
          const prevSubTree = instance.subTree;
          instance.subTree = subTree;
          console.log("curr", subTree);
          console.log("prev", prevSubTree);
          patch(prevSubTree, subTree, container, instance, anchor);
          /** 组件对应的根element元素遍历后赋予真实$el */
        }
      },
      {
        scheduler() {
          console.log("update - scheduler");
          queueJobs(instance.update);
        },
      }
    );
  }
  return {
    createApp: createAppAPI(render),
  };
}
/**
 * 更新组件
 * @param instance 当前组件实例
 * @param nextVNode 需要更新的虚拟节点
 */
function updateComponentPreRender(instance, nextVNode) {
  /** 更新组件的虚拟节点 */
  instance.vnode = nextVNode;
  /** 将更新的虚拟节点置为空 */
  instance.next = null;
  /** 更新组件的props */
  instance.props = nextVNode.props;
}
/**
 * 生成最长递增子序列
 */
function getSequence(arr: number[]): number[] {
  const p = arr.slice();
  const result = [0];
  let i, j, u, v, c;
  const len = arr.length;
  for (i = 0; i < len; i++) {
    const arrI = arr[i];
    if (arrI !== 0) {
      j = result[result.length - 1];
      if (arr[j] < arrI) {
        p[i] = j;
        result.push(i);
        continue;
      }
      u = 0;
      v = result.length - 1;
      while (u < v) {
        c = (u + v) >> 1;
        if (arr[result[c]] < arrI) {
          u = c + 1;
        } else {
          v = c;
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1];
        }
        result[u] = i;
      }
    }
  }
  u = result.length;
  v = result[u - 1];
  while (u-- > 0) {
    result[u] = v;
    v = p[v];
  }
  return result;
}
