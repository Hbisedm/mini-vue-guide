import { hasOwn } from "./../shared/index";
const publicPropertiesMap = {
  $el: (i) => i.vnode.el,
  $slots: (i) => i.slots,
  $props: (i) => i.props,
};
export const PublicInstanceHandles = {
  get({ _: instance }, key) {
    /* setupState */
    const { setupState, props } = instance;

    if (hasOwn(setupState, key)) {
      return setupState[key];
    } else if (hasOwn(props, key)) {
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
