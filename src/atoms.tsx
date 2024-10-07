import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { defaultCategorySettings } from "./consts";

export const ShowSettingsAtom = atomWithStorage("showSettings", true);
export const SelectedDeviceIdAtom = atomWithStorage("selectedDeviceId", "");
export const VideoAtom = atom<HTMLVideoElement | null>(null);
export const WebcamFlippedAtom = atomWithStorage("webcamFlipped", {
  x: false,
  y: false,
});
export const VideoLoadedAtom = atom(false);
export const OpacityAtom = atomWithStorage("opacity", 1);
export const ShowCategoriesAtom = atomWithStorage<Record<string, boolean>>(
  "category-settings",
  defaultCategorySettings,
);
export const FpsAtom = atomWithStorage("fps",10);
export const CanvasRefAtom = atom<{ current: HTMLCanvasElement | null }>({
  current: null,
});
export const LoadingSegmenterAtom = atom(false);
