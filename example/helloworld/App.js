import { h } from "../../lib/mini-vue.esm.js";
export const App = {
  render() {
    return h(
      "div",
      {
        id: "one",
      },
      [
        h(
          "div",
          {
            class: "red",
          },
          "p1"
        ),
        h(
          "div",
          {
            class: "blue",
          },
          "p2"
        ),
      ]
    );
  },

  setup() {
    return {
      msg: "mini-vue",
    };
  },
};
