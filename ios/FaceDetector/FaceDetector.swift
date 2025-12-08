import VisionCamera
import MLKitVision
import MLKitFaceDetection

@objc(FaceDetectorPlugin)
public class FaceDetectorPlugin: FrameProcessorPlugin {
    
    private let detector: FaceDetector
    private var isProcessing = false
    private var lastResult: [String: Any] = ["faceCount": 0]
    
    public override init(proxy: VisionCameraProxyHolder, options: [AnyHashable: Any]! = [:]) {
        // Configure ML Kit Face Detector options (same as Android)
        let detectorOptions = FaceDetectorOptions()
        detectorOptions.performanceMode = .accurate
        detectorOptions.landmarkMode = .all
        detectorOptions.classificationMode = .all
        detectorOptions.minFaceSize = 0.15
        
        self.detector = FaceDetector.faceDetector(options: detectorOptions)
        
        super.init(proxy: proxy, options: options)
    }
    
    public override func callback(_ frame: Frame, withArguments arguments: [AnyHashable: Any]?) -> Any? {
        // Skip if already processing
        if isProcessing {
            return lastResult
        }
        
        let buffer = frame.buffer
        let orientation = frame.orientation
        
        // Convert orientation to ML Kit format
        let imageOrientation = getImageOrientation(from: orientation)
        
        // Create VisionImage from buffer
        let visionImage = VisionImage(buffer: buffer)
        visionImage.orientation = imageOrientation
        
        // Start processing
        isProcessing = true
        
        // Process image with ML Kit Face Detector
        detector.process(visionImage) { [weak self] faces, error in
            guard let self = self else { return }
            
            if let error = error {
                print("Face detection error: \(error.localizedDescription)")
                self.isProcessing = false
                return
            }
            
            guard let faces = faces else {
                self.lastResult = ["faceCount": 0, "status": "no_face"]
                self.isProcessing = false
                return
            }
            
            let result = self.processFaces(faces)
            self.lastResult = result
            self.isProcessing = false
        }
        
        return lastResult
    }
    
    private func processFaces(_ faces: [Face]) -> [String: Any] {
        switch faces.count {
        case 0:
            return [
                "faceCount": 0,
                "status": "no_face"
            ]
            
        case 1:
            let face = faces[0]
            
            // Eye open probability (same as Android)
            let leftEyeOpenProb = face.hasLeftEyeOpenProbability ? face.leftEyeOpenProbability : -1.0
            let rightEyeOpenProb = face.hasRightEyeOpenProbability ? face.rightEyeOpenProbability : -1.0
            let smilingProb = face.hasSmilingProbability ? face.smilingProbability : -1.0
            
            let bothEyesOpen = leftEyeOpenProb > 0.4 && rightEyeOpenProb > 0.4
            let isSmiling = smilingProb > 0.5
            
            // Face orientation (same threshold as Android)
            let eulerY = Double(face.headEulerAngleY)
            let eulerZ = Double(face.headEulerAngleZ)
            
            // true = sedang menoleh/miring, false = lurus
            let yaw = eulerY < -15.0 || eulerY > 15.0  // true jika menoleh kiri/kanan
            let roll = eulerZ < -15.0 || eulerZ > 15.0 // true jika miring
            
            return [
                "faceCount": 1,
                "status": "face_detected",
                "eyesOpen": bothEyesOpen,
                "isSmiling": isSmiling,
                "yaw": yaw,
                "roll": roll
            ]
            
        default:
            return [
                "faceCount": faces.count,
                "status": "duplicate_faces"
            ]
        }
    }
    
    private func getImageOrientation(from orientation: UIImage.Orientation) -> UIImage.Orientation {
        // For camera frames, typically need to adjust orientation
        // ML Kit expects the orientation that makes the image upright
        switch orientation {
        case .up:
            return .up
        case .down:
            return .down
        case .left:
            return .left
        case .right:
            return .right
        case .upMirrored:
            return .upMirrored
        case .downMirrored:
            return .downMirrored
        case .leftMirrored:
            return .leftMirrored
        case .rightMirrored:
            return .rightMirrored
        @unknown default:
            return .up
        }
    }
}