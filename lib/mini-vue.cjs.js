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

function h(type, props, children) {
    return createVNode(type, props, children);
}

const extend = Object.assign;
const isObject = (val) => {
    return val !== null && typeof val === "object";
};
const hasChange = Object.is;
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
const EMPTY_OBJ = {};

// 临时变量 目的是为了存储当前的effect
let activityEffect;
// 是否需要track状态变量
let shouldTrack;
/**
 * shouldTrack 是否要track：每次执行fn前都会将shouldTrack设置为true
 * activityEffect === undefined 的情况为 当建立个响应式对象后，它没有对应的effect副作用函数包裹过
 */
function isTracking() {
    return shouldTrack && activityEffect !== undefined;
}
/**
 * 这个ReactiveEffect Class目的是抽离出fn的执行,方便未来依赖收集的操作
 */
class ReactiveEffect {
    constructor(fn, scheduler) {
        this.scheduler = scheduler;
        this.deps = [];
        this.clearActivity = true;
        this._fn = fn;
    }
    run() {
        activityEffect = this;
        // 若clearActivity为false => 触发get#track => 当前的shouldTrack为false => 不会触发收集依赖
        if (!this.clearActivity) {
            return this._fn();
        }
        // 每次先设置为true后 说明当前的对象是要执行收集依赖的
        shouldTrack = true;
        // 执行时，触发里面的响应式对象track方法，因为响应式对象里面get
        const result = this._fn();
        shouldTrack = false;
        return result;
    }
    stop() {
        if (this.clearActivity) {
            cleanEffect(this);
            if (this.onStop) {
                this.onStop();
            }
            this.clearActivity = false;
        }
    }
}
/**
 *  抽离出 当前effect对象的dep容器列表清空当前的effect对象
 */
function cleanEffect(effect) {
    effect.deps.forEach((dep) => {
        dep.delete(effect);
    });
    effect.deps.length = 0;
}
const targetsMap = new Map();
function effect(fn, options = {}) {
    // 触发effect创建一个对象 -> 里面有响应式对象的get会触发track函数（使用个activityEffect变量进行暂存当前这个effect）
    const reactiveEffect = new ReactiveEffect(fn, options.scheduler);
    extend(reactiveEffect, options);
    // Object.assign(reactiveEffect, options);
    // reactiveEffect.onStop = options.onStop;
    // effect在初始化时会第一次执行一次
    reactiveEffect.run();
    const runner = reactiveEffect.run.bind(reactiveEffect);
    runner._effect = reactiveEffect;
    return runner;
}
// 收集依赖
function track(target, key) {
    if (!isTracking())
        return;
    // target -> key -> dep
    let depsMap = targetsMap.get(target);
    if (!depsMap) {
        depsMap = new Map();
        targetsMap.set(target, depsMap);
    }
    let dep = depsMap.get(key);
    if (!dep) {
        dep = new Set();
        depsMap.set(key, dep);
    }
    trackEffects(dep);
}
function trackEffects(dep) {
    if (dep.has(activityEffect))
        return;
    // 对当前这个effect进行存入set容器，未来的set操作就会去查看当前容器是否有这个属性的依赖，若有则执行与它相关
    dep.add(activityEffect);
    activityEffect.deps.push(dep);
}
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
        // 收集依赖
        if (!isReadonly) {
            track(target, key);
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

// 1 true "1" 基本数据类型...
// get set 使用Proxy去劫持是不行的，因为它的目标是一个对象类型
// 可以使用对象的get set 去劫持
class RefImpl {
    constructor(val) {
        this.dep = new Set();
        this.__v_isRef = true;
        this._rawValue = val;
        this._value = convert(val);
    }
    get value() {
        //当使用后没有effect执行。
        if (isTracking()) {
            trackEffects(this.dep);
        }
        return this._value;
    }
    set value(newVal) {
        if (hasChange(newVal, this._rawValue))
            return;
        this._rawValue = newVal;
        this._value = convert(newVal);
        triggerEffects(this.dep);
    }
}
function convert(value) {
    return isObject(value) ? reactive(value) : value;
}
function ref(value) {
    return new RefImpl(value);
}
function isRef(value) {
    return !!value.__v_isRef;
}
function unRef(val) {
    return isRef(val) ? val.value : val;
}
function proxyRefs(objectWithRefs) {
    return new Proxy(objectWithRefs, {
        // key->value ref?ref.value:value
        get(target, key) {
            return unRef(target[key]);
        },
        // set 上一个值是ref，新值不是ref,需要特殊处理
        set(target, key, value) {
            if (isRef(target[key]) && !isRef(value)) {
                return (target[key].value = value);
            }
            else {
                return Reflect.set(target, key, value);
            }
        },
    });
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
        isMounted: false,
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
        instance.setupState = proxyRefs(setupResult);
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

function createAppAPI(render) {
    // 传入APP组件
    return function createApp(rootComponent) {
        return {
            mount(rootContainer) {
                // 先转为VNode
                // component -> vNode
                // 未来的所有逻辑操作，都基于这个VNode
                const vnode = createVNode(rootComponent);
                render(vnode, rootContainer);
            },
        };
    };
}

function createRenderer(options) {
    const { createElement: hostCreateElement, patchProp: hostPatchProp, insert: hostInsert, } = options;
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
    function patch(n1, n2, container, parentComponent) {
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
                if (shapeFlag & 1 /* ShapeFlags.ELEMENT */) {
                    processElement(n1, n2, container, parentComponent);
                    // } else if (typeof vnode.type === "object") {
                }
                else if (shapeFlag & 2 /* ShapeFlags.STATEFUL_COMPONENT */) {
                    processComponent(n1, n2, container, parentComponent);
                }
                break;
        }
    }
    function processText(n1, n2, container) {
        const { children } = n2;
        const textNode = (n2.el = document.createTextNode(children));
        container.append(textNode);
    }
    function processFragment(n1, n2, container, parentComponent) {
        mountChildren(n2, container, parentComponent);
    }
    function mountChildren(vnode, container, parentComponent) {
        vnode.children.forEach((v) => {
            patch(null, v, container, parentComponent);
        });
    }
    function processElement(n1, n2, container, parentComponent) {
        if (!n1) {
            mountElement(n2, container, parentComponent);
        }
        else {
            patchElement(n1, n2);
        }
    }
    function patchElement(n1, n2, container) {
        console.log("old", n1);
        console.log("new", n2);
        const oldProps = n1.props || EMPTY_OBJ;
        const newProps = n2.props || EMPTY_OBJ;
        const el = (n2.el = n1.el);
        patchProps(el, oldProps, newProps);
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
    function mountElement(vnode, container, parentComponent) {
        const el = (vnode.el = hostCreateElement(vnode.type));
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
        hostInsert(el, container);
    }
    function processComponent(n1, n2, container, parentComponent) {
        mountComponent(n2, container, parentComponent);
    }
    function mountComponent(initialVNode, container, parentComponent) {
        const instance = createComponentInstance(initialVNode, parentComponent);
        setupComponent(instance);
        setupRenderEffect(instance, initialVNode, container);
    }
    function setupRenderEffect(instance, initialVNode, container) {
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
            }
            else {
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

function createElement(type) {
    return document.createElement(type);
}
function patchProp(el, key, oldVal, nextVal) {
    const isOn = (eventName) => /^on[A-Z]/.test(eventName);
    if (isOn(key)) {
        const eventName = key.slice(2).toLowerCase();
        console.log("<---- addEventListener run ---->");
        console.log(`eventName => ${eventName},
      event handler func => ${nextVal}`);
        el.addEventListener(eventName, nextVal);
    }
    else {
        if (nextVal === undefined || nextVal === null) {
            el.removeAttribute(key);
        }
        else {
            el.setAttribute(key, nextVal);
        }
    }
}
function insert(el, parent) {
    parent.append(el);
}
const renderer = createRenderer({
    createElement,
    patchProp,
    insert,
});
function createApp(...args) {
    return renderer.createApp(...args);
}

exports.createApp = createApp;
exports.createRenderer = createRenderer;
exports.createTextVNode = createTextVNode;
exports.getCurrentInstance = getCurrentInstance;
exports.h = h;
exports.inject = inject;
exports.provide = provide;
exports.proxyRefs = proxyRefs;
exports.ref = ref;
exports.renderSlots = renderSlots;
exports.renderer = renderer;
