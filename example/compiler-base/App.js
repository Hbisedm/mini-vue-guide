import { ref } from "../../lib/mini-vue.esm.js";
export const App = {
  name: "App",
  template: "<div>hi,{{count}}{{message}}</div>",
  setup() {
    const count = (window.count = ref(1));
    return {
      message: "123",
      count,
    };
  },
};
