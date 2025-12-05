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

class FaceDetectorPlugin(proxy: VisionCameraProxy, options: Map<String, Any>?) : FrameProcessorPlugin() {

    private val detector = FaceDetection.getClient(
        FaceDetectorOptions.Builder()
            .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
            .setMinFaceSize(0.15f)
            .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
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
                        
                        // Kedua mata terbuka jika probability > 0.4
                        val bothEyesOpen = leftEyeOpenProb > 0.4f && rightEyeOpenProb > 0.4f
                        
                        // Senyum jika probability > 0.5
                        val isSmiling = smilingProb > 0.5f
                        
                        mapOf(
                            "faceCount" to 1,
                            "status" to "face_detected",
                            "eyesOpen" to bothEyesOpen,
                            "isSmiling" to isSmiling
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
}