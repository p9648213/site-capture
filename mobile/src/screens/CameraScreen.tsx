import { useEffect, useRef, useState } from "react";
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
type CameraFacing = "back" | "front";
const PHOTO_ASPECT_RATIO = 1;

type CaptureMetadata = {
  latitude: number | null;
  longitude: number | null;
  capturedAt: string;
  city: string | null;
  country: string | null;
};

function isOnline(networkState: Network.NetworkState) {
  return networkState.isConnected === true && networkState.isInternetReachable !== false;
}

function formatCapturedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatCoordinate(value: number | null) {
  return value === null ? "Unavailable" : value.toFixed(6);
}

function getCity(address: Location.LocationGeocodedAddress | null) {
  return address?.city ?? address?.district ?? address?.subregion ?? address?.region ?? null;
}

async function reverseGeocodeLocation(location: Location.LocationObject | null) {
  if (location === null) {
    return null;
  }

  return Location.reverseGeocodeAsync({
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  })
    .then((results) => results[0] ?? null)
    .catch(() => null);
}

function buildMetadata(
  capturedAt: string,
  location: Location.LocationObject | null,
  address: Location.LocationGeocodedAddress | null,
): CaptureMetadata {
  return {
    latitude: location?.coords.latitude ?? null,
    longitude: location?.coords.longitude ?? null,
    capturedAt,
    city: getCity(address),
    country: address?.country ?? null,
  };
}

function WatermarkOverlay({ metadata, siteName }: { metadata: CaptureMetadata; siteName: string }) {
  return (
    <View style={styles.watermark}>
      <Text style={styles.watermarkText}>{formatCapturedAt(metadata.capturedAt)}</Text>
      <Text style={styles.watermarkText}>
        {formatCoordinate(metadata.latitude)}, {formatCoordinate(metadata.longitude)}
      </Text>
      <Text style={styles.watermarkText}>{metadata.city ?? "City unavailable"}</Text>
      <Text style={styles.watermarkText}>{metadata.country ?? "Country unavailable"}</Text>
      <Text style={styles.watermarkText}>{siteName}</Text>
    </View>
  );
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
  const [facing, setFacing] = useState<CameraFacing>("back");
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [liveMetadata, setLiveMetadata] = useState<CaptureMetadata>({
    latitude: null,
    longitude: null,
    capturedAt: new Date().toISOString(),
    city: null,
    country: null,
  });

  const hasCameraPermission = cameraPermission?.granted === true;
  const hasLocationPermission = locationPermission?.granted === true;

  async function requestPermissions() {
    await requestCameraPermission();
    await requestLocationPermission();
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveMetadata((current) => ({
        ...current,
        capturedAt: new Date().toISOString(),
      }));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!hasLocationPermission) {
      return;
    }

    let isMounted = true;

    async function refreshLiveLocation() {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }).catch(() => null);
      const address = await reverseGeocodeLocation(location);

      if (!isMounted) {
        return;
      }

      setLiveMetadata((current) => buildMetadata(current.capturedAt, location, address));
    }

    void refreshLiveLocation();

    return () => {
      isMounted = false;
    };
  }, [hasLocationPermission]);

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

      const capturedAt = new Date().toISOString();
      const address = await reverseGeocodeLocation(location);
      const capturedMetadata = buildMetadata(capturedAt, location, address);

      setCapturedPhoto(photo);
      setMetadata(capturedMetadata);
      setLiveMetadata(capturedMetadata);
    } catch (error) {
      Alert.alert(
        "Capture failed",
        error instanceof Error ? error.message : "The photo could not be captured.",
      );
    } finally {
      setIsBusy(false);
    }
  }

  function toggleFacing() {
    setFacing((current) => (current === "back" ? "front" : "back"));
    setIsFlashOn(false);
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
            <WatermarkOverlay metadata={metadata} siteName={route.params.siteName} />
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
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.cameraLayout}>
        <View style={styles.cameraHeader}>
          <Text style={styles.cameraSite}>{route.params.siteName}</Text>
          <Text style={styles.cameraType}>{route.params.pictureTypeName}</Text>
        </View>
        <View style={styles.cameraFrame}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing={facing}
            mode="picture"
            ratio="1:1"
            flash={isFlashOn ? "on" : "off"}
            enableTorch={facing === "back" && isFlashOn}
          />
          <WatermarkOverlay metadata={liveMetadata} siteName={route.params.siteName} />
        </View>
        <View style={styles.cameraFooter}>
          <View style={styles.cameraControls}>
            <Pressable
              style={[styles.cameraControlButton, isFlashOn && styles.cameraControlButtonActive]}
              disabled={facing === "front"}
              onPress={() => setIsFlashOn((current) => !current)}
            >
              <Text style={[styles.cameraControlText, facing === "front" && styles.cameraControlTextDisabled]}>
                {isFlashOn ? "Flash On" : "Flash Off"}
              </Text>
            </Pressable>
            <Pressable style={styles.cameraControlButton} onPress={toggleFacing}>
              <Text style={styles.cameraControlText}>{facing === "back" ? "Back" : "Front"}</Text>
            </Pressable>
          </View>
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
  cameraLayout: {
    flex: 1,
    justifyContent: "space-between",
  },
  cameraFrame: {
    width: "100%",
    aspectRatio: PHOTO_ASPECT_RATIO,
    overflow: "hidden",
    backgroundColor: "#000000",
  },
  camera: {
    flex: 1,
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
  cameraControls: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
    paddingHorizontal: 24,
  },
  cameraControlButton: {
    minWidth: 104,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.75)",
    backgroundColor: "rgba(0, 0, 0, 0.38)",
    paddingHorizontal: 14,
  },
  cameraControlButtonActive: {
    backgroundColor: "rgba(37, 99, 235, 0.78)",
  },
  cameraControlText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  cameraControlTextDisabled: {
    color: "#9ca3af",
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
    width: "100%",
    aspectRatio: PHOTO_ASPECT_RATIO,
    alignSelf: "center",
    backgroundColor: "#000000",
  },
  previewImage: {
    flex: 1,
  },
  watermark: {
    position: "absolute",
    right: 16,
    bottom: 16,
    maxWidth: "72%",
    alignItems: "flex-end",
  },
  watermarkText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    textAlign: "right",
    textShadowColor: "rgba(0, 0, 0, 0.85)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
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
