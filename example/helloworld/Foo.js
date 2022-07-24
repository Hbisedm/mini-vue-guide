import { h } from "../../lib/mini-vue.esm.js";

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
    return h("div", {}, [foo, btn]);
  },
};
