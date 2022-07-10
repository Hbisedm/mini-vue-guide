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
