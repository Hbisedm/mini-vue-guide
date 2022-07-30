import { getCurrentInstance } from "./component";

export function provide(key, value) {
  const currentInstance: any = getCurrentInstance();
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

export function inject(key, defaultValue) {
  const currentInstance: any = getCurrentInstance();
  const { provides } = currentInstance.parent;
  if (key in provides) {
    return provides[key];
  } else if (defaultValue !== "") {
    if (typeof defaultValue === "function") {
      return defaultValue();
    }
    return defaultValue;
  }
}
