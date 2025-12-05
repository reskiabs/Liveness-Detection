import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from "react-native-vision-camera";
import { detectFaces } from "./hooks/useDetectFaces";

export default function App() {
  const device = useCameraDevice("front");
  const { hasPermission, requestPermission } = useCameraPermission();
  const [isCameraActive, setIsCameraActive] = useState(false);

  const frameProcessor = useFrameProcessor((frame) => {
    "worklet";
    const faces = detectFaces(frame);
    console.log(`Faces in Frame: ${faces}`);
  }, []);

  if (!hasPermission)
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No access to camera</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Allow Camera Access</Text>
        </TouchableOpacity>
      </View>
    );

  if (device == null)
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No device</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <Camera
        style={styles.camera}
        device={device}
        frameProcessor={frameProcessor}
        isActive={isCameraActive}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={() => setIsCameraActive(!isCameraActive)}
      >
        <Text style={styles.buttonText}>Toggle Camera</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
  },

  camera: {
    width: 300,
    height: 300,
    marginBottom: 20,
  },
  text: {
    fontSize: 20,
    color: "white",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
