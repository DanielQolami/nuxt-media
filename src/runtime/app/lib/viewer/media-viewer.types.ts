import type { MediaViewerItem } from "../../types/media-viewer.types";

interface MediaViewerSlideProps {
  item: MediaViewerItem;
  active: boolean;
  preload?: boolean;
  zoom: number;
  maxZoom?: number;
}

export type {
  MediaViewerSlideProps,
};
