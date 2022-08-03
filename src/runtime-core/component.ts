import { proxyRefs } from "../reactivity";
import { shallowReadonly } from "../reactivity/reactive";
import { emit } from "./componentEmit";
import { initProps } from "./componentProps";
import { PublicInstanceHandles } from "./componentPublicInstance";
import { initSlots } from "./componentSlots";
/* 创建组件实例 */
export function createComponentInstance(vnode: any, parent) {
  console.log("parent ->", parent);
  const component = {
    vnode, // 组件实例的虚拟节点
    type: vnode.type, // 组件实例的name, 因为这个type就是组件
    setupState: {},
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
  initProps(instance, instance.vnode.props);
  initSlots(instance, instance.vnode.children);
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
    setCurrentInstance(instance);
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
    instance.setupState = proxyRefs(setupResult);
  }

  finishComponentSetup(instance);
}

function finishComponentSetup(instance: any) {
  const Component = instance.type;
  if (Component.render) {
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
