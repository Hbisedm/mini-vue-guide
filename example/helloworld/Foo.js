import { h, renderSlots } from "../../lib/mini-vue.esm.js";

export const Foo = {
  setup(props, { emit }) {
    // props.count
    console.log(props);
    // readonly
    props.count++;
    console.log(props);
    const emitAdd = () => {
      console.log("emitAdd handler");
      emit("add", 1, 2);
      emit("add-foo", 3);
    };
    return {
      emitAdd,
    };
  },
  render() {
    const btn = h("button", { onClick: this.emitAdd }, "emit");
    const foo = h("div", {}, "foo:" + this.count);
    // 具名插槽
    // 确定插槽名称
    // 确定插槽位置
    // 作用域插槽
    const age = 23;
    return h("div", {}, [
      renderSlots(this.$slots, "header", { age }),
      foo,
      renderSlots(this.$slots, "footer"),
      renderSlots(this.$slots, "default"),
    ]);
  },
};
