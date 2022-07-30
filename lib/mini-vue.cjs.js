'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const Fragment = Symbol("Fragment");
const Text = Symbol("Text");
function createVNode(type, props, children) {
    const vnode = {
        type,
        props,
        children,
        el: null,
        shapeFlag: getShapeFlag(type),
    };
    if (typeof children === "string") {
        vnode.shapeFlag |= 4 /* ShapeFlags.TEXT_CHILDREN */;
    }
    else if (typeof Array.isArray(children)) {
        vnode.shapeFlag |= 8 /* ShapeFlags.ARRAY_CHILDREN */;
    }
    // 判断是不是slotChildren
    // 1. 组件类型
    // 2. chrildren为对象类型
    if (vnode.shapeFlag & 2 /* ShapeFlags.STATEFUL_COMPONENT */) {
        if (typeof vnode.children === "object") {
            vnode.shapeFlag |= 16 /* ShapeFlags.SLOT_CHILDREN */;
        }
    }
    return vnode;
}
function getShapeFlag(type) {
    if (typeof type === "string") {
        return 1 /* ShapeFlags.ELEMENT */;
    }
    else {
        return 2 /* ShapeFlags.STATEFUL_COMPONENT */;
    }
}
function createTextVNode(text) {
    return createVNode(Text, {}, text);
}

/**
 * 将传入的Slot 转为 Vnode
 * @param slots Array
 * @returns
 */
function renderSlots(slots, name, props) {
    let slot = slots[name];
    if (slot) {
        if (typeof slot === "function") {
            console.log("slot 正在执行 -----------------------------------------");
            console.log(slot(props));
            console.log("slot 正在执行-----------------------------------------");
            const vnode = createVNode(Fragment, {}, slot(props));
            return vnode;
        }
    }
}

const extend = Object.assign;
const isObject = (val) => {
    return val !== null && typeof val === "object";
};
const hasOwn = (thisObj, key) => Object.prototype.hasOwnProperty.call(thisObj, key);
const camelize = (str) => {
    return str.replace(/-(\w)/g, (_, a) => {
        return a ? a.toUpperCase() : "";
    });
};
const capitalize = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
};
const toHandlerKey = (str) => {
    return "on" + capitalize(str);
};

const targetsMap = new Map();
// 触发依赖
function trigger(target, key) {
    const depsMap = targetsMap.get(target);
    if (!depsMap)
        return;
    const dep = depsMap.get(key);
    triggerEffects(dep);
}
function triggerEffects(dep) {
    for (let item of dep) {
        if (item.scheduler) {
            // 当前的effect依赖实例如果有scheduler属性的话，说明effect的构造有传递第二个参数
            item.scheduler();
        }
        else {
            // 否则执行原来的逻辑
            item.run();
        }
    }
}

const get = createGetter();
const set = createSetter();
const readonlyGet = createGetter(true);
const shallowReadonlyGet = createGetter(true, true);
function createGetter(isReadonly = false, shallow = false) {
    return function get(target, key) {
        if (key === "__v_is_reactive" /* ReactiveFlags.IS_REACTIVE */) {
            return !isReadonly;
        }
        if (key === "__v_is_readonly" /* ReactiveFlags.IS_READONLY */) {
            return isReadonly;
        }
        const res = Reflect.get(target, key);
        if (shallow) {
            return res;
        }
        if (isObject(res)) {
            return isReadonly ? readonly(res) : reactive(res);
        }
        return res;
    };
}
function createSetter() {
    return function set(target, key, val) {
        const res = Reflect.set(target, key, val);
        // 触发依赖
        trigger(target, key);
        return res;
    };
}
const mutableHandlers = {
    get,
    set,
};
const readonlyHandlers = {
    get: readonlyGet,
    set: function (target, key, val) {
        console.warn(`${key}cannot set, beacause current Object is readlony`, target);
        return true;
    },
};
const shallowReadonlyHandlers = extend({}, readonlyHandlers, {
    get: shallowReadonlyGet,
});

function reactive(raw) {
    return createActivityObj(raw, mutableHandlers);
}
function readonly(raw) {
    return createActivityObj(raw, readonlyHandlers);
}
function createActivityObj(target, baseHandlers) {
    if (!isObject(target)) {
        console.warn(`target: ${target} no a object`);
        return target;
    }
    return new Proxy(target, baseHandlers);
}
function shallowReadonly(raw) {
    return createActivityObj(raw, shallowReadonlyHandlers);
}

function emit(instance, event, ...args) {
    console.table("instance", instance);
    console.log("emit", event);
    const { props } = instance;
    //TPP
    const handler = props[toHandlerKey(camelize(event))];
    handler && handler(...args);
}

function initProps(componentInstance, rawProps) {
    componentInstance.props = rawProps || {};
}

const publicPropertiesMap = {
    $el: (i) => i.vnode.el,
    $slots: (i) => i.slots,
};
const PublicInstanceHandles = {
    get({ _: instance }, key) {
        /* setupState */
        const { setupState, props } = instance;
        if (hasOwn(setupState, key)) {
            return setupState[key];
        }
        else if (hasOwn(props, key)) {
            return props[key];
        }
        /*     if (key in setupState) {
          return setupState[key];
        }
        if (key in props) {
          return props[key];
        } */
        /* this.$el ... */
        /*     if (key === "$el") {
          return instance.el;
        } */
        /*     if (key in publicPropertiesMap) {
          return publicPropertiesMap[key](instance);
        } */
        const publicGetter = publicPropertiesMap[key];
        if (publicGetter) {
            return publicGetter(instance);
        }
    },
};

/**
 * 初始化Slot
 * @param instance
 * @param children
 */
function initSlots(instance, children) {
    //   instance.slots = Array.isArray(children) ? children : [children];
    // 判断当前组件是不是含有slot
    const { vnode } = instance;
    if (vnode.shapeFlag & 16 /* ShapeFlags.SLOT_CHILDREN */) {
        normalizeObjectSlots(children, instance.slots);
    }
}
/**
 * 触发这个方法说明当前的children是对象类型
 * 处理children的key，将组件的slot属性赋予对应的h函数
 * @param children
 * @param slots
 */
function normalizeObjectSlots(children, slots) {
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

/* 创建组件实例 */
function createComponentInstance(vnode, parent) {
    console.log("parent ->", parent);
    const component = {
        vnode,
        type: vnode.type,
        setupState: {},
        props: {},
        slots: {},
        provides: parent ? parent.provides : {},
        parent,
        emit: () => { },
    };
    // thisArg是null或undefined，执行作用域的 this 将被视为新函数的 thisArg。
    // component是component#emit的第一个参数
    component.emit = emit.bind(null, component);
    return component;
}
function setupComponent(instance) {
    // TODO
    initProps(instance, instance.vnode.props);
    initSlots(instance, instance.vnode.children);
    setupStatefulComponent(instance);
}
function setupStatefulComponent(instance) {
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
function handleSetupResult(instance, setupResult) {
    // function Object
    // TODO function
    if (typeof setupResult === "object") {
        instance.setupState = setupResult;
    }
    finishComponentSetup(instance);
}
function finishComponentSetup(instance) {
    const Component = instance.type;
    if (Component.render) {
        instance.render = Component.render;
    }
}
let currentInstance = null;
function getCurrentInstance() {
    return currentInstance;
}
function setCurrentInstance(instance) {
    currentInstance = instance;
}

/**
 * 处理第一个App
 * @param vnode
 * @param container
 */
function render(vnode, container, parentComponent) {
    // patch
    console.log("render 正在执行 ---->");
    patch(vnode, container, parentComponent);
}
/*
处理elememt、component、Fragment、Text的虚拟节点
*/
function patch(vnode, container, parentComponent) {
    //去处理
    console.log("<---当前处理的vnode ");
    console.log(vnode);
    console.log("当前处理的vnode ----> ");
    const { type, shapeFlag } = vnode;
    switch (type) {
        case Fragment:
            processFragment(vnode, container, parentComponent);
            break;
        case Text:
            processText(vnode, container);
            break;
        default:
            // 判断是不是element
            // if (typeof vnode.type === "string") {
            if (shapeFlag & 1 /* ShapeFlags.ELEMENT */) {
                processElement(vnode, container, parentComponent);
                // } else if (typeof vnode.type === "object") {
            }
            else if (shapeFlag & 2 /* ShapeFlags.STATEFUL_COMPONENT */) {
                processComponent(vnode, container, parentComponent);
            }
            break;
    }
}
function processText(vnode, container) {
    const { children } = vnode;
    const textNode = (vnode.el = document.createTextNode(children));
    container.append(textNode);
}
function processFragment(vnode, container, parentComponent) {
    mountChildren(vnode, container, parentComponent);
}
function mountChildren(vnode, container, parentComponent) {
    vnode.children.forEach((v) => {
        patch(v, container, parentComponent);
    });
}
function processElement(vnode, container, parentComponent) {
    mountElement(vnode, container, parentComponent);
}
function mountElement(vnode, container, parentComponent) {
    const el = (vnode.el = document.createElement(vnode.type));
    const { children, props, shapeFlag } = vnode;
    // if (typeof children === "string") {
    if (shapeFlag & 4 /* ShapeFlags.TEXT_CHILDREN */) {
        el.textContent = children;
    }
    else if (shapeFlag & 8 /* ShapeFlags.ARRAY_CHILDREN */) {
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
    const isOn = (eventName) => /^on[A-Z]/.test(eventName);
    for (const key in props) {
        console.log("<---- props ---->");
        const val = props[key];
        if (isOn(key)) {
            const eventName = key.slice(2).toLowerCase();
            console.log("<---- addEventListener run ---->");
            console.log(`eventName => ${eventName}, 
      event handler func => ${val}`);
            el.addEventListener(eventName, val);
        }
        else {
            el.setAttribute(key, val);
        }
    }
    container.append(el);
}
function processComponent(vnode, container, parentComponent) {
    mountComponent(vnode, container, parentComponent);
}
function mountComponent(initialVNode, container, parentComponent) {
    const instance = createComponentInstance(initialVNode, parentComponent);
    setupComponent(instance);
    setupRenderEffect(instance, initialVNode, container);
}
function setupRenderEffect(instance, initialVNode, container) {
    const { proxy } = instance;
    const subTree = instance.render.call(proxy);
    console.log("instance");
    console.log(instance);
    patch(subTree, container, instance);
    /** 组件对应的根element元素遍历后赋予真实$el */
    initialVNode.el = subTree.el;
}

// 传入APP组件
function createApp(rootComponent) {
    return {
        mount(rootContainer) {
            // 先转为VNode
            // component -> vNode
            // 未来的所有逻辑操作，都基于这个VNode
            const vnode = createVNode(rootComponent);
            render(vnode, rootContainer);
        },
    };
}

function h(type, props, children) {
    return createVNode(type, props, children);
}

function provide(key, value) {
    const currentInstance = getCurrentInstance();
    if (currentInstance) {
        let { provides } = currentInstance;
        console.log(parent);
        /**
         * 这里的初始化需要处理
         * 第一次的时候，当前组件拿到是父级组件的provides
         * 未来在调用时，就直接覆盖父级的
         * 借用原型链的思想
         */
        const parentProvides = currentInstance.parent.provides;
        if (provides === parentProvides) {
            provides = currentInstance.provides = Object.create(parentProvides);
        }
        provides[key] = value;
    }
}
function inject(key, defaultValue) {
    const currentInstance = getCurrentInstance();
    const { provides } = currentInstance.parent;
    if (key in provides) {
        return provides[key];
    }
    else if (defaultValue !== "") {
        if (typeof defaultValue === "function") {
            return defaultValue();
        }
        return defaultValue;
    }
}

exports.createApp = createApp;
exports.createTextVNode = createTextVNode;
exports.getCurrentInstance = getCurrentInstance;
exports.h = h;
exports.inject = inject;
exports.provide = provide;
exports.renderSlots = renderSlots;
