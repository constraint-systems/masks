import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export const ShowSettingsAtom = atomWithStorage("showSettings", true);

export const VideoAtom = atom<HTMLVideoElement | null>(null);
export const WebcamFlippedAtom = atomWithStorage("webcamFlipped", {
  x: false,
  y: false,
});
export const VideoLoadedAtom = atom(false);
export const OpacityAtom = atomWithStorage("opacity", 1);
export const defaultCategorySettings = {
  background: true,
  hair: true,
  face: true,
  body: false,
  clothes: false,
};
export const ShowCategoriesAtom = atomWithStorage<Record<string, boolean>>(
  "category-settings",
  defaultCategorySettings,
);
export const categoryKeys = Object.keys(defaultCategorySettings);
export const CanvasRefAtom = atom<{ current: HTMLCanvasElement | null }>({
  current: null,
});
