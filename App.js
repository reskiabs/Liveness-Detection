import { useRef, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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

  // Camera ref untuk recording dan photo
  const cameraRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [videoPath, setVideoPath] = useState(null);
  const [photoPath, setPhotoPath] = useState(null);

  // Track completed instructions
  const completedInstructions = useRef(new Set());
  const [completedCount, setCompletedCount] = useState(0);
  const currentTask = useRef(null);
  const isTaskCompleted = useRef(false);

  // All available instructions
  const instructions = useRef([
    { id: "blink", text: "Kedipkan mata Anda" },
    { id: "smile", text: "Tersenyum" },
    { id: "yaw", text: "Tolehkan kepala" },
    { id: "roll", text: "Miringkan kepala" },
  ]).current;

  // Shuffle and get next instruction
  const getNextInstruction = async () => {
    const remaining = instructions.filter(
      (inst) => !completedInstructions.current.has(inst.id)
    );

    if (remaining.length === 0) {
      // All completed - stop recording and take photo
      await stopRecordingAndTakePhoto();
      return;
    }

    // Random instruction from remaining
    const randomIndex = Math.floor(Math.random() * remaining.length);
    const nextTask = remaining[randomIndex];

    currentTask.current = nextTask;
    setInstruction(nextTask.text);
    isTaskCompleted.current = false;
  };

  // Start recording video
  const startRecording = async () => {
    if (!cameraRef.current) return;

    try {
      setIsRecording(true);
      cameraRef.current.startRecording({
        onRecordingFinished: (video) => {
          console.log("Video saved to:", video.path);
          setVideoPath(video.path);
          setIsRecording(false);
        },
        onRecordingError: (error) => {
          console.error("Recording error:", error);
          setIsRecording(false);
        },
      });
    } catch (error) {
      console.error("Failed to start recording:", error);
      setIsRecording(false);
    }
  };

  // Stop recording and take photo
  const stopRecordingAndTakePhoto = async () => {
    if (!cameraRef.current) return;

    try {
      // Stop recording
      if (isRecording) {
        await cameraRef.current.stopRecording();
      }

      // Take photo
      const photo = await cameraRef.current.takePhoto({
        qualityPrioritization: "balanced",
      });

      console.log("Photo saved to:", photo.path);
      setPhotoPath(photo.path);

      // Update UI
      setInstruction("Liveness Selesai");
      setIsCameraActive(false);
      currentTask.current = null;

      // Show success message
      Alert.alert(
        "Liveness Selesai",
        `Video: ${videoPath}\nPhoto: ${photo.path}`,
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("Failed to stop recording or take photo:", error);
    }
  };

  // Start liveness detection
  const startLiveness = async () => {
    completedInstructions.current = new Set();
    setCompletedCount(0);
    setIsCameraActive(true);
    isTaskCompleted.current = false;
    setVideoPath(null);
    setPhotoPath(null);

    // Delay to ensure camera is active, then start recording
    setTimeout(async () => {
      await startRecording();
      getNextInstruction();
    }, 500);
  };

  // Worklet to check task completion
  const onTaskCompleted = Worklets.createRunOnJS((taskId) => {
    if (isTaskCompleted.current) return;

    isTaskCompleted.current = true;
    completedInstructions.current.add(taskId);
    setCompletedCount(completedInstructions.current.size);

    // Move to next instruction after delay
    setTimeout(() => {
      getNextInstruction();
    }, 1000);
  });

  const frameProcessor = useFrameProcessor((frame) => {
    "worklet";
    const result = detectFaces(frame);

    if (result.status === "duplicate_faces") {
      return;
    }

    if (result.status === "face_detected" && currentTask.current) {
      const taskId = currentTask.current.id;

      if (isTaskCompleted.current) return;

      let completed = false;

      switch (taskId) {
        case "blink":
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
      }

      if (completed) {
        onTaskCompleted(taskId);
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
      <View style={styles.instructionContainer}>
        <Text style={styles.instruction}>{instruction}</Text>
        <Text style={styles.progress}>
          Progress: {completedCount}/{instructions.length}
        </Text>
        {isRecording && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>Recording...</Text>
          </View>
        )}
      </View>

      <Camera
        ref={cameraRef}
        style={styles.camera}
        device={device}
        frameProcessor={frameProcessor}
        isActive={isCameraActive}
        video={true} // Enable video recording
        photo={true} // Enable photo capture
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
            ? "✅ Selesai - Mulai Lagi"
            : isCameraActive
            ? "Sedang Berjalan..."
            : "Start Liveness"}
        </Text>
      </TouchableOpacity>

      {/* Display results */}
      {videoPath && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultText}>Video: {videoPath}</Text>
        </View>
      )}
      {photoPath && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultText}>Photo: {photoPath}</Text>
        </View>
      )}
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
  recordingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FF3B30",
    marginRight: 8,
  },
  recordingText: {
    fontSize: 14,
    color: "#FF3B30",
    fontWeight: "600",
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
  resultContainer: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    maxWidth: 400,
  },
  resultText: {
    fontSize: 12,
    color: "#666",
  },
});
