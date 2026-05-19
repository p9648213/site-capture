import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, type RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { getSiteWithCategories } from "../db/sites";
import type { RootStackParamList } from "../navigation/types";
import { usePhotoSyncContext } from "../sync/PhotoSyncContext";
import type { SiteWithCategories } from "../types/site";

type Route = RouteProp<RootStackParamList, "CategoryDetail">;
type Navigation = NativeStackNavigationProp<RootStackParamList, "CategoryDetail">;

export function CategoryDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Navigation>();
  const photoSync = usePhotoSyncContext();
  const [site, setSite] = useState<SiteWithCategories | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSite = useCallback(
    async (showLoading: boolean) => {
      if (showLoading) {
        setIsLoading(true);
      }

      const cachedSite = await getSiteWithCategories(route.params.siteId);
      setSite(cachedSite);
      setIsLoading(false);
    },
    [route.params.siteId],
  );

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function loadFocusedSite() {
        setIsLoading(true);
        const cachedSite = await getSiteWithCategories(route.params.siteId);

        if (mounted) {
          setSite(cachedSite);
          setIsLoading(false);
        }
      }

      loadFocusedSite();

      return () => {
        mounted = false;
      };
    }, [route.params.siteId]),
  );

  useEffect(() => {
    if (photoSync.syncRevision > 0) {
      loadSite(false);
    }
  }, [loadSite, photoSync.syncRevision]);

  const category = useMemo(
    () => site?.categories.find((item) => item.id === route.params.categoryId) ?? null,
    [route.params.categoryId, site],
  );

  if (isLoading) {
    return (
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading category...</Text>
      </SafeAreaView>
    );
  }

  if (!site || !category) {
    return (
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.centered}>
        <Text style={styles.title}>Category not found</Text>
        <Text style={styles.muted}>Refresh cached data and try again.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.topBarTitle}>Category</Text>
        <View style={styles.topBarSpacer} />
      </View>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{site.name}</Text>
        <Text style={styles.title}>{category.name}</Text>
        <Text style={category.status === "COMPLETED" ? styles.completedBadge : styles.incompleteBadge}>
          {category.status}
        </Text>
      </View>
      <FlatList
        data={category.pictureTypes}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={category.pictureTypes.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No picture types</Text>
            <Text style={styles.muted}>The boss has not assigned photo requirements for this category.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.pictureTypeRow}
            onPress={() =>
              navigation.navigate("Camera", {
                siteId: site.id,
                categoryId: category.id,
                pictureTypeId: item.id,
                siteName: site.name,
                pictureTypeName: item.name,
              })
            }
          >
            <View style={item.isFulfilled ? styles.fulfilledDot : styles.missingDot} />
            <View style={styles.pictureText}>
              <Text style={styles.pictureName}>{item.name}</Text>
              <Text style={item.isFulfilled ? styles.fulfilledText : styles.missingText}>
                {item.isFulfilled ? "Completed" : "Missing photo"}
              </Text>
            </View>
            <Text style={styles.captureText}>Capture</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f4f6f8",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#f4f6f8",
    padding: 24,
  },
  topBar: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomColor: "#dbe1e8",
    borderBottomWidth: 1,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
  },
  backButton: {
    minHeight: 40,
    minWidth: 64,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  backText: {
    color: "#2563eb",
    fontSize: 16,
    fontWeight: "700",
  },
  topBarTitle: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "800",
  },
  topBarSpacer: {
    width: 64,
  },
  header: {
    gap: 8,
    backgroundColor: "#ffffff",
    borderBottomColor: "#dbe1e8",
    borderBottomWidth: 1,
    padding: 16,
  },
  eyebrow: {
    color: "#526171",
    fontSize: 14,
    fontWeight: "600",
  },
  title: {
    color: "#111827",
    fontSize: 26,
    fontWeight: "700",
  },
  list: {
    gap: 10,
    padding: 12,
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
    color: "#111827",
    fontSize: 18,
    fontWeight: "700",
  },
  muted: {
    color: "#64748b",
    textAlign: "center",
  },
  pictureTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dbe1e8",
    backgroundColor: "#ffffff",
    padding: 14,
  },
  pictureText: {
    flex: 1,
  },
  pictureName: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "700",
  },
  fulfilledDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#10b981",
  },
  missingDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#f59e0b",
  },
  fulfilledText: {
    marginTop: 4,
    color: "#047857",
    fontWeight: "600",
  },
  missingText: {
    marginTop: 4,
    color: "#92400e",
    fontWeight: "600",
  },
  captureText: {
    color: "#2563eb",
    fontWeight: "800",
  },
  completedBadge: {
    alignSelf: "flex-start",
    borderRadius: 5,
    backgroundColor: "#d1fae5",
    color: "#065f46",
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  incompleteBadge: {
    alignSelf: "flex-start",
    borderRadius: 5,
    backgroundColor: "#fef3c7",
    color: "#92400e",
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
});
