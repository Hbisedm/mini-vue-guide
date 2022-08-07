import { h } from "../../lib/mini-vue.esm.js";

import ArrayToText from "./ArrayToText.js";
import TextToText from "./TextToText.js";
import TextToArray from "./TextToArray.js";
import ArrayToArray from "./ArrayToArray.js";

export const App = {
  name: "App",
  render() {
    console.log(ArrayToText);
    return h("div", {}, [
      h("div", {}, "首页"),
      // h(ArrayToText, {}),
      // h(TextToText, {}),
      h(TextToArray, {}),
      h(ArrayToArray, {}),
    ]);
  },

  setup() {},
};
