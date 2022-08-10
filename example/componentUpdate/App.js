import { h, ref } from "../../lib/mini-vue.esm.js";
import Child from "./Child.js";

export const App = {
  name: "App",
  setup() {
    const count = ref(1);
    const msg = ref("123");
    const changeCount = () => {
      count.value++;
    };
    const changeChildProps = () => {
      msg.value = "345";
    };

    return {
      onClick: changeCount,
      count,
      msg,
      changeChildProps,
    };
  },
  render() {
    // console.log("this.count => ");
    // console.log(this.count);
    return h("div", { id: "root", ...this.props }, [
      h(Child, { msg: this.msg }),
      h("div", {}, "count:" + this.count),
      h("button", { onClick: this.onClick }, "changeCount"),
      h("button", { onClick: this.changeChildProps }, "changeChildProps"),
    ]);
  },
};
