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
    const onChangeProps1 = () => {
      props.value.foo = "new-foo";
    };
    const onChangeProps2 = () => {
      props.value.foo = undefined;
    };
    const onChangeProps3 = () => {
      props.value = {
        foo: "foo",
      };
    };
    return {
      onClick,
      count,
      props,
      onChangeProps1,
      onChangeProps2,
      onChangeProps3,
    };
  },
  render() {
    // console.log("this.count => ");
    // console.log(this.count);
    return h("div", { id: "root", ...this.props }, [
      h("div", {}, "count:" + this.count),
      h("button", { onClick: this.onClick }, "click"),
      h(
        "button",
        { onClick: this.onChangeProps1 },
        "changeProps - 值改变 - 修改"
      ),
      h(
        "button",
        { onClick: this.onChangeProps2 },
        "changeProps - 值变成undefined - 值删除"
      ),
      h(
        "button",
        { onClick: this.onChangeProps3 },
        "changeProps - key在新的里面没有了 - 删除"
      ),
    ]);
  },
};
