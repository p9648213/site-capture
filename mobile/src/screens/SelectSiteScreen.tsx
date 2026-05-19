import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Network from "expo-network";
import { useFocusEffect, type NavigationProp, useNavigation } from "@react-navigation/native";
import { fetchSitesForSync } from "../api/sites";
import { getLastSyncedAt, getSites, upsertSyncedSites } from "../db/sites";
import type { RootStackParamList } from "../navigation/types";
import { usePhotoSyncContext } from "../sync/PhotoSyncContext";
import type { Site } from "../types/site";
import { formatRelativeTime, isSyncStale } from "../utils/time";

type SyncNotice = {
  tone: "success" | "error";
  message: string;
};

function isOnline(networkState: Network.NetworkState) {
  return networkState.isConnected === true && networkState.isInternetReachable !== false;
}

export function SelectSiteScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [sites, setSites] = useState<Site[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [networkState, setNetworkState] = useState<Network.NetworkState>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<SyncNotice | null>(null);
  const photoSync = usePhotoSyncContext();
  const online = isOnline(networkState);
  const stale = isSyncStale(lastSyncedAt);

  const reloadCachedData = useCallback(async () => {
    const [cachedSites, cachedLastSyncedAt] = await Promise.all([getSites(), getLastSyncedAt()]);
    setSites(cachedSites);
    setLastSyncedAt(cachedLastSyncedAt);
  }, []);

  const refreshSites = useCallback(
    async (mode: "auto" | "manual") => {
      if (!online) {
        if (mode === "manual") {
          setNotice({
            tone: "error",
            message: "No internet. Connect to refresh.",
          });
        }
        return;
      }

      setIsRefreshing(true);
      setNotice(null);

      try {
        const payload = await fetchSitesForSync();
        await upsertSyncedSites(payload);
        await reloadCachedData();
        setNotice({
          tone: "success",
          message: `Sync complete: ${payload.sites.length} site${payload.sites.length === 1 ? "" : "s"} updated.`,
        });
      } catch (error) {
        setNotice({
          tone: "error",
          message:
            error instanceof Error ? error.message : "Sync failed. Check connection and server settings.",
        });
      } finally {
        setIsRefreshing(false);
      }
    },
    [online, reloadCachedData],
  );

  useEffect(() => {
    let mounted = true;

    async function load() {
      const currentNetworkState = await Network.getNetworkStateAsync();

      if (!mounted) {
        return;
      }

      setNetworkState(currentNetworkState);
      await reloadCachedData();
      setIsLoading(false);

      if (isOnline(currentNetworkState)) {
        await refreshSites("auto");
      }
    }

    load();
    const subscription = Network.addNetworkStateListener((nextNetworkState) => {
      setNetworkState(nextNetworkState);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [refreshSites, reloadCachedData]);

  useFocusEffect(
    useCallback(() => {
      reloadCachedData();
      photoSync.refreshPendingCount();
    }, [photoSync, reloadCachedData]),
  );

  useEffect(() => {
    if (photoSync.syncRevision > 0) {
      reloadCachedData();
    }
  }, [photoSync.syncRevision, reloadCachedData]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Select Site</Text>
          <Text style={styles.synced}>Last synced: {formatRelativeTime(lastSyncedAt)}</Text>
        </View>
        <Pressable
          style={[styles.refreshButton, (!online || isRefreshing) && styles.refreshButtonDisabled]}
          disabled={!online || isRefreshing}
          onPress={() => refreshSites("manual")}
        >
          {isRefreshing ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.refreshText}>Refresh</Text>}
        </Pressable>
      </View>

      {!online ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            Offline - using cached data from {formatRelativeTime(lastSyncedAt)}
          </Text>
        </View>
      ) : null}

      {stale ? (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>You haven't synced today. Refresh before going offline.</Text>
        </View>
      ) : null}

      {notice ? (
        <View style={notice.tone === "success" ? styles.successBanner : styles.errorBanner}>
          <Text style={notice.tone === "success" ? styles.successText : styles.errorText}>{notice.message}</Text>
        </View>
      ) : null}

      {photoSync.pendingCount > 0 || photoSync.isSyncing || photoSync.lastError || photoSync.lastMessage ? (
        <View style={photoSync.lastError ? styles.errorBanner : styles.photoSyncBanner}>
          <Text style={photoSync.lastError ? styles.errorText : styles.photoSyncText}>
            {photoSync.isSyncing
              ? `Uploading ${photoSync.pendingCount} pending photo${photoSync.pendingCount === 1 ? "" : "s"}...`
              : photoSync.lastError ??
                photoSync.lastMessage ??
                `${photoSync.pendingCount} photo${photoSync.pendingCount === 1 ? "" : "s"} pending upload.`}
          </Text>
          {online && photoSync.pendingCount > 0 && !photoSync.isSyncing ? (
            <Pressable style={styles.syncButton} onPress={photoSync.syncNow}>
              <Text style={styles.syncButtonText}>Sync photos</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator />
          <Text style={styles.muted}>Loading cached sites...</Text>
        </View>
      ) : (
        <FlatList
          data={sites}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={sites.length === 0 ? styles.emptyList : styles.list}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No cached sites</Text>
              <Text style={styles.muted}>Connect to the internet and refresh before going offline.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.siteCard}
              onPress={() => navigation.navigate("SiteDetail", { siteId: item.id })}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.siteName}>{item.name}</Text>
                <Text style={item.status === "COMPLETED" ? styles.completedBadge : styles.incompleteBadge}>
                  {item.status}
                </Text>
              </View>
              <Text style={styles.address}>{item.address}</Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f4f6f8",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#dbe1e8",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
  },
  synced: {
    marginTop: 4,
    color: "#526171",
    fontSize: 14,
  },
  refreshButton: {
    minWidth: 104,
    height: 42,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1f2937",
  },
  refreshButtonDisabled: {
    backgroundColor: "#94a3b8",
  },
  refreshText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  offlineBanner: {
    margin: 12,
    marginBottom: 0,
    borderRadius: 6,
    backgroundColor: "#e0f2fe",
    padding: 12,
  },
  offlineText: {
    color: "#075985",
    fontWeight: "600",
  },
  warningBanner: {
    margin: 12,
    marginBottom: 0,
    borderRadius: 6,
    backgroundColor: "#fef3c7",
    padding: 12,
  },
  warningText: {
    color: "#92400e",
    fontWeight: "600",
  },
  successBanner: {
    margin: 12,
    marginBottom: 0,
    borderRadius: 6,
    backgroundColor: "#dcfce7",
    padding: 12,
  },
  successText: {
    color: "#166534",
    fontWeight: "600",
  },
  errorBanner: {
    margin: 12,
    marginBottom: 0,
    borderRadius: 6,
    backgroundColor: "#fee2e2",
    padding: 12,
  },
  errorText: {
    color: "#991b1b",
    fontWeight: "600",
  },
  photoSyncBanner: {
    margin: 12,
    marginBottom: 0,
    borderRadius: 6,
    backgroundColor: "#eef2ff",
    padding: 12,
  },
  photoSyncText: {
    color: "#3730a3",
    fontWeight: "600",
  },
  syncButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    borderRadius: 5,
    backgroundColor: "#3730a3",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  syncButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  list: {
    padding: 12,
    gap: 12,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  emptyState: {
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  muted: {
    color: "#64748b",
    textAlign: "center",
  },
  siteCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dbe1e8",
    backgroundColor: "#ffffff",
    padding: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  siteName: {
    flex: 1,
    color: "#111827",
    fontSize: 18,
    fontWeight: "700",
  },
  address: {
    marginTop: 8,
    color: "#526171",
  },
  completedBadge: {
    borderRadius: 5,
    backgroundColor: "#d1fae5",
    color: "#065f46",
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  incompleteBadge: {
    borderRadius: 5,
    backgroundColor: "#fef3c7",
    color: "#92400e",
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
});
