import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from "react-native-vision-camera";
import { Worklets } from "react-native-worklets-core";
import { detectFaces } from "./hooks/useDetectFaces";

export default function App() {
  const device = useCameraDevice("front");
  const { hasPermission, requestPermission } = useCameraPermission();
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [instructions, setInstructions] = useState("");

  const onFaceDetected = Worklets.createRunOnJS((message) => {
    setInstructions(message);
  });

  const frameProcessor = useFrameProcessor((frame) => {
    "worklet";
    const result = detectFaces(frame);
    if (result.status === "face_detected") {
      if (!result.yaw && !result.roll) {
        onFaceDetected("Menoleh atau Miringkan Kepala");
      }
      if (result.yaw) {
        onFaceDetected("Miringkan Kepala ke kiri atau ke kanan");
      }
      if (result.roll) {
        onFaceDetected("Menoleh ke kiri atau ke kanan");
      }
      if (result.isSmiling) {
        onFaceDetected("Tutup Mata");
      }
      if (!result.eyesOpen) {
        onFaceDetected("Tersenyum");
      }
    }
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
      <View>
        <Text style={styles.instruction}>{instructions}</Text>
      </View>
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
        <Text style={styles.buttonText}>
          {isCameraActive ? "Stop" : "Start"} Camera
        </Text>
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
  instruction: {
    fontSize: 20,
    fontWeight: "500",
    marginBottom: 10,
  },
  button: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 30,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
});
