import { configureAccessMode } from "../utils/accessMode.js";

const viteEnv = import.meta.env;

export const clientEnvironment = Object.freeze({
  accessMode: viteEnv.VITE_ACCESS_MODE,
});

export const configureClientAccessMode = () =>
  configureAccessMode({ VITE_ACCESS_MODE: clientEnvironment.accessMode });
