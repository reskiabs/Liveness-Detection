import VisionCamera
import Vision

@objc(FaceDetectorPlugin)
public class FaceDetectorPlugin: FrameProcessorPlugin {
    
    private var isProcessing = false
    private var lastResult: [String: Any] = ["faceCount": 0]
    
    public override init(proxy: VisionCameraProxyHolder, options: [AnyHashable: Any]! = [:]) {
        super.init(proxy: proxy, options: options)
    }
    
    public override func callback(_ frame: Frame, withArguments arguments: [AnyHashable: Any]?) -> Any? {
        // Skip if already processing
        if isProcessing {
            return lastResult
        }
        
        let buffer = frame.buffer
        let orientation = frame.orientation
        
        // Convert orientation
        let imageOrientation = getImageOrientation(from: orientation)
        
        // Start processing
        isProcessing = true
        
        // Create Vision request
        let request = VNDetectFaceLandmarksRequest { [weak self] request, error in
            guard let self = self else { return }
            
            if let error = error {
                print("Face detection error: \(error.localizedDescription)")
                self.isProcessing = false
                return
            }
            
            guard let observations = request.results as? [VNFaceObservation] else {
                self.lastResult = ["faceCount": 0, "status": "no_face"]
                self.isProcessing = false
                return
            }
            
            let result = self.processFaceObservations(observations)
            self.lastResult = result
            self.isProcessing = false
        }
        
        // Configure request
        request.revision = VNDetectFaceLandmarksRequestRevision3
        
        // Perform request
        let handler = VNImageRequestHandler(cvPixelBuffer: buffer, orientation: imageOrientation, options: [:])
        
        do {
            try handler.perform([request])
        } catch {
            print("Failed to perform face detection: \(error.localizedDescription)")
            isProcessing = false
        }
        
        return lastResult
    }
    
    private func processFaceObservations(_ observations: [VNFaceObservation]) -> [String: Any] {
        switch observations.count {
        case 0:
            return [
                "faceCount": 0,
                "status": "no_face"
            ]
            
        case 1:
            let face = observations[0]
            
            // Eye detection
            let leftEyeOpen = isEyeOpen(face.landmarks?.leftEye)
            let rightEyeOpen = isEyeOpen(face.landmarks?.rightEye)
            let bothEyesOpen = leftEyeOpen && rightEyeOpen
            
            // Smile detection (approximate using mouth landmarks)
            let isSmiling = detectSmile(face)
            
            // Face orientation (yaw and roll)
            let yaw = abs(face.yaw?.doubleValue ?? 0.0) > 0.26 // ~15 degrees in radians
            let roll = abs(face.roll?.doubleValue ?? 0.0) > 0.26 // ~15 degrees in radians
            
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
                "faceCount": observations.count,
                "status": "duplicate_faces"
            ]
        }
    }
    
    private func isEyeOpen(_ eye: VNFaceLandmarkRegion2D?) -> Bool {
        guard let eye = eye else { return false }
        
        // Calculate eye aspect ratio (EAR)
        let points = eye.normalizedPoints
        if points.count < 6 { return false }
        
        // Simple heuristic: if eye landmarks are detected, assume eye is open
        // More sophisticated: calculate vertical vs horizontal distance
        let topPoint = points[1]
        let bottomPoint = points[4]
        let leftPoint = points[0]
        let rightPoint = points[3]
        
        let verticalDist = abs(topPoint.y - bottomPoint.y)
        let horizontalDist = abs(rightPoint.x - leftPoint.x)
        
        let ear = verticalDist / horizontalDist
        
        // Threshold: eye is open if EAR > 0.2
        return ear > 0.2
    }
    
    private func detectSmile(_ face: VNFaceObservation) -> Bool {
        guard let outerLips = face.landmarks?.outerLips else { return false }
        
        let points = outerLips.normalizedPoints
        if points.count < 8 { return false }
        
        // Calculate mouth width vs height ratio
        // A smile typically has a wider mouth
        let leftCorner = points[0]
        let rightCorner = points[points.count / 2]
        let topLip = points[points.count / 4]
        let bottomLip = points[3 * points.count / 4]
        
        let width = abs(rightCorner.x - leftCorner.x)
        let height = abs(topLip.y - bottomLip.y)
        
        let ratio = width / height
        
        // Threshold: smiling if ratio > 3.0
        return ratio > 3.0
    }
    
    private func getImageOrientation(from orientation: UIImage.Orientation) -> CGImagePropertyOrientation {
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