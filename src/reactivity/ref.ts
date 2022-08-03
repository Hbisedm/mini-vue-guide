import { hasChange, isObject } from "./../shared/index";
import { isTracking, trackEffects, triggerEffects } from "./effect";
import { reactive } from "./reactive";

// 1 true "1" 基本数据类型...
// get set 使用Proxy去劫持是不行的，因为它的目标是一个对象类型
// 可以使用对象的get set 去劫持
class RefImpl {
  private _value: any;
  private dep: any = new Set();
  private _rawValue: any;
  __v_isRef = true;
  constructor(val) {
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
    if (hasChange(newVal, this._rawValue)) return;
    this._rawValue = newVal;
    this._value = convert(newVal);
    triggerEffects(this.dep);
  }
}
function convert(value) {
  return isObject(value) ? reactive(value) : value;
}
export function ref(value) {
  return new RefImpl(value);
}
export function isRef(value) {
  return !!value.__v_isRef;
}
export function unRef(val) {
  return isRef(val) ? val.value : val;
}
export function proxyRefs(objectWithRefs) {
  return new Proxy(objectWithRefs, {
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
