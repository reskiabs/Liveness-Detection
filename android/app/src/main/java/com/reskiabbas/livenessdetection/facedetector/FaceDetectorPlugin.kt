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
            .build()
    )
    
    private val isProcessing = AtomicBoolean(false)
    private val lastResult = AtomicReference<Any>(0)

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
                    faces.size > 1 -> "duplicate_faces"
                    else -> faces.size
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