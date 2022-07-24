import { h } from "../../lib/mini-vue.esm.js";
import { Foo } from "./Foo.js";
window.self;
export const App = {
  /* this.$el */
  render() {
    window.self = this;
    return h(
      "div",
      {
        id: "one",
        // onClick: () => console.log("click"),
      },
      [
        h("div", { class: "red" }, "p1"),
        h(Foo, {
          count: 1,
          onAdd: (a, b) => {
            console.log("on Add");
            console.log("args", a, b);
          },
          onAddFoo: (a) => {
            console.log("onAddFoo");
            console.log(a);
          },
        }),
      ]
      // "hello " + this.msg
      // [
      //   h(
      //     "div",
      //     {
      //       class: "red",
      //     },
      //     "p1"
      //   ),
      //   h(
      //     "div",
      //     {
      //       class: "blue",
      //     },
      //     "p2"
      //   ),
      // ]
    );
  },

  setup() {
    return {
      msg: "mini-vue",
    };
  },
};
