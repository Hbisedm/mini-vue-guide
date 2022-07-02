export function effect(fn) {
  const reactiveEffect = new ReactiveEffect(fn);
  // effect在初始化时会第一次执行一次
  reactiveEffect.run();
}
// 临时变量 目的是为了存储当前的effect
let activityEffect;
const targetsMap = new Map();
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

  // new Dep()
}
export function trigger(target, key) {
  const depsMap = targetsMap.get(target);
  const dep = depsMap.get(key);
  for (let item of dep) {
    item.run();
  }
}
//
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
