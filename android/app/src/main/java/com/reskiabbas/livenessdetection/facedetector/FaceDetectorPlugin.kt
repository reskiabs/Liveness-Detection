package com.reskiabbas.livenessdetection.facedetector

import android.annotation.SuppressLint
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.google.mlkit.vision.face.FaceLandmark
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
            // HAPUS CONTOUR_MODE_ALL - terlalu berat!
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
                        
                        // Mouth open detection using landmarks (LEBIH RINGAN!)
                        val isMouthOpen = detectMouthOpenWithLandmarks(face)
                        
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
    
    private fun detectMouthOpenWithLandmarks(face: com.google.mlkit.vision.face.Face): Boolean {
        // Get mouth landmarks
        val mouthBottom = face.getLandmark(FaceLandmark.MOUTH_BOTTOM)?.position
        val mouthLeft = face.getLandmark(FaceLandmark.MOUTH_LEFT)?.position
        val mouthRight = face.getLandmark(FaceLandmark.MOUTH_RIGHT)?.position
        
        if (mouthBottom == null || mouthLeft == null || mouthRight == null) {
            return false
        }
        
        // Hitung lebar mulut (horizontal distance)
        val mouthWidth = abs(mouthRight.x - mouthLeft.x)
        
        // Hitung tinggi mulut dari rata-rata posisi corner ke bottom
        val mouthTopY = (mouthLeft.y + mouthRight.y) / 2
        val mouthHeight = abs(mouthBottom.y - mouthTopY)
        
        // Ratio tinggi/lebar mulut
        // Mulut tertutup: ratio kecil (mulut horizontal)
        // Mulut terbuka: ratio besar (mulut vertical juga terbuka)
        val mouthAspectRatio = mouthHeight / mouthWidth
        
        // Threshold: ratio > 0.5 = mulut terbuka
        return mouthAspectRatio > 0.5f
    }
}