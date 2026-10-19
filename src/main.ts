import "./styles/main.css";
import { startRouter } from "./app/router";
import { libraryView } from "./app/views/library";
import { notFoundView } from "./app/views/notFound";

const root = document.getElementById("app");
if (!root) throw new Error("Element #app fehlt");

startRouter(root, { "/": libraryView }, notFoundView);
