import { ReactiveEffect, trackEffects } from "./effect";

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
