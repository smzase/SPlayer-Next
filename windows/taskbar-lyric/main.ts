import "@/styles/uno";
import { createApp } from "vue";
import App from "./App.vue";
import Queue from "./Queue.vue";

const view = new URLSearchParams(window.location.search).get("view");
createApp(view === "queue" ? Queue : App).mount("#app");
