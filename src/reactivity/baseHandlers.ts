import { extend } from "./../shared/index";
import { isObject } from "../shared";
import { track, trigger } from "./effect";
import { reactive, ReactiveFlags, readonly } from "./reactive";

const get = createGetter();
const set = createSetter();
const readonlyGet = createGetter(true);
const shallowReadonlyGet = createGetter(true, true);

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

export const mutableHandlers = {
  get,
  set,
};
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
export const shallowReadonlyHandlers = extend({}, readonlyHandlers, {
  get: shallowReadonlyGet,
});
