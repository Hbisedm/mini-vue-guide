import { extend } from "./../shared/index";

// 临时变量 目的是为了存储当前的effect
let activityEffect;
// 是否需要track状态变量
let shouldTrack;

/**
 * shouldTrack 是否要track：每次执行fn前都会将shouldTrack设置为true
 * activityEffect === undefined 的情况为 当建立个响应式对象后，它没有对应的effect副作用函数包裹过
 */
export function isTracking() {
  return shouldTrack && activityEffect !== undefined;
}

/**
 * 这个ReactiveEffect Class目的是抽离出fn的执行,方便未来依赖收集的操作
 */
export class ReactiveEffect {
  private _fn: any;
  deps = [];
  onStop?: any;
  private clearActivity = true;
  constructor(fn, public scheduler?) {
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
  effect.deps.forEach((dep: any) => {
    dep.delete(effect);
  });
  effect.deps.length = 0;
}
const targetsMap = new Map();
export function effect(fn, options: any = {}) {
  // 触发effect创建一个对象 -> 里面有响应式对象的get会触发track函数（使用个activityEffect变量进行暂存当前这个effect）
  const reactiveEffect = new ReactiveEffect(fn, options.scheduler);
  extend(reactiveEffect, options);
  // Object.assign(reactiveEffect, options);
  // reactiveEffect.onStop = options.onStop;
  // effect在初始化时会第一次执行一次
  reactiveEffect.run();
  const runner: any = reactiveEffect.run.bind(reactiveEffect);
  runner._effect = reactiveEffect;
  return runner;
}
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
  
  if (!depsMap) return;
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

export function stop(runner: any) {
  runner._effect.stop();
}
