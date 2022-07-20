import { h } from "../../lib/mini-vue.esm";

export const Foo = {
  setup(props) {
    // props.count
    console.log(props);
    // readonly
  },
  render() {
    return h("div", {}, "foo:" + this.count);
  },
};
