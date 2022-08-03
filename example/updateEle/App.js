import { h, ref } from "../../lib/mini-vue.esm.js";

export const App = {
  name: "App",
  setup() {
    const count = ref(0);

    const onClick = () => {
      count.value++;
    };
    const props = ref({
      foo: "foo",
      bar: "bar",
    });
    return {
      onClick,
      count,
    };
  },
  render() {
    // console.log("this.count => ");
    // console.log(this.count);
    return h("div", { id: "root" }, [
      h("div", {}, "count:" + this.count),
      h("button", { onClick: this.onClick }, "click"),
    ]);
  },
};
