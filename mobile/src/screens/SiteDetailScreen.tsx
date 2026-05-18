import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, type RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { getSiteWithCategories } from "../db/sites";
import type { RootStackParamList } from "../navigation/types";
import type { SiteWithCategories } from "../types/site";

type Route = RouteProp<RootStackParamList, "SiteDetail">;
type Navigation = NativeStackNavigationProp<RootStackParamList, "SiteDetail">;

function getCategoryProgress(category: SiteWithCategories["categories"][number]) {
  const total = category.pictureTypes.length;
  const fulfilled = category.pictureTypes.filter((pictureType) => pictureType.isFulfilled).length;

  return { fulfilled, total };
}

export function SiteDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Navigation>();
  const [site, setSite] = useState<SiteWithCategories | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function loadSite() {
        setIsLoading(true);
        const cachedSite = await getSiteWithCategories(route.params.siteId);

        if (mounted) {
          setSite(cachedSite);
          setIsLoading(false);
        }
      }

      loadSite();

      return () => {
        mounted = false;
      };
    }, [route.params.siteId]),
  );

  if (isLoading) {
    return (
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading site...</Text>
      </SafeAreaView>
    );
  }

  if (!site) {
    return (
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.centered}>
        <Text style={styles.title}>Site not found</Text>
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
        <Text style={styles.topBarTitle}>Site</Text>
        <View style={styles.topBarSpacer} />
      </View>
      <View style={styles.header}>
        <Text style={styles.title}>{site.name}</Text>
        <Text style={styles.address}>{site.address}</Text>
      </View>
      <FlatList
        data={site.categories}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={site.categories.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No categories</Text>
            <Text style={styles.muted}>This site has no required inspection categories yet.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const progress = getCategoryProgress(item);

          return (
            <Pressable
              style={styles.card}
              onPress={() =>
                navigation.navigate("CategoryDetail", {
                  siteId: site.id,
                  categoryId: item.id,
                })
              }
            >
              <View style={styles.cardHeader}>
                <Text style={styles.categoryName}>{item.name}</Text>
                <Text style={item.status === "COMPLETED" ? styles.completedBadge : styles.incompleteBadge}>
                  {item.status}
                </Text>
              </View>
              <Text style={styles.progress}>
                {progress.fulfilled}/{progress.total} picture types fulfilled
              </Text>
            </Pressable>
          );
        }}
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
    backgroundColor: "#ffffff",
    borderBottomColor: "#dbe1e8",
    borderBottomWidth: 1,
    padding: 16,
  },
  title: {
    color: "#111827",
    fontSize: 26,
    fontWeight: "700",
  },
  address: {
    marginTop: 6,
    color: "#526171",
  },
  list: {
    gap: 12,
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
  card: {
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
  categoryName: {
    flex: 1,
    color: "#111827",
    fontSize: 18,
    fontWeight: "700",
  },
  progress: {
    marginTop: 10,
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
