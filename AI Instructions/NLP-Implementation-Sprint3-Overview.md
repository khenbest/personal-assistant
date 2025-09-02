# Sprint 3: Advanced ML Integration (Week 2)

## Sprint Goal
Integrate TensorFlow.js or ONNX Runtime for on-device intent classification, achieving 95%+ accuracy with <100ms inference time.

## Sprint Overview

### Day 8-9: TF.js Integration
- Set up TensorFlow.js in React Native
- Create model training pipeline
- Convert embeddings to TF.js format
- Implement on-device inference

### Day 10-11: Model Training & Optimization
- Train classifier on collected data
- Implement quantization for mobile
- A/B test TF.js vs LLM performance
- Optimize for battery efficiency

### Day 12-13: Advanced Features
- Multi-intent support
- Confidence calibration
- Context awareness
- Proactive suggestions

### Day 14: Production Readiness
- Final validation and benchmarking
- Documentation and deployment guide
- Handoff to production team

## Key Deliverables

1. **TF.js Model**: Trained and optimized for mobile
2. **95% Accuracy**: Through ML model + learning
3. **<100ms Inference**: On-device classification
4. **Multi-Intent**: Handle compound requests
5. **Production Ready**: Fully tested and documented

## Technical Architecture

### TF.js Setup for React Native
```typescript
// packages/mobile/src/services/tfjs-classifier.ts
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import '@tensorflow/tfjs-react-native-gpu'; // For GPU acceleration

export class TFJSClassifier {
  private model: tf.LayersModel | null = null;
  private tokenizer: any;
  
  async initialize() {
    // Wait for TensorFlow.js to initialize
    await tf.ready();
    
    // Load model from bundle or URL
    this.model = await tf.loadLayersModel(
      bundleResourceIO(modelJson, modelWeights)
    );
    
    // Warm up the model
    const dummy = tf.zeros([1, 384]);
    await this.model.predict(dummy).data();
    dummy.dispose();
  }
  
  async classify(text: string): Promise<IntentResult> {
    if (!this.model) throw new Error('Model not loaded');
    
    // Get embedding (from cache or generate)
    const embedding = await this.getEmbedding(text);
    
    // Run inference
    const input = tf.tensor2d([embedding]);
    const prediction = this.model.predict(input) as tf.Tensor;
    
    // Get probabilities
    const probs = await prediction.data();
    const maxProb = Math.max(...probs);
    const intentIdx = probs.indexOf(maxProb);
    
    // Clean up tensors
    input.dispose();
    prediction.dispose();
    
    return {
      intent: INTENT_LABELS[intentIdx],
      confidence: maxProb,
      slots: {} // Slots still extracted separately
    };
  }
}
```

### Model Training Pipeline
```python
# packages/backend/scripts/train_model.py
import tensorflow as tf
from tensorflow import keras
import numpy as np
import pandas as pd

def create_model(input_dim=384, num_classes=6):
    """Create a simple but effective classifier"""
    model = keras.Sequential([
        keras.layers.Input(shape=(input_dim,)),
        keras.layers.Dense(128, activation='relu'),
        keras.layers.Dropout(0.3),
        keras.layers.Dense(64, activation='relu'),
        keras.layers.Dropout(0.2),
        keras.layers.Dense(num_classes, activation='softmax')
    ])
    
    model.compile(
        optimizer='adam',
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )
    
    return model

# Train on embeddings from Sprint 2
embeddings = load_embeddings_from_supabase()
X = embeddings['embedding'].values
y = pd.get_dummies(embeddings['intent']).values

model = create_model()
model.fit(X, y, epochs=50, validation_split=0.2)

# Convert to TensorFlow.js
import tensorflowjs as tfjs
tfjs.converters.save_keras_model(model, 'tfjs_model')
```

### ONNX Alternative
```typescript
// For better performance, use ONNX Runtime
import { InferenceSession } from 'onnxruntime-react-native';

export class ONNXClassifier {
  private session: InferenceSession | null = null;
  
  async initialize() {
    // Load ONNX model
    this.session = await InferenceSession.create(
      './assets/intent_model.onnx'
    );
  }
  
  async classify(text: string): Promise<IntentResult> {
    const embedding = await this.getEmbedding(text);
    
    // Create input tensor
    const input = new Float32Array(embedding);
    const feeds = { input: new Tensor('float32', input, [1, 384]) };
    
    // Run inference
    const results = await this.session!.run(feeds);
    const output = results.output.data as Float32Array;
    
    // Get prediction
    const maxIdx = output.indexOf(Math.max(...output));
    
    return {
      intent: INTENT_LABELS[maxIdx],
      confidence: output[maxIdx],
      slots: {}
    };
  }
}
```

## Model Optimization Strategies

### Quantization for Mobile
```javascript
// Reduce model size by 75% with minimal accuracy loss
async function quantizeModel(model) {
  const quantizedModel = await tf.quantization.quantize(
    model,
    {
      inputRange: [0, 1],
      outputRange: [0, 1]
    }
  );
  
  // Save quantized model
  await quantizedModel.save('indexeddb://quantized-intent-model');
  
  return quantizedModel;
}
```

### Caching Strategy
```typescript
class ModelCache {
  private embeddingCache = new Map<string, Float32Array>();
  private resultCache = new Map<string, IntentResult>();
  
  async getEmbedding(text: string): Promise<Float32Array> {
    const cached = this.embeddingCache.get(text.toLowerCase());
    if (cached) return cached;
    
    // Generate embedding
    const embedding = await generateEmbedding(text);
    
    // Cache with size limit
    if (this.embeddingCache.size > 1000) {
      const firstKey = this.embeddingCache.keys().next().value;
      this.embeddingCache.delete(firstKey);
    }
    
    this.embeddingCache.set(text.toLowerCase(), embedding);
    return embedding;
  }
}
```

## Advanced Features

### Multi-Intent Support
```typescript
// Handle compound requests like "Schedule meeting and remind me to prepare"
async function classifyMultiIntent(text: string): Promise<IntentResult[]> {
  // Split by conjunctions
  const segments = text.split(/\s+and\s+|\s+then\s+|\s+also\s+/i);
  
  const results: IntentResult[] = [];
  for (const segment of segments) {
    const intent = await classifier.classify(segment);
    if (intent.confidence > 0.6) {
      results.push(intent);
    }
  }
  
  return results;
}
```

### Context Awareness
```typescript
interface ContextualIntent {
  intent: string;
  confidence: number;
  slots: any;
  context: {
    previousIntent?: string;
    timeOfDay: string;
    location?: string;
    userPreferences: any;
  };
}

// Use context to improve accuracy
function applyContext(intent: IntentResult, context: any): ContextualIntent {
  // Boost confidence based on patterns
  if (context.timeOfDay === 'morning' && intent.intent === 'create_event') {
    intent.confidence *= 1.1; // Morning bias for scheduling
  }
  
  // Apply user preferences
  if (context.userPreferences.defaultMeetingDuration) {
    intent.slots.duration_min = context.userPreferences.defaultMeetingDuration;
  }
  
  return { ...intent, context };
}
```

## Performance Benchmarks

### Target Metrics
| Metric | LLM Baseline | TF.js Target | ONNX Target |
|--------|--------------|--------------|-------------|
| Accuracy | 85% | 93% | 95% |
| Inference Time | 300-500ms | <100ms | <50ms |
| Model Size | N/A | <5MB | <2MB |
| Battery Impact | Medium | Low | Very Low |
| Offline Capable | No | Yes | Yes |

### A/B Testing Framework
```typescript
class ABTestClassifier {
  async classify(text: string): Promise<IntentResult> {
    const variant = this.getVariant(text);
    
    let result: IntentResult;
    const startTime = Date.now();
    
    switch (variant) {
      case 'A': // LLM
        result = await this.llmClassify(text);
        break;
      case 'B': // TF.js
        result = await this.tfjsClassify(text);
        break;
      case 'C': // ONNX
        result = await this.onnxClassify(text);
        break;
    }
    
    // Log metrics
    await this.logMetrics({
      variant,
      latency: Date.now() - startTime,
      confidence: result.confidence,
      intent: result.intent
    });
    
    return result;
  }
}
```

## Production Deployment

### Model Versioning
```typescript
interface ModelVersion {
  version: string;
  accuracy: number;
  size: number;
  createdAt: Date;
  changelog: string[];
}

class ModelManager {
  async checkForUpdates(): Promise<ModelVersion | null> {
    const current = await this.getCurrentVersion();
    const latest = await this.fetchLatestVersion();
    
    if (latest.version > current.version) {
      return latest;
    }
    
    return null;
  }
  
  async updateModel(version: ModelVersion): Promise<void> {
    // Download new model
    const modelData = await this.downloadModel(version);
    
    // Validate accuracy before switching
    const testAccuracy = await this.validateModel(modelData);
    if (testAccuracy < version.accuracy * 0.95) {
      throw new Error('Model validation failed');
    }
    
    // Atomic switch
    await this.swapModel(modelData);
  }
}
```

## Success Criteria

### Must Have
- [ ] 95% accuracy on test set
- [ ] <100ms inference time
- [ ] Model size <5MB
- [ ] Offline capability
- [ ] Graceful fallback to LLM

### Nice to Have
- [ ] Multi-intent support
- [ ] Context awareness
- [ ] Voice activation
- [ ] Proactive suggestions
- [ ] Cross-platform model sharing

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Model accuracy drops | High | A/B test, gradual rollout |
| Large model size | Medium | Quantization, pruning |
| Battery drain | High | Optimize inference, batch |
| Compatibility issues | Medium | Fallback to LLM |
| Training data bias | High | Diverse data, monitoring |

## Sprint 3 Complete Checklist

- [ ] TF.js or ONNX integrated
- [ ] 95% accuracy achieved
- [ ] <100ms inference time
- [ ] Model size <5MB
- [ ] A/B testing complete
- [ ] Documentation updated
- [ ] Production deployment guide
- [ ] Team handoff complete

## Next Steps After Sprint 3

1. **Continuous Learning**: Implement federated learning
2. **Multi-Language**: Support Spanish, French, etc.
3. **Advanced NLU**: Sentiment, emotion detection
4. **Voice Enhancement**: Wake word, continuous listening
5. **Expansion**: Add 10+ new intents