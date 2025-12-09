import { useRef, useState } from "react";
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
  const [instruction, setInstruction] = useState("Tekan Start untuk memulai");

  // Track completed instructions
  const [completedInstructions, setCompletedInstructions] = useState(new Set());
  const [currentTask, setCurrentTask] = useState(null);
  const [isTaskCompleted, setIsTaskCompleted] = useState(false);

  // All available instructions
  const instructions = useRef([
    { id: "blink", text: "Kedipkan mata Anda" },
    { id: "smile", text: "Tersenyum" },
    { id: "yaw", text: "Tolehkan kepala" },
    { id: "roll", text: "Miringkan kepala" },
    { id: "mouth", text: "Buka mulut Anda" },
  ]).current;

  // Shuffle and get next instruction
  const getNextInstruction = () => {
    const remaining = instructions.filter(
      (inst) => !completedInstructions.has(inst.id)
    );

    if (remaining.length === 0) {
      // All completed
      setInstruction("Liveness Selesai");
      setIsCameraActive(false);
      setCurrentTask(null);
      return;
    }

    // Random instruction from remaining
    const randomIndex = Math.floor(Math.random() * remaining.length);
    const nextTask = remaining[randomIndex];

    setCurrentTask(nextTask);
    setInstruction(nextTask.text);
    setIsTaskCompleted(false);
  };

  // Start liveness detection
  const startLiveness = () => {
    setCompletedInstructions(new Set());
    setIsCameraActive(true);
    setIsTaskCompleted(false);

    // Delay to ensure camera is active
    setTimeout(() => {
      getNextInstruction();
    }, 500);
  };

  // Worklet to check task completion
  const checkTaskCompletion = Worklets.createRunOnJS((taskId, result) => {
    if (isTaskCompleted) return; // Already completed

    let completed = false;

    switch (taskId) {
      case "blink":
        // Check if eyes were open then closed
        if (!result.eyesOpen) {
          completed = true;
        }
        break;

      case "smile":
        if (result.isSmiling) {
          completed = true;
        }
        break;

      case "yaw":
        if (result.yaw) {
          completed = true;
        }
        break;

      case "roll":
        if (result.roll) {
          completed = true;
        }
        break;

      case "mouth":
        if (result.isMouthOpen) completed = true;
        break;
    }

    if (completed) {
      setIsTaskCompleted(true);
      setCompletedInstructions((prev) => {
        const newSet = new Set(prev);
        newSet.add(taskId);
        return newSet;
      });

      // Move to next instruction after delay
      setTimeout(() => {
        getNextInstruction();
      }, 1000);
    }
  });

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";
      const result = detectFaces(frame);

      if (result.status === "duplicate_faces") {
        // Handle multiple faces
        return;
      }

      if (result.status === "face_detected" && currentTask) {
        checkTaskCompletion(currentTask.id, result);
      }
    },
    [currentTask, isTaskCompleted]
  );

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
      <View style={styles.instructionContainer}>
        <Text style={styles.instruction}>{instruction}</Text>
        <Text style={styles.progress}>
          Progress: {completedInstructions.size}/{instructions.length}
        </Text>
      </View>

      <Camera
        style={styles.camera}
        device={device}
        frameProcessor={frameProcessor}
        isActive={isCameraActive}
      />

      <TouchableOpacity
        style={[
          styles.button,
          !isCameraActive && instruction === "Liveness Selesai"
            ? styles.successButton
            : null,
        ]}
        onPress={startLiveness}
        disabled={isCameraActive}
      >
        <Text style={styles.buttonText}>
          {instruction === "Liveness Selesai"
            ? "Selesai - Mulai Lagi"
            : isCameraActive
            ? "Sedang Berjalan..."
            : "Start Liveness"}
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
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 20,
  },
  instructionContainer: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instruction: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    color: "#333",
    marginBottom: 8,
  },
  progress: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  camera: {
    width: 300,
    height: 400,
    borderRadius: 12,
    marginBottom: 20,
    overflow: "hidden",
  },
  text: {
    fontSize: 18,
    color: "#333",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
    minWidth: 200,
  },
  successButton: {
    backgroundColor: "#34C759",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
