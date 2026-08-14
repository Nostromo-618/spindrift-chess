/// <reference types="vite/client" />

declare module "@vanduo-oss/vd3/css";

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}
