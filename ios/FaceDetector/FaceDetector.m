#import <VisionCamera/FrameProcessorPlugin.h>
#import <VisionCamera/FrameProcessorPluginRegistry.h>

#if __has_include("livenessdetection/livenessdetection-Swift.h")
#import "livenessdetection/livenessdetection-Swift.h"
#else
#import "livenessdetection-Swift.h"
#endif

VISION_EXPORT_SWIFT_FRAME_PROCESSOR(FaceDetectorPlugin, detectFaces)