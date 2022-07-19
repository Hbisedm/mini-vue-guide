import { h } from "../../lib/mini-vue.esm.js";
window.self;
export const App = {
  /* this.$el */
  render() {
    window.self = this;
    return h(
      "div",
      {
        id: "one",
      },
      "hello " + this.msg
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
