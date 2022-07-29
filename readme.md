# mini-vue 的搭建过程

## 搭建环境

- jest
- typescript
- babel

```shell
yarn add typescript --dev

yarn add jest --dev
yarn add --dev @types/jest

yarn add --dev babel-jest @babel/core @babel/preset-env
yarn add --dev @babel/preset-typescript
```

## esm

在当前工程内使用 esm 模块化，因为当前工程是 node 环境下，可以使用`babel`通过配置 Babel 使其能够兼容当前的 Node 版本。

```js
module.exports = {
  presets: [["@babel/preset-env", { targets: { node: "current" } }]],
};
```

使 babel 支持 typescript
将 `@babel/preset-typescript` 添加到 babel.config.js 中的 presets 列表中。

- [jest 配置 babel](https://www.jestjs.cn/docs/getting-started#%E4%BD%BF%E7%94%A8-babel)
- [jest 配置 typescript](https://www.jestjs.cn/docs/getting-started#%E4%BD%BF%E7%94%A8-typescript)

## 实现 reactive 与 effect

<span id="effectTest">编写测试用例`effect.spec.ts`</span>

```typescript
describe("effect", () => {
  it("happy", () => {
    const user = reactive({
      age: 10,
    });
    let nextAge;
    effect(() => {
      nextAge = user.age + 1;
    });
    expect(nextAge).toBe(11);

    user.age++;
    expect(nextAge).toBe(12);
  });
});
```

- 需要拿到响应式对象，然后每次响应式对象的属性发生变化时，对应的副作用函数 effect 也要发生执行。
- 那么先编写响应式对象的测试用例

```typescript
describe("reactive", () => {
  it("happy path", () => {
    const originUser = {
      age: 19,
    };
    const user = reactive(originUser);
    expect(user).not.toBe(originUser);
    expect(user.age).toBe(19);
  });
});
```

可以发现原来的对象和 reactive 函数处理过的 Proxy 对象是 2 个不同的对象

> vue3 采用这种 Proxy 对象处理原始对象变成响应式对象

> 那么创建`reactive.ts`，使用 ES6 的 Proxy 对象 进行处理，`tsconfig.json`>`lib`配置 typescript 编译期才可以识别 ES6 的类型
>
> ```json
> "lib": [
>      "DOM",
>      "ES6"
>    ]
> ```

### 响应式对象处理 reactive

```typescript
export function reactive(raw) {
  return new Proxy(raw, {
    get(target, key) {
      const res = Reflect.get(target, key);
      // TODO 收集依赖
      return res;
    },
    set(target, key, val) {
      const res = Reflect.set(target, key, val);
      // TODO 触发依赖
      return res;
    },
  });
}
```

这时候我们的`reactive.spec.ts`是可以跑通了，回到一开始的[`effect.spec.ts`](#effectTest),现在需要去实现 effect 函数到达每次响应式对象属性改变，劫持对应的依赖去执行。

```typescript
export function effect(fn) {
  const reactiveEffect = new ReactiveEffect(fn);
  // effect在初始化时会第一次执行一次
  reactiveEffect.run();
}
let activityEffect;
class ReactiveEffect {
  private _fn: any;
  constructor(fn) {
    this._fn = fn;
  }
  run() {
    activityEffect = this;
    this._fn();
  }
}
```

### 依赖收集

- 现在可以测试通过`expect(nextAge).toBe(11);`
- 目前还缺对 对象进行**依赖收集与劫持**
- 抛出疑问：如何进行依赖收集呢？
- 我们刚才对当前对象进行了 Proxy 处理，那么我们可以在 get 方法内进行依赖收集。
- 在`effect.ts`编写依赖收集的方法 effect#track
- 依赖收集就是将当前对象的属性的副作用函数 effect 进行收集，那么每个副作用函数都是没必要重复的，需要使用个 Set 集合进行收集

```typescript
export function track(target, key) {
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

  dep.add(activityEffect);
}
```

依赖收集后，意味着每个对象的属性对应的副作用函数都在对应 set 集合里面了。
未来如果对这个属性修改的话，对应的 Proxy#set 就可以进行劫持，执行对应的副作用函数。

### 劫持依赖

```typescript
export function trigger(target, key) {
  const depsMap = targetsMap.get(target);
  const dep = depsMap.get(key);
  for (let item of dep) {
    item.run();
  }
}
```

到此[`effect.spec.ts`](#effectTest)可以跑通了。目前的 effect.ts

```typescript
class ReactiveEffect {
  // 这个ReactiveEffect Class目的是抽离出fn的执行
  private _fn: any;
  constructor(fn) {
    this._fn = fn;
  }
  run() {
    activityEffect = this;
    this._fn();
  }
}

// 临时变量 目的是为了存储当前的effect
let activityEffect;
const targetsMap = new Map();
export function effect(fn) {
  // 触发effect创建一个对象 -> 里面有响应式对象的get会触发track函数（使用个activityEffect变量进行暂存当前这个effect）
  const reactiveEffect = new ReactiveEffect(fn);
  // effect在初始化时会第一次执行一次
  reactiveEffect.run();
}
// 收集依赖
export function track(target, key) {
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
  // 对当前这个effect进行存入set容器，未来的set操作就会去查看当前容器是否有这个属性的依赖，若有则执行与它相关
  dep.add(activityEffect);

  // new Dep()
}
// 触发依赖
export function trigger(target, key) {
  const depsMap = targetsMap.get(target);
  const dep = depsMap.get(key);
  for (let item of dep) {
    item.run();
  }
}
```

## 实现 effect 返回 runner

> effect 的返回值 是一个函数，通过运行这个函数，可以再次执行这个 effect 里面的逻辑代码
> 首先编写 effect 返回值的测试用例

```typescript
it("should return runner", () => {
  let testNum = 11;
  const runner = effect(() => {
    testNum++;
    return "foo";
  });
  expect(testNum).toBe(12);
  const foo = runner();
  expect(testNum).toBe(13);
  expect(foo).toBe("foo");
});
```

- 分析：这个 effect 的 fn 函数有个返回值'foo'，当再次运行这个 runner 函数可以拿到这个返回值；并且运行这里的代码，`foo++`
  在 effect.ts 编写对应代码

```typescript
export function effect(fn) {
  // 触发effect创建一个对象 -> 里面有响应式对象的get会触发track函数（使用个activityEffect变量进行暂存当前这个effect）
  const reactiveEffect = new ReactiveEffect(fn);
  // effect在初始化时会第一次执行一次
  reactiveEffect.run();
  // 将当前的Effect对象的run返回出去
  return reactiveEffect.run.bind(reactiveEffect);
}
class ReactiveEffect {
  // 这个ReactiveEffect Class目的是抽离出fn的执行,方便未来依赖收集的操作
  private _fn: any;
  constructor(fn) {
    this._fn = fn;
  }
  run() {
    activityEffect = this;
    // 返回这个用户的fn代码
    return this._fn();
  }
}
```

## 实现 effect 的 scheduler

copy vue3 github 的 [scheduler 测试用例](https://github.com/vuejs/core/blob/main/packages/reactivity/__tests__/effect.spec.ts#L680)

```typescript
it("scheduler", () => {
  let dummy;
  let run: any;
  const scheduler = jest.fn(() => {
    run = runner;
  });
  const obj = reactive({ foo: 1 });
  const runner = effect(
    () => {
      dummy = obj.foo;
    },
    { scheduler }
  );
  expect(scheduler).not.toHaveBeenCalled();
  expect(dummy).toBe(1);
  // should be called on first trigger
  obj.foo++;
  expect(scheduler).toHaveBeenCalledTimes(1);
  // should not run yet
  expect(dummy).toBe(1);
  // manually run
  run();
  // should have run
  expect(dummy).toBe(2);
});
```

可以发现 我们原来的 effect 加入个对象，而这个对象里面有 scheduler 属性

- 第一次使用 effect 时，里面的 runner 被执行一次，但是 scheduler 没有被调用
- 但对响应式对象进行 set 操作 update 时，scheduler 被执行一次，而 runner 里面的值没被赋值
- 但执行 run 后里面的值才被执行

那么我们先改写 effect 的构造函数

- 接受一个 options 对象，且里面有个 scheduler 方法

```typescript
export function effect(fn, options: any = {}) {
  // 触发effect创建一个对象 -> 里面有响应式对象的get会触发track函数（使用个activityEffect变量进行暂存当前这个effect）
  const reactiveEffect = new ReactiveEffect(fn, options.scheduler);
  // effect在初始化时会第一次执行一次
  reactiveEffect.run();

  return reactiveEffect.run.bind(reactiveEffect);
}
```

那么改写 ReactiveEffect 的构造函数，public 让它变为公有属性 ？表示它是个可传参数

```typescript
  constructor(fn, public scheduler?) {
    this._fn = fn;
  }

```

接着改变些劫持依赖的代码，也就是 proxy#Set

```typescript
export function trigger(target, key) {
  const depsMap = targetsMap.get(target);
  const dep = depsMap.get(key);
  for (let item of dep) {
    if (item.scheduler) {
      // 当前的effect依赖实例如果有scheduler属性的话，说明effect的构造有传递第二个参数
      item.scheduler();
    } else {
      // 否则执行原来的逻辑
      item.run();
    }
  }
}
```

## effect 实现 stop 功能

copy 官方的 测试用例[<https://github.com/vuejs/core/blob/769e5555f9d9004ce541613341652db859881570/packages/reactivity/>**tests**/effect.spec.ts#L783]

```typescript
it("stop", () => {
  let dummy;
  const obj = reactive({ prop: 1 });
  const runner = effect(() => {
    dummy = obj.prop;
  });
  obj.prop = 2;
  expect(dummy).toBe(2);
  stop(runner);
  obj.prop = 3;
  expect(dummy).toBe(2);

  // stopped effect should still be manually callable
  runner();
  expect(dummy).toBe(3);
});
```

> 可以发现我们的 effect 返回值 runner，传入到一个 stop 函数后，这个 runner 里面的代码逻辑就不在会被清空掉，也就是后面的依赖劫持后，会运行 dep 里面的每个 runner，但是这时候的 runner 已经清空了。不在自动帮我们运行这个 runner 了。除非手动运行。

那么如何实现上述功能呢

- 先在 effect 里面创建个 stop 函数，且接受一个 runner 参数
- stop 肯定在 ReactiveEffect 里面去将对应 dep 容器清空对应的 effect
- 那么这个 runner 参数需要有个 ReactiveEffect 的实例对象，**如何拿到这个对象呢**
- 我们可以在 effect()函数的函数体里面实现将当前的这个 runner 携带当前的 ReactiveEffect 实例对象。
- 这样 stop 函数就可以拿到这个 ReactiveEffect 实例对象了，接着调用 ReactiveEffect 的新方法 stop
- stop 里面需要拿到当前的 effect 对应的 dep 容器，**如何拿到这个容器呢**
- 在我们的依赖收集的时候，需要将 effect 传入 dep 容器中
- 这里我们要有个概念，effect 和容器是多对多关系，一个 effect 可以对应多个容器，一个容器也可以对应多个 effect
- 那么在 ReactiveEffect 中新增个数组属性：deps
- 每次依赖收集时 effect 传入 dep 容器后，再将这个 dep 容器 push 到当前 effect 的 deps 数组里面。
- 那么 ReactiveEffect#stop 就可以通过`this.deps`拿到对应的 dep 列表，将每个 dep 里面对应的当前 effect 实例删除掉就行了。
- 这样就测试通过上面的用例。

```typescript
export function effect(fn, options: any = {}) {
  const reactiveEffect = new ReactiveEffect(fn, options.scheduler);
  // effect在初始化时会第一次执行一次
  reactiveEffect.run();
  const runner: any = reactiveEffect.run.bind(reactiveEffect);
  runner._effect = reactiveEffect; // 将当前effect实例对象挂载到runner方法上，下面代码才可以使用
  return runner;
}
```

```typescript
export function stop(runner: any) {
  runner._effect.stop();
}
```

```typescript
// 收集依赖
export function track(target, key) {
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
  dep.add(activityEffect);
  activityEffect.deps.push(dep); // 将当前的dep容器传入到实例的deps数组里面
}
```

```typescript
class ReactiveEffect {
  // 这个ReactiveEffect Class目的是抽离出fn的执行,方便未来依赖收集的操作
  private _fn: any;
  deps = [];
  constructor(fn, public scheduler?) {
    this._fn = fn;
  }
  run() {
    activityEffect = this;
    return this._fn();
  }
  stop() {
    this.deps.forEach((dep: any) => {
      dep.delete(this);
    });
  }
}
```

### 优化代码

ReactiveEffect#stop 里面的 forEach 可以抽离出去

```typescript
// 抽离出 dep容器清空effect的函数
function cleanEffect(effect) {
  effect.deps.forEach((dep: any) => {
    dep.delete(effect);
  });
}
```

```typescript
stop() {
    cleanEffect(this)
  }
```

> 每次代码运行一次 stop 其实后面都不需要再次调用了。那么这个可以给个状态值表示当前调用过了。

```typescript
class ReactiveEffect {
  private clearActivity = true;
  stop() {
    if (this.clearActivity) {
      cleanEffect(this);
      this.clearActivity = false;
    }
  }
}
```

### stop 的参数

copy 官方的 onStop 测试用例[<https://github.com/vuejs/core/blob/769e5555f9d9004ce541613341652db859881570/packages/reactivity/>**tests**/effect.spec.ts#L820]

```typescript
it("events: onStop", () => {
  const onStop = jest.fn();
  const runner = effect(() => {}, {
    onStop,
  });

  stop(runner);
  expect(onStop).toHaveBeenCalled();
});
```

- 传入一个对象，这个对象里面有个 onStop 函数，当使用 stop 方法时，这个 onStop 也被调用。
- 先在 effect 方法里面将这个 onStop 方法传入到 effect 实例里面
- 接着调用 stop 的时候，调用这个 onStop 就可以实现

```typescript
export function effect(fn, options: any = {}) {
  // 触发effect创建一个对象 -> 里面有响应式对象的get会触发track函数（使用个activityEffect变量进行暂存当前这个effect）
  const reactiveEffect = new ReactiveEffect(fn, options.scheduler);
  extend(reactiveEffect, options);
  //   Object.assign(reactiveEffect, options);
  //   reactiveEffect.onStop = options.onStop;
  // effect在初始化时会第一次执行一次
  reactiveEffect.run();
  const runner: any = reactiveEffect.run.bind(reactiveEffect);
  runner._effect = reactiveEffect;
  return runner;
}
```

> 这里将这个方法使用`Object.assign`赋值给了 effect 的方法，但这样可读性、语义化有点差，将这个 API 方法封装起来，在 src/shared/index.ts

```typescript
export const extend = Object.assign;
```

- 拓展 ReactiveEffect 类，加入 onStop 属性
- 在 stop 方法调用后调用下 onStop 方法

```typescript
class ReactiveEffect {
  // 这个ReactiveEffect Class目的是抽离出fn的执行,方便未来依赖收集的操作
  private _fn: any;
  deps = [];
  onStop?: any;
  private clearActivity = true;
  constructor(fn, public scheduler?) {
    this._fn = fn;
  }
  run() {
    activityEffect = this;
    return this._fn();
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
```

### reactive#readonly 的实现

编写 readonly 测试用例

```typescript
describe("readonly", () => {
  it("happy path", () => {
    const original = {
      foo: 1,
    };
    const wrapped = readonly(original);
    expect(wrapped).not.toBe(original);
    expect(wrapped.foo).toBe(1);
  });
  it("readonly cannot set", () => {
    const user = {
      age: 23,
    };
    console.warn = jest.fn();
    const readonlyUser = readonly(user);
    readonlyUser.age++; // 触发set
    expect(console.warn).toBeCalled();
  });
});
```

- 当使用 readonly 包裹后的对象，它是个只能读取，不能修改的
- 思路：将 Proxy#set 内的实现去掉，直接返回 true 即可

```typescript
export function readonly(raw) {
  return new Proxy(raw, {
    get(target, key) {
      const res = Reflect.get(target, key);
      track(target, key);
      return res;
    },
    set(target, key, val) {
      return true;
    },
  });
}
```

- 可以发现 readonly 与 reactive 里面的代码逻辑是相同的。
- 可以抽离出 get 方法，且抽出 readonly 的状态，
  - 当为 reactive 时，使用 track 方法
  - readonly 时，不需要使用 track 方法

```typescript
const createGetter = function (isReadonly = false) {
  return function get(target, key) {
    const res = Reflect.get(target, key);
    // 收集依赖
    if (!isReadonly) {
      track(target, key);
    }
    return res;
  };
};
```

> 因为 get 使用了个 createGetter 方法，为了保持代码可读性，set 也可以使用 createSetter 方法，保持一致

```typescript
const createSetter = function () {
  return function set(target, key, val) {
    const res = Reflect.set(target, key, val);
    // 触发依赖
    trigger(target, key);
    return res;
  };
};
```

```typescript
export function reactive(raw) {
  return new Proxy(raw, {
    get: creategetter(),
    set: createsetter(),
  });
}
export function readonly(raw) {
  return new Proxy(raw, {
    get: createGetter(true),
    set(target, key, val) {
      return true;
    },
  });
}
```

- 每次使用 new Proxy(raw, handeler)里面都是个处理器对象，这个对象也是可以抽离出去
- 创建个`baseHandlers.ts`将这些内容都抽离出来
  - createGetter
  - createSetter
  - handeler

```typescript
const createGetter = function (isReadonly = false) {
  return function get(target, key) {
    const res = Reflect.get(target, key);
    // 收集依赖
    if (!isReadonly) {
      track(target, key);
    }
    return res;
  };
};
const createSetter = function () {
  return function set(target, key, val) {
    const res = Reflect.set(target, key, val);
    // 触发依赖
    trigger(target, key);
    return res;
  };
};
export const mutableHandlers = {
  get: creategetter(),
  set: createsetter(),
};
export const readonlyHandlers = {
  get: creategetter(),
  set: function (target, key, val) {
    return true;
  },
};
```

```typescript
import { mutableHandlers, readonlyHandlers } from "./baseHandlers";

export function reactive(raw) {
  return new Proxy(raw, mutableHandlers);
}
export function readonly(raw) {
  return new Proxy(raw, readonlyHandlers);
}
```

- 再抽离这个 new Proxy 方法

```typescript
import { mutableHandlers, readonlyHandlers } from "./baseHandlers";

export function reactive(raw) {
  return createActivityObj(raw, mutableHandlers);
}
export function readonly(raw) {
  return createActivityObj(raw, readonlyHandlers);
}
function createActivityObj(raw: any, baseHandlers: any) {
  return new Proxy(raw, baseHandlers);
}
```

- 这样抽离，看起来就很干净

![](https://raw.githubusercontent.com/Hbisedm/my-blob-picGo/main/img/202207062219745.png)
这里可以抽出去，每次都调用很耗性能

```typescript
const get = createGetter();
const set = createSetter();
const readonlyGet = createGetter(true);

export const mutableHandlers = {
  get,
  set,
};
export const readonlyHandlers = {
  get: readonlyGet,
  set: function (target, key, val) {
    return true;
  },
};
```

### 实现 readonly 对象 set 时候报警告

这个在 set 的时候，抛出 warn 就可以达到目的，修改 readonlyHandlers 即可

```typescript
export const readonlyHandlers = {
  get: readonlyGet,
  set: function (target, key, val) {
    console.warn(
      `${key}cannot set, beacause current Object is readlony`,
      target
    );
    return true;
  },
};
```

# mini-vue 的搭建过程

## 搭建环境

- jest
- typescript
- babel

```shell
yarn add typescript --dev

yarn add jest --dev
yarn add --dev @types/jest

yarn add --dev babel-jest @babel/core @babel/preset-env
yarn add --dev @babel/preset-typescript
```

## esm

在当前工程内使用 esm 模块化，因为当前工程是 node 环境下，可以使用`babel`通过配置 Babel 使其能够兼容当前的 Node 版本。

```js
module.exports = {
  presets: [["@babel/preset-env", { targets: { node: "current" } }]],
};
```

使 babel 支持 typescript
将 `@babel/preset-typescript` 添加到 babel.config.js 中的 presets 列表中。

- [jest 配置 babel](https://www.jestjs.cn/docs/getting-started#%E4%BD%BF%E7%94%A8-babel)
- [jest 配置 typescript](https://www.jestjs.cn/docs/getting-started#%E4%BD%BF%E7%94%A8-typescript)

## 实现 reactive 与 effect

<span id="effectTest">编写测试用例`effect.spec.ts`</span>

```typescript
describe("effect", () => {
  it("happy", () => {
    const user = reactive({
      age: 10,
    });
    let nextAge;
    effect(() => {
      nextAge = user.age + 1;
    });
    expect(nextAge).toBe(11);

    user.age++;
    expect(nextAge).toBe(12);
  });
});
```

- 需要拿到响应式对象，然后每次响应式对象的属性发生变化时，对应的副作用函数 effect 也要发生执行。
- 那么先编写响应式对象的测试用例

```typescript
describe("reactive", () => {
  it("happy path", () => {
    const originUser = {
      age: 19,
    };
    const user = reactive(originUser);
    expect(user).not.toBe(originUser);
    expect(user.age).toBe(19);
  });
});
```

可以发现原来的对象和 reactive 函数处理过的 Proxy 对象是 2 个不同的对象

> vue3 采用这种 Proxy 对象处理原始对象变成响应式对象

> 那么创建`reactive.ts`，使用 ES6 的 Proxy 对象 进行处理，`tsconfig.json`>`lib`配置 typescript 编译期才可以识别 ES6 的类型
>
> ```json
> "lib": [
>      "DOM",
>      "ES6"
>    ]
> ```

### 响应式对象处理 reactive

```typescript
export function reactive(raw) {
  return new Proxy(raw, {
    get(target, key) {
      const res = Reflect.get(target, key);
      // TODO 收集依赖
      return res;
    },
    set(target, key, val) {
      const res = Reflect.set(target, key, val);
      // TODO 触发依赖
      return res;
    },
  });
}
```

这时候我们的`reactive.spec.ts`是可以跑通了，回到一开始的[`effect.spec.ts`](#effectTest),现在需要去实现 effect 函数到达每次响应式对象属性改变，劫持对应的依赖去执行。

```typescript
export function effect(fn) {
  const reactiveEffect = new ReactiveEffect(fn);
  // effect在初始化时会第一次执行一次
  reactiveEffect.run();
}
let activityEffect;
class ReactiveEffect {
  private _fn: any;
  constructor(fn) {
    this._fn = fn;
  }
  run() {
    activityEffect = this;
    this._fn();
  }
}
```

### 依赖收集

- 现在可以测试通过`expect(nextAge).toBe(11);`
- 目前还缺对 对象进行**依赖收集与劫持**
- 抛出疑问：如何进行依赖收集呢？
- 我们刚才对当前对象进行了 Proxy 处理，那么我们可以在 get 方法内进行依赖收集。
- 在`effect.ts`编写依赖收集的方法 effect#track
- 依赖收集就是将当前对象的属性的副作用函数 effect 进行收集，那么每个副作用函数都是没必要重复的，需要使用个 Set 集合进行收集

```typescript
export function track(target, key) {
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

  dep.add(activityEffect);
}
```

依赖收集后，意味着每个对象的属性对应的副作用函数都在对应 set 集合里面了。
未来如果对这个属性修改的话，对应的 Proxy#set 就可以进行劫持，执行对应的副作用函数。

### 劫持依赖

```typescript
export function trigger(target, key) {
  const depsMap = targetsMap.get(target);
  const dep = depsMap.get(key);
  for (let item of dep) {
    item.run();
  }
}
```

到此[`effect.spec.ts`](#effectTest)可以跑通了。目前的 effect.ts

```typescript
class ReactiveEffect {
  // 这个ReactiveEffect Class目的是抽离出fn的执行
  private _fn: any;
  constructor(fn) {
    this._fn = fn;
  }
  run() {
    activityEffect = this;
    this._fn();
  }
}

// 临时变量 目的是为了存储当前的effect
let activityEffect;
const targetsMap = new Map();
export function effect(fn) {
  // 触发effect创建一个对象 -> 里面有响应式对象的get会触发track函数（使用个activityEffect变量进行暂存当前这个effect）
  const reactiveEffect = new ReactiveEffect(fn);
  // effect在初始化时会第一次执行一次
  reactiveEffect.run();
}
// 收集依赖
export function track(target, key) {
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
  // 对当前这个effect进行存入set容器，未来的set操作就会去查看当前容器是否有这个属性的依赖，若有则执行与它相关
  dep.add(activityEffect);

  // new Dep()
}
// 触发依赖
export function trigger(target, key) {
  const depsMap = targetsMap.get(target);
  const dep = depsMap.get(key);
  for (let item of dep) {
    item.run();
  }
}
```

## 实现 effect 返回 runner

> effect 的返回值 是一个函数，通过运行这个函数，可以再次执行这个 effect 里面的逻辑代码
> 首先编写 effect 返回值的测试用例

```typescript
it("should return runner", () => {
  let testNum = 11;
  const runner = effect(() => {
    testNum++;
    return "foo";
  });
  expect(testNum).toBe(12);
  const foo = runner();
  expect(testNum).toBe(13);
  expect(foo).toBe("foo");
});
```

- 分析：这个 effect 的 fn 函数有个返回值'foo'，当再次运行这个 runner 函数可以拿到这个返回值；并且运行这里的代码，`foo++`
  在 effect.ts 编写对应代码

```typescript
export function effect(fn) {
  // 触发effect创建一个对象 -> 里面有响应式对象的get会触发track函数（使用个activityEffect变量进行暂存当前这个effect）
  const reactiveEffect = new ReactiveEffect(fn);
  // effect在初始化时会第一次执行一次
  reactiveEffect.run();
  // 将当前的Effect对象的run返回出去
  return reactiveEffect.run.bind(reactiveEffect);
}
class ReactiveEffect {
  // 这个ReactiveEffect Class目的是抽离出fn的执行,方便未来依赖收集的操作
  private _fn: any;
  constructor(fn) {
    this._fn = fn;
  }
  run() {
    activityEffect = this;
    // 返回这个用户的fn代码
    return this._fn();
  }
}
```

## 实现 effect 的 scheduler

copy vue3 github 的 [scheduler 测试用例](https://github.com/vuejs/core/blob/main/packages/reactivity/__tests__/effect.spec.ts#L680)

```typescript
it("scheduler", () => {
  let dummy;
  let run: any;
  const scheduler = jest.fn(() => {
    run = runner;
  });
  const obj = reactive({ foo: 1 });
  const runner = effect(
    () => {
      dummy = obj.foo;
    },
    { scheduler }
  );
  expect(scheduler).not.toHaveBeenCalled();
  expect(dummy).toBe(1);
  // should be called on first trigger
  obj.foo++;
  expect(scheduler).toHaveBeenCalledTimes(1);
  // should not run yet
  expect(dummy).toBe(1);
  // manually run
  run();
  // should have run
  expect(dummy).toBe(2);
});
```

可以发现 我们原来的 effect 加入个对象，而这个对象里面有 scheduler 属性

- 第一次使用 effect 时，里面的 runner 被执行一次，但是 scheduler 没有被调用
- 但对响应式对象进行 set 操作 update 时，scheduler 被执行一次，而 runner 里面的值没被赋值
- 但执行 run 后里面的值才被执行

那么我们先改写 effect 的构造函数

- 接受一个 options 对象，且里面有个 scheduler 方法

```typescript
export function effect(fn, options: any = {}) {
  // 触发effect创建一个对象 -> 里面有响应式对象的get会触发track函数（使用个activityEffect变量进行暂存当前这个effect）
  const reactiveEffect = new ReactiveEffect(fn, options.scheduler);
  // effect在初始化时会第一次执行一次
  reactiveEffect.run();

  return reactiveEffect.run.bind(reactiveEffect);
}
```

那么改写 ReactiveEffect 的构造函数，public 让它变为公有属性 ？表示它是个可传参数

```typescript
  constructor(fn, public scheduler?) {
    this._fn = fn;
  }

```

接着改变些劫持依赖的代码，也就是 proxy#Set

```typescript
export function trigger(target, key) {
  const depsMap = targetsMap.get(target);
  const dep = depsMap.get(key);
  for (let item of dep) {
    if (item.scheduler) {
      // 当前的effect依赖实例如果有scheduler属性的话，说明effect的构造有传递第二个参数
      item.scheduler();
    } else {
      // 否则执行原来的逻辑
      item.run();
    }
  }
}
```

## effect 实现 stop 功能

copy 官方的 测试用例[<https://github.com/vuejs/core/blob/769e5555f9d9004ce541613341652db859881570/packages/reactivity/>**tests**/effect.spec.ts#L783]

```typescript
it("stop", () => {
  let dummy;
  const obj = reactive({ prop: 1 });
  const runner = effect(() => {
    dummy = obj.prop;
  });
  obj.prop = 2;
  expect(dummy).toBe(2);
  stop(runner);
  obj.prop = 3;
  expect(dummy).toBe(2);

  // stopped effect should still be manually callable
  runner();
  expect(dummy).toBe(3);
});
```

> 可以发现我们的 effect 返回值 runner，传入到一个 stop 函数后，这个 runner 里面的代码逻辑就不再自动执行了，会被清空掉，也就是后面的依赖劫持后，会运行 dep 里面的每个 runner，但是这时候的 runner 已经清空了。不再自动帮我们运行这个 runner 了。除非手动运行。

那么如何实现上述功能呢

- 先在 effect 里面创建个 stop 函数，且接受一个 runner 参数
- stop 肯定在 ReactiveEffect 里面去将对应 dep 容器清空对应的 effect
- 那么这个 runner 参数需要有个 ReactiveEffect 的实例对象，**如何拿到这个对象呢**
- 我们可以在 effect()函数的函数体里面实现将当前的这个 runner 携带当前的 ReactiveEffect 实例对象。
- 这样 stop 函数就可以拿到这个 ReactiveEffect 实例对象了，接着调用 ReactiveEffect 的新方法 stop
- stop 里面需要拿到当前的 effect 对应的 dep 容器，**如何拿到这个容器呢**
- 在我们的依赖收集的时候，需要将 effect 传入 dep 容器中
- 这里我们要有个概念，effect 和容器是多对多关系，一个 effect 可以对应多个容器，一个容器也可以对应多个 effect
- 那么在 ReactiveEffect 中新增个数组属性：deps
- 每次依赖收集时 effect 传入 dep 容器后，再将这个 dep 容器 push 到当前 effect 的 deps 数组里面。
- 那么 ReactiveEffect#stop 就可以通过`this.deps`拿到对应的 dep 列表，将每个 dep 里面对应的当前 effect 实例删除掉就行了。
- 这样就测试通过上面的用例。

```typescript
export function effect(fn, options: any = {}) {
  const reactiveEffect = new ReactiveEffect(fn, options.scheduler);
  // effect在初始化时会第一次执行一次
  reactiveEffect.run();
  const runner: any = reactiveEffect.run.bind(reactiveEffect);
  runner._effect = reactiveEffect; // 将当前effect实例对象挂载到runner方法上，下面代码才可以使用
  return runner;
}
```

```typescript
export function stop(runner: any) {
  runner._effect.stop();
}
```

```typescript
// 收集依赖
export function track(target, key) {
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
  dep.add(activityEffect);
  activityEffect.deps.push(dep); // 将当前的dep容器传入到实例的deps数组里面
}
```

```typescript
class ReactiveEffect {
  // 这个ReactiveEffect Class目的是抽离出fn的执行,方便未来依赖收集的操作
  private _fn: any;
  deps = [];
  constructor(fn, public scheduler?) {
    this._fn = fn;
  }
  run() {
    activityEffect = this;
    return this._fn();
  }
  stop() {
    this.deps.forEach((dep: any) => {
      dep.delete(this);
    });
  }
}
```

### 优化代码

ReactiveEffect#stop 里面的 forEach 可以抽离出去

```typescript
// 抽离出 dep容器清空effect的函数
function cleanEffect(effect) {
  effect.deps.forEach((dep: any) => {
    dep.delete(effect);
  });
}
```

```typescript
stop() {
    cleanEffect(this)
  }
```

> 每次代码运行一次 stop 其实后面都不需要再次调用了。那么这个可以给个状态值表示当前调用过了。

```typescript
class ReactiveEffect {
  private clearActivity = true;
  stop() {
    if (this.clearActivity) {
      cleanEffect(this);
      this.clearActivity = false;
    }
  }
}
```

### stop 的参数

copy 官方的 onStop 测试用例[<https://github.com/vuejs/core/blob/769e5555f9d9004ce541613341652db859881570/packages/reactivity/>**tests**/effect.spec.ts#L820]

```typescript
it("events: onStop", () => {
  const onStop = jest.fn();
  const runner = effect(() => {}, {
    onStop,
  });

  stop(runner);
  expect(onStop).toHaveBeenCalled();
});
```

- 传入一个对象，这个对象里面有个 onStop 函数，当使用 stop 方法时，这个 onStop 也被调用。
- 先在 effect 方法里面将这个 onStop 方法传入到 effect 实例里面
- 接着调用 stop 的时候，调用这个 onStop 就可以实现

```typescript
export function effect(fn, options: any = {}) {
  // 触发effect创建一个对象 -> 里面有响应式对象的get会触发track函数（使用个activityEffect变量进行暂存当前这个effect）
  const reactiveEffect = new ReactiveEffect(fn, options.scheduler);
  extend(reactiveEffect, options);
  //   Object.assign(reactiveEffect, options);
  //   reactiveEffect.onStop = options.onStop;
  // effect在初始化时会第一次执行一次
  reactiveEffect.run();
  const runner: any = reactiveEffect.run.bind(reactiveEffect);
  runner._effect = reactiveEffect;
  return runner;
}
```

> 这里将这个方法使用`Object.assign`赋值给了 effect 的方法，但这样可读性、语义化有点差，将这个 API 方法封装起来，在 src/shared/index.ts

```typescript
export const extend = Object.assign;
```

- 拓展 ReactiveEffect 类，加入 onStop 属性
- 在 stop 方法调用后调用下 onStop 方法

```typescript
class ReactiveEffect {
  // 这个ReactiveEffect Class目的是抽离出fn的执行,方便未来依赖收集的操作
  private _fn: any;
  deps = [];
  onStop?: any;
  private clearActivity = true;
  constructor(fn, public scheduler?) {
    this._fn = fn;
  }
  run() {
    activityEffect = this;
    return this._fn();
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
```

### reactive#readonly 的实现

编写 readonly 测试用例

```typescript
describe("readonly", () => {
  it("happy path", () => {
    const original = {
      foo: 1,
    };
    const wrapped = readonly(original);
    expect(wrapped).not.toBe(original);
    expect(wrapped.foo).toBe(1);
  });
  it("readonly cannot set", () => {
    const user = {
      age: 23,
    };
    console.warn = jest.fn();
    const readonlyUser = readonly(user);
    readonlyUser.age++; // 触发set
    expect(console.warn).toBeCalled();
  });
});
```

- 当使用 readonly 包裹后的对象，它是个只能读取，不能修改的
- 思路：将 Proxy#set 内的实现去掉，直接返回 true 即可

```typescript
export function readonly(raw) {
  return new Proxy(raw, {
    get(target, key) {
      const res = Reflect.get(target, key);
      track(target, key);
      return res;
    },
    set(target, key, val) {
      return true;
    },
  });
}
```

- 可以发现 readonly 与 reactive 里面的代码逻辑是相同的。
- 可以抽离出 get 方法，且抽出 readonly 的状态，
  - 当为 reactive 时，使用 track 方法
  - readonly 时，不需要使用 track 方法

```typescript
const createGetter = function (isReadonly = false) {
  return function get(target, key) {
    const res = Reflect.get(target, key);
    // 收集依赖
    if (!isReadonly) {
      track(target, key);
    }
    return res;
  };
};
```

> 因为 get 使用了个 createGetter 方法，为了保持代码可读性，set 也可以使用 createSetter 方法，保持一致

```typescript
const createSetter = function () {
  return function set(target, key, val) {
    const res = Reflect.set(target, key, val);
    // 触发依赖
    trigger(target, key);
    return res;
  };
};
```

```typescript
export function reactive(raw) {
  return new Proxy(raw, {
    get: creategetter(),
    set: createsetter(),
  });
}
export function readonly(raw) {
  return new Proxy(raw, {
    get: createGetter(true),
    set(target, key, val) {
      return true;
    },
  });
}
```

- 每次使用 new Proxy(raw, handeler)里面都是个处理器对象，这个对象也是可以抽离出去
- 创建个`baseHandlers.ts`将这些内容都抽离出来
  - createGetter
  - createSetter
  - handeler

```typescript
const createGetter = function (isReadonly = false) {
  return function get(target, key) {
    const res = Reflect.get(target, key);
    // 收集依赖
    if (!isReadonly) {
      track(target, key);
    }
    return res;
  };
};
const createSetter = function () {
  return function set(target, key, val) {
    const res = Reflect.set(target, key, val);
    // 触发依赖
    trigger(target, key);
    return res;
  };
};
export const mutableHandlers = {
  get: creategetter(),
  set: createsetter(),
};
export const readonlyHandlers = {
  get: creategetter(),
  set: function (target, key, val) {
    return true;
  },
};
```

```typescript
import { mutableHandlers, readonlyHandlers } from "./baseHandlers";

export function reactive(raw) {
  return new Proxy(raw, mutableHandlers);
}
export function readonly(raw) {
  return new Proxy(raw, readonlyHandlers);
}
```

- 再抽离这个 new Proxy 方法

```typescript
import { mutableHandlers, readonlyHandlers } from "./baseHandlers";

export function reactive(raw) {
  return createActivityObj(raw, mutableHandlers);
}
export function readonly(raw) {
  return createActivityObj(raw, readonlyHandlers);
}
function createActivityObj(raw: any, baseHandlers: any) {
  return new Proxy(raw, baseHandlers);
}
```

- 这样抽离，看起来就很干净

![](https://raw.githubusercontent.com/Hbisedm/my-blob-picGo/main/img/202207062219745.png)
这里可以抽出去，每次都调用很耗性能

```typescript
const get = createGetter();
const set = createSetter();
const readonlyGet = createGetter(true);

export const mutableHandlers = {
  get,
  set,
};
export const readonlyHandlers = {
  get: readonlyGet,
  set: function (target, key, val) {
    return true;
  },
};
```

### 实现 readonly 对象 set 时候报警告

这个在 set 的时候，抛出 warn 就可以达到目的，修改 readonlyHandlers 即可

```typescript
export const readonlyHandlers = {
  get: readonlyGet,
  set: function (target, key, val) {
    console.warn(
      `${key}cannot set, beacause current Object is readlony`,
      target
    );
    return true;
  },
};
```

## isReactive 与 isReadonly

判断当前这个对象是不是经过 reactive、readonly 函数封装过的

- 那经过前面的学习，可以知道经过它们包裹的对象，实际上是个 Proxy 对象
- 那么可以使用 Proxy#get 进行判断，使用一个没有存在的 key 值，进行 get 拦截判断即可
- 采用枚举的方式，使得代码的可读性高

`reactive.ts`定义 isReactive、isReadonly 方法

```typescript
export const enum ReactiveFlags {
  IS_REACTIVE = "__v_is_reactive",
  IS_READONLY = "__v_is_readonly",
}
export function isReactive(raw) {
  return !!raw[ReactiveFlags.IS_REACTIVE];
}
export function isReadonly(raw) {
  return !!raw[ReactiveFlags.IS_READONLY];
}
```

`baseHandlers.ts` get()

```typescript
import { ReactiveFlags } from "./reactive";

const createGetter = function (isReadonly = false) {
  return function get(target, key) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly;
    }
    if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly;
    }
    const res = Reflect.get(target, key);
    // 收集依赖
    if (!isReadonly) {
      track(target, key);
    }
    return res;
  };
};
```

## 优化 stop

```typescript
it("stop", () => {
  let dummy;
  const obj = reactive({ prop: 1 });
  const runner = effect(() => {
    dummy = obj.prop;
  });
  obj.prop = 2;
  expect(dummy).toBe(2);
  stop(runner);
  // obj.prop = 3;
  // get set
  //  obj.prop = obj.prop + 1
  obj.prop++;
  expect(dummy).toBe(2);

  // stopped effect should still be manually callable
  runner();
  expect(dummy).toBe(3);
});
```

将`obj.prop = 3` => `obj.prop++` 发现 jest 通不过。

> 原因是： `obj.prop++` => `obj.prop = obj.prop + 1`
> 这里会 get 后 set 的，那么之前的 get 操作会收集依赖导致 stop 函数运行删除 dep 里面的依赖白删除了。
> 那么就需要在这个 get(track)里面的做手脚。
> 加入个全局变量`shouldTrack`进行判断处理

```typescript
export function track(target, key) {
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
  // 对当前这个effect进行存入set容器，未来的set操作就会去查看当前容器是否有这个属性的依赖，若有则执行与它相关
  if (!activityEffect) return;
  if (!shouldTrack) return; // false do next line
  dep.add(activityEffect);
  activityEffect.deps.push(dep);
}
```

- ReactivityEffect#run 方法内处理下即可

```typescript
 run() {
    activityEffect = this;
    if(!this.clearActivity) {// 若clearActivity为false => 触发get#track => 当前的shouldTrack为false => 不会触发收集依赖
      return this._fn()
    }
    shouldTrack = true
    const result = this._fn() // 执行时，触发里面的响应式对象track方法
    shouldTrack = false
    return result
  }
```

测试通过了，接着就是优化下代码。
发现 track 函数里面这 2 个代码可以放到最前面

```typescript
if (!activityEffect) return;
if (!shouldTrack) return;
```

使用个函数包装起来

```typescript
function isTracking() {
  return shouldTrack && activityEffect !== undefined;
}
```

若 dep 里面包含了 activityEffect 的话，就没有必要继续收集了

```typescript
if (dep.has(activityEffect)) return;
dep.add(activityEffect);
```

目前优化后的代码

```typescript
// 收集依赖
export function track(target, key) {
  if (!isTracking()) return;
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
  if (dep.has(activityEffect)) return;
  // 对当前这个effect进行存入set容器，未来的set操作就会去查看当前容器是否有这个属性的依赖，若有则执行与它相关
  dep.add(activityEffect);
  activityEffect.deps.push(dep);
}
function isTracking() {
  return shouldTrack && activityEffect !== undefined;
}
```

注意点：
![](https://raw.githubusercontent.com/Hbisedm/my-blob-picGo/main/img/202207082339755.png)

## reactive、readonly 嵌套对象转换功能

编写测试用例

```typescript
it("happy path", () => {
  const original = {
    foo: 1,
    bar: {
      foo: "test",
    },
  };
  const wrapped = readonly(original);
  expect(wrapped).not.toBe(original);
  expect(wrapped.foo).toBe(1);
  expect(isReadonly(wrapped)).toBe(true);
  expect(isReadonly(original)).toBe(false);

  expect(isReadonly(wrapped.bar)).toBe(true); // 对嵌套对象进行判断
  expect(isReadonly(original.bar)).toBe(false);
});
it("happy path", () => {
  const originUser = {
    name: "Hbisedm",
    age: 19,
    friend: {
      name: "Sam",
    },
  };
  const user = reactive(originUser);
  expect(user).not.toBe(originUser);
  expect(user.age).toBe(19);
  expect(isReactive(user)).toBe(true);
  expect(isReactive(originUser)).toBe(false);
  expect(isReactive(user.friend)).toBe(true); // 对嵌套对象进行判断
  expect(isReactive(originUser.friend)).toBe(false);
});
```

- 每次对响应式对象进行取值操作都会触发 get，所以在 get 的逻辑代码里面进行处理即可。
- `baseHandlers.ts#createGetter`判断当前 return 的值是不是对象，若是，则加入 readonly、reactive 操作

```typescript
const res = Reflect.get(target, key);
if (isObject(res)) {
  return isReadonly ? readonly(res) : reactive(res);
}
```

## shallowReadonly 的实现

shallow -> 浅的意思 -> 第一层有 readonly 的特性，里面的对象没有这个特性

```typescript
describe("shallowReadonly", () => {
  test("should not make non-reactive propertiese reactive", () => {
    const props = shallowReadonly({
      n: {
        foo: 1,
      },
    });
    expect(isReadonly(props)).toBe(true);
    expect(isReadonly(props.n)).toBe(false);
  });
});
```

> 实现过程： 先在`reactive.ts`内实现`shallowReadonly`方法,在 baseHandlers#createGetter 内加多个参数表示是否为 shallow 状态，若为 shallow 状态则将这个 key 对应的 val 抛出去也不用依赖收集的操作了。

```typescript
export const shallowReadonlyHandlers = extend({}, readonlyHandlers, {
  get: shallowReadonlyGet,
});
```

```typescript
function createGetter(isReadonly = false, shallow = false) {
  return function get(target, key) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly;
    }
    if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly;
    }
    const res = Reflect.get(target, key);

    if (shallow) {
      //直接抛出去
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
```

```typescript
export function shallowReadonly(raw) {
  return createActivityObj(raw, shallowReadonlyHandlers);
}
```

## 实现 isProxy

在`reactive.ts`内实现 isProxy 方法，判断是否为`isReadonly`、`isReactive`其中一个

```typescript
export function isProxy(value) {
  return isReactive(value) || isReadonly(value);
}
```

## 实现 ref

copy 官方的测试用例

```typescript
describe("reactivity/ref", () => {
  it("should hold a value", () => {
    const a = ref(1);
    expect(a.value).toBe(1);
    a.value = 2;
    expect(a.value).toBe(2);
  });

  it("should be reactive", () => {
    const a = ref(1);
    let dummy;
    let calls = 0;
    effect(() => {
      calls++;
      dummy = a.value;
    });
    expect(calls).toBe(1);
    expect(dummy).toBe(1);
    a.value = 2;
    expect(calls).toBe(2);
    expect(dummy).toBe(2);
    // same value should not trigger
    a.value = 2;
    expect(calls).toBe(2);
  });

  it("should make nested properties reactive", () => {
    const a = ref({
      count: 1,
    });
    let dummy;
    effect(() => {
      dummy = a.value.count;
    });
    expect(dummy).toBe(1);
    a.value.count = 2;
    expect(dummy).toBe(2);
  });
});
```

- ref 是一个含有 value 的对象
- 当有 effect 的执行时，ref 的 value 也需要被依赖收集起来。修改时，当发现和原来的对象/值一样的话。不触发依赖。
- ref 可以包裹个 obj，将 value 指向个 reactive(obj)即可。

抽离 effect 的 track 与 trigger

```typescript
// 收集依赖
export function track(target, key) {
  if (!isTracking()) return;
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

export function trackEffects(dep) {
  if (dep.has(activityEffect)) return;
  // 对当前这个effect进行存入set容器，未来的set操作就会去查看当前容器是否有这个属性的依赖，若有则执行与它相关
  dep.add(activityEffect);
  activityEffect.deps.push(dep);
}

// 触发依赖
export function trigger(target, key) {
  const depsMap = targetsMap.get(target);
  const dep = depsMap.get(key);
  triggerEffects(dep);
}
export function triggerEffects(dep) {
  for (let item of dep) {
    if (item.scheduler) {
      // 当前的effect依赖实例如果有scheduler属性的话，说明effect的构造有传递第二个参数
      item.scheduler();
    } else {
      // 否则执行原来的逻辑
      item.run();
    }
  }
}
```

创建 Ref 的类，里面有个`_value`表示当前的 value

```typescript
class RefImpl {
  private _value: any;
  private dep: any = new Set();
  private _rawValue: any;
  constructor(val) {
    this._rawValue = val;
    this._value = isObject(val) ? reactive(val) : val;
  }
  get value() {
    //当使用后没有effect执行。
    if (isTracking()) {
      trackEffects(this.dep);
    }
    return this._value;
  }
  set value(newVal) {
    if (newVal === this._rawValue) return;
    this._rawValue = newVal;
    this._value = isObject(newVal) ? reactive(newVal) : newVal;
    triggerEffects(this.dep);
  }
}
export function ref(value) {
  return new RefImpl(value);
}
```

### 优化代码

- 抽离出 Object.is 到工具包里`shared/index.ts`

```typescript
export const hasChange = Object.is;
```

```typescript
this._value = isObject(newVal) ? reactive(newVal) : newVal;
// 抽离出来
function convert(value) {
  return isObject(value) ? reactive(value) : value;
}
```

## 实现 isRef 与 unRef

测试用例：

```typescript
it("isRef", () => {
  const a = ref(1);
  const b = 1;
  const c = reactive({
    num: 1,
  });
  expect(isRef(a)).toBe(true);
  expect(isRef(b)).toBe(false);
  expect(isRef(c.num)).toBe(false);
});
it("unRef", () => {
  const a = ref(1);
  const b = 1;
  expect(unRef(a)).toBe(1);
  expect(unRef(b)).toBe(1);
});
```

> 分析一下：
>
> - `isRef`是判断当前的值是不是被 ref 函数执行过，那么我们可以使用个`__v_isRef`属性去做判断即可
> - `unRef`是将 ref 函数执行过的值，还原成原来的样子

```typescript
class RefImpl {
  public __v_isRef = true
  ...
}
export function isRef(value) {
  return !!value.__v_isRef;
}
export function unRef(val) {
  return isRef(val) ? val.value : val;
}
```

## 实现 proxyRefs

> 使用 ref 的对象，在 vue3 的 template 里面我们都不用使用 value 去拿值
> 如：const age = ref(23) -> {{age}}

编写测试用例

```typescript
it("proxyRefs", () => {
  const user = {
    age: ref(10),
    name: "Sam",
  };
  const proxyUser = proxyRefs(user);
  expect(user.age.value).toBe(10);
  expect(proxyUser.age).toBe(10);
  expect(proxyUser.name).toBe("Sam");

  proxyUser.age = 20;
  expect(user.age.value).toBe(20);
  expect(proxyUser.age).toBe(20);

  proxyUser.age = ref(10);
  expect(user.age.value).toBe(10);
  expect(proxyUser.age).toBe(10);
});
```

在`ref.ts`中实现`proxyRefs`

```typescript
export function proxyRefs(objectWithRef) {
  return new Proxy(objectWithRef, {
    // key->value ref?ref.value:value
    get(target, key) {
      return unRef(target[key]);
    },
    // set 上一个值是ref，新值不是ref,需要特殊处理
    set(target, key, value) {
      if (isRef(target[key]) && !isRef(value)) {
        return (target[key].value = value);
      } else {
        return Reflect.set(target, key, value);
      }
    },
  });
}
```

## 实现 computed

computed 函数运行后的值，也 ref 类似，也是需要通过`.value`进行取值。
编写测试用例 happy path

```typescript
it("happy path", () => {
  const user = reactive({
    age: 1,
  });

  const age = computed(() => {
    return user.age;
  });
  expect(age.value).toBe(1);
});
```

- 创建`computed.ts`
- computed 函数接受个 getter 函数，然后创建个 ComputedRefImpl 对象

```typescript
class ComputedRefImpl {
  private _getter: any;
  private _drity: boolean = true;
  constructor(getter) {
    this._getter = getter;
  }
  get value() {
    return this.this._getter();
  }
}
export function computed(getter) {
  return new ComputedRefImpl(getter);
}
```

测试通过，接着开始实现 computed 的一些特性。

- 默认不允许 getter，这点与 effect 不一样
- 缓存性
- 调用引入的响应式对象变量，computed 的 getter 不运行

copy 官方的测试

```typescript
describe("computed", () => {
  it("happy path", () => {
    const user = reactive({
      age: 1,
    });

    const age = computed(() => {
      return user.age;
    });
    expect(age.value).toBe(1);
  });

  it("should compute lazily", () => {
    const value = reactive({
      foo: 1,
    });
    const getter = jest.fn(() => value.foo);
    const cValue = computed(getter);

    // lazy
    expect(getter).not.toHaveBeenCalled();

    expect(cValue.value).toBe(1);
    expect(getter).toHaveBeenCalledTimes(1);

    //   // should not compute again
    cValue.value;
    expect(getter).toHaveBeenCalledTimes(1);

    //   // should not compute until needed
    value.foo = 1;
    expect(getter).toHaveBeenCalledTimes(1);

    //   // now it should compute
    expect(cValue.value).toBe(1);
    expect(getter).toHaveBeenCalledTimes(2);

    // should not compute again
    cValue.value;
    expect(getter).toHaveBeenCalledTimes(2);
  });
});
```

- 使用 ReactiveEffect 对象传入 getter 和 scheduler
- 当触发响应式对象的 trigger 时，有 scheduler 的话就不允许 run
- 防止自动运行 run()，也就是达到，缓存性，没有调用 computedRefImpl#get 的时候不会拿新的值
- 若不使用 ReactiveEffect 去传入 getter 的话，getter 里面的响应式对象若 set 的话，会导致对应 depsMap 找不到对应的依赖从而报错。

```typescript
class ComputedRefImpl {
  private _getter: any;
  private _drity: boolean = true;
  private _value: any;
  private _effect: ReactiveEffect;
  constructor(getter) {
    // 使用ReactiveEffect对象传入getter和scheduler
    // 当触发响应式对象的trigger时，有scheduler的话就不允许run
    // 防止自动运行run()，也就是达到，缓存性，没有调用computedRefImpl#get的时候不会拿新的值
    this._effect = new ReactiveEffect(getter, () => {
      if (!this._drity) {
        this._drity = true;
      }
    });
    this._getter = this._effect;
  }
  get value() {
    if (this._drity) {
      this._drity = false;
      this._value = this._getter.run();
      return this._value;
    }
    return this._value;
  }
}
export function computed(getter) {
  return new ComputedRefImpl(getter);
}
```

## 实现初始化 component 主流程

首先创建个 createApp 函数，返回值是一个对象且这个对象有 mount 方法进行挂载节点。

```typescript
// 传入APP组件
export function createApp(rootComponent) {
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
```

创建个`vnode.ts` 新建`createVNode`函数来创建虚拟节点。

```typescript
export function createVNode(type, props?, children?) {
  return {
    type,
    props,
    children,
  };
}
```

创建个`h.ts` 新建`h`函数

```typescript
export function h(type, props?, children?) {
  return createVNode(type, props, children);
}
```

h 函数是帮助创建虚拟节点的。

创建`component.ts`构建组件的行为

```typescript
/* 创建组件实例 */
export function createComponentInstance(vnode: any) {
  const component = {
    vnode,
    type: vnode.type,
  };
  return component;
}

export function setupComponent(instance) {
  // TODO
  // initProps
  // initSlots
  setupStatefulComponent(instance);
}
function setupStatefulComponent(instance: any) {
  const Component = instance.type;

  const { setup } = Component;

  // 有可能用户没有写setup
  if (setup) {
    // function -> render
    // Object  -> 注入到当前组件的上下文中
    const setupResult = setup();

    handleSetupResult(instance, setupResult);
  }
}
function handleSetupResult(instance, setupResult: any) {
  // function Object
  // TODO function

  if (typeof setupResult === "object") {
    instance.setupState = setupResult;
  }

  finishComponentSetup(instance);
}

function finishComponentSetup(instance: any) {
  const Component = instance.type;
  /*   最后将组件的render方法挂在组件实例身上 */
  if (Component.render) {
    instance.render = Component.render;
  }
}
```

创建`renderer.ts`渲染器函数,vnode 渲染到真实 dom 需要这个函数

```typescript
import { isObject } from "./../shared/index";
import { createComponentInstance, setupComponent } from "./component";

export function render(vnode, container) {
  // patch
  patch(vnode, container);
}
function patch(vnode: any, container: any) {
  //去处理组件
  console.log("vnode : ");
  console.log(vnode);

  // 判断是不是element
  if (typeof vnode.type === "string") {
    processElement(vnode, container);
  } else if (typeof vnode.type === "object") {
    processComponent(vnode, container);
  }
}
function processElement(vnode: any, container: any) {
  mountElement(vnode, container);
}
function mountElement(vnode: any, container: any) {
  const el = document.createElement(vnode.type);

  const { children, props } = vnode;
  if (typeof children === "string") {
    el.textContent = children;
  } else {
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
function processComponent(vnode: any, container: any) {
  mountComponent(vnode, container);
}

function mountComponent(vnode: any, container: any) {
  const instance = createComponentInstance(vnode);

  setupComponent(instance);
  setupRenderEffect(instance, container);
}
function setupRenderEffect(instance: any, container) {
  const subTree = instance.render();
  console.log("instance");
  console.log(instance);
  patch(subTree, container);
}
```

## 使用 rollup

构建 ts 项目，生成 esm.js

安装

```shell
yarn add rollup --dev
yarn add tslib --dev
yarn add @rollup/plugin-typescrip --dev
```

创建`rollup.config.js`

```js
import typescript from "@rollup/plugin-typescript";
import pkg from "./package.json";
export default {
  input: "./src/index.ts",
  output: [
    {
      format: "cjs",
      file: pkg.main,
    },
    {
      format: "es",
      file: pkg.module,
    },
  ],
  plugins: [typescript()],
};
```

修改`package.json`

```json
  "main": "lib/mini-vue.cjs.js",
  "module": "lib/mini-vue.esm.js",
  "scripts": {
    "test": "jest",
    "build": "rollup -c rollup.config.js"
  },
```

运行`yarn build --watch`实时构建

最后将生成的`esm.js`导入到`index.html`，里面有个`main.js`和`App.js`

```js
import { h } from "../../lib/mini-vue.esm.js";
export const App = {
  render() {
    return h(
      "div",
      {
        id: "one",
      },
      [
        h(
          "div",
          {
            class: "red",
          },
          "p1"
        ),
        h(
          "div",
          {
            class: "blue",
          },
          "p2"
        ),
      ]
    );
  },

  setup() {
    return {
      msg: "mini-vue",
    };
  },
};
```

```js
import { createApp } from "../../lib/mini-vue.esm.js";
import { App } from "./App.js";
const app = document.querySelector("#app");
createApp(App).mount(app);
```

初步完成运行时环境

## 实现组件代理对象

vue3 中的 render()会碰到`this.$el`或者`this.xxx`setup 函数返回的值

```typescript
function setupStatefulComponent(instance: any) {
  const Component = instance.type;
  /* 实现个代理对象 */
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
```

创建个`componentPublicInstance`具体实现 Proxy 的 get handler

```ts
const publicPropertiesMap = {
  $el: (i) => i.vnode.el,
};
export const PublicInstanceHandles = {
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
```

```ts
function mountElement(vnode: any, container: any) {
  /* 将当前元素的真实el挂载到vnode的el属性 */
  const el = (vnode.el = document.createElement(vnode.type));

  const { children, props } = vnode;
  if (typeof children === "string") {
    el.textContent = children;
  } else {
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
function setupRenderEffect(instance: any, initialVNode, container) {
  const { proxy } = instance;
  const subTree = instance.render.call(proxy);
  patch(subTree, container);
  /* 组件对应的根element元素遍历后赋予组件实例对象的vnode属性的el属性 */
  initialVNode.el = subTree.el;
}
```

```ts
/* 这里拿到真实dom */
const publicPropertiesMap = {
  $el: (i) => i.vnode.el,
};
```

> 这里的解构赋值 转化有点理解不太来
> 这样的写法，代码可读性高了许多

```ts
instance.proxy = new Proxy({ _: instance }, PublicInstanceHandles);

export const PublicInstanceHandles = {
  get({ _: instance }, key) {
    // 代码块里面拿到instance，就是组件实例对象。
  },
};
```

## 加入 shapeFlag

每次判断当前 vnode 是组件还是元素，这步判断抽离成 flag 对象，为了提高性能，可以通过位运算来判断。
新建`ShapeFlags.ts`来抽离当前 vnode 的类型和它的 children 的

```ts
/*
ShapeFlags = {
  element: true or false,
  stateful: true or false,
  ...
}
*/
export const enum ShapeFlags {
  ELEMENT = 1,
  STATEFUL_COMPONENT = 1 << 1,
  TEXT_CHILDREN = 1 << 2,
  ARRAY_CHILDREN = 1 << 3,
}
```

`vnode.ts`

```ts
import { ShapeFlags } from "./ShapeFlags";

export function createVNode(type, props?, children?) {
  const vnode = {
    type,
    props,
    children,
    el: null,
    shapeFlag: getShapeFlag(type),
  };

  if (typeof children === "string") {
    vnode.shapeFlag |= ShapeFlags.TEXT_CHILDREN;
  } else if (typeof Array.isArray(children)) {
    vnode.shapeFlag |= ShapeFlags.ARRAY_CHILDREN;
  }

  return vnode;
}

function getShapeFlag(type) {
  if (typeof type === "string") {
    return ShapeFlags.ELEMENT;
  } else {
    return ShapeFlags.STATEFUL_COMPONENT;
  }
}
```

这样就将 vnode 和 children 的类型都可以清楚知道了。在需要判断的时候，使用逻辑与运算即可。
如渲染器的 patch 方法

```ts
function patch(vnode: any, container: any) {
  // 判断是不是element
  if (vnode.shapeFlag & ShapeFlags.ELEMENT) {
    processElement(vnode, container);
  } else if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
    processComponent(vnode, container);
  }
}
```

## 实现事件绑定

在 vnode 的 props 传入事件函数，如何把回调绑定到真实节点呢

```js
      {
        id: "one",
        onClick: () => console.log("click"),
      }
```

在渲染器的 mountElement 函数中判断当前的 props 的 key, 使用正则表达式判断是不是事件的 key

```ts
function mountElement(vnode: any, container: any) {
  const el = (vnode.el = document.createElement(vnode.type));

  const { children, props, shapeFlag } = vnode;
  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    el.textContent = children;
  } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
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
    } else {
      el.setAttribute(key, val);
    }
  }
  container.append(el);
}
```

## 实现组件 props 的功能

- `setup`接受一个 props 参数
- `render`函数 this.xxx 可以拿到 props 的 key
- props 是 readonly

写个新组件`foo`

```js
import { h } from "../../lib/mini-vue.esm.js";

export const Foo = {
  setup(props) {
    // props.count
    console.log(props);
    // readonly
    props.count++;
    console.log(props);
  },
  render() {
    return h("div", {}, "foo:" + this.count);
  },
};
```

App.js

```js
render() {
  return h('div', {}, [
    h(Foo, {count:1})
  ])
}
```

这里传入一个 props 对象 `{count: 1}`

```ts
export function setupComponent(instance) {
  // 初始化props
  initProps(instance, instance.vnode.props);
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
    const setupResult = setup(instance.props);

    handleSetupResult(instance, setupResult);
  }
}
```

`componentProps.ts`

```ts
export function initProps(componentInstance, rawProps) {
  componentInstance.props = rawProps || {};
}
```

在`component.ts`中先初始化个 props，接着 setup 函数传入 props
这里实现了第一个功能点： setup 传入参数

在 renderer 渲染器中,setupRenderEffect 函数组件实例 render 函数是被组件实例的 proxy call
所以在 proxy 的 get 方法中找 key 是否有在 props 中即可

```ts
function setupRenderEffect(instance: any, initialVNode, container) {
  const { proxy } = instance;
  const subTree = instance.render.call(proxy);
  console.log("instance");
  console.log(instance);
  patch(subTree, container);
  /* 组件对应的根element元素遍历后赋予真实$el */
  initialVNode.el = subTree.el;
}
```

组件实例代理的 get 逻辑代码

```ts
if (hasOwn(setupState, key)) {
  return setupState[key];
} else if (hasOwn(props, key)) {
  return props[key];
}
```

其中 hasOwn 是来自 shared/index.ts

```ts
export const hasOwn = (thisObj, key) =>
  Object.prototype.hasOwnProperty.call(thisObj, key);
```

完成第二个功能点。

vue3 中 props 是不可写的，这里可以借助响应式对象的 shallowReadonly 函数，将 setup 函数调用时的 props 参数进行包裹一层

```ts
if (setup) {
  // function -> render
  // Object  -> 注入到当前组件的上下文中
  const setupResult = setup(shallowReadonly(instance.props));

  handleSetupResult(instance, setupResult);
}
```

完成第三个功能点

## 实现组件 emit 功能

子组件 emit 发送事件给父组件`on + eventName`

```ts
  setup(props, { emit }) {
    // props.count
    console.log(props);
    // readonly
    props.count++;
    console.log(props);
    const emitAdd = () => {
      console.log("emitAdd handler");
      emit("add", 1, 2);
      emit("add-foo", 3);
    };
    return {
      emitAdd,
    };
  },
```

setup 传入第二个参数，参数是个对象类型，里面含有 emit

```ts
        h(Foo, {
          count: 1,
          onAdd: (a, b) => {
            console.log("on Add");
            console.log("args", a, b);
          },
          onAddFoo: (a) => {
            console.log("onAddFoo");
            console.log(a);
          },
        }),
```

父组件 props 属性加入 onAdd、onAddFoo 方法

需要做的是将子组件的传入的事件名、参数 传入到父组件 props 的事件属性和参数

先在 component#setupStatefulComponent 的 setup 函数调用传入 emit

```ts
function setupStatefulComponent(instance: any) {
  const Component = instance.type;

  instance.proxy = new Proxy({ _: instance }, PublicInstanceHandles);

  const { setup } = Component;

  // 有可能用户没有写setup
  if (setup) {
    // function -> render
    // Object  -> 注入到当前组件的上下文中
    const setupResult = setup(shallowReadonly(instance.props), {
      emit: instance.emit,
    });

    handleSetupResult(instance, setupResult);
  }
}
```

这个 emit 在组件实例对象定义，里面的 emit 函数抽到`componentEmit.ts`内

```ts
export function createComponentInstance(vnode: any) {
  const component = {
    vnode, // 组件实例的虚拟节点
    type: vnode.type, // 组件实例的name, 因为这个type就是组件
    setupState: {},
    props: {},
    emit: () => {},
  };
  // thisArg是null或undefined，执行作用域的 this 将被视为新函数的 thisArg。
  // component是component#emit的第一个参数
  component.emit = emit.bind(null, component) as () => void;
  return component;
}
```

`componentEmit.ts`

```ts
export function emit(instance, event, ...args) {
  console.table("instance", instance);
  console.log("emit", event);
  const { props } = instance;
  //TPP
  const handler = props[toHandlerKey(camelize(event))];
  handler && handler(...args);
}
```

这里抽离出 转为事件 key-toHandlerKey 转为驼峰-camelize 事件 key 第一个字符转大写-capitalize

```ts
export const camelize = (str: string) => {
  return str.replace(/-(\w)/g, (_, a: string) => {
    return a ? a.toUpperCase() : "";
  });
};
export const capitalize = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};
export const toHandlerKey = (str: string) => {
  return "on" + capitalize(str);
};
```

## 组件的 slots

- 具名插槽
- 作用域插槽

App.js

```js
const fooSlotObj = h(
  Foo,
  {
    count: 1,
  },
  h("p", {}, "Obj Slots 插槽")
);
```

Foo.js

```js
render() {

   return h("div", {}, [
      renderSlots(this.$slots),
    ]);
}

```

- 需要可以拿到 this.$slots
- renderSlots 的实现抽出来，也就是创建虚拟节点

```js
/* PublicInstanceHandles中增加代理`$slots`、组件实例对象增加`slots`属性
组件实例对象的`slots`属性的定义 initSlots 创建个`componentSlots.ts`进行实现， 保证单一原则 */

export function initSlots(instance, children) {
  instance.slots = children;
}
```

可以实现当 slot 为一个值的时候
但如果是个数组，上面的方法就需求改进了

```js
const fooSlotArr = h(
  Foo,
  {
    count: 1,
  },
  [h("p", {}, " Slot Array 1"), h("p", {}, "Slot Array 2")]
);
```

```js
export function initSlots(instance, children) {
  instance.slots = Array.isArray(children) ? children : [children];
}
export function renderSlots(slots: Object) {
  return createVNode("div", {}, slots);
}
```

具名插槽的实现

1. 具体指定位置
2. 具体内容

定义的时候，传入参数 name 指定位置(子组件)

使用的时候，传入参数，指定内容(父组件)

作用域插槽的实现(子组件传递给父组件值)
写成函数的形式，调用时传入值。

App.js

```js
const fooSlotHasName = h(
  Foo,
  {
    count: 1,
  },
  {
    header: ({ age }) => {
      return h("p", {}, " Slot Array 1 get slot age: " + age);
    },
    footer: () => h("p", {}, "Slot Array 2"),
  }
);
```

Foo.js

```js
return h("div", {}, [
  renderSlots(this.$slots, "header", { age }),
  foo,
  renderSlots(this.$slots, "footer"),
]);
```

修改`renderSlots`
这里拿到函数，才可以将子组件的值传过去给父组件

```ts
export function renderSlots(slots: Object, name: string, props) {
  let slot = slots[name];
  if (slot) {
    if (typeof slot === "function") {
      const vnode = createVNode("div", {}, slot(props));
      return vnode;
    }
  }
}
```

`initProps`修改为函数运行的方式，使得 renderSlot 拿到的是函数的形式

```ts
function normalizeObjectSlots(children: any, slots: any) {
  // let slots = {};
  if (children)
    for (let key in children) {
      // footer: () => h("p", {}, "Slot Array 2"),
      const value = children[key]; //这里value是父组件定义的 () => h() 箭头函数
      slots[key] = (props) => normalizeSlotValue(value(props));
    }
  // instance.slots = slots;
}

function normalizeSlotValue(value) {
  return Array.isArray(value) ? value : [value];
}

export function initSlots(instance, children) {
  //   instance.slots = Array.isArray(children) ? children : [children];
  // 判断当前组件是不是含有slot
  const { vnode } = instance;
  if (vnode.shapeFlag & ShapeFlags.SLOT_CHILDREN) {
    normalizeObjectSlots(children, instance.slots);
  }
}
```

https://vue-next-template-explorer.netlify.app/
这个网址查看 template 转换后的 h 函数
![](https://raw.githubusercontent.com/Hbisedm/my-blob-picGo/main/img/202207262256920.png)

## 实现 Fragment 和 Text 类型节点

> 上一个小节实现的 slots 生成后的真实节点，有个问题，会多个 div 标签一层。

原来的渲染，是通过创建个 div 的虚拟节点，那么使用个 Fragment 中间变量，接着在 patch 方法里面做判断

`vnode.ts`

```ts
export const Fragment = Symbol("Fragment");
```

`renderSlots.ts`

```ts
const vnode = createVNode(Fragment, {}, slot(props));
```

`renderer.ts`渲染器函数内添加`processFragment`函数，目的是直接渲染 vnode 的 children

```ts
function patch(vnode: any, container: any) {
  //去处理
  console.log("vnode : ");
  console.log(vnode);
  const { type, shapeFlag } = vnode;
  switch (type) {
    case Fragment:
      processFragment(vnode, container);
      break;

    case Text:
      processText(vnode, container);
      break;
    default:
      // 判断是不是element
      // if (typeof vnode.type === "string") {
      if (shapeFlag & ShapeFlags.ELEMENT) {
        processElement(vnode, container);
        // } else if (typeof vnode.type === "object") {
      } else if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
        processComponent(vnode, container);
      }
      break;
  }
}
// 渲染节点直接
function processFragment(vnode: any, container: any) {
  mountChildren(vnode, container);
}
```

`App.js`内使用 text 节点等于下面这样写法

```html
<component>你好啊</component>
```

```ts
{
        header: ({ age }) => {
          return h("p", {}, " Slot Array 1 get slot age: " + age);
        },
        footer: () => [
          h("p", {}, "Slot Array 2"),
          h("div", {}, "div..."),
          createTextVNode("hello text node..."),
        ],
   }
```

那么这样直接文本的节点如何处理呢

`vnode.ts` 定义个 createTextVnode 方法里面将文本传入个 vnode 就行，一样调用创建虚拟节点的方法

```ts
export const Text = Symbol("Text");
export function createTextVNode(text: string) {
  return createVNode(Text, {}, text);
}
```

`renderer.ts`渲染器内对 Text 的类型进行处理

```ts
function processText(vnode: any, container: any) {
  const { children } = vnode;
  const textNode = (vnode.el = document.createTextNode(children));
  container.append(textNode);
}
```

使用原生的 api 创建文本节点 接着挂载到指定的容器内即可

## 实现 getCurrentInstance

可以在组件实例的 setup 方法内拿到当前组件的实例

`App.js`

```js
  setup() {
    console.log("%c this is App setup ->", "color:red;font-size: 20px");
    console.log(getCurrentInstance());
    console.log("%c <- this is App setup", "color:red;font-size: 20px");
    return {
      msg: "mini-vue",
    };
  },

```

在`component.ts`声明个`getCurrentInstance`和当前模块的全局变量`currentInstance`

```ts
let currentInstance = null;
export function getCurrentInstance() {
  return currentInstance;
}
```

当调用的 setup 方法时，先给`currentInstance`赋值，调用完毕后，再赋予`null`

```ts
可以使用个函数抽离出这个赋值过程;

function setCurrentInstance(instance) {
  currentInstance = instance;
}

function setupStatefulComponent(instance: any) {
  //...
  setCurrentInstance(instance);
  const setupResult = setup(shallowReadonly(props), {
    emit,
  });
  setCurrentInstance(null);
  //...
}
```

这样做的好处：可以方便后期调试错

