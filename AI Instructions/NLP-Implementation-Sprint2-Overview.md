# Sprint 2: Self-Learning Infrastructure (Days 4-7)

## Sprint Goal
Enhance the NLP system with sophisticated self-learning capabilities, achieving 90%+ accuracy through user feedback and continuous improvement.

## Sprint Overview

### Day 4: kNN Index & Embedding Infrastructure
- Implement kNN index with Supabase pgvector
- Set up embedding generation with @xenova/transformers
- Create similarity search for intent matching
- Build centroid management system

### Day 5: Advanced Learning Pipeline
- Real-time correction processing
- Batch learning system
- Pattern recognition from corrections
- Automated slot override learning

### Day 6: Learning Analytics & Optimization
- Comprehensive analytics dashboard
- Learning effectiveness metrics
- A/B testing framework
- Performance optimization

### Day 7: Integration & Validation
- Full system integration test
- Learning effectiveness validation
- Performance benchmarking
- Documentation and handoff

## Key Deliverables

1. **Embedding System**: Generate and store embeddings for all text
2. **kNN Search**: Find similar past queries for better accuracy
3. **Centroid Updates**: Online learning without retraining
4. **Pattern Learning**: Automatic discovery of slot patterns
5. **Analytics Dashboard**: Real-time learning metrics
6. **90% Accuracy**: Achieved through learning enhancements

## Technical Components

### Embedding Generation
```typescript
// Using @xenova/transformers for local embeddings
import { pipeline } from '@xenova/transformers';

const embedder = await pipeline(
  'feature-extraction',
  'Xenova/all-MiniLM-L6-v2'
);

const embedding = await embedder(text, {
  pooling: 'mean',
  normalize: true
});
```

### pgvector Setup
```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create embeddings table
CREATE TABLE intent_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  text TEXT NOT NULL,
  embedding vector(384) NOT NULL,
  intent TEXT NOT NULL,
  confidence FLOAT,
  source TEXT DEFAULT 'training',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for similarity search
CREATE INDEX ON intent_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### kNN Search Implementation
```typescript
// Find similar queries
async function findSimilar(embedding: number[], k: number = 5) {
  const { data } = await supabase.rpc('match_embeddings', {
    query_embedding: embedding,
    match_count: k,
    match_threshold: 0.7
  });
  
  return data;
}
```

### Centroid Learning
```typescript
// Update centroid with new example
function updateCentroid(
  currentCentroid: number[],
  newEmbedding: number[],
  sampleCount: number
): number[] {
  // Online mean update
  return currentCentroid.map((val, i) => 
    val + (newEmbedding[i] - val) / (sampleCount + 1)
  );
}
```

## Success Criteria

### Accuracy Targets
- Overall: ≥90% (from 85%)
- High-confidence predictions: ≥95%
- Correction rate: <10%
- Learning effectiveness: 15% improvement after 100 corrections

### Performance Targets
- Embedding generation: <100ms
- kNN search: <50ms
- Total classification: <300ms with embeddings
- Cache hit rate: >40%

### Learning Metrics
- Corrections applied immediately
- Patterns discovered automatically
- Centroids converge after 50 examples
- User satisfaction increases over time

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Embedding generation slow | Use caching, batch processing |
| pgvector not available | Fallback to in-memory search |
| Learning causes drift | Maintain confidence thresholds |
| Storage grows too large | Implement data retention policy |

## Dependencies

### Required Packages
```json
{
  "@xenova/transformers": "^2.6.0",
  "@supabase/supabase-js": "^2.39.1",
  "hnswlib-node": "^1.4.2"  // Fallback for local vector search
}
```

### Supabase Setup
- pgvector extension enabled
- RPC functions for similarity search
- Proper indexes on embedding columns

## Daily Breakdown

Each day has detailed instructions in separate files:
- `NLP-Implementation-Sprint2-Day4.md` - kNN & Embeddings
- `NLP-Implementation-Sprint2-Day5.md` - Learning Pipeline
- `NLP-Implementation-Sprint2-Day6.md` - Analytics & Optimization
- `NLP-Implementation-Sprint2-Day7.md` - Integration & Validation

## Integration Points

### With Sprint 1
- Enhances existing IntentService
- Builds on correction infrastructure
- Extends slot extraction with learned patterns

### For Sprint 3
- Prepares for TF.js model training
- Provides training data via embeddings
- Sets up A/B testing framework

## Team Coordination

### Backend Team
- Implement embedding service
- Set up pgvector in Supabase
- Create learning pipeline

### Mobile Team
- Enhance correction UI with confidence display
- Add learning preferences
- Show improvement notifications

### DevOps
- Monitor pgvector performance
- Set up backup for embeddings
- Implement data retention

## Sprint 2 Kickoff Checklist

- [ ] Sprint 1 complete with 85% accuracy
- [ ] Supabase pgvector extension enabled
- [ ] Team briefed on learning objectives
- [ ] @xenova/transformers tested locally
- [ ] Analytics requirements defined
- [ ] Performance baselines established