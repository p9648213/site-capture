import { createContext, useContext, type ReactNode } from "react";
import { usePhotoSync, type PhotoSyncState } from "./usePhotoSync";

const PhotoSyncContext = createContext<PhotoSyncState | null>(null);

export function PhotoSyncProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const state = usePhotoSync(enabled);
  return <PhotoSyncContext.Provider value={state}>{children}</PhotoSyncContext.Provider>;
}

export function usePhotoSyncContext() {
  const context = useContext(PhotoSyncContext);

  if (!context) {
    throw new Error("usePhotoSyncContext must be used inside PhotoSyncProvider.");
  }

  return context;
}
