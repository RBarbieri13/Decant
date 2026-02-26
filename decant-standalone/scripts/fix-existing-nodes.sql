-- Fix existing nodes with proper SEG, CAT, TYP classification codes
-- Run with: sqlite3 data/decant.db < scripts/fix-existing-nodes.sql

-- Anthropic SDK for Python -> AI, AI Agents (SDK/library), Repository
UPDATE nodes SET segment_code='A', category_code='LLM', content_type_code='R'
WHERE id='4ca949f5-3c53-4f12-afa8-3f5c55c3ed5f';

-- Wispr Flow -> AI, NLP (voice dictation), Tool
UPDATE nodes SET segment_code='A', category_code='NLP', content_type_code='T'
WHERE id='884e13b3-ecbf-4d37-9f5e-75f3068f3cc3';

-- ByteDance AI video battle -> AI, Generative AI, News
UPDATE nodes SET segment_code='A', category_code='GEN', content_type_code='N'
WHERE id='91fa82b2-8eab-48f0-b4e2-45592694ec6c';

-- Composer 1.5 (Cursor coding model) -> AI, AI Agents (coding), Tool
UPDATE nodes SET segment_code='A', category_code='AGT', content_type_code='T'
WHERE id='9b07db7a-242b-4243-b3e5-cf7f9db99ce8';

-- How to Use Kling 3.0 for AI Filmmaking -> AI, Generative AI, Video
UPDATE nodes SET segment_code='A', category_code='GEN', content_type_code='V'
WHERE id='aa6869fe-da8c-45b7-9320-970185329142';

-- ngram AI videos -> AI, Generative AI, Tool
UPDATE nodes SET segment_code='A', category_code='GEN', content_type_code='T'
WHERE id='6dfce6d4-932f-4284-a273-938a752fe129';

-- AI Timeline Maker -> AI, Other AI, Tool
UPDATE nodes SET segment_code='A', category_code='OTH', content_type_code='T'
WHERE id='fd8b84f6-e8d1-4475-8d5a-619c1a613de1';

-- Macaron AI Agent -> AI, AI Agents, Tool
UPDATE nodes SET segment_code='A', category_code='AGT', content_type_code='T'
WHERE id='37a29524-a069-402a-89f5-0f3490d36033';

-- Factory (Agent-Native Dev) -> AI, AI Agents, Service
UPDATE nodes SET segment_code='A', category_code='AGT', content_type_code='S'
WHERE id='7daf8b0e-0d27-4e05-8d98-550453f758eb';

-- Interface Craft -> Tech, Web Development, Tool
UPDATE nodes SET segment_code='T', category_code='WEB', content_type_code='T'
WHERE id='1f645223-ee1c-4756-970e-3c5617de7a29';

-- Qwen Chat blog -> AI, LLM, Article
UPDATE nodes SET segment_code='A', category_code='LLM', content_type_code='A'
WHERE id='3bc0c369-cf81-46fb-ad38-13a6afe396fd';

-- Qwen Image 2.0 video -> AI, Computer Vision, Video
UPDATE nodes SET segment_code='A', category_code='CVS', content_type_code='V'
WHERE id='bb96dcbf-d260-4014-885a-60676af8a34c';

-- SCMP China Economy -> Finance, Economics, News
UPDATE nodes SET segment_code='F', category_code='ECN', content_type_code='N'
WHERE id='80342e12-2fac-4f51-b1af-a5632d553d69';

-- Companion OS -> AI, AI Agents, Tool
UPDATE nodes SET segment_code='A', category_code='AGT', content_type_code='T'
WHERE id='dfb65f0f-a655-4b8b-a64b-6f770f8be161';

-- Devin -> AI, AI Agents, Service
UPDATE nodes SET segment_code='A', category_code='AGT', content_type_code='S'
WHERE id='8fc5c9ae-733a-4325-b27b-26b98a587653';

-- Update all timestamps
UPDATE nodes SET updated_at = datetime('now') WHERE is_deleted = 0;
