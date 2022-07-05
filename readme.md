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

copy 官方的 测试用例[https://github.com/vuejs/core/blob/769e5555f9d9004ce541613341652db859881570/packages/reactivity/__tests__/effect.spec.ts#L783]

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

copy 官方的 onStop 测试用例[https://github.com/vuejs/core/blob/769e5555f9d9004ce541613341652db859881570/packages/reactivity/__tests__/effect.spec.ts#L820]

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
