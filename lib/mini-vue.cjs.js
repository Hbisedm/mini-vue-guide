'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const isObject = (val) => {
    return val !== null && typeof val === "object";
};

const publicPropertiesMap = {
    $el: (i) => i.vnode.el,
};
const PublicInstanceHandles = {
    get({ _: instance }, key) {
        /* setupState */
        const { setupState } = instance;
        if (key in setupState) {
            return setupState[key];
        }
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
    };
    return component;
}
function setupComponent(instance) {
    // TODO
    // initProps
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
        const setupResult = setup();
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
    if (typeof vnode.type === "string") {
        processElement(vnode, container);
    }
    else if (typeof vnode.type === "object") {
        processComponent(vnode, container);
    }
}
function processElement(vnode, container) {
    mountElement(vnode, container);
}
function mountElement(vnode, container) {
    const el = (vnode.el = document.createElement(vnode.type));
    const { children, props } = vnode;
    if (typeof children === "string") {
        el.textContent = children;
    }
    else {
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
    return {
        type,
        props,
        children,
        el: null,
    };
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
