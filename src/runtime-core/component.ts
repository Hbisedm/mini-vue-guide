import { proxyRefs } from "../reactivity";
import { shallowReadonly } from "../reactivity/reactive";
import { emit } from "./componentEmit";
import { initProps } from "./componentProps";
import { PublicInstanceHandles } from "./componentPublicInstance";
import { initSlots } from "./componentSlots";
/**
 * 根据给的虚拟节点创建组件实例
 * @param vnode 虚拟节点
 * @param parent 父组件实例
 * @returns 创建组件实例
 */
export function createComponentInstance(vnode: any, parent) {
  const component = {
    vnode, // 组件实例的虚拟节点
    type: vnode.type, // 组件实例的name, 因为这个type就是组件
    setupState: {},
    next: null, // 代表下次要更新的vnode
    props: {},
    slots: {},
    provides: parent ? parent.provides : {},
    parent,
    isMounted: false,
    emit: () => {},
  };
  // thisArg是null或undefined，执行作用域的 this 将被视为新函数的 thisArg。
  // component是component#emit的第一个参数
  component.emit = emit.bind(null, component) as () => void;
  return component;
}

export function setupComponent(instance) {
  // TODO
  /** 处理props */
  initProps(instance, instance.vnode.props);
  /** 处理插槽 */
  initSlots(instance, instance.vnode.children);
  /** 安装有状态的组件 */
  setupStatefulComponent(instance);
}
function setupStatefulComponent(instance: any) {
  const Component = instance.type;

  instance.proxy = new Proxy({ _: instance }, PublicInstanceHandles);

  const { setup } = Component;

  // 有可能用户没有写setup
  if (setup) {
    // function -> render
    // Object  -> 注入到当前组件的上下文中
    const { props, emit } = instance;
    console.log(`处理组件传入的props =>`);
    console.log(instance);

    console.log(props);
    console.log(`<= 处理组件传入的props`);
    /**
     * 这个语句是为了在setup执行中可以拿到当前组件实例
     */
    setCurrentInstance(instance);
    /**
     * 第一个参数是传给组件去使用props
     * 第二个是个对象 里面有 emit 一个发射器 发射给父组件
     */
    const setupResult = setup(shallowReadonly(props), {
      emit,
    });
    setCurrentInstance(null);

    handleSetupResult(instance, setupResult);
  }
}
function handleSetupResult(instance, setupResult: any) {
  // function Object
  // TODO function

  if (typeof setupResult === "object") {
    /** 转成一个代理 */
    instance.setupState = proxyRefs(setupResult);
  }

  finishComponentSetup(instance);
}

function finishComponentSetup(instance: any) {
  const Component = instance.type;
  if (Component.render) {
    /** 将组件的render函数 赋值给 组件实例 */
    instance.render = Component.render;
  }
}
let currentInstance = null;
export function getCurrentInstance() {
  return currentInstance;
}
function setCurrentInstance(instance) {
  currentInstance = instance;
}
