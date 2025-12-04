import { Frame, VisionCameraProxy } from "react-native-vision-camera";

const plugin = VisionCameraProxy.initFrameProcessorPlugin("detectFaces", {});

export function detectFaces(frame: Frame) {
  "worklet";
  if (plugin == null) {
    throw new Error("Failed to load Frame Processor Plugin!");
  }
  return plugin.call(frame);
}
