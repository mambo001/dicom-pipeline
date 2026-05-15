import type { DesktopApi } from "../../preload/preload";

declare global {
  interface Window {
    readonly dicomDesktop: DesktopApi;
  }
}

export {};
