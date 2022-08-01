import { createApp } from "../../lib/mini-vue.esm.js";
import { App } from "./App.js";
import { AppInject } from "./apiInject/index.js";
const app = document.querySelector("#app");
// createApp(AppInject).mount(app);
createApp(App).mount(app);
