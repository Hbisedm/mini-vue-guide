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
