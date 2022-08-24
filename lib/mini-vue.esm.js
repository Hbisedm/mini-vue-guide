const Fragment = Symbol("Fragment");
const Text = Symbol("Text");
function createVNode(type, props, children) {
    const vnode = {
        type,
        props,
        key: props && props.key,
        children,
        component: null,
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

function toDisplayString(value) {
    return String(value);
}

const extend = Object.assign;
const isObject = (val) => {
    return val !== null && typeof val === "object";
};
const isString = (val) => typeof val === "string";
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
    /* 返回值再次调用执行对应的runner */
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
    $props: (i) => i.props,
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

/**
 * 根据给的虚拟节点创建组件实例
 * @param vnode 虚拟节点
 * @param parent 父组件实例
 * @returns 创建组件实例
 */
function createComponentInstance(vnode, parent) {
    const component = {
        vnode,
        type: vnode.type,
        setupState: {},
        next: null,
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
    /** 处理props */
    initProps(instance, instance.vnode.props);
    /** 处理插槽 */
    initSlots(instance, instance.vnode.children);
    /** 安装有状态的组件 */
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
function handleSetupResult(instance, setupResult) {
    // function Object
    // TODO function
    if (typeof setupResult === "object") {
        /** 转成一个代理 */
        instance.setupState = proxyRefs(setupResult);
    }
    finishComponentSetup(instance);
}
function finishComponentSetup(instance) {
    const Component = instance.type;
    // template ==> render函数
    if (compiler && !Component.render) {
        if (Component.template) {
            Component.render = compiler(Component.template);
        }
    }
    /** 将组件的render函数 赋值给 组件实例 */
    instance.render = Component.render;
}
let currentInstance = null;
function getCurrentInstance() {
    return currentInstance;
}
function setCurrentInstance(instance) {
    currentInstance = instance;
}
let compiler;
function registerRuntimeCompiler(_compiler) {
    compiler = _compiler;
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
    // 传入APP组件                目的是创建根的虚拟节点
    return function createApp(rootComponent) {
        return {
            /** rootContainer 根Dom节点 */
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

function shouldUpdateComponent(prevVNode, nextVNode) {
    const { props: prevProps } = prevVNode;
    const { props: nextProps } = nextVNode;
    for (const key in nextProps) {
        /** 简单判断下 新旧节点的props是否一样 */
        if (nextProps[key] !== prevProps[key]) {
            return true;
        }
    }
    return false;
}

/** 队列 */
const queue = [];
/** 防止Promise频繁创建 */
let isFlushPending = false;
/** 提供给用户 可以拿到视图异步更新后的数据, */
function nextTick(fn) {
    return fn ? Promise.resolve().then(fn) : Promise.resolve();
}
function queueJobs(job) {
    if (!queue.includes(job)) {
        queue.push(job);
    }
    /** 执行加入异步队列 */
    queueFlush();
}
function queueFlush() {
    if (isFlushPending)
        return;
    isFlushPending = true;
    /**
     * 每次进来都会创建个Promise
     * 使用个变量去控制Promise的创建
     */
    //   Promise.resolve().then(() => {
    //     flushJobs();
    //   });
    nextTick(flushJobs);
}
function flushJobs() {
    isFlushPending = false;
    let job;
    while ((job = queue.shift())) {
        job && job();
    }
}

function createRenderer(options) {
    const { createElement: hostCreateElement, patchProp: hostPatchProp, remove: hostRemove, insert: hostInsert, setElementText: hostSetElementText, } = options;
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
    function patch(n1, n2, container, parentComponent, anchor) {
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
                if (shapeFlag & 1 /* ShapeFlags.ELEMENT */) {
                    processElement(n1, n2, container, parentComponent, anchor);
                    // } else if (typeof vnode.type === "object") {
                }
                else if (shapeFlag & 2 /* ShapeFlags.STATEFUL_COMPONENT */) {
                    processComponent(n1, n2, container, parentComponent, anchor);
                }
                break;
        }
    }
    function processText(n1, n2, container) {
        const { children } = n2;
        const textNode = (n2.el = document.createTextNode(children));
        container.append(textNode);
    }
    function processFragment(n1, n2, container, parentComponent, anchor) {
        mountChildren(n2.children, container, parentComponent, anchor);
    }
    function mountChildren(children, container, parentComponent, anchor) {
        children.forEach((v) => {
            patch(null, v, container, parentComponent, anchor);
        });
    }
    function processElement(n1, n2, container, parentComponent, anchor) {
        if (!n1) {
            mountElement(n2, container, parentComponent, anchor);
        }
        else {
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
        if (shapeFlag & 4 /* ShapeFlags.TEXT_CHILDREN */) {
            if (prevShapeFlag & 8 /* ShapeFlags.ARRAY_CHILDREN */) {
                // 删除旧数组children
                unmountChildren(n1.children);
            }
            if (c1 !== c2) {
                // 添加新文本
                hostSetElementText(container, c2);
            }
        }
        else {
            /** 新的孩子节点是数组 */
            if (prevShapeFlag & 4 /* ShapeFlags.TEXT_CHILDREN */) {
                /** 清空旧的文本节点 */
                hostSetElementText(container, "");
                /** 加入新的数组节点 */
                mountChildren(n2.children, container, parentComponent, anchor);
            }
            else {
                // array 2 array  diff 双端对比算法
                patchKeyedChildren(c1, c2, container, parentComponent, anchor);
            }
        }
    }
    function patchKeyedChildren(c1, c2, container, parentComponent, parentAnchor) {
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
            }
            else {
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
            }
            else {
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
        }
        else if (i > e2) {
            /** 老的比新的多的情况，删除 */
            while (i <= e1) {
                const n1 = c1[i].el;
                hostRemove(n1);
                i++;
            }
        }
        else {
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
                }
                else {
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
                }
                else {
                    /**
                     * 若一直是递增的话，就是 1, 2, 3
                     * 若里面改变了 就是 3, 1, 2 等同于 newIndex < maxNewIndexSoFar => 需要移动
                     */
                    if (newIndex >= maxNewIndexSoFar) {
                        maxNewIndexSoFar = newIndex;
                    }
                    else {
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
                    }
                    else {
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
    function unmountChildren(children) {
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
    function mountElement(vnode, container, parentComponent, anchor) {
        const el = (vnode.el = hostCreateElement(vnode.type));
        const { children, props, shapeFlag } = vnode;
        // if (typeof children === "string") {
        if (shapeFlag & 4 /* ShapeFlags.TEXT_CHILDREN */) {
            el.textContent = children;
        }
        else if (shapeFlag & 8 /* ShapeFlags.ARRAY_CHILDREN */) {
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
    function processComponent(n1, n2, container, parentComponent, anchor) {
        if (!n1) {
            /** init */
            mountComponent(n2, container, parentComponent, anchor);
        }
        else {
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
        }
        else {
            /** 不需要更新的处理逻辑 */
            n2.el = n1.el;
            instance.vnode = n2;
        }
    }
    function mountComponent(initialVNode, container, parentComponent, anchor) {
        const instance = (initialVNode.component = createComponentInstance(initialVNode, parentComponent));
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
    function setupRenderEffect(instance, initialVNode, container, anchor) {
        /**
         * 使用effect监控里面的响应式对象
         * effect的返回值，再次调用，可以执行里面的回调函数
         */
        instance.update = effect(() => {
            // 第一次进来时(init)，这个isMounted为false
            if (!instance.isMounted) {
                const { proxy } = instance;
                /** 让instance的代理去执行组件的定义的render函数 返回的是一个subTree虚拟节点 */
                const subTree = (instance.subTree = instance.render.call(proxy, proxy));
                /** 调用patch方法挂载这个虚拟节点树 */
                patch(null, subTree, container, instance, anchor);
                /** 挂载后 subTree树会带有个el真实节点的属性 */
                /** 组件对应的根element元素遍历后赋予真实$el */
                initialVNode.el = subTree.el;
                instance.isMounted = true;
            }
            else {
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
        }, {
            scheduler() {
                console.log("update - scheduler");
                queueJobs(instance.update);
            },
        });
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
function getSequence(arr) {
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
                }
                else {
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
function insert(el, parent, anchor) {
    // parent.append(el);
    parent.insertBefore(el, anchor || null);
}
function remove(child) {
    // Implement
    const parent = child.parentNode;
    if (parent) {
        parent.removeChild(child);
    }
}
function setElementText(el, text) {
    el.textContent = text;
}
const renderer = createRenderer({
    createElement,
    patchProp,
    insert,
    remove,
    setElementText,
});
function createApp(...args) {
    return renderer.createApp(...args);
}

var runtimeDom = /*#__PURE__*/Object.freeze({
    __proto__: null,
    renderer: renderer,
    createApp: createApp,
    renderSlots: renderSlots,
    h: h,
    createTextVNode: createTextVNode,
    createElementVNode: createVNode,
    getCurrentInstance: getCurrentInstance,
    registerRuntimeCompiler: registerRuntimeCompiler,
    inject: inject,
    provide: provide,
    createRenderer: createRenderer,
    nextTick: nextTick,
    toDisplayString: toDisplayString,
    ref: ref,
    proxyRefs: proxyRefs
});

const TO_DISPLAY_STRING = Symbol("toDisplayString");
const CREATE_ELEMENT_VNODE = Symbol("createElementVNode");
const helperMapName = {
    [TO_DISPLAY_STRING]: "toDisplayString",
    [CREATE_ELEMENT_VNODE]: "createElementVNode",
};

function generate(ast) {
    const context = createCodegenContext();
    const { push } = context;
    getFunctionPreamble(ast, context);
    const functionName = "render";
    const args = ["_ctx", "_cache"];
    const signature = args.join(",");
    push(`function ${functionName}(${signature}){`);
    push("return ");
    genNode(ast.codegenNode, context);
    push("}");
    return {
        code: context.code,
    };
}
/**
 * 处理前导码
 * @param ast
 * @param context
 */
function getFunctionPreamble(ast, context) {
    const { push } = context;
    const VueBinding = "Vue";
    // const helpers = ["toDisplayString"];
    const aliasHelper = (s) => `${helperMapName[s]}: _${helperMapName[s]}`;
    if (ast.helpers.length > 0) {
        push(`const { ${ast.helpers.map(aliasHelper).join(", ")} } = ${VueBinding}`);
    }
    push("\n");
    push("return ");
}
function createCodegenContext() {
    const context = {
        code: "",
        push(source) {
            context.code += source;
        },
        helper(key) {
            return `_${helperMapName[key]}`;
        },
    };
    return context;
}
function genNode(node, context) {
    switch (node.type) {
        case 3 /* NodeTypes.TEXT */:
            getText(node, context);
            break;
        case 0 /* NodeTypes.INTERPOLATION */:
            gedInterpolation(node, context);
            break;
        case 1 /* NodeTypes.SIMPLE_EXPRESSION */:
            genExpression(node, context);
            break;
        case 2 /* NodeTypes.ELEMENT */:
            genElement(node, context);
            break;
        case 5 /* NodeTypes.COMPOUND_EXPRESSION */:
            genCompoundExpression(node, context);
            break;
    }
}
function genCompoundExpression(node, context) {
    const { push } = context;
    const { children } = node;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (isString(child)) {
            push(child);
        }
        else {
            genNode(child, context);
        }
    }
}
function genElement(node, context) {
    const { push, helper } = context;
    const { tag, children, props } = node;
    push(`${helper(CREATE_ELEMENT_VNODE)}(`);
    // for (let i = 0; i < children.length; i++) {
    //   const child = children[i];
    //   genNode(child, context);
    // }
    // =>
    // const child = children[0];
    genNodeList(genNullable([tag, props, children]), context);
    push(")");
}
function genNodeList(nodes, context) {
    // Implement
    const { push } = context;
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (isString(node)) {
            push(node);
        }
        else {
            genNode(node, context);
        }
        if (i < nodes.length - 1) {
            push(", ");
        }
    }
}
function genNullable(args) {
    // Implement
    return args.map((arg) => arg || "null");
}
function genExpression(node, context) {
    // Implement
    const { push } = context;
    console.log(node);
    push(`${node.content}`);
}
function gedInterpolation(node, context) {
    /**
     * 插值 {{ 表达式类型的content }}
     */
    const { push, helper } = context;
    push(`${helper(TO_DISPLAY_STRING)}(`);
    // 处理表达式类型 ,使用统一的入口
    genNode(node.content, context);
    push(")");
}
function getText(node, context) {
    const { push } = context;
    push(`'${node.content}'`);
}

/**
 * content 统一的入口
 * @param content
 * @returns ast
 */
function baseParse(content) {
    const context = createParseContext(content);
    return createRoot(parseChildren(context, []));
}
function parseChildren(context, ancestors) {
    const nodes = [];
    while (!isEnd(context, ancestors)) {
        let node;
        const s = context.source;
        /**
         * {{}}
         * 处理插值表达式
         */
        if (s.startsWith("{{")) {
            node = parseInterpolation(context);
        }
        else if (s[0] === "<") {
            /**
             * 处理Element
             * 使用正则匹配 `<`开头 `[a-z]*`
             */
            if (/[a-z]/.test(s[1])) {
                node = parseElement(context, ancestors);
            }
        }
        else {
            node = parseText(context);
        }
        nodes.push(node);
    }
    return nodes;
}
function isEnd(context, ancestors) {
    const s = context.source;
    // Implement
    // 1. context.source 空
    // 2. tag
    if (s.startsWith("</")) {
        /** 优化倒序，提高遍历性能 */
        for (let i = ancestors.length - 1; i >= 0; i--) {
            const tag = ancestors[i].tag;
            if (startsWithEndTagOpen(s, tag)) {
                // if (s.slice(2, 2 + tag.length) === tag) {
                return true;
            }
        }
    }
    return !s;
}
function parseText(context) {
    let endIndex = context.source.length;
    const endTokens = ["{{", "<"];
    for (let i = 0; i < endTokens.length; i++) {
        const index = context.source.indexOf(endTokens[i]);
        /** 取出最小值 */
        if (index !== -1 && endIndex > index) {
            endIndex = index;
        }
    }
    let content = parseTextData(context, endIndex);
    // console.log("parseTexted ----");
    // console.log(content);
    return {
        type: 3 /* NodeTypes.TEXT */,
        content,
    };
}
function parseTextData(context, length) {
    /** 1. 获取值 */
    let content = context.source.slice(0, length);
    /** 2. 推进 */
    advanceBy(context, length);
    return content;
}
function parseElement(context, ancestors) {
    const element = parseTag(context, 0 /* TagType.START */);
    ancestors.push(element);
    element.children = parseChildren(context, ancestors);
    ancestors.pop();
    // console.log(" hbisedm Log...");
    // console.log(element.tag);
    // console.log(context.source);
    if (startsWithEndTagOpen(context.source, element.tag)) {
        // if (context.source.slice(2, 2 + element.tag.length) === element.tag) {
        parseTag(context, 1 /* TagType.END */);
    }
    else {
        throw new Error(`应该来个${element.tag}结尾`);
    }
    return element;
}
function startsWithEndTagOpen(source, tag) {
    return (source.startsWith("</") &&
        source.slice(2, 2 + tag.length).toLowerCase() === tag.toLowerCase());
}
function parseTag(context, tagType) {
    /**
     * 1. 解析tag
     */
    const match = /^<\/?([a-z]*)/i.exec(context.source);
    const tag = match[1];
    /**
     * 2. 删除已处理完成的代码
     */
    advanceBy(context, match[0].length);
    advanceBy(context, 1);
    if (tagType === 1 /* TagType.END */)
        return;
    return {
        type: 2 /* NodeTypes.ELEMENT */,
        tag,
    };
}
function parseInterpolation(context) {
    // {{message}}
    const openDelimiter = "{{";
    const closeDelimiter = "}}";
    /**
     * 拿到字符尾部索引
     */
    const closeIndex = context.source.indexOf(closeDelimiter, openDelimiter.length);
    /**
     *  推进
     *  {{msg}}{{name}} => msg}}{{name}}
     */
    advanceBy(context, openDelimiter.length);
    /**
     * 计算出插值模版里面字符的长度
     */
    const rawContentLength = closeIndex - openDelimiter.length;
    const rawContent = parseTextData(context, rawContentLength);
    const content = rawContent.trim();
    /**
     * 继续推进
     * msg}}{{name}} => {{name}}
     */
    advanceBy(context, closeDelimiter.length);
    return {
        type: 0 /* NodeTypes.INTERPOLATION */,
        content: {
            type: 1 /* NodeTypes.SIMPLE_EXPRESSION */,
            content,
        },
    };
}
function advanceBy(context, length) {
    context.source = context.source.slice(length);
}
/**
 * 封装成ctx对象
 * @param content
 * @returns
 */
function createParseContext(content) {
    return {
        source: content,
    };
}
function createRoot(children) {
    return {
        children,
        type: 4 /* NodeTypes.ROOT */,
    };
}

function transform(root, options = {}) {
    const context = createContext(root, options);
    // 深度遍历
    traverseNodes(root, context);
    // 方便生成代码阶段调用转换后的ast树
    genCode(root);
    root.helpers = [...context.helpers.keys()];
}
function genCode(root) {
    const child = root.children[0];
    if (child.type === 2 /* NodeTypes.ELEMENT */) {
        root.codegenNode = child.codegenNode;
    }
    else {
        root.codegenNode = root.children[0];
    }
}
function traverseNodes(node, context) {
    const { nodeTransforms } = context;
    // 对节点进行用户自义定插件处理
    const exitFns = [];
    nodeTransforms.forEach((transform) => {
        const onExit = transform(node, context);
        if (onExit)
            exitFns.push(onExit);
    });
    // 处理不同类型
    switch (node.type) {
        case 0 /* NodeTypes.INTERPOLATION */:
            context.helper(TO_DISPLAY_STRING);
            break;
        case 4 /* NodeTypes.ROOT */:
        case 2 /* NodeTypes.ELEMENT */:
            traverseChildren(node, context);
            break;
    }
    let i = exitFns.length;
    //倒序执行
    while (i--) {
        exitFns[i]();
    }
}
function traverseChildren(root, context) {
    const children = root.children;
    for (let i = 0; i < children.length; i++) {
        const node = children[i];
        traverseNodes(node, context);
    }
}
function createContext(root, options) {
    const context = {
        root,
        nodeTransforms: options.nodeTransforms || [],
        helpers: new Map(),
        helper(key) {
            context.helpers.set(key, 1);
        },
    };
    return context;
}

function createVNodeCall(context, tag, props, children) {
    context.helper(CREATE_ELEMENT_VNODE);
    return {
        type: 2 /* NodeTypes.ELEMENT */,
        tag,
        props,
        children,
    };
}

function transformElement(node, context) {
    return () => {
        if (node.type === 2 /* NodeTypes.ELEMENT */) {
            //中间处理层
            // tag
            const vnodeTag = `"${node.tag}"`;
            // props
            let vnodeProps;
            const { children } = node;
            const vnodeChildren = children[0];
            node.codegenNode = createVNodeCall(context, vnodeTag, vnodeProps, vnodeChildren);
        }
    };
}

/**
 * 专用处理插值的插件
 * @param node
 */
function transformExpression(node) {
    if (node.type === 0 /* NodeTypes.INTERPOLATION */) {
        processExpression(node.content);
    }
}
function processExpression(node) {
    node.content = `_ctx.${node.content}`;
    return node;
}

/**
 * 判断当前节点是不是Text类型or插值类型
 * @param node
 * @returns
 */
function isText(node) {
    return node.type === 3 /* NodeTypes.TEXT */ || node.type === 0 /* NodeTypes.INTERPOLATION */;
}

function transformText(node) {
    return () => {
        if (node.type === 2 /* NodeTypes.ELEMENT */) {
            let currentContainer;
            const { children } = node;
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                // 如果是的话， 进行 `+`的操作
                if (isText(child)) {
                    for (let j = i + 1; j < children.length; j++) {
                        const next = children[j];
                        if (isText(next)) {
                            // init
                            if (!currentContainer) {
                                // 更新 Text or插值为复合类型
                                currentContainer = children[i] = {
                                    type: 5 /* NodeTypes.COMPOUND_EXPRESSION */,
                                    children: [child],
                                };
                            }
                            currentContainer.children.push(" + ");
                            currentContainer.children.push(next);
                            children.splice(j, 1);
                            j--;
                        }
                        else {
                            currentContainer = undefined;
                            break;
                        }
                    }
                }
            }
        }
    };
}

/**
 * 将template内容转成render函数
 * @param template
 * @returns
 */
function baseCompile(template) {
    const ast = baseParse(template);
    transform(ast, {
        nodeTransforms: [transformExpression, transformElement, transformText],
    });
    return generate(ast);
}

// 入口
/**
 *  code => function 代码的字符串的逻辑实现
 * @param template
 * @returns
 */
function compileToFunction(template) {
    const { code } = baseCompile(template);
    // function代码字符串 => function
    const render = new Function("Vue", code)(runtimeDom);
    // 返回render函数
    return render;
}
registerRuntimeCompiler(compileToFunction);

export { createApp, createVNode as createElementVNode, createRenderer, createTextVNode, getCurrentInstance, h, inject, nextTick, provide, proxyRefs, ref, registerRuntimeCompiler, renderSlots, renderer, toDisplayString };
