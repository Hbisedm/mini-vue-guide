import { h, ref } from "../../lib/mini-vue.esm.js";

/** 1 右侧对比
 * (ab)c
 * (ab)de
 * */
// const prevChildren = [
//   h("div", { key: "A" }, "A"),
//   h("div", { key: "B" }, "B"),
//   h("div", { key: "C" }, "C"),
// ];
// const nextChildren = [
//   h("div", { key: "A" }, "A"),
//   h("div", { key: "B" }, "B"),
//   h("div", { key: "D" }, "D"),
//   h("div", { key: "E" }, "E"),
// ];

/** 2 左侧对比
 * a(bc)
 * de(bc)
 * */
// const prevChildren = [
//   h("div", { key: "A" }, "A"),
//   h("div", { key: "B" }, "B"),
//   h("div", { key: "C" }, "C"),
// ];
// const nextChildren = [
//   h("div", { key: "D" }, "D"),
//   h("div", { key: "E" }, "E"),
//   h("div", { key: "B" }, "B"),
//   h("div", { key: "C" }, "C"),
// ];

/** 3 右侧对比 创建
 * (ab)
 * (ab)c
 * */
// const prevChildren = [h("div", { key: "A" }, "A"), h("div", { key: "B" }, "B")];
// const nextChildren = [
//   h("div", { key: "A" }, "A"),
//   h("div", { key: "B" }, "B"),
//   h("div", { key: "C" }, "C"),
//   h("div", { key: "D" }, "D"),
// ];

/** 4 左侧对比 创建
 * (ab)
 * c(ab)
 * */
const prevChildren = [h("div", { key: "A" }, "A"), h("div", { key: "B" }, "B")];
const nextChildren = [
  h("div", { key: "D" }, "D"),
  h("div", { key: "C" }, "C"),
  h("div", { key: "A" }, "A"),
  h("div", { key: "B" }, "B"),
];
/** 5 老的比新的长 del右侧
 * (ab)
 * c(ab)
 * */
// const prevChildren = [
//   h("div", { key: "A" }, "A"),
//   h("div", { key: "B" }, "B"),
//   h("div", { key: "C" }, "C"),
// ];
// const nextChildren = [h("div", { key: "A" }, "A"), h("div", { key: "B" }, "B")];
/** 6 老的比新的长 del左侧
 * (ab)
 * c(ab)
 * */
// const prevChildren = [
//   h("div", { key: "A" }, "A"),
//   h("div", { key: "B" }, "B"),
//   h("div", { key: "C" }, "C"),
// ];
// const nextChildren = [h("div", { key: "B" }, "B"), h("div", { key: "C" }, "C")];
export default {
  name: "ArrayToText",
  setup() {
    const isChange = ref(false);
    window.isChange = isChange;

    return {
      isChange,
    };
  },
  render() {
    const self = this;

    return self.isChange === true
      ? h("div", {}, nextChildren)
      : h("div", {}, prevChildren);
  },
};
