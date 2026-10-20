import "./styles/main.css";
import { mountUpdateNotice, showUpdateNotice } from "./app/components/updateNotice";
import { startRouter } from "./app/router";
import { libraryView } from "./app/views/library";
import { notFoundView } from "./app/views/notFound";
import { registerServiceWorker } from "./platform/serviceWorker";

const root = document.getElementById("app");
const notice = document.getElementById("update-notice");
if (!root || !notice) throw new Error("Element #app oder #update-notice fehlt");

startRouter(root, { "/": libraryView }, notFoundView);
mountUpdateNotice(notice);
registerServiceWorker(showUpdateNotice);
