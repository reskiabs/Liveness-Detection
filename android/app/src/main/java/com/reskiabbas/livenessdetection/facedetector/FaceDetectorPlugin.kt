package com.reskiabbas.livenessdetection.facedetector

import android.annotation.SuppressLint
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.VisionCameraProxy
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.math.abs

class FaceDetectorPlugin(proxy: VisionCameraProxy, options: Map<String, Any>?) : FrameProcessorPlugin() {

    private val detector = FaceDetection.getClient(
        FaceDetectorOptions.Builder()
            .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE)
            .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_ALL)
            .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
            .setContourMode(FaceDetectorOptions.CONTOUR_MODE_ALL)
            .setMinFaceSize(0.15f)
            .build()
    )
    
    private val isProcessing = AtomicBoolean(false)
    private val lastResult = AtomicReference<Any>(mapOf("faceCount" to 0))

    @SuppressLint("UnsafeOptInUsageError")
    override fun callback(frame: Frame, arguments: Map<String, Any>?): Any {
        if (isProcessing.get()) {
            return lastResult.get()
        }
        
        val image = frame.image ?: return lastResult.get()
        
        val inputImage = InputImage.fromMediaImage(image, 270)
        
        isProcessing.set(true)
        
        detector.process(inputImage)
            .addOnSuccessListener { faces ->
                val result = when {
                    faces.size > 1 -> mapOf(
                        "faceCount" to faces.size,
                        "status" to "duplicate_faces"
                    )
                    faces.size == 1 -> {
                        val face = faces[0]
                        
                        val leftEyeOpenProb = face.leftEyeOpenProbability ?: -1f
                        val rightEyeOpenProb = face.rightEyeOpenProbability ?: -1f
                        val smilingProb = face.smilingProbability ?: -1f
                        
                        val bothEyesOpen = leftEyeOpenProb > 0.4f && rightEyeOpenProb > 0.4f
                        val isSmiling = smilingProb > 0.5f
                        
                        // Face orientation
                        val eulerY = face.headEulerAngleY.toDouble()
                        val eulerZ = face.headEulerAngleZ.toDouble()
                        
                        val yaw = eulerY !in -15.0..15.0
                        val roll = eulerZ !in -15.0..15.0
                        
                        // Mouth open detection using contours
                        val isMouthOpen = detectMouthOpen(face)
                        
                        mapOf(
                            "faceCount" to 1,
                            "status" to "face_detected",
                            "eyesOpen" to bothEyesOpen,
                            "isSmiling" to isSmiling,
                            "yaw" to yaw,
                            "roll" to roll,
                            "isMouthOpen" to isMouthOpen
                        )
                    }
                    else -> mapOf(
                        "faceCount" to 0,
                        "status" to "no_face"
                    )
                }
                
                lastResult.set(result)
                isProcessing.set(false)
            }
            .addOnFailureListener { e ->
                isProcessing.set(false)
            }
        
        return lastResult.get()
    }
    
    private fun detectMouthOpen(face: com.google.mlkit.vision.face.Face): Boolean {
        // FaceContour constants dari dokumentasi
        val UPPER_LIP_BOTTOM = 10
        val LOWER_LIP_TOP = 11
        
        // Get mouth contours
        val upperLipBottom = face.getContour(UPPER_LIP_BOTTOM)?.points
        val lowerLipTop = face.getContour(LOWER_LIP_TOP)?.points
        
        if (upperLipBottom == null || lowerLipTop == null) {
            return false
        }
        
        if (upperLipBottom.isEmpty() || lowerLipTop.isEmpty()) {
            return false
        }
        
        // Calculate vertical distance between lips
        // Ambil titik tengah bibir atas dan bawah
        val upperLipCenterY = upperLipBottom[upperLipBottom.size / 2].y
        val lowerLipCenterY = lowerLipTop[lowerLipTop.size / 2].y
        
        val lipDistance = abs(lowerLipCenterY - upperLipCenterY)
        
        // Calculate face height untuk normalisasi
        val faceHeight = face.boundingBox.height()
        
        // Ratio mulut terbuka terhadap tinggi wajah
        val mouthOpenRatio = lipDistance / faceHeight
        
        // Threshold: jika ratio > 0.04 (4% dari tinggi wajah) = mulut terbuka
        return mouthOpenRatio > 0.04f
    }
}