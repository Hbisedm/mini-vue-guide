import {
  h,
  provide,
  inject,
  createTextVNode,
} from "../../../lib/mini-vue.esm.js";
/**
 * App2 for provide inject func
 */

export const AppInject = {
  name: "App",
  setup() {},
  render() {
    return h("div", {}, [h("p", {}, "apiInject"), h(App2)]);
  },
};
export const App2 = {
  name: "App2",
  render() {
    return h("div", {}, [h("p", {}, "祖先组件 "), h(App2Two)]);
  },
  setup() {
    provide("foo", "fooVal");
    provide("bar", "barVal");
  },
};

export const App2Two = {
  name: "App2Two",
  render() {
    return h("div", {}, [h("p", {}, "中间组件 " + this.foo), h(Foo2)]);
  },
  setup() {
    provide("foo", "fooTwoVal");
    const foo = inject("foo");
    return {
      foo,
    };
  },
};

const Foo2 = {
  name: "Foo2",
  render() {
    return h("div", {}, [
      createTextVNode(`子组件 inject foo => ${this.foo}        `),
      createTextVNode(`and  bar => ${this.bar}         `),
      createTextVNode(`and baz is a default value => ${this.baz}`),
      createTextVNode(`and func is a default value by func => ${this.func}`),
    ]);
  },
  setup() {
    const foo = inject("foo");
    const bar = inject("bar");
    const baz = inject("baz", "default baz...");
    const func = inject("func", () => "default by func ...");
    return {
      foo,
      bar,
      baz,
      func,
    };
  },
};
