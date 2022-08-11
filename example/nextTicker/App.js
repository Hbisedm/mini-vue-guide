import {
  h,
  ref,
  getCurrentInstance,
  nextTick,
} from "../../lib/mini-vue.esm.js";

export const App = {
  name: "App",
  setup() {
    const count = ref(1);
    const curr = getCurrentInstance();
    function onClick() {
      for (let i = 0; i < 100; i++) {
        console.log("update");
        count.value = i;
      }
      console.log(curr);
      nextTick(() => {
        console.log(curr);
      });

      // await nextTick()
      // console.log(curr)
    }
    return {
      count,
      onClick,
    };
  },
  render() {
    // console.log("this.count => ");
    // console.log(this.count);
    return h("div", {}, [
      h("div", {}, "count:" + this.count),
      h("button", { onClick: this.onClick }, "changeCount"),
    ]);
  },
};
