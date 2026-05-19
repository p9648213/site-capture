import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as Location from "expo-location";
import * as Network from "expo-network";
import { captureRef } from "react-native-view-shot";
import { type RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { insertPendingPhoto } from "../db/photos";
import type { RootStackParamList } from "../navigation/types";
import { usePhotoSyncContext } from "../sync/PhotoSyncContext";
import { buildLocalPhotoUri, ensurePhotoDirectory } from "../utils/photos";

type Route = RouteProp<RootStackParamList, "Camera">;
type Navigation = NativeStackNavigationProp<RootStackParamList, "Camera">;

type CaptureMetadata = {
  latitude: number | null;
  longitude: number | null;
  capturedAt: string;
};

function isOnline(networkState: Network.NetworkState) {
  return networkState.isConnected === true && networkState.isInternetReachable !== false;
}

function formatCapturedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatCoordinate(value: number | null) {
  return value === null ? "Unavailable" : value.toFixed(6);
}

export function CameraScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Navigation>();
  const photoSync = usePhotoSyncContext();
  const cameraRef = useRef<CameraView>(null);
  const previewRef = useRef<View>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions();
  const [capturedPhoto, setCapturedPhoto] = useState<CameraCapturedPicture | null>(null);
  const [metadata, setMetadata] = useState<CaptureMetadata | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const hasCameraPermission = cameraPermission?.granted === true;
  const hasLocationPermission = locationPermission?.granted === true;

  async function requestPermissions() {
    await requestCameraPermission();
    await requestLocationPermission();
  }

  async function takePhoto() {
    if (!cameraRef.current || isBusy) {
      return;
    }

    setIsBusy(true);

    try {
      const [photo, location] = await Promise.all([
        cameraRef.current.takePictureAsync({
          quality: 0.9,
          skipProcessing: false,
        }),
        hasLocationPermission
          ? Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            }).catch(() => null)
          : Promise.resolve(null),
      ]);

      setCapturedPhoto(photo);
      setMetadata({
        latitude: location?.coords.latitude ?? null,
        longitude: location?.coords.longitude ?? null,
        capturedAt: new Date().toISOString(),
      });
    } catch (error) {
      Alert.alert(
        "Capture failed",
        error instanceof Error ? error.message : "The photo could not be captured.",
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function savePhoto() {
    if (!capturedPhoto || !metadata || !previewRef.current || isBusy) {
      return;
    }

    setIsBusy(true);

    try {
      await ensurePhotoDirectory();
      const capturedPreviewUri = await captureRef(previewRef, {
        format: "jpg",
        quality: 0.92,
        result: "tmpfile",
      });
      const normalized = await ImageManipulator.manipulateAsync(capturedPreviewUri, [], {
        compress: 0.9,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      const localUri = buildLocalPhotoUri(route.params.pictureTypeId, metadata.capturedAt);

      await FileSystem.copyAsync({
        from: normalized.uri,
        to: localUri,
      });

      await insertPendingPhoto({
        siteId: route.params.siteId,
        categoryId: route.params.categoryId,
        pictureTypeId: route.params.pictureTypeId,
        localUri,
        latitude: metadata.latitude,
        longitude: metadata.longitude,
        capturedAt: metadata.capturedAt,
      });
      await photoSync.refreshPendingCount();

      const networkState = await Network.getNetworkStateAsync();

      if (isOnline(networkState)) {
        await photoSync.syncNow();
      }

      navigation.goBack();
    } catch (error) {
      Alert.alert(
        "Save failed",
        error instanceof Error ? error.message : "The photo could not be saved locally.",
      );
    } finally {
      setIsBusy(false);
    }
  }

  if (!hasCameraPermission || !hasLocationPermission) {
    return (
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.permissionScreen}>
        <Text style={styles.permissionTitle}>Permissions required</Text>
        <Text style={styles.permissionText}>
          Camera and location access are required to capture watermarked site photos.
        </Text>
        <Pressable style={styles.permissionButton} onPress={requestPermissions}>
          <Text style={styles.primaryButtonText}>Grant permissions</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (capturedPhoto && metadata) {
    return (
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.screen}>
        <View ref={previewRef} collapsable={false} style={styles.previewCapture}>
          <ImageBackground source={{ uri: capturedPhoto.uri }} resizeMode="cover" style={styles.previewImage}>
            <View style={styles.watermark}>
              <Text style={styles.watermarkTitle}>{route.params.siteName}</Text>
              <Text style={styles.watermarkText}>{route.params.pictureTypeName}</Text>
              <Text style={styles.watermarkText}>{formatCapturedAt(metadata.capturedAt)}</Text>
              <Text style={styles.watermarkText}>
                GPS {formatCoordinate(metadata.latitude)}, {formatCoordinate(metadata.longitude)}
              </Text>
            </View>
          </ImageBackground>
        </View>
        <View style={styles.previewActions}>
          <Pressable
            style={styles.secondaryButton}
            disabled={isBusy}
            onPress={() => {
              setCapturedPhoto(null);
              setMetadata(null);
            }}
          >
            <Text style={styles.secondaryButtonText}>Retake</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} disabled={isBusy} onPress={savePhoto}>
            {isBusy ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Save</Text>}
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.cameraScreen}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back" mode="picture" />
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.cameraOverlay}>
        <View style={styles.cameraHeader}>
          <Text style={styles.cameraSite}>{route.params.siteName}</Text>
          <Text style={styles.cameraType}>{route.params.pictureTypeName}</Text>
        </View>
        <View style={styles.cameraFooter}>
          <Pressable style={styles.shutterButton} disabled={isBusy} onPress={takePhoto}>
            {isBusy ? <ActivityIndicator color="#ffffff" /> : <View style={styles.shutterInner} />}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#111827",
  },
  permissionScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    backgroundColor: "#f4f6f8",
    padding: 24,
  },
  permissionTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "700",
  },
  permissionText: {
    color: "#526171",
    lineHeight: 21,
    textAlign: "center",
  },
  cameraScreen: {
    flex: 1,
    backgroundColor: "#000000",
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: "space-between",
  },
  cameraHeader: {
    margin: 16,
    borderRadius: 8,
    backgroundColor: "rgba(15, 23, 42, 0.78)",
    padding: 12,
  },
  cameraSite: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  cameraType: {
    marginTop: 4,
    color: "#dbeafe",
    fontSize: 14,
    fontWeight: "700",
  },
  cameraFooter: {
    alignItems: "center",
    paddingBottom: 30,
  },
  shutterButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#ffffff",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#ffffff",
  },
  previewCapture: {
    flex: 1,
    backgroundColor: "#000000",
  },
  previewImage: {
    flex: 1,
    justifyContent: "flex-end",
  },
  watermark: {
    margin: 16,
    borderRadius: 8,
    backgroundColor: "rgba(15, 23, 42, 0.78)",
    padding: 12,
  },
  watermarkTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  watermarkText: {
    marginTop: 3,
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: "600",
  },
  previewActions: {
    flexDirection: "row",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
    backgroundColor: "#0f172a",
    padding: 16,
  },
  primaryButton: {
    minHeight: 46,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: "#2563eb",
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  permissionButton: {
    minHeight: 46,
    minWidth: 190,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: "#2563eb",
    paddingHorizontal: 18,
  },
  secondaryButton: {
    minHeight: 46,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: "#111827",
    fontWeight: "800",
  },
});
