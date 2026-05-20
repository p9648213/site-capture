import { useCallback, useEffect, useRef, useState } from "react";
import * as Network from "expo-network";
import { countPendingPhotos } from "../db/photos";
import { syncPendingPhotos } from "./photoSync";

export type PhotoSyncState = {
  pendingCount: number;
  isSyncing: boolean;
  lastMessage: string | null;
  lastError: string | null;
  syncRevision: number;
  refreshPendingCount: () => Promise<void>;
  syncNow: () => Promise<void>;
};

function isOnline(networkState: Network.NetworkState) {
  return networkState.isConnected === true && networkState.isInternetReachable !== false;
}

export function usePhotoSync(enabled: boolean): PhotoSyncState {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [syncRevision, setSyncRevision] = useState(0);
  const syncPromiseRef = useRef<Promise<void> | null>(null);

  const refreshPendingCount = useCallback(async () => {
    setPendingCount(await countPendingPhotos());
  }, []);

  const syncNow = useCallback(async () => {
    if (syncPromiseRef.current) {
      return syncPromiseRef.current;
    }

    setIsSyncing(true);
    setLastMessage(null);
    setLastError(null);

    const syncPromise = (async () => {
      const result = await syncPendingPhotos();
      setPendingCount(result.remaining);

      if (result.attempted > 0) {
        if (result.synced > 0) {
          setSyncRevision((current) => current + 1);
        }

        setLastMessage(
          `Uploaded ${result.synced} photo${result.synced === 1 ? "" : "s"} and refreshed site data. ${result.remaining} pending.`,
        );
      }
    })()
      .catch(async (error: unknown) => {
        await refreshPendingCount();
        setLastError(error instanceof Error ? error.message : "Photo sync failed.");
      })
      .finally(() => {
        syncPromiseRef.current = null;
        setIsSyncing(false);
      });

    syncPromiseRef.current = syncPromise;
    return syncPromise;
  }, [refreshPendingCount]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let mounted = true;

    async function start() {
      await refreshPendingCount();
      const networkState = await Network.getNetworkStateAsync();

      if (mounted && isOnline(networkState)) {
        await syncNow();
      }
    }

    start();

    const subscription = Network.addNetworkStateListener((networkState) => {
      if (isOnline(networkState)) {
        syncNow();
      }
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [enabled, refreshPendingCount, syncNow]);

  return {
    pendingCount,
    isSyncing,
    lastMessage,
    lastError,
    syncRevision,
    refreshPendingCount,
    syncNow,
  };
}
