import { h, createTextVNode } from "../../lib/mini-vue.esm.js";
import { Bar } from "./Bar.js";
import { Foo } from "./Foo.js";
window.self;
export const App = {
  /* this.$el */
  render() {
    window.self = this;
    const app = h("div", { class: "red" }, "p1");
    const fooEvent = h(Foo, {
      count: 1,
      onAdd: (a, b) => {
        console.log("on Add");
        console.log("args", a, b);
      },
      onAddFoo: (a) => {
        console.log("onAddFoo");
        console.log(a);
      },
    });
    const barSlotObj = h(
      Bar,
      {
        count: 1,
      },
      h("p", {}, "Obj Slots 插槽")
    );
    const fooSlotArr = h(
      Foo,
      {
        count: 1,
      },
      [h("p", {}, " Slot Array 1"), h("p", {}, "Slot Array 2")]
    );
    const fooSlotHasName = h(
      Foo,
      {
        count: 1,
      },
      {
        header: ({ age }) => [
          h("p", {}, " Slot Array 1 get slot age: " + age),
          h("div", {}, "Slot "),
        ],
        footer: () => [
          h("p", {}, "Slot Array 2"),
          h("div", {}, "div..."),
          createTextVNode("hello text node..."),
        ],
      }
    );
    const fooDefault = h(
      Foo,
      {
        count: 2,
      },
      {
        default: () => {
          return h("div", {}, "default Slot render...");
        },
      }
    );
    return h(
      "div",
      {
        // id: "one",
        // onClick: () => console.log("click"),
      },
      [app, fooSlotArr, barSlotObj, fooSlotHasName, fooDefault]
      // [app, fooSlotArr, fooSlotObj, fooSlotHasName]
      // [app, fooSlotHasName]
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
