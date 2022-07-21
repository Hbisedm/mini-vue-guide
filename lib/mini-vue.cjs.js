'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const extend = Object.assign;
const isObject = (val) => {
    return val !== null && typeof val === "object";
};
const hasOwn = (thisObj, key) => Object.prototype.hasOwnProperty.call(thisObj, key);

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

function initProps(componentInstance, rawProps) {
    componentInstance.props = rawProps || {};
}

const publicPropertiesMap = {
    $el: (i) => i.vnode.el,
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

/* 创建组件实例 */
function createComponentInstance(vnode) {
    const component = {
        vnode,
        type: vnode.type,
        setupState: {},
        props: {},
    };
    return component;
}
function setupComponent(instance) {
    // TODO
    initProps(instance, instance.vnode.props);
    // initSlots
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
        const setupResult = setup(shallowReadonly(instance.props));
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

function render(vnode, container) {
    // patch
    patch(vnode, container);
}
function patch(vnode, container) {
    //去处理组件
    console.log("vnode : ");
    console.log(vnode);
    // 判断是不是element
    // if (typeof vnode.type === "string") {
    if (vnode.shapeFlag & 1 /* ShapeFlags.ELEMENT */) {
        processElement(vnode, container);
        // } else if (typeof vnode.type === "object") {
    }
    else if (vnode.shapeFlag & 2 /* ShapeFlags.STATEFUL_COMPONENT */) {
        processComponent(vnode, container);
    }
}
function processElement(vnode, container) {
    mountElement(vnode, container);
}
function mountElement(vnode, container) {
    const el = (vnode.el = document.createElement(vnode.type));
    const { children, props, shapeFlag } = vnode;
    // if (typeof children === "string") {
    if (shapeFlag & 4 /* ShapeFlags.TEXT_CHILDREN */) {
        el.textContent = children;
    }
    else if (shapeFlag & 8 /* ShapeFlags.ARRAY_CHILDREN */) {
        children.forEach((item) => {
            if (isObject(item)) {
                patch(item, el);
            }
        });
    }
    const isOn = (eventName) => /^on[A-Z]/.test(eventName);
    for (const key in props) {
        const val = props[key];
        if (isOn(key)) {
            const eventName = key.slice(2).toLowerCase();
            el.addEventListener(eventName, val);
        }
        else {
            el.setAttribute(key, val);
        }
    }
    container.append(el);
}
function processComponent(vnode, container) {
    mountComponent(vnode, container);
}
function mountComponent(initialVNode, container) {
    const instance = createComponentInstance(initialVNode);
    setupComponent(instance);
    setupRenderEffect(instance, initialVNode, container);
}
function setupRenderEffect(instance, initialVNode, container) {
    const { proxy } = instance;
    const subTree = instance.render.call(proxy);
    console.log("instance");
    console.log(instance);
    patch(subTree, container);
    /* 组件对应的根element元素遍历后赋予真实$el */
    initialVNode.el = subTree.el;
}

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

exports.createApp = createApp;
exports.h = h;
