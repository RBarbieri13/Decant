# DECANT: Complete Master Specification
## The Definitive Technical Guide for AI-Powered Knowledge Base System

**Version:** 2.0 (Unified)  
**Last Updated:** January 19, 2026  
**Purpose:** SINGLE SOURCE OF TRUTH - Complete technical specification combining all design decisions, hierarchy systems, database schemas, UI requirements, and implementation details.

---

> ⚠️ **CRITICAL DOCUMENT**
> 
> This document is the ONLY authoritative specification for the Decant application. 
> If your computer catches fire, this document alone should be sufficient to rebuild 
> the entire application from scratch.

---

# Master Table of Contents

## Part I: Product Specification (Sections 1-15)
Original comprehensive developer implementation guide covering all system design.

1. [System Overview](#1-system-overview)
2. [Core Architecture](#2-core-architecture)
3. [Function-Based Hierarchy System](#3-function-based-hierarchy-system)
4. [Organization-Based Hierarchy System](#4-organization-based-hierarchy-system)
5. [Hierarchy Coding Systems](#5-hierarchy-coding-systems)
6. [Metadata Coding System](#6-metadata-coding-system)
7. [Descriptor Fields & Strings](#7-descriptor-fields--strings)
8. [Processing Phases](#8-processing-phases)
9. [Database Schema](#9-database-schema)
10. [AI Classification Logic](#10-ai-classification-logic)
11. [Node Association & Similarity](#11-node-association--similarity)
12. [User Interface Requirements](#12-user-interface-requirements)
13. [API Specifications](#13-api-specifications)
14. [Edge Cases & Error Handling](#14-edge-cases--error-handling)
15. [Testing Requirements](#15-testing-requirements)

## Part II: Implementation Specification (Sections 16-25)
Standalone Electron implementation details, tech stack, and build instructions.

16. [Architecture Decision: Standalone Electron](#16-architecture-decision-standalone-electron)
17. [Tech Stack (Research-Validated)](#17-tech-stack-research-validated)
18. [User Requirements Summary](#18-user-requirements-summary)
19. [Directory Structure](#19-directory-structure)
20. [IPC Communication Pattern](#20-ipc-communication-pattern)
21. [Gumroad Design System](#21-gumroad-design-system)
22. [Implementation Phases](#22-implementation-phases)
23. [File Creation Order](#23-file-creation-order)
24. [Dependencies](#24-dependencies)
25. [Verification Checklists](#25-verification-checklists)

## Part III: Operational Reference (Sections 26-28)
Environment setup, risk mitigation, and operational notes.

26. [Environment Variables](#26-environment-variables)
27. [Risk Mitigation](#27-risk-mitigation)
28. [Running the Project](#28-running-the-project)

---

# PART I: PRODUCT SPECIFICATION

---

# Decant Knowledge Base Hierarchy System
## Comprehensive Developer Implementation Guide

**Version:** 1.0  
**Last Updated:** January 18, 2026  
**Purpose:** Complete technical specification for implementing the Decant auto-hierarchy knowledge base system

---

# Table of Contents

1. [System Overview](#1-system-overview)
2. [Core Architecture](#2-core-architecture)
3. [Function-Based Hierarchy System](#3-function-based-hierarchy-system)
4. [Organization-Based Hierarchy System](#4-organization-based-hierarchy-system)
5. [Hierarchy Coding Systems](#5-hierarchy-coding-systems)
6. [Metadata Coding System](#6-metadata-coding-system)
7. [Descriptor Fields & Strings](#7-descriptor-fields--strings)
8. [Processing Phases](#8-processing-phases)
9. [Database Schema](#9-database-schema)
10. [AI Classification Logic](#10-ai-classification-logic)
11. [Node Association & Similarity](#11-node-association--similarity)
12. [User Interface Requirements](#12-user-interface-requirements)
13. [API Specifications](#13-api-specifications)
14. [Edge Cases & Error Handling](#14-edge-cases--error-handling)
15. [Testing Requirements](#15-testing-requirements)

---

# 1. System Overview

## 1.1 What is Decant?

Decant is an intelligent knowledge base application that automatically organizes online content using AI-powered hierarchical classification. When a user imports a URL (article, video, tool, repository, etc.), the system:

1. **Extracts** metadata and content attributes from the source
2. **Classifies** the content into a dynamic hierarchy
3. **Positions** the node in its logical organizational spot
4. **Associates** the node with related content via metadata codes
5. **Generates** rich descriptors for search and discovery

## 1.2 Core Value Proposition

- **No Manual Filing:** AI handles the cognitive load of organization
- **Dynamic Hierarchy:** Structure evolves based on content
- **Dual View Modes:** Function-based OR Organization-based hierarchy
- **Unique Positioning:** Every node has a unique hierarchical address
- **Rich Association:** Metadata codes enable cross-hierarchy relationships

## 1.3 Key Terminology

| Term | Definition |
|------|------------|
| **Node** | A single piece of content in the knowledge base (one URL import) |
| **Hierarchy Code** | Unique address indicating WHERE a node lives in the tree |
| **Metadata Code** | Tag indicating WHAT a node relates to (for associations) |
| **Descriptor** | Rich metadata field describing the node's content |
| **Descriptor String** | Concatenated text of all descriptors for search |
| **Segment** | Broadest classification (AI, Technology, Sports, etc.) |
| **Category** | Specific topic within a segment (LLMs, Agents, DFS, etc.) |
| **Content Type** | Format/medium of the content (video, article, tool, etc.) |
| **Subcategory** | Dynamic differentiator to ensure unique positioning |

## 1.4 System Architecture Overview

```
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
â                           USER INTERFACE                                â
â  âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ   â
â  â  [Function View] âââââ TOGGLE âââââ [Organization View]         â   â
â  âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ   â
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
                                    â
                                    â¼
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
â                         IMPORT PIPELINE                                 â
â  ââââââââââââââââ    ââââââââââââââââ    ââââââââââââââââââââââââââââ  â
â  â URL Input    âââââ¶â Phase 1 AI   âââââ¶â Hierarchy Classification â  â
â  â              â    â (Immediate)  â    â + Code Generation        â  â
â  ââââââââââââââââ    ââââââââââââââââ    ââââââââââââââââââââââââââââ  â
â                                                      â                  â
â                                                      â¼                  â
â                      ââââââââââââââââ    ââââââââââââââââââââââââââââ  â
â                      â Phase 2 AI   ââââââ Node Stored in DB        â  â
â                      â (Background) â    â (Hierarchy Complete)     â  â
â                      ââââââââââââââââ    ââââââââââââââââââââââââââââ  â
â                              â                                          â
â                              â¼                                          â
â                      ââââââââââââââââââââââââââââââââââââââââââââââââ  â
â                      â Descriptors + Metadata Codes Generated       â  â
â                      â Descriptor String Created                    â  â
â                      â Similarity Associations Computed             â  â
â                      ââââââââââââââââââââââââââââââââââââââââââââââââ  â
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
                                    â
                                    â¼
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
â                         PERSISTENT DATABASE                             â
â  âââââââââââââââââââââââ  âââââââââââââââââââââââ                      â
â  â Function Hierarchy  â  â Organization        â                      â
â  â Database            â  â Hierarchy Database  â                      â
â  âââââââââââââââââââââââ  âââââââââââââââââââââââ                      â
â                                                                         â
â  âââââââââââââââââââââââ  âââââââââââââââââââââââ                      â
â  â Metadata Codes      â  â Node Associations   â                      â
â  â Registry            â  â Graph               â                      â
â  âââââââââââââââââââââââ  âââââââââââââââââââââââ                      â
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
```

---

# 2. Core Architecture

## 2.1 Dual Hierarchy System

The application maintains TWO separate but linked hierarchy systems:

### 2.1.1 Function-Based Hierarchy
- Organized by WHAT the content is about
- Primary organizational structure
- Levels: Segment â Category â Content Type â Subcategories

### 2.1.2 Organization-Based Hierarchy
- Organized by WHO created/owns the content
- Alternative view of the same nodes
- Levels: Organization â Category â Content Type â Subcategories

**Critical Implementation Note:** Both hierarchies reference the SAME underlying nodes. When a node is imported, it receives codes for BOTH hierarchies simultaneously. The UI toggle switches between views instantly without recalculation.

## 2.2 Two-Phase Processing Model

### Phase 1: On Import (Immediate - Front-End AI)
**Timing:** Synchronous, blocks until complete  
**Purpose:** Place node in hierarchy immediately so user sees result

Fields generated:
- Segment (Function view)
- Organization (Organization view)
- Category
- Content Type
- All Subcategories needed for uniqueness
- Hierarchy Codes (both views)
- URL (captured verbatim)
- Date Added (timestamp)

### Phase 2: Idle Time (Background - Async AI)
**Timing:** Asynchronous, runs when system is idle  
**Purpose:** Enrich node with detailed metadata for search and association

Fields generated:
- Title
- Source Domain
- Company/Organization (detailed)
- Phrase Description
- Short Description (1-3 sentences)
- Logo URL
- Key Concepts (tags)
- All Metadata Codes
- Descriptor String (concatenated)

## 2.3 Core Rules (MUST BE ENFORCED)

### Rule 1: Minimum Depth
```
The hierarchy ALWAYS descends to at least the Category level, 
even if there is only ONE node in that segment.

CORRECT:
  AI (1 node) â LLMs (1 node) â [node placed here]

INCORRECT:
  AI (1 node) â [node placed here - TOO SHALLOW]
```

### Rule 2: Unique Positioning
```
NO two nodes may exist in the same bottom-level position.
The hierarchy must branch with subcategories until each node 
occupies a UNIQUE terminal position.

CORRECT:
  LLMs â Tool â Claude â Opus 4.5 [Node A]
  LLMs â Tool â Claude â Sonnet 4.5 [Node B]

INCORRECT:
  LLMs â Tool â Claude [Node A AND Node B] â VIOLATION
```

### Rule 3: Differentiation-Based Subcategories
```
Subcategories exist ONLY to differentiate nodes that share 
the same parent. The AI must identify WHAT makes nodes 
DIFFERENT, not classify them by shared attributes.

WRONG THINKING:
  "Both are frontier models, so Subcategory = 'Frontier Model'"
  (This doesn't split them!)

RIGHT THINKING:
  "Both are frontier models. What differentiates them? 
   One is Claude, one is GPT. Subcategory = company/brand."

EXAMPLE:
  Category: LLMs
  Nodes: Claude Opus 4.5, GPT-5.2
  
  Both are: Frontier, Multimodal, Commercial, API-based
  
  â Subcategory 1 = "Frontier Model" â WRONG (doesn't split)
  â Subcategory 1 = "Multimodal" â WRONG (doesn't split)
  â Subcategory 1 = "Commercial" â WRONG (doesn't split)
  â Subcategory 1 = "Claude" vs "GPT" â CORRECT (splits them)
```

### Rule 4: Dynamic Code Mutability
```
Hierarchy codes MAY CHANGE when new nodes are imported that 
require restructuring of existing branches.

SCENARIO:
  Before: Single Llama article exists
    Code: A.LLM.A1
  
  After: Second Llama article (different version) imported
    Old node: A.LLM.A1.1 (Llama 4)
    New node: A.LLM.A1.2 (Llama 3.3)
  
The system must update existing node codes when branching occurs.
```

---

# 3. Function-Based Hierarchy System

## 3.1 Hierarchy Levels

| Level | Name | Required | Description |
|-------|------|----------|-------------|
| 1 | **Segment** | Always | Broadest domain/industry classification |
| 2 | **Category** | Always | Specific topic within the segment |
| 3 | **Content Type** | Always | Format/medium of the content |
| 4 | **Subcategory 1** | If needed | First differentiator |
| 5 | **Subcategory 2** | If needed | Second differentiator |
| n | **Subcategory n** | If needed | Continues until unique |

## 3.2 Level 1: Segment

### Definition
The broadest classification representing the industry, domain, or major interest area of the content.

### Segment Registry

| Code | Segment Name | Description | Example Content |
|------|--------------|-------------|-----------------|
| A | AI | Artificial intelligence, machine learning, LLMs, neural networks | ChatGPT, ML papers, agent frameworks |
| T | Technology | Software, hardware, development tools, general tech | React tutorials, laptop reviews, GitHub repos |
| F | Finance | Money, investing, FP&A, accounting, economics | Budget templates, stock analysis, forecasting tools |
| S | Sports | Football, basketball, fantasy sports, athletics | DFS strategy, player rankings, game recaps |
| H | Health | Medical, wellness, fitness, accessibility, caregiving | Adaptive equipment, workout guides, medical research |
| B | Business | Strategy, operations, management, entrepreneurship | Productivity systems, business plans, leadership |
| E | Entertainment | Media, gaming, music, movies, streaming | Game reviews, album releases, movie analysis |
| L | Lifestyle | Home, fashion, food, travel, personal | Smart home guides, recipes, travel blogs |
| X | Science | Research, academia, natural sciences, physics, biology | Academic papers, experiments, discoveries |
| C | Creative | Design, art, writing, content creation | Design tools, writing guides, creative tutorials |

### Segment Assignment Rules
1. AI should determine segment based on PRIMARY purpose of content
2. If content spans multiple segments, choose the DOMINANT one
3. Metadata codes will capture secondary segment associations

### Adding New Segments
- System should support dynamic segment addition
- New segments require: Code (single uppercase letter), Name, Description
- Check for code collision before adding
- Reserve letters Q, Z for future use

## 3.3 Level 2: Category

### Definition
The specific topic, technology, or focus area within a segment. Categories are more granular than segments but still represent a coherent subject area.

### Category Registry (Initial Set)

#### AI Segment (A) Categories
| Code | Category Name | Description |
|------|---------------|-------------|
| LLM | Large Language Models | ChatGPT, Claude, Llama, text generation models |
| AGT | Agents | Autonomous AI agents, multi-agent systems, agent frameworks |
| PMP | Prompting | Prompt engineering, jailbreaks, prompt optimization |
| RAG | Retrieval Augmented Generation | Vector databases, embeddings, retrieval systems |
| FTN | Fine-tuning | Model training, LoRA, PEFT, custom model creation |
| CVS | Computer Vision | Image recognition, object detection, visual AI |
| NLP | Natural Language Processing | Text processing, sentiment analysis, NER |
| AUT | Automation | AI-powered automation, workflows, MCP servers |
| MLO | MLOps | Model deployment, monitoring, infrastructure |
| GEN | Generative AI | Image generation, video generation, audio synthesis |

#### Technology Segment (T) Categories
| Code | Category Name | Description |
|------|---------------|-------------|
| FND | Frontend | React, Vue, CSS, UI/UX, web development |
| BKD | Backend | Node.js, Python, APIs, server architecture |
| DBS | Databases | SQL, PostgreSQL, MongoDB, data storage |
| DVP | DevOps | CI/CD, Docker, Kubernetes, deployment |
| API | APIs & Integrations | REST, GraphQL, webhooks, third-party integrations |
| SEC | Security | Cybersecurity, authentication, encryption |
| MOB | Mobile | iOS, Android, React Native, mobile development |
| CLD | Cloud | AWS, GCP, Azure, cloud infrastructure |
| NET | Networking | TCP/IP, DNS, network architecture |
| HRD | Hardware | Computers, devices, physical technology |

#### Finance Segment (F) Categories
| Code | Category Name | Description |
|------|---------------|-------------|
| FPA | FP&A | Financial planning & analysis |
| BGT | Budgeting | Budget creation, management, tracking |
| FCT | Forecasting | Financial forecasting, projections |
| VAR | Variance Analysis | Budget vs actual, variance reporting |
| REV | Revenue Operations | Revenue tracking, sales finance |
| INV | Investing | Stock market, portfolio management |
| ACC | Accounting | Bookkeeping, financial statements |
| TAX | Taxation | Tax planning, compliance |

#### Sports Segment (S) Categories
| Code | Category Name | Description |
|------|---------------|-------------|
| FFL | Fantasy Football | Season-long fantasy football |
| DFS | Daily Fantasy Sports | DraftKings, FanDuel, daily contests |
| ANL | Player Analytics | Statistics, projections, analysis |
| BET | Sports Betting | Odds, lines, betting strategy |
| NWS | Sports News | Game recaps, trades, breaking news |
| NFL | NFL | National Football League specific |
| NBA | NBA | National Basketball Association specific |
| MLB | MLB | Major League Baseball specific |

#### Health Segment (H) Categories
| Code | Category Name | Description |
|------|---------------|-------------|
| ACC | Accessibility | Adaptive technology, assistive devices |
| CGV | Caregiving | Care coordination, support resources |
| WLN | Wellness | General health, mental wellness |
| FIT | Fitness | Exercise, workouts, physical training |
| MED | Medical | Medical information, conditions, treatments |
| NUT | Nutrition | Diet, supplements, meal planning |

#### Business Segment (B) Categories
| Code | Category Name | Description |
|------|---------------|-------------|
| PRD | Productivity | Task management, workflows, efficiency |
| PJM | Project Management | Agile, Scrum, project planning |
| COL | Collaboration | Team tools, communication platforms |
| STR | Strategy | Business strategy, planning |
| ENT | Entrepreneurship | Startups, business creation |
| MKT | Marketing | Digital marketing, advertising |
| SAL | Sales | Sales techniques, CRM |

#### Entertainment Segment (E) Categories
| Code | Category Name | Description |
|------|---------------|-------------|
| GAM | Gaming | Video games, gaming platforms |
| STR | Streaming | Netflix, YouTube, streaming platforms |
| MUS | Music | Music production, artists, albums |
| MOV | Movies | Films, cinema, reviews |
| POD | Podcasting | Podcast creation, episodes |

#### Lifestyle Segment (L) Categories
| Code | Category Name | Description |
|------|---------------|-------------|
| SMH | Smart Home | Home automation, IoT devices |
| AUD | Audio | Sound systems, speakers, audio equipment |
| HMI | Home Improvement | Renovation, DIY, home projects |
| TRV | Travel | Destinations, planning, reviews |
| FOD | Food | Cooking, recipes, restaurants |
| FSH | Fashion | Clothing, style, accessories |

#### Science Segment (X) Categories
| Code | Category Name | Description |
|------|---------------|-------------|
| PHY | Physics | Physical sciences |
| BIO | Biology | Life sciences |
| CHM | Chemistry | Chemical sciences |
| AST | Astronomy | Space, celestial bodies |
| ENV | Environmental | Climate, ecology |
| MAT | Mathematics | Pure and applied math |

#### Creative Segment (C) Categories
| Code | Category Name | Description |
|------|---------------|-------------|
| DSG | Design | Graphic design, UI/UX design |
| ART | Art | Visual arts, illustration |
| WRT | Writing | Creative writing, copywriting |
| PHO | Photography | Camera work, photo editing |
| VID | Video Production | Filming, editing, production |

### Category Rules
1. Category codes are 3 uppercase letters
2. Categories are segment-specific (same code can exist in different segments)
3. New categories can be added dynamically by the AI
4. When AI creates a new category, it must register: Code, Name, Description, Parent Segment

## 3.4 Level 3: Content Type

### Definition
The format or medium of the content. This describes HOW the information is presented, not WHAT it's about.

### Content Type Registry

| Code | Content Type | Description | Common Sources |
|------|--------------|-------------|----------------|
| T | Website/Tool | Interactive platform, SaaS, web application, utility | Product pages, app landing pages |
| A | Article | Written content, blog post, documentation, guide | Medium, blogs, news sites, docs |
| V | Video | YouTube, Vimeo, embedded video content | YouTube, Vimeo, course platforms |
| U | Audio | Music, sound files, audio-only content | SoundCloud, audio hosting |
| P | Podcast | Episodic audio/video series | Spotify, Apple Podcasts, YouTube |
| R | Research Paper | Academic papers, whitepapers, studies | arXiv, PubMed, journals |
| G | Repository | GitHub repos, code libraries, packages, open source | GitHub, GitLab, npm |
| S | Social Post | Twitter/X threads, LinkedIn posts, Reddit discussions | Twitter, LinkedIn, Reddit |
| C | Course/Tutorial | Structured learning content, educational series | Udemy, Coursera, tutorials |
| I | Image/Graphic | Infographics, diagrams, visual assets, charts | Pinterest, design sites |
| N | Newsletter | Email-based recurring content, digests | Substack, email archives |
| K | Book/eBook | Long-form published content, digital books | Amazon, publishers |

### Content Type Detection Rules

The AI should detect content type based on:

1. **URL patterns:**
   - youtube.com, vimeo.com â Video (V)
   - github.com, gitlab.com â Repository (G)
   - arxiv.org, pubmed.gov â Research Paper (R)
   - twitter.com, x.com, linkedin.com â Social Post (S)
   - open.spotify.com/episode, podcasts.apple.com â Podcast (P)
   - substack.com â Newsletter (N)

2. **Page metadata:**
   - og:type = "article" â Article (A)
   - og:type = "video" â Video (V)
   - meta application type indicators

3. **Content analysis:**
   - Interactive elements, login, dashboard â Tool (T)
   - Long-form text, paragraphs â Article (A)
   - Code files, README â Repository (G)

4. **Fallback rules:**
   - If product/service page with pricing â Tool (T)
   - If primarily informational text â Article (A)
   - If unclear, default to Article (A) and flag for review

## 3.5 Levels 4+: Dynamic Subcategories

### Definition
Subcategories are AI-generated levels that exist ONLY when needed to differentiate nodes sharing the same parent. They continue indefinitely until every node has a unique position.

### Subcategory Generation Algorithm

```python
def generate_subcategories(parent_path, nodes_at_parent):
    """
    Recursively generate subcategories until each node is unique.
    
    Args:
        parent_path: Current hierarchy path (e.g., "A.LLM.T")
        nodes_at_parent: List of nodes that need to be placed at this level
    
    Returns:
        Dict mapping each node to its final subcategory chain
    """
    
    # Base case: Only one node - no subcategory needed
    if len(nodes_at_parent) == 1:
        return {nodes_at_parent[0].id: []}
    
    # Multiple nodes - need to differentiate
    # Step 1: Identify the differentiating attribute
    differentiator = find_differentiator(nodes_at_parent)
    
    # Step 2: Group nodes by differentiator value
    groups = group_by_differentiator(nodes_at_parent, differentiator)
    
    # Step 3: Assign subcategory numbers
    result = {}
    for subcat_num, (diff_value, group_nodes) in enumerate(groups.items(), 1):
        # Recursively handle groups with multiple nodes
        sub_result = generate_subcategories(
            f"{parent_path}{subcat_num}.",
            group_nodes
        )
        
        for node_id, sub_chain in sub_result.items():
            result[node_id] = [subcat_num] + sub_chain
    
    return result


def find_differentiator(nodes):
    """
    Identify the attribute that best differentiates the given nodes.
    
    The differentiator must SPLIT the nodes, not group them together.
    
    Priority order for differentiation:
    1. Brand/Product name (Claude vs GPT vs Llama)
    2. Version (4.5 vs 5.0 vs 3.3)
    3. Specific feature/variant (Pro vs Enterprise vs Free)
    4. Creator/Author
    5. Date/Year
    6. Unique identifier
    
    Returns:
        String indicating which attribute to use for differentiation
    """
    
    # Check brand/product differentiation
    brands = set(node.extracted_brand for node in nodes)
    if len(brands) == len(nodes):
        return "brand"
    elif len(brands) > 1:
        return "brand"  # Will create groups that may need further splitting
    
    # Check version differentiation  
    versions = set(node.extracted_version for node in nodes)
    if len(versions) == len(nodes):
        return "version"
    elif len(versions) > 1:
        return "version"
    
    # Check specific variant
    variants = set(node.extracted_variant for node in nodes)
    if len(variants) > 1:
        return "variant"
    
    # Check creator
    creators = set(node.extracted_creator for node in nodes)
    if len(creators) > 1:
        return "creator"
    
    # Fallback to unique identifier (timestamp, hash, etc.)
    return "unique_id"
```

### Subcategory Examples

#### Example 1: LLM Tools
```
Nodes to place:
- Claude Opus 4.5 (Anthropic)
- Claude Sonnet 4.5 (Anthropic)
- GPT-5.2 (OpenAI)
- GPT-4o (OpenAI)
- Llama 4 (Meta)

Step 1: All at A.LLM.T (AI > LLMs > Tool)
Step 2: Find differentiator â Brand (Claude, GPT, Llama)
Step 3: Group by brand:
  - Group 1 (Claude): Opus 4.5, Sonnet 4.5
  - Group 2 (GPT): GPT-5.2, GPT-4o
  - Group 3 (Llama): Llama 4

Step 4: Assign subcategory numbers:
  - A.LLM.T1 = Claude group
  - A.LLM.T2 = GPT group
  - A.LLM.T3 = Llama group

Step 5: Recurse for groups with multiple nodes:
  - A.LLM.T1 has 2 nodes â differentiate by version
    - A.LLM.T1.1 = Opus 4.5
    - A.LLM.T1.2 = Sonnet 4.5
  - A.LLM.T2 has 2 nodes â differentiate by version
    - A.LLM.T2.1 = GPT-5.2
    - A.LLM.T2.2 = GPT-4o
  - A.LLM.T3 has 1 node â done
    - A.LLM.T3 = Llama 4

Final codes:
  A.LLM.T1.1 â Claude Opus 4.5
  A.LLM.T1.2 â Claude Sonnet 4.5
  A.LLM.T2.1 â GPT-5.2
  A.LLM.T2.2 â GPT-4o
  A.LLM.T3   â Llama 4
```

#### Example 2: Single Node Scenario
```
Nodes to place:
- "Prompt Injection Attack Guide" (Article)

Path: A.PMP.A (AI > Prompting > Article)
Only 1 node â No subcategory needed

Final code: A.PMP.A1

Note: We still append "1" to indicate position, even though 
there's only one node. This allows future nodes to get A2, A3, etc.
without restructuring.
```

#### Example 3: Deep Nesting
```
Nodes to place (all are DFS lineup articles):
- "Week 1 Cash Game Strategy"
- "Week 1 GPP Tournament Strategy"  
- "Week 2 Cash Game Strategy"
- "Week 2 GPP Tournament Strategy"
- "Week 3 Cash Game Strategy"

Path: S.DFS.A (Sports > DFS > Article)

Step 1: Differentiate 5 articles
  - Differentiator: Week number (Week 1, Week 2, Week 3)

Step 2: Group by week:
  - Week 1: 2 articles
  - Week 2: 2 articles
  - Week 3: 1 article

Step 3: Assign:
  - S.DFS.A1 = Week 1 group
  - S.DFS.A2 = Week 2 group
  - S.DFS.A3 = Week 3 group

Step 4: Recurse:
  - S.DFS.A1 has 2 â differentiate by game type (Cash vs GPP)
    - S.DFS.A1.1 = Cash Game
    - S.DFS.A1.2 = GPP Tournament
  - S.DFS.A2 has 2 â differentiate by game type
    - S.DFS.A2.1 = Cash Game
    - S.DFS.A2.2 = GPP Tournament
  - S.DFS.A3 has 1 â done
    - S.DFS.A3 = Week 3 Cash Game

Final codes:
  S.DFS.A1.1 â Week 1 Cash Game Strategy
  S.DFS.A1.2 â Week 1 GPP Tournament Strategy
  S.DFS.A2.1 â Week 2 Cash Game Strategy
  S.DFS.A2.2 â Week 2 GPP Tournament Strategy
  S.DFS.A3   â Week 3 Cash Game Strategy
```

### Subcategory Anti-Patterns (What NOT to Do)

```
â WRONG: Using shared attributes as subcategories

Scenario: Two frontier models need differentiation
  - Claude Opus 4.5
  - GPT-5.2

BAD subcategory choices:
  - "Frontier Model" â Both are frontier, doesn't split
  - "Multimodal" â Both are multimodal, doesn't split
  - "Commercial" â Both are commercial, doesn't split
  - "API Access" â Both have API, doesn't split

GOOD subcategory choice:
  - "Claude" vs "GPT" â Splits them apart â


â WRONG: Over-categorizing when unnecessary

Scenario: Only one RAG article exists

BAD:
  A.RAG.A.VectorDB.Pinecone.Tutorial â Too deep for 1 node

GOOD:
  A.RAG.A1 â Simple, leaves room for growth


â WRONG: Using inconsistent differentiators at same level

Scenario: Three LLM tools

BAD (mixing differentiator types):
  A.LLM.T1 = "Open Source" (category type)
  A.LLM.T2 = "Claude" (brand name)
  A.LLM.T3 = "2024 Release" (date)

GOOD (consistent differentiator):
  A.LLM.T1 = "Claude" (brand)
  A.LLM.T2 = "GPT" (brand)
  A.LLM.T3 = "Llama" (brand)
```

---

# 4. Organization-Based Hierarchy System

## 4.1 Overview

The Organization-Based Hierarchy provides an alternative view of the same nodes, organized by the company or entity that created/owns the content rather than by functional topic.

**Key Difference from Function-Based:**
- Function view: "Show me all LLM content across companies"
- Organization view: "Show me all content from Anthropic"

## 4.2 Hierarchy Levels

| Level | Name | Required | Description |
|-------|------|----------|-------------|
| 1 | **Organization** | Always | Company/entity with logo displayed |
| 2 | **Category** | Always | Topic within that org's content |
| 3 | **Content Type** | Always | Format/medium |
| 4+ | **Subcategory n** | If needed | Dynamic differentiators |

**Note:** Segment is NOT included in Organization view because the organization itself implies the domain. Users seeing "Anthropic" or "OpenAI" already know it's AI-related.

## 4.3 Organization Registry

### Organization Code Format
- 4 uppercase letters (abbreviation of company name)
- Must be unique across registry
- Stored with logo URL for display

### Initial Organization Registry

| Code | Organization | Logo URL | Primary Segment |
|------|--------------|----------|-----------------|
| ANTH | Anthropic | [asset] | AI |
| OPAI | OpenAI | [asset] | AI |
| GOOG | Google | [asset] | Technology |
| META | Meta | [asset] | AI/Technology |
| MSFT | Microsoft | [asset] | Technology |
| AMZN | Amazon | [asset] | Technology |
| APPL | Apple | [asset] | Technology |
| NFLX | Netflix | [asset] | Entertainment |
| GHUB | GitHub | [asset] | Technology |
| DKNG | DraftKings | [asset] | Sports |
| ESPN | ESPN | [asset] | Sports |
| NFLN | NFL | [asset] | Sports |
| NVDA | NVIDIA | [asset] | Technology |
| HUGG | Hugging Face | [asset] | AI |
| STRP | Stripe | [asset] | Technology |
| VRCL | Vercel | [asset] | Technology |
| ARXV | arXiv | [asset] | Science |
| WIKI | Wikipedia | [asset] | Reference |
| MEDU | Medium | [asset] | Publishing |
| SUBS | Substack | [asset] | Publishing |
| YOUT | YouTube | [asset] | Entertainment |
| TWTR | Twitter/X | [asset] | Social |
| RDDT | Reddit | [asset] | Social |
| LNKD | LinkedIn | [asset] | Business |

### Adding New Organizations
When AI encounters a new organization:
1. Generate 4-letter code from company name
2. Check for code collision
3. Attempt to fetch logo from:
   - Company website favicon
   - Clearbit Logo API
   - Google favicon service
4. Store in registry with extracted primary segment

## 4.4 Organization Hierarchy Code Structure

```
[ORG].[CATEGORY].[CONTENT TYPE][SUBCATEGORY CHAIN]

Format:
  - ORG: 4 uppercase letters
  - CATEGORY: 3 uppercase letters (same as Function view)
  - CONTENT TYPE: 1 letter
  - SUBCATEGORY: Numeric chain

Examples:
  ANTH.LLM.T1.1   â Anthropic > LLMs > Tool > Opus 4.5
  ANTH.LLM.T1.2   â Anthropic > LLMs > Tool > Sonnet 4.5
  ANTH.AGT.A1     â Anthropic > Agents > Article
  OPAI.LLM.T1.1   â OpenAI > LLMs > Tool > GPT-5.2
  OPAI.LLM.T1.2   â OpenAI > LLMs > Tool > GPT-4o
  META.LLM.G1     â Meta > LLMs > Repo > Llama 4
  DKNG.DFS.T1     â DraftKings > DFS > Tool
  NFLN.ANL.V1     â NFL > Analytics > Video
```

## 4.5 Visual Representation Comparison

```
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
â                        FUNCTION VIEW                                    â
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ¤
â                                                                         â
â  AI                                                                     â
â  âââ LLMs                                                               â
â  â   âââ Tool                                                           â
â  â   â   âââ Claude                                                     â
â  â   â   â   âââ Opus 4.5                                               â
â  â   â   â   âââ Sonnet 4.5                                             â
â  â   â   âââ GPT                                                        â
â  â   â   â   âââ GPT-5.2                                                â
â  â   â   â   âââ GPT-4o                                                 â
â  â   â   âââ Llama                                                      â
â  â   â       âââ Llama 4                                                â
â  â   âââ Article                                                        â
â  â       âââ Prompt Engineering Guide                                   â
â  âââ Agents                                                             â
â      âââ Repository                                                     â
â      â   âââ LangChain                                                  â
â      â   âââ CrewAI                                                     â
â      âââ Article                                                        â
â          âââ Building AI Agents                                         â
â                                                                         â
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

                              â TOGGLE â

âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
â                      ORGANIZATION VIEW                                  â
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ¤
â                                                                         â
â  [LOGO] Anthropic                                                       â
â  âââ LLMs                                                               â
â  â   âââ Tool                                                           â
â  â       âââ Opus 4.5                                                   â
â  â       âââ Sonnet 4.5                                                 â
â  âââ Agents                                                             â
â      âââ Article                                                        â
â          âââ Building AI Agents                                         â
â                                                                         â
â  [LOGO] OpenAI                                                          â
â  âââ LLMs                                                               â
â  â   âââ Tool                                                           â
â  â       âââ GPT-5.2                                                    â
â  â       âââ GPT-4o                                                     â
â  âââ Agents                                                             â
â      âââ Repository                                                     â
â          âââ (none from OpenAI)                                         â
â                                                                         â
â  [LOGO] Meta                                                            â
â  âââ LLMs                                                               â
â      âââ Repository                                                     â
â          âââ Llama 4                                                    â
â                                                                         â
â  [LOGO] LangChain Inc                                                   â
â  âââ Agents                                                             â
â      âââ Repository                                                     â
â          âââ LangChain                                                  â
â                                                                         â
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
```

## 4.6 Separate Database Storage

The Organization hierarchy is stored in a SEPARATE database/table from the Function hierarchy. This enables:

1. **Instant Toggle:** No recalculation needed when switching views
2. **Independent Optimization:** Each view can be indexed optimally
3. **Parallel Updates:** Both views can be updated simultaneously on import

### Database Link
Both hierarchies share the same underlying `node_id`. The node record contains:
- `function_hierarchy_code` (e.g., "A.LLM.T1.1")
- `organization_hierarchy_code` (e.g., "ANTH.LLM.T1.1")

---

# 5. Hierarchy Coding Systems

## 5.1 Function Hierarchy Code Format

### Structure
```
[SEGMENT].[CATEGORY].[CONTENT_TYPE][SUBCATEGORY_CHAIN]

Components:
âââ SEGMENT: 1 uppercase letter (A, T, F, S, H, B, E, L, X, C)
âââ CATEGORY: 3 uppercase letters (LLM, AGT, DFS, etc.)
âââ CONTENT_TYPE: 1 uppercase letter (T, A, V, P, R, G, S, C, I, N, K)
âââ SUBCATEGORY_CHAIN: Numeric chain (1, 1.1, 1.1.2, etc.)
```

### Examples with Breakdown
```
A.LLM.T1.1
â â   âââ
â â   âââââ Subcategory 2: 1 (first variant - Opus 4.5)
â â   âââââ Subcategory 1: 1 (first brand - Claude)
â â   âââââ Content Type: T (Tool)
â âââââââââ Category: LLM (Large Language Models)
âââââââââââ Segment: A (AI)

S.DFS.A2.3.1
â â   âââââ
â â   âââââââ Subcategory 3: 1 (specific article variant)
â â   âââââââ Subcategory 2: 3 (third sub-topic)
â â   âââââââ Subcategory 1: 2 (second topic group)
â â   âââââââ Content Type: A (Article)
â â   âââââââ (no separator before content type)
â âââââââââââ Category: DFS (Daily Fantasy Sports)
âââââââââââââ Segment: S (Sports)
```

### Parsing Regex
```javascript
const FUNCTION_CODE_REGEX = /^([A-Z])\.([A-Z]{3})\.([A-Z])(\d+(?:\.\d+)*)$/;

// Example parsing:
const code = "A.LLM.T1.1";
const match = code.match(FUNCTION_CODE_REGEX);
// match[1] = "A" (segment)
// match[2] = "LLM" (category)
// match[3] = "T" (content type)
// match[4] = "1.1" (subcategory chain)
```

## 5.2 Organization Hierarchy Code Format

### Structure
```
[ORG].[CATEGORY].[CONTENT_TYPE][SUBCATEGORY_CHAIN]

Components:
âââ ORG: 4 uppercase letters (ANTH, OPAI, META, etc.)
âââ CATEGORY: 3 uppercase letters (LLM, AGT, DFS, etc.)
âââ CONTENT_TYPE: 1 uppercase letter (T, A, V, etc.)
âââ SUBCATEGORY_CHAIN: Numeric chain (1, 1.1, etc.)
```

### Examples
```
ANTH.LLM.T1.1
â    â   âââ
â    â   âââââ Subcategory 2: 1 (Opus 4.5)
â    â   âââââ Subcategory 1: 1 (first model line)
â    â   âââââ Content Type: T (Tool)
â    âââââââââ Category: LLM
ââââââââââââââ Organization: ANTH (Anthropic)

DKNG.DFS.T1
â    â   ââ
â    â   ââââ Subcategory 1: 1 (only DFS tool from DraftKings)
â    â   ââââ Content Type: T (Tool)
â    ââââââââ Category: DFS
âââââââââââââ Organization: DKNG (DraftKings)
```

### Parsing Regex
```javascript
const ORG_CODE_REGEX = /^([A-Z]{4})\.([A-Z]{3})\.([A-Z])(\d+(?:\.\d+)*)$/;
```

## 5.3 Code Generation Algorithm

```python
def generate_function_hierarchy_code(node, existing_nodes):
    """
    Generate the function-based hierarchy code for a new node.
    
    Args:
        node: The new node being imported
        existing_nodes: All existing nodes in the database
    
    Returns:
        String hierarchy code (e.g., "A.LLM.T1.1")
    """
    
    # Step 1: Classify segment, category, content type
    segment = classify_segment(node)  # Returns single letter
    category = classify_category(node, segment)  # Returns 3 letters
    content_type = classify_content_type(node)  # Returns single letter
    
    # Step 2: Find existing nodes at same path
    base_path = f"{segment}.{category}.{content_type}"
    siblings = find_nodes_at_path(existing_nodes, base_path)
    
    # Step 3: Generate subcategory chain
    if len(siblings) == 0:
        # First node at this path
        subcategory_chain = "1"
    else:
        # Need to differentiate from siblings
        all_nodes = siblings + [node]
        assignments = generate_subcategories(base_path, all_nodes)
        subcategory_chain = format_chain(assignments[node.id])
        
        # Update existing nodes if their codes changed
        for sibling in siblings:
            new_chain = format_chain(assignments[sibling.id])
            if sibling.hierarchy_code != f"{base_path}{new_chain}":
                update_node_code(sibling, f"{base_path}{new_chain}")
    
    return f"{base_path}{subcategory_chain}"


def format_chain(chain_list):
    """Convert [1, 2, 3] to "1.2.3" """
    if not chain_list:
        return "1"
    return ".".join(str(n) for n in chain_list)
```

## 5.4 Code Mutability & Restructuring

When a new node is added that requires restructuring:

```
BEFORE adding new node:
âââââââââââââââââââââââââ
A.LLM.T1 â Claude Opus 4.5
A.LLM.T2 â GPT-5.2

NEW NODE: Claude Sonnet 4.5

RESTRUCTURING REQUIRED:
âââââââââââââââââââââââââ
Old: A.LLM.T1 â Claude Opus 4.5
  - Has sibling at T2 (GPT)
  - New node is also Claude
  - Need to split Claude into sub-levels

New structure:
A.LLM.T1.1 â Claude Opus 4.5 (UPDATED from T1)
A.LLM.T1.2 â Claude Sonnet 4.5 (NEW)
A.LLM.T2   â GPT-5.2 (UNCHANGED - different brand)

DATABASE OPERATIONS:
1. UPDATE node SET hierarchy_code = 'A.LLM.T1.1' WHERE hierarchy_code = 'A.LLM.T1'
2. INSERT new node with hierarchy_code = 'A.LLM.T1.2'
```

### Restructuring Events
Track all code changes for audit/debugging:

```sql
CREATE TABLE hierarchy_code_changes (
    id SERIAL PRIMARY KEY,
    node_id UUID REFERENCES nodes(id),
    old_code VARCHAR(100),
    new_code VARCHAR(100),
    change_reason VARCHAR(255),  -- 'new_sibling_added', 'restructure', 'manual'
    triggered_by_node_id UUID,   -- The new node that caused this change
    changed_at TIMESTAMP DEFAULT NOW()
);
```

---

# 6. Metadata Coding System

## 6.1 Purpose

Metadata codes serve a DIFFERENT purpose than hierarchy codes:

| Hierarchy Codes | Metadata Codes |
|-----------------|----------------|
| WHERE the node lives in the tree | WHAT the node relates to |
| Single value per node | Multiple values per node |
| Determines visual position | Enables cross-cutting queries |
| Changes when tree restructures | Stable once assigned |

Metadata codes enable:
- "Find all content from Anthropic" (across all topics)
- "Find all content about code generation" (across all companies)
- "Find nodes similar to this node" (shared metadata)
- "Build knowledge graph of relationships"

## 6.2 Metadata Code Types

### Type Registry

| Prefix | Type | Description | Example Values |
|--------|------|-------------|----------------|
| ORG: | Organization | Company/entity behind content | ANTHROPIC, OPENAI, META |
| DOM: | Domain | Source website root | GITHUB, YOUTUBE, ARXIV |
| FNC: | Function | What it does/enables | CODEGEN, IMGGEN, ANALYSIS |
| TEC: | Technology | Tech stack/tools used | PYTHON, REACT, EXCEL, API |
| CON: | Concept | Abstract ideas/topics | REASONING, MULTIMODAL, RAG |
| IND: | Industry | Industry vertical | HEALTHCARE, FINTECH, SPORTS |
| AUD: | Audience | Target user type | DEVELOPER, ENTERPRISE, CONSUMER |
| PRC: | Price | Pricing model | FREE, FREEMIUM, PAID, ENTERPRISE |
| LIC: | License | License type (for repos) | MIT, APACHE2, GPL, PROPRIETARY |
| LNG: | Language | Programming language | PYTHON, JAVASCRIPT, RUST |
| FMW: | Framework | Software framework | REACT, LANGCHAIN, PYTORCH |
| PLT: | Platform | Platform/OS | WEB, IOS, ANDROID, DESKTOP |

### Code Format
```
[TYPE]:[VALUE]

Rules:
- TYPE: 3 uppercase letters
- VALUE: UPPERCASE, underscores allowed, no spaces
- Combined length: Max 50 characters

Examples:
  ORG:ANTHROPIC
  FNC:CODE_GENERATION
  TEC:PYTHON
  CON:RETRIEVAL_AUGMENTED_GENERATION
  PRC:FREEMIUM
```

## 6.3 Metadata Assignment Rules

### Per-Node Assignment
Each node can have MULTIPLE metadata codes across ALL types:

```
Node: Claude Opus 4.5 Tool Page
ââââââââââââââââââââââââââââââââââââââââââ
Metadata Codes Assigned:
[
  ORG:ANTHROPIC,
  DOM:ANTHROPIC,
  FNC:CODEGEN,
  FNC:REASONING,
  FNC:ANALYSIS,
  FNC:MULTIMODAL,
  FNC:CONVERSATION,
  TEC:API,
  TEC:PYTHON,
  TEC:TYPESCRIPT,
  TEC:REST,
  CON:FRONTIER_MODEL,
  CON:LONG_CONTEXT,
  CON:SAFETY,
  CON:CONSTITUTIONAL_AI,
  IND:TECHNOLOGY,
  IND:ENTERPRISE,
  AUD:DEVELOPER,
  AUD:ENTERPRISE,
  AUD:RESEARCHER,
  PRC:PAID,
  PRC:FREEMIUM,
  PLT:WEB,
  PLT:API
]
```

### Assignment Priorities
1. **Always assign:** ORG, DOM (derived from URL)
2. **Primary functions:** FNC codes for main capabilities
3. **Technologies:** TEC for implementation details
4. **Concepts:** CON for abstract themes
5. **Business:** IND, AUD, PRC as applicable

### Minimum Metadata Set
Every node MUST have at least:
- 1 ORG code (or ORG:UNKNOWN if unidentifiable)
- 1 DOM code (extracted from URL)
- 1 FNC or CON code

## 6.4 Metadata Registry (Database)

```sql
-- Registry of all known metadata codes
CREATE TABLE metadata_code_registry (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,     -- Full code: "ORG:ANTHROPIC"
    type VARCHAR(3) NOT NULL,              -- Type prefix: "ORG"
    value VARCHAR(46) NOT NULL,            -- Value: "ANTHROPIC"
    display_name VARCHAR(100),             -- Human-readable: "Anthropic"
    description TEXT,                      -- Optional description
    created_at TIMESTAMP DEFAULT NOW(),
    usage_count INTEGER DEFAULT 0          -- How many nodes use this code
);

-- Index for fast lookups
CREATE INDEX idx_metadata_type ON metadata_code_registry(type);
CREATE INDEX idx_metadata_value ON metadata_code_registry(value);
```

### Dynamic Code Creation
When AI encounters a new organization, technology, or concept:

```python
def get_or_create_metadata_code(code_type, value):
    """
    Get existing metadata code or create new one.
    
    Args:
        code_type: "ORG", "FNC", "TEC", etc.
        value: "ANTHROPIC", "CODEGEN", etc.
    
    Returns:
        The full code string (e.g., "ORG:ANTHROPIC")
    """
    full_code = f"{code_type}:{value}"
    
    existing = db.query(
        "SELECT * FROM metadata_code_registry WHERE code = %s",
        [full_code]
    )
    
    if existing:
        # Increment usage count
        db.execute(
            "UPDATE metadata_code_registry SET usage_count = usage_count + 1 WHERE code = %s",
            [full_code]
        )
        return full_code
    
    # Create new code
    display_name = generate_display_name(value)  # "ANTHROPIC" â "Anthropic"
    
    db.execute("""
        INSERT INTO metadata_code_registry (code, type, value, display_name, usage_count)
        VALUES (%s, %s, %s, %s, 1)
    """, [full_code, code_type, value, display_name])
    
    return full_code
```

## 6.5 Node-Metadata Junction Table

```sql
-- Many-to-many relationship between nodes and metadata codes
CREATE TABLE node_metadata (
    node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
    metadata_code_id INTEGER REFERENCES metadata_code_registry(id),
    assigned_at TIMESTAMP DEFAULT NOW(),
    confidence FLOAT DEFAULT 1.0,  -- AI confidence in this assignment
    PRIMARY KEY (node_id, metadata_code_id)
);

-- Indexes for common queries
CREATE INDEX idx_node_metadata_node ON node_metadata(node_id);
CREATE INDEX idx_node_metadata_code ON node_metadata(metadata_code_id);
```

## 6.6 Querying with Metadata Codes

### Find all nodes with specific metadata
```sql
-- Find all Anthropic content
SELECT n.* FROM nodes n
JOIN node_metadata nm ON n.id = nm.node_id
JOIN metadata_code_registry mcr ON nm.metadata_code_id = mcr.id
WHERE mcr.code = 'ORG:ANTHROPIC';

-- Find all code generation tools
SELECT n.* FROM nodes n
JOIN node_metadata nm ON n.id = nm.node_id
JOIN metadata_code_registry mcr ON nm.metadata_code_id = mcr.id
WHERE mcr.code = 'FNC:CODEGEN'
AND n.content_type_code = 'T';  -- Tools only
```

### Find nodes sharing metadata with a given node
```sql
-- Find nodes similar to node X (sharing at least 3 metadata codes)
WITH target_codes AS (
    SELECT metadata_code_id FROM node_metadata WHERE node_id = :target_node_id
)
SELECT 
    n.id,
    n.title,
    COUNT(*) as shared_codes
FROM nodes n
JOIN node_metadata nm ON n.id = nm.node_id
WHERE nm.metadata_code_id IN (SELECT metadata_code_id FROM target_codes)
AND n.id != :target_node_id
GROUP BY n.id, n.title
HAVING COUNT(*) >= 3
ORDER BY shared_codes DESC;
```

---

# 7. Descriptor Fields & Strings

## 7.1 Descriptor Fields

These are rich metadata fields that describe the node's content. Unlike hierarchy codes (which determine position) and metadata codes (which enable association), descriptor fields provide human-readable information for display and search.

### Field Specifications

| Field | Type | Max Length | Required | Generated In |
|-------|------|------------|----------|--------------|
| title | String | 500 | Yes | Phase 2 |
| source_domain | String | 100 | Yes | Phase 1* |
| url | String | 2000 | Yes | Phase 1 |
| date_added | Timestamp | - | Yes | Phase 1 |
| company | String | 200 | No | Phase 2 |
| phrase_description | String | 100 | Yes | Phase 2 |
| short_description | String | 500 | Yes | Phase 2 |
| logo_url | String | 500 | No | Phase 2 |
| key_concepts | Array[String] | 20 items | Yes | Phase 2 |

*source_domain is extracted immediately from URL, enriched in Phase 2

### Field Definitions

#### title
The name or headline of the content.
```
Sources:
- <title> tag
- og:title meta tag
- h1 heading
- AI-generated from content analysis

Examples:
- "Claude Opus 4.5 - Anthropic's Most Intelligent Model"
- "Building AI Agents with LangChain: A Comprehensive Guide"
- "Week 15 DraftKings NFL DFS Lineup Strategy"
```

#### source_domain
The root website domain, normalized.
```
Extraction:
- Parse URL hostname
- Remove www. prefix
- Store root domain only

Examples:
- "https://www.anthropic.com/claude/opus" â "anthropic.com"
- "https://github.com/langchain-ai/langchain" â "github.com"
- "https://blog.medium.com/article" â "medium.com"
```

#### url
The full original URL as provided by user.
```
Storage:
- Store exactly as imported
- Do not modify or normalize
- Used for deduplication and linking back

Deduplication:
- Normalize for comparison (remove tracking params, trailing slashes)
- But store original for faithful reproduction
```

#### date_added
Timestamp when node was imported.
```
Format: ISO 8601 with timezone
Example: "2026-01-18T15:42:00Z"

Usage:
- Sort by recency
- Filter by date range
- Display "Added 3 days ago"
```

#### company
The organization that created or owns the content.
```
This may differ from source_domain.
Example:
- URL: medium.com/@anthropic/...
- source_domain: "medium.com"
- company: "Anthropic"

Sources:
- Author byline
- About page
- Organization schema markup
- AI inference from content
```

#### phrase_description
Ultra-brief label (like a tagline).
```
Max: 100 characters
Style: No period at end, title case or sentence case
Purpose: Quick identification in lists

Examples:
- "Anthropic's flagship reasoning model"
- "Python framework for building AI agents"
- "Daily fantasy sports lineup optimizer"
- "Variance analysis Excel template"
```

#### short_description
1-3 sentence summary of the content.
```
Max: 500 characters
Style: Complete sentences with periods
Purpose: Preview without opening content

Examples:
- "Claude Opus 4.5 is Anthropic's most advanced AI model, 
   featuring enhanced reasoning capabilities and extended 
   context windows up to 200K tokens. Available via API 
   and Claude.ai."
   
- "A comprehensive guide to building autonomous AI agents 
   using the LangChain framework. Covers tool use, memory, 
   and multi-agent orchestration patterns."
```

#### logo_url
URL to the company/product logo image.
```
Sources (in priority order):
1. Apple touch icon: <link rel="apple-touch-icon" href="...">
2. Open Graph image: <meta property="og:image" content="...">
3. Favicon: <link rel="icon" href="...">
4. Clearbit Logo API: https://logo.clearbit.com/{domain}
5. Google Favicon: https://www.google.com/s2/favicons?domain={domain}

Storage:
- Download and store locally (don't hotlink)
- Resize to standard dimensions (128x128, 256x256)
- Support PNG, JPG, SVG formats
```

#### key_concepts
Array of tags representing abstract ideas discussed.
```
Max: 20 tags
Tag format: Lowercase, spaces allowed, 2-50 characters each

Examples:
[
  "reasoning",
  "multimodal",
  "long context",
  "enterprise ai",
  "api access",
  "code generation",
  "frontier model"
]

Difference from Metadata Codes:
- Metadata codes: Structured, typed, uppercase (FNC:CODEGEN)
- Key concepts: Freeform tags, lowercase, human-friendly
- Key concepts appear in UI, metadata codes are for querying
```

## 7.2 Descriptor String

### Definition
A single concatenated text blob combining all descriptor values for full-text search.

### Format
```
[Title]|[SourceDomain]|[Company]|[PhraseDesc]|[ShortDesc]|[KeyConcepts joined by |]

Delimiter: Pipe character (|)
All fields included even if empty (double pipes)
```

### Example
```
Claude Opus 4.5|anthropic.com|Anthropic|Anthropic's flagship reasoning 
model|Claude Opus 4.5 is Anthropic's most advanced AI model with enhanced 
reasoning and 200K context window. Available via API and Claude.ai.|reasoning|
multimodal|long context|enterprise ai|api access|code generation|frontier model
```

### Generation Function
```python
def generate_descriptor_string(node):
    """
    Generate the concatenated descriptor string for full-text search.
    
    Args:
        node: Node object with all descriptor fields populated
    
    Returns:
        Single string with all descriptors concatenated
    """
    parts = [
        node.title or "",
        node.source_domain or "",
        node.company or "",
        node.phrase_description or "",
        node.short_description or "",
    ]
    
    # Add key concepts
    if node.key_concepts:
        parts.extend(node.key_concepts)
    
    return "|".join(parts)
```

### Search Usage
```sql
-- Full-text search across all descriptor content
SELECT * FROM nodes
WHERE descriptor_string ILIKE '%reasoning%'
   OR descriptor_string ILIKE '%anthropic%';

-- With PostgreSQL full-text search
SELECT * FROM nodes
WHERE to_tsvector('english', descriptor_string) @@ to_tsquery('reasoning & anthropic');
```

---

# 8. Processing Phases

## 8.1 Phase 1: On Import (Immediate)

### Trigger
User submits a URL for import

### Timing
- Synchronous (blocks UI until complete)
- Target: < 3 seconds
- User sees loading indicator

### Operations

```python
async def phase1_import(url: str, user_id: str) -> Node:
    """
    Phase 1: Immediate import processing.
    Places node in hierarchy so user sees result right away.
    """
    
    # Step 1: Validate URL
    if not is_valid_url(url):
        raise InvalidURLError(url)
    
    # Step 2: Check for duplicates
    existing = find_node_by_url(url)
    if existing:
        return existing  # Or prompt user for action
    
    # Step 3: Fetch basic page data
    page_data = await fetch_page_metadata(url)
    # Returns: title, meta tags, og tags, basic content
    
    # Step 4: Extract immediate fields
    source_domain = extract_domain(url)
    date_added = datetime.utcnow()
    
    # Step 5: AI Classification (lightweight model)
    classification = await ai_classify_quick(page_data)
    # Returns: segment, category, content_type, organization
    
    # Step 6: Generate hierarchy codes
    function_code = generate_function_code(
        segment=classification.segment,
        category=classification.category,
        content_type=classification.content_type,
        existing_nodes=get_nodes_at_path(...)
    )
    
    org_code = generate_organization_code(
        organization=classification.organization,
        category=classification.category,
        content_type=classification.content_type,
        existing_nodes=get_nodes_at_path(...)
    )
    
    # Step 7: Create node record
    node = Node(
        id=generate_uuid(),
        url=url,
        source_domain=source_domain,
        date_added=date_added,
        function_hierarchy_code=function_code,
        organization_hierarchy_code=org_code,
        segment_code=classification.segment,
        category_code=classification.category,
        content_type_code=classification.content_type,
        organization_code=classification.organization,
        phase_2_complete=False
    )
    
    # Step 8: Save to database
    save_node(node)
    
    # Step 9: Queue for Phase 2 processing
    queue_phase2(node.id)
    
    # Step 10: Return to user
    return node
```

### Fields Set in Phase 1
| Field | Source |
|-------|--------|
| id | Generated UUID |
| url | User input |
| source_domain | Extracted from URL |
| date_added | Current timestamp |
| segment_code | AI classification |
| category_code | AI classification |
| content_type_code | AI classification |
| organization_code | AI classification |
| function_hierarchy_code | Generated |
| organization_hierarchy_code | Generated |
| phase_2_complete | False |

## 8.2 Phase 2: Background Processing (Async)

### Trigger
- Node queued after Phase 1 completion
- System idle time
- Batch processing job

### Timing
- Asynchronous (user not waiting)
- Target: < 30 seconds per node
- Can be parallelized

### Operations

```python
async def phase2_enrich(node_id: str) -> None:
    """
    Phase 2: Background enrichment processing.
    Generates rich descriptors and metadata codes.
    """
    
    node = get_node(node_id)
    if node.phase_2_complete:
        return  # Already processed
    
    # Step 1: Full page fetch
    full_content = await fetch_full_page(node.url)
    # Returns: Full HTML, text content, images, structured data
    
    # Step 2: AI Deep Analysis (heavier model)
    analysis = await ai_analyze_deep(full_content)
    
    # Step 3: Extract/generate descriptors
    node.title = analysis.title or extract_title(full_content)
    node.company = analysis.company or extract_company(full_content)
    node.phrase_description = analysis.phrase_description
    node.short_description = analysis.short_description
    node.key_concepts = analysis.key_concepts
    
    # Step 4: Fetch logo
    node.logo_url = await fetch_and_store_logo(
        node.source_domain,
        node.company
    )
    
    # Step 5: Generate metadata codes
    metadata_codes = generate_metadata_codes(analysis)
    
    for code in metadata_codes:
        code_id = get_or_create_metadata_code(code)
        link_node_metadata(node.id, code_id)
    
    # Step 6: Generate descriptor string
    node.descriptor_string = generate_descriptor_string(node)
    
    # Step 7: Compute similarity scores
    await compute_similarity_scores(node)
    
    # Step 8: Mark complete and save
    node.phase_2_complete = True
    save_node(node)
    
    # Step 9: Notify UI if user is viewing this node
    notify_node_updated(node.id)
```

### Fields Set in Phase 2
| Field | Source |
|-------|--------|
| title | AI extraction / HTML parsing |
| company | AI inference / metadata |
| phrase_description | AI generation |
| short_description | AI generation |
| logo_url | Fetched and stored |
| key_concepts | AI extraction |
| metadata_codes | AI assignment |
| descriptor_string | Concatenation |
| phase_2_complete | True |

## 8.3 Processing Queue Management

```python
# Queue implementation (e.g., using Redis or PostgreSQL)

class Phase2Queue:
    def enqueue(self, node_id: str, priority: int = 5):
        """Add node to processing queue."""
        # Priority 1-10 (1 = highest)
        # Recently viewed nodes get higher priority
        
    def dequeue(self) -> Optional[str]:
        """Get next node to process."""
        # Returns highest priority node
        
    def process_batch(self, batch_size: int = 10):
        """Process multiple nodes in parallel."""
        nodes = [self.dequeue() for _ in range(batch_size)]
        nodes = [n for n in nodes if n]  # Filter None
        
        # Process in parallel
        await asyncio.gather(*[
            phase2_enrich(node_id) for node_id in nodes
        ])
```

### Queue Priorities
| Priority | Trigger |
|----------|---------|
| 1 (Highest) | User is actively viewing incomplete node |
| 3 | User just imported this node |
| 5 (Default) | Normal queue position |
| 7 | Batch import |
| 10 (Lowest) | Background reprocessing |

---

# 9. Database Schema

## 9.1 Complete Schema

```sql
-- ============================================
-- CORE TABLES
-- ============================================

-- Main nodes table
CREATE TABLE nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- URL and timing
    url VARCHAR(2000) NOT NULL,
    source_domain VARCHAR(100) NOT NULL,
    date_added TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Function hierarchy
    function_hierarchy_code VARCHAR(100) NOT NULL,
    segment_code CHAR(1) NOT NULL,
    category_code CHAR(3) NOT NULL,
    content_type_code CHAR(1) NOT NULL,
    function_subcategory_chain VARCHAR(50),  -- e.g., "1.2.3"
    
    -- Organization hierarchy
    organization_hierarchy_code VARCHAR(100) NOT NULL,
    organization_code CHAR(4) NOT NULL,
    org_category_code CHAR(3) NOT NULL,
    org_content_type_code CHAR(1) NOT NULL,
    org_subcategory_chain VARCHAR(50),
    
    -- Descriptor fields (populated in Phase 2)
    title VARCHAR(500),
    company VARCHAR(200),
    phrase_description VARCHAR(100),
    short_description VARCHAR(500),
    logo_url VARCHAR(500),
    key_concepts JSONB DEFAULT '[]',  -- Array of strings
    descriptor_string TEXT,
    
    -- Processing status
    phase_2_complete BOOLEAN DEFAULT FALSE,
    phase_2_started_at TIMESTAMP WITH TIME ZONE,
    phase_2_completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(url)
);

-- Indexes for nodes table
CREATE INDEX idx_nodes_function_code ON nodes(function_hierarchy_code);
CREATE INDEX idx_nodes_org_code ON nodes(organization_hierarchy_code);
CREATE INDEX idx_nodes_segment ON nodes(segment_code);
CREATE INDEX idx_nodes_category ON nodes(category_code);
CREATE INDEX idx_nodes_content_type ON nodes(content_type_code);
CREATE INDEX idx_nodes_organization ON nodes(organization_code);
CREATE INDEX idx_nodes_phase2 ON nodes(phase_2_complete);
CREATE INDEX idx_nodes_date ON nodes(date_added DESC);
CREATE INDEX idx_nodes_descriptor_gin ON nodes USING gin(to_tsvector('english', descriptor_string));

-- ============================================
-- REGISTRY TABLES
-- ============================================

-- Segment registry
CREATE TABLE segment_registry (
    code CHAR(1) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default segments
INSERT INTO segment_registry (code, name, description) VALUES
('A', 'AI', 'Artificial intelligence, machine learning, LLMs'),
('T', 'Technology', 'Software, hardware, development tools'),
('F', 'Finance', 'Money, investing, FP&A, accounting'),
('S', 'Sports', 'Football, basketball, fantasy, athletics'),
('H', 'Health', 'Medical, wellness, fitness, accessibility'),
('B', 'Business', 'Strategy, operations, management'),
('E', 'Entertainment', 'Media, gaming, music, movies'),
('L', 'Lifestyle', 'Home, fashion, food, travel'),
('X', 'Science', 'Research, academia, natural sciences'),
('C', 'Creative', 'Design, art, writing, content creation');

-- Category registry
CREATE TABLE category_registry (
    id SERIAL PRIMARY KEY,
    segment_code CHAR(1) REFERENCES segment_registry(code),
    code CHAR(3) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(segment_code, code)
);

-- Content type registry
CREATE TABLE content_type_registry (
    code CHAR(1) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    url_patterns JSONB,  -- Patterns for auto-detection
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default content types
INSERT INTO content_type_registry (code, name, description, url_patterns) VALUES
('T', 'Website/Tool', 'Interactive platform, SaaS, utility', '[]'),
('A', 'Article', 'Written content, blog post, documentation', '[]'),
('V', 'Video', 'YouTube, Vimeo, embedded video', '["youtube.com", "vimeo.com", "youtu.be"]'),
('U', 'Audio', 'Music, sound files, audio-only', '["soundcloud.com"]'),
('P', 'Podcast', 'Episodic audio/video series', '["podcasts.apple.com", "open.spotify.com/episode"]'),
('R', 'Research Paper', 'Academic papers, whitepapers', '["arxiv.org", "pubmed.gov", "papers.ssrn.com"]'),
('G', 'Repository', 'GitHub repos, code libraries', '["github.com", "gitlab.com", "bitbucket.org"]'),
('S', 'Social Post', 'Twitter threads, LinkedIn posts', '["twitter.com", "x.com", "linkedin.com/posts"]'),
('C', 'Course/Tutorial', 'Structured learning content', '["udemy.com", "coursera.org"]'),
('I', 'Image/Graphic', 'Infographics, diagrams', '[]'),
('N', 'Newsletter', 'Email-based content', '["substack.com"]'),
('K', 'Book/eBook', 'Long-form published content', '[]');

-- Organization registry
CREATE TABLE organization_registry (
    code CHAR(4) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    logo_url VARCHAR(500),
    website VARCHAR(200),
    primary_segment CHAR(1) REFERENCES segment_registry(code),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- METADATA TABLES
-- ============================================

-- Metadata code registry
CREATE TABLE metadata_code_registry (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    type CHAR(3) NOT NULL,
    value VARCHAR(46) NOT NULL,
    display_name VARCHAR(100),
    description TEXT,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_metadata_type ON metadata_code_registry(type);
CREATE INDEX idx_metadata_code ON metadata_code_registry(code);

-- Node-Metadata junction table
CREATE TABLE node_metadata (
    node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
    metadata_code_id INTEGER REFERENCES metadata_code_registry(id),
    confidence FLOAT DEFAULT 1.0,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (node_id, metadata_code_id)
);

CREATE INDEX idx_node_metadata_node ON node_metadata(node_id);
CREATE INDEX idx_node_metadata_code ON node_metadata(metadata_code_id);

-- ============================================
-- ASSOCIATION TABLES
-- ============================================

-- Pre-computed similarity scores between nodes
CREATE TABLE node_similarity (
    node_a_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
    node_b_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
    similarity_score FLOAT NOT NULL,
    shared_metadata_count INTEGER NOT NULL,
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (node_a_id, node_b_id),
    CHECK (node_a_id < node_b_id)  -- Ensure no duplicates (A,B) and (B,A)
);

CREATE INDEX idx_similarity_score ON node_similarity(similarity_score DESC);
CREATE INDEX idx_similarity_node_a ON node_similarity(node_a_id);
CREATE INDEX idx_similarity_node_b ON node_similarity(node_b_id);

-- ============================================
-- AUDIT TABLES
-- ============================================

-- Track hierarchy code changes
CREATE TABLE hierarchy_code_changes (
    id SERIAL PRIMARY KEY,
    node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
    hierarchy_type VARCHAR(20) NOT NULL,  -- 'function' or 'organization'
    old_code VARCHAR(100),
    new_code VARCHAR(100) NOT NULL,
    change_reason VARCHAR(255),
    triggered_by_node_id UUID REFERENCES nodes(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_code_changes_node ON hierarchy_code_changes(node_id);
CREATE INDEX idx_code_changes_date ON hierarchy_code_changes(changed_at DESC);

-- ============================================
-- PROCESSING QUEUE TABLE
-- ============================================

CREATE TABLE processing_queue (
    id SERIAL PRIMARY KEY,
    node_id UUID REFERENCES nodes(id) ON DELETE CASCADE UNIQUE,
    priority INTEGER DEFAULT 5,
    status VARCHAR(20) DEFAULT 'pending',  -- pending, processing, completed, failed
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    queued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_queue_status_priority ON processing_queue(status, priority, queued_at);
```

## 9.2 Database Functions

```sql
-- Function to get next item from processing queue
CREATE OR REPLACE FUNCTION dequeue_next_node()
RETURNS UUID AS $$
DECLARE
    next_node_id UUID;
BEGIN
    UPDATE processing_queue
    SET status = 'processing',
        started_at = NOW(),
        attempts = attempts + 1
    WHERE id = (
        SELECT id FROM processing_queue
        WHERE status = 'pending'
        ORDER BY priority ASC, queued_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    RETURNING node_id INTO next_node_id;
    
    RETURN next_node_id;
END;
$$ LANGUAGE plpgsql;


-- Function to find similar nodes
CREATE OR REPLACE FUNCTION find_similar_nodes(
    target_node_id UUID,
    min_shared_codes INTEGER DEFAULT 3,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    node_id UUID,
    title VARCHAR,
    similarity_score FLOAT,
    shared_codes INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN ns.node_a_id = target_node_id THEN ns.node_b_id
            ELSE ns.node_a_id
        END as node_id,
        n.title,
        ns.similarity_score,
        ns.shared_metadata_count as shared_codes
    FROM node_similarity ns
    JOIN nodes n ON n.id = CASE 
        WHEN ns.node_a_id = target_node_id THEN ns.node_b_id
        ELSE ns.node_a_id
    END
    WHERE (ns.node_a_id = target_node_id OR ns.node_b_id = target_node_id)
    AND ns.shared_metadata_count >= min_shared_codes
    ORDER BY ns.similarity_score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;


-- Function to update similarity scores for a node
CREATE OR REPLACE FUNCTION update_node_similarities(target_node_id UUID)
RETURNS VOID AS $$
DECLARE
    target_codes INTEGER[];
    target_code_count INTEGER;
BEGIN
    -- Get metadata codes for target node
    SELECT ARRAY_AGG(metadata_code_id)
    INTO target_codes
    FROM node_metadata
    WHERE node_id = target_node_id;
    
    target_code_count := COALESCE(array_length(target_codes, 1), 0);
    
    IF target_code_count = 0 THEN
        RETURN;  -- No metadata codes, no similarities
    END IF;
    
    -- Delete existing similarities for this node
    DELETE FROM node_similarity
    WHERE node_a_id = target_node_id OR node_b_id = target_node_id;
    
    -- Insert new similarities
    INSERT INTO node_similarity (node_a_id, node_b_id, similarity_score, shared_metadata_count)
    SELECT 
        LEAST(target_node_id, other_node_id),
        GREATEST(target_node_id, other_node_id),
        shared_count::FLOAT / (target_code_count + other_code_count - shared_count),
        shared_count
    FROM (
        SELECT 
            nm.node_id as other_node_id,
            COUNT(*) as shared_count,
            (SELECT COUNT(*) FROM node_metadata WHERE node_id = nm.node_id) as other_code_count
        FROM node_metadata nm
        WHERE nm.metadata_code_id = ANY(target_codes)
        AND nm.node_id != target_node_id
        GROUP BY nm.node_id
        HAVING COUNT(*) >= 2  -- Minimum shared codes threshold
    ) similarities
    ON CONFLICT (node_a_id, node_b_id) DO UPDATE
    SET similarity_score = EXCLUDED.similarity_score,
        shared_metadata_count = EXCLUDED.shared_metadata_count,
        computed_at = NOW();
END;
$$ LANGUAGE plpgsql;
```

---

# 10. AI Classification Logic

## 10.1 Overview

The AI performs classification at two stages:
1. **Quick Classification (Phase 1):** Lightweight, fast, determines hierarchy position
2. **Deep Analysis (Phase 2):** Comprehensive, generates rich metadata

## 10.2 Quick Classification Prompt (Phase 1)

```
SYSTEM:
You are a content classification AI for a knowledge base system. 
Your task is to quickly categorize imported URLs into a hierarchical structure.

You must output ONLY valid JSON with the following structure:
{
  "segment": "<single uppercase letter>",
  "category": "<3 uppercase letters>",
  "content_type": "<single uppercase letter>",
  "organization": "<4 uppercase letters>",
  "confidence": <float 0-1>,
  "reasoning": "<brief explanation>"
}

SEGMENT CODES:
A = AI (artificial intelligence, ML, LLMs)
T = Technology (software, hardware, dev tools)
F = Finance (money, investing, FP&A)
S = Sports (football, fantasy, athletics)
H = Health (medical, wellness, accessibility)
B = Business (strategy, operations, management)
E = Entertainment (media, gaming, music)
L = Lifestyle (home, fashion, food, travel)
X = Science (research, academia)
C = Creative (design, art, writing)

CONTENT TYPE CODES:
T = Website/Tool (interactive platform, SaaS)
A = Article (written content, blog, docs)
V = Video (YouTube, Vimeo)
P = Podcast (episodic audio/video)
R = Research Paper (academic, whitepaper)
G = Repository (GitHub, code libraries)
S = Social Post (Twitter, LinkedIn)
C = Course/Tutorial (structured learning)
I = Image/Graphic (infographics)
N = Newsletter (email content)
K = Book/eBook

For CATEGORY, use existing codes if applicable or create a new 3-letter code.
For ORGANIZATION, use existing codes if known or create a new 4-letter code from company name.

USER:
URL: {url}
Page Title: {title}
Meta Description: {meta_description}
Domain: {domain}
Content Preview: {first_500_chars}
```

### Example Classifications

```json
// Input: https://anthropic.com/claude/opus-4-5
{
  "segment": "A",
  "category": "LLM",
  "content_type": "T",
  "organization": "ANTH",
  "confidence": 0.95,
  "reasoning": "Product page for Claude LLM from Anthropic"
}

// Input: https://github.com/langchain-ai/langchain
{
  "segment": "A",
  "category": "AGT",
  "content_type": "G",
  "organization": "LNCH",
  "confidence": 0.92,
  "reasoning": "GitHub repository for LangChain agent framework"
}

// Input: https://www.youtube.com/watch?v=abc123
// (Video about DraftKings NFL DFS strategy)
{
  "segment": "S",
  "category": "DFS",
  "content_type": "V",
  "organization": "YOUT",
  "confidence": 0.88,
  "reasoning": "YouTube video covering DFS lineup strategy for NFL"
}
```

## 10.3 Deep Analysis Prompt (Phase 2)

```
SYSTEM:
You are a content analysis AI for a knowledge base system.
Your task is to extract detailed metadata from imported content.

You must output ONLY valid JSON with the following structure:
{
  "title": "<extracted or generated title, max 500 chars>",
  "company": "<company/organization name>",
  "phrase_description": "<ultra-brief tagline, max 100 chars>",
  "short_description": "<1-3 sentence summary, max 500 chars>",
  "key_concepts": ["<tag1>", "<tag2>", ...],  // max 20 tags
  "metadata_codes": {
    "ORG": ["<value1>"],
    "FNC": ["<value1>", "<value2>", ...],
    "TEC": ["<value1>", "<value2>", ...],
    "CON": ["<value1>", "<value2>", ...],
    "IND": ["<value1>", "<value2>", ...],
    "AUD": ["<value1>", "<value2>", ...],
    "PRC": ["<value1>"],
    "PLT": ["<value1>", "<value2>", ...]
  }
}

METADATA CODE GUIDELINES:
- ORG: Organization/company (uppercase, e.g., "ANTHROPIC")
- FNC: Functions/capabilities (e.g., "CODEGEN", "REASONING", "ANALYSIS")
- TEC: Technologies used (e.g., "PYTHON", "API", "REACT")
- CON: Concepts/themes (e.g., "FRONTIER_MODEL", "MULTIMODAL")
- IND: Industries (e.g., "TECHNOLOGY", "HEALTHCARE", "FINTECH")
- AUD: Target audience (e.g., "DEVELOPER", "ENTERPRISE", "CONSUMER")
- PRC: Pricing model (e.g., "FREE", "FREEMIUM", "PAID")
- PLT: Platform (e.g., "WEB", "API", "MOBILE")

KEY CONCEPTS should be lowercase, human-readable tags.
METADATA CODES should be UPPERCASE with underscores.

USER:
URL: {url}
Full Page Content:
{full_text_content}

Structured Data Found:
{json_ld_data}
{opengraph_data}
```

### Example Deep Analysis Output

```json
{
  "title": "Claude Opus 4.5 - Anthropic's Most Intelligent AI Model",
  "company": "Anthropic",
  "phrase_description": "Anthropic's flagship reasoning model with 200K context",
  "short_description": "Claude Opus 4.5 is Anthropic's most advanced AI model, featuring enhanced reasoning capabilities, multimodal understanding, and extended context windows up to 200K tokens. Available via API and the Claude.ai interface for enterprise and developer use.",
  "key_concepts": [
    "reasoning",
    "multimodal",
    "long context",
    "enterprise ai",
    "api access",
    "code generation",
    "frontier model",
    "constitutional ai",
    "safety",
    "assistant"
  ],
  "metadata_codes": {
    "ORG": ["ANTHROPIC"],
    "FNC": ["CODEGEN", "REASONING", "ANALYSIS", "CONVERSATION", "MULTIMODAL", "WRITING"],
    "TEC": ["API", "PYTHON", "TYPESCRIPT", "REST", "STREAMING"],
    "CON": ["FRONTIER_MODEL", "LONG_CONTEXT", "SAFETY", "CONSTITUTIONAL_AI", "RLHF"],
    "IND": ["TECHNOLOGY", "ENTERPRISE"],
    "AUD": ["DEVELOPER", "ENTERPRISE", "RESEARCHER"],
    "PRC": ["FREEMIUM", "PAID"],
    "PLT": ["WEB", "API"]
  }
}
```

## 10.4 Differentiator Detection

When multiple nodes need differentiation for subcategories:

```
SYSTEM:
You are analyzing multiple content items that need to be differentiated 
in a hierarchical knowledge base.

Given a list of items at the same hierarchy level, identify the SINGLE 
attribute that BEST differentiates them from each other.

The differentiator must SPLIT the items apart, not describe what they 
have in common.

Priority order for differentiation:
1. Brand/Product name (different companies or product lines)
2. Version (different versions of same product)
3. Variant (different editions, tiers, or configurations)
4. Creator/Author (different people)
5. Time/Date (different time periods)
6. Unique identifier (fallback)

Output JSON:
{
  "differentiator_type": "<brand|version|variant|creator|date|unique>",
  "differentiator_attribute": "<specific attribute name>",
  "groups": {
    "<group_value_1>": [<item_indices>],
    "<group_value_2>": [<item_indices>],
    ...
  },
  "reasoning": "<explanation>"
}

USER:
Items to differentiate:
{items_json}

They currently share this hierarchy path:
{current_path}
```

## 10.5 Model Selection

| Phase | Model Requirements | Recommended |
|-------|-------------------|-------------|
| Phase 1 Quick | Fast, cheap, good at classification | Claude Haiku, GPT-4o-mini |
| Phase 2 Deep | Thorough, good at extraction | Claude Sonnet, GPT-4o |
| Differentiator | Logical reasoning | Claude Sonnet, GPT-4o |

---

# 11. Node Association & Similarity

## 11.1 Similarity Scoring Algorithm

```python
def calculate_similarity(node_a_codes: set, node_b_codes: set) -> float:
    """
    Calculate Jaccard similarity between two nodes based on metadata codes.
    
    Jaccard Index = |A â© B| / |A âª B|
    
    Returns:
        Float between 0 (no similarity) and 1 (identical)
    """
    if not node_a_codes or not node_b_codes:
        return 0.0
    
    intersection = len(node_a_codes & node_b_codes)
    union = len(node_a_codes | node_b_codes)
    
    return intersection / union


def calculate_weighted_similarity(node_a_codes: dict, node_b_codes: dict) -> float:
    """
    Calculate weighted similarity with different code types having different weights.
    
    Weights:
    - ORG: 2.0 (same company is strong signal)
    - FNC: 1.5 (same function is meaningful)
    - TEC: 1.0 (same technology)
    - CON: 1.2 (same concepts)
    - IND: 0.8 (same industry, broader)
    - AUD: 0.8 (same audience)
    - PRC: 0.5 (pricing less meaningful)
    - PLT: 0.5 (platform less meaningful)
    """
    WEIGHTS = {
        'ORG': 2.0,
        'FNC': 1.5,
        'TEC': 1.0,
        'CON': 1.2,
        'IND': 0.8,
        'AUD': 0.8,
        'PRC': 0.5,
        'PLT': 0.5,
        'DOM': 0.3,
    }
    
    total_weight = 0
    matched_weight = 0
    
    all_codes = set(node_a_codes.keys()) | set(node_b_codes.keys())
    
    for code in all_codes:
        code_type = code.split(':')[0]
        weight = WEIGHTS.get(code_type, 1.0)
        total_weight += weight
        
        if code in node_a_codes and code in node_b_codes:
            matched_weight += weight
    
    if total_weight == 0:
        return 0.0
    
    return matched_weight / total_weight
```

## 11.2 Similarity Computation Triggers

Similarities are computed:
1. **On Phase 2 completion:** Compute similarities for the new node
2. **Batch recomputation:** Nightly job to refresh all similarities
3. **On demand:** When user requests "related content"

```python
async def compute_similarities_for_node(node_id: str):
    """
    Compute and store similarity scores between target node and all others.
    """
    # Get target node's metadata codes
    target_codes = get_node_metadata_codes(node_id)
    
    if len(target_codes) < 2:
        return  # Not enough codes for meaningful similarity
    
    # Get all other nodes with their codes (batched for efficiency)
    all_other_nodes = get_all_nodes_with_metadata(exclude=node_id)
    
    similarities = []
    for other_node_id, other_codes in all_other_nodes:
        score = calculate_weighted_similarity(target_codes, other_codes)
        shared_count = len(set(target_codes.keys()) & set(other_codes.keys()))
        
        if score > 0.1 and shared_count >= 2:  # Threshold for storage
            similarities.append({
                'node_a_id': min(node_id, other_node_id),
                'node_b_id': max(node_id, other_node_id),
                'similarity_score': score,
                'shared_metadata_count': shared_count
            })
    
    # Batch upsert
    upsert_similarities(similarities)
```

## 11.3 Association Use Cases

### Related Content
```sql
-- Get top 5 related items for a node
SELECT 
    n.id,
    n.title,
    n.phrase_description,
    ns.similarity_score
FROM nodes n
JOIN node_similarity ns ON 
    (ns.node_a_id = :target_id AND ns.node_b_id = n.id) OR
    (ns.node_b_id = :target_id AND ns.node_a_id = n.id)
WHERE n.phase_2_complete = TRUE
ORDER BY ns.similarity_score DESC
LIMIT 5;
```

### Knowledge Graph Edges
```python
def build_knowledge_graph_edges(min_similarity: float = 0.3):
    """
    Generate graph edges for visualization.
    
    Returns:
        List of edges with source, target, weight
    """
    edges = db.query("""
        SELECT 
            node_a_id as source,
            node_b_id as target,
            similarity_score as weight
        FROM node_similarity
        WHERE similarity_score >= %s
    """, [min_similarity])
    
    return [
        {
            'source': str(e.source),
            'target': str(e.target),
            'weight': e.weight
        }
        for e in edges
    ]
```

### Clustering
```python
def find_content_clusters():
    """
    Identify clusters of highly related content.
    Uses connected components with similarity threshold.
    """
    import networkx as nx
    
    # Build graph
    G = nx.Graph()
    
    edges = db.query("""
        SELECT node_a_id, node_b_id, similarity_score
        FROM node_similarity
        WHERE similarity_score >= 0.4
    """)
    
    for e in edges:
        G.add_edge(str(e.node_a_id), str(e.node_b_id), weight=e.similarity_score)
    
    # Find connected components
    clusters = list(nx.connected_components(G))
    
    return [
        {
            'cluster_id': i,
            'node_ids': list(cluster),
            'size': len(cluster)
        }
        for i, cluster in enumerate(clusters)
    ]
```

---

# 12. User Interface Requirements

## 12.1 Hierarchy Toggle

### Toggle Component
```
âââââââââââââââââââââââââââââââââââââââââââ
â  View Mode:                             â
â  ââââââââââââââââ ââââââââââââââââââââ  â
â  â â Function   â â â Organization   â  â
â  ââââââââââââââââ ââââââââââââââââââââ  â
âââââââââââââââââââââââââââââââââââââââââââ
```

### Toggle Behavior
- **Instant switch:** No loading, no recalculation
- **Preserve selection:** If viewing a node, show same node in new view
- **Persist preference:** Remember user's last view choice
- **URL update:** Update URL param (?view=function or ?view=organization)

## 12.2 Tree View Component

### Function View Tree
```
[Segment Icon] Segment Name
âââ [Category Icon] Category Name
â   âââ [Content Type Icon] Content Type
â   â   âââ [Node] Node Title
â   â   âââ [Node] Node Title
â   â   âââ [Subcategory]
â   â       âââ [Node] Node Title
â   â       âââ [Node] Node Title
â   âââ [Content Type Icon] Content Type
â       âââ [Node] Node Title
âââ [Category Icon] Category Name
    âââ ...
```

### Organization View Tree
```
[Logo] Organization Name
âââ [Category Icon] Category Name
â   âââ [Content Type Icon] Content Type
â   â   âââ [Node] Node Title
â   â   âââ [Node] Node Title
â   âââ [Content Type Icon] Content Type
â       âââ [Node] Node Title
âââ [Category Icon] Category Name
    âââ ...
```

### Tree Interactions
- **Expand/Collapse:** Click on folder icons
- **Select node:** Click on node title
- **Drag & Drop:** Manual reorganization (creates manual override)
- **Right-click menu:** Rename, Move, Delete, Copy link
- **Search filter:** Type to filter visible nodes

## 12.3 Node Detail Panel

```
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
â [Logo]  Node Title                               [â® Menu]  â
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ¤
â Phrase Description                                          â
â                                                             â
â Short Description text goes here spanning multiple          â
â lines as needed for the full 1-3 sentence summary.         â
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ¤
â Key Concepts:                                               â
â [tag1] [tag2] [tag3] [tag4] [tag5]                         â
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ¤
â Details                                                     â
â âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ  â
â Source:       anthropic.com                                 â
â Company:      Anthropic                                     â
â Added:        Jan 18, 2026 at 3:42 PM                      â
â Type:         Tool                                          â
â                                                             â
â Hierarchy (Function):   A.LLM.T1.1                         â
â Hierarchy (Org):        ANTH.LLM.T1.1                      â
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ¤
â Related Content                                             â
â âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ  â
â â¢ [Claude Sonnet 4.5] - 95% similar                        â
â â¢ [GPT-5.2] - 67% similar                                  â
â â¢ [Anthropic API Docs] - 58% similar                       â
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ¤
â [Open URL]  [Copy Link]  [Edit]  [Delete]                  â
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
```

## 12.4 Import Modal

```
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
â                    Import Content                      [Ã]  â
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ¤
â                                                             â
â URL:                                                        â
â ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
â â https://                                                ââ
â ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
â                                                             â
â [Import]                                                    â
â                                                             â
â âââââââââââââââââââ OR âââââââââââââââââââ                 â
â                                                             â
â Paste multiple URLs (one per line):                        â
â ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
â â                                                         ââ
â â                                                         ââ
â â                                                         ââ
â ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
â                                                             â
â [Import All (0)]                                           â
â                                                             â
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
```

### Import Progress
```
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
â                    Importing...                             â
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ¤
â                                                             â
â â URL validated                                            â
â â Page fetched                                             â
â â³ Classifying content...                                   â
â â Generating codes                                          â
â â Saving to database                                        â
â                                                             â
â ââââââââââââââââââââââââââââââââââââââââ  60%              â
â                                                             â
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
```

### Import Result
```
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
â                    Import Complete                     [Ã]  â
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ¤
â                                                             â
â â Successfully imported!                                   â
â                                                             â
â [Logo] Claude Opus 4.5                                     â
â                                                             â
â Placed in:                                                  â
â AI â LLMs â Tool â Claude â Opus 4.5                       â
â                                                             â
â Code: A.LLM.T1.1                                           â
â                                                             â
â â¹ Rich metadata will be generated in the background.       â
â                                                             â
â [View Node]  [Import Another]  [Close]                     â
â                                                             â
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
```

## 12.5 Search Interface

### Search Bar
```
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
â ð Search knowledge base...                        [Filters]â
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
```

### Search Filters Panel
```
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
â Filters                                               [Ã]   â
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ¤
â Segment:        [All â¼]                                     â
â Category:       [All â¼]                                     â
â Content Type:   [All â¼]                                     â
â Organization:   [All â¼]                                     â
â                                                             â
â Date Added:     [Any time â¼]                               â
â                 â Last 24 hours                             â
â                 â Last 7 days                               â
â                 â Last 30 days                              â
â                 â Custom range                              â
â                                                             â
â Has metadata:   â¡ Complete only                             â
â                                                             â
â [Apply Filters]  [Clear All]                               â
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
```

### Search Results
```
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
â Results for "claude reasoning" (15 found)                   â
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ¤
â                                                             â
â [Logo] Claude Opus 4.5                                     â
â        Anthropic's flagship reasoning model                 â
â        AI â LLMs â Tool                                    â
â        Added Jan 18, 2026                                   â
â                                                             â
â âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ  â
â                                                             â
â [Logo] Building Reasoning Agents with Claude               â
â        Tutorial on chain-of-thought prompting              â
â        AI â Agents â Article                               â
â        Added Jan 15, 2026                                   â
â                                                             â
â âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ  â
â                                                             â
â ...                                                         â
â                                                             â
â [Load more]                                                 â
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
```

---

# 13. API Specifications

## 13.1 REST API Endpoints

### Import

```
POST /api/v1/nodes/import
Content-Type: application/json

Request:
{
  "url": "https://anthropic.com/claude/opus-4-5",
  "user_id": "user_123"
}

Response (201 Created):
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "https://anthropic.com/claude/opus-4-5",
  "source_domain": "anthropic.com",
  "date_added": "2026-01-18T15:42:00Z",
  "function_hierarchy_code": "A.LLM.T1.1",
  "organization_hierarchy_code": "ANTH.LLM.T1.1",
  "segment_code": "A",
  "category_code": "LLM",
  "content_type_code": "T",
  "organization_code": "ANTH",
  "phase_2_complete": false
}
```

### Batch Import

```
POST /api/v1/nodes/import/batch
Content-Type: application/json

Request:
{
  "urls": [
    "https://anthropic.com/claude/opus-4-5",
    "https://openai.com/gpt-5",
    "https://github.com/langchain-ai/langchain"
  ],
  "user_id": "user_123"
}

Response (202 Accepted):
{
  "batch_id": "batch_abc123",
  "total_urls": 3,
  "status": "processing",
  "results_url": "/api/v1/nodes/import/batch/batch_abc123"
}
```

### Get Node

```
GET /api/v1/nodes/{node_id}

Response (200 OK):
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "https://anthropic.com/claude/opus-4-5",
  "source_domain": "anthropic.com",
  "date_added": "2026-01-18T15:42:00Z",
  
  "function_hierarchy": {
    "code": "A.LLM.T1.1",
    "segment": {"code": "A", "name": "AI"},
    "category": {"code": "LLM", "name": "Large Language Models"},
    "content_type": {"code": "T", "name": "Website/Tool"},
    "subcategory_chain": ["1", "1"],
    "breadcrumb": ["AI", "LLMs", "Tool", "Claude", "Opus 4.5"]
  },
  
  "organization_hierarchy": {
    "code": "ANTH.LLM.T1.1",
    "organization": {"code": "ANTH", "name": "Anthropic", "logo_url": "..."},
    "category": {"code": "LLM", "name": "Large Language Models"},
    "content_type": {"code": "T", "name": "Website/Tool"},
    "subcategory_chain": ["1", "1"],
    "breadcrumb": ["Anthropic", "LLMs", "Tool", "Opus 4.5"]
  },
  
  "descriptors": {
    "title": "Claude Opus 4.5 - Anthropic's Most Intelligent AI Model",
    "company": "Anthropic",
    "phrase_description": "Anthropic's flagship reasoning model with 200K context",
    "short_description": "Claude Opus 4.5 is Anthropic's most advanced AI model...",
    "logo_url": "https://...",
    "key_concepts": ["reasoning", "multimodal", "long context", ...]
  },
  
  "metadata_codes": [
    "ORG:ANTHROPIC",
    "FNC:CODEGEN",
    "FNC:REASONING",
    "TEC:API",
    ...
  ],
  
  "phase_2_complete": true,
  "created_at": "2026-01-18T15:42:00Z",
  "updated_at": "2026-01-18T15:45:00Z"
}
```

### Get Hierarchy Tree

```
GET /api/v1/hierarchy/function
GET /api/v1/hierarchy/organization

Query Params:
- expanded: Comma-separated list of expanded node codes
- search: Filter by search term

Response (200 OK):
{
  "type": "function",
  "tree": [
    {
      "code": "A",
      "name": "AI",
      "type": "segment",
      "children": [
        {
          "code": "A.LLM",
          "name": "Large Language Models",
          "type": "category",
          "children": [
            {
              "code": "A.LLM.T",
              "name": "Tool",
              "type": "content_type",
              "children": [
                {
                  "code": "A.LLM.T1",
                  "name": "Claude",
                  "type": "subcategory",
                  "children": [
                    {
                      "code": "A.LLM.T1.1",
                      "name": "Opus 4.5",
                      "type": "node",
                      "node_id": "550e8400...",
                      "title": "Claude Opus 4.5",
                      "logo_url": "..."
                    },
                    ...
                  ]
                },
                ...
              ]
            },
            ...
          ]
        },
        ...
      ]
    },
    ...
  ]
}
```

### Search Nodes

```
GET /api/v1/nodes/search

Query Params:
- q: Search query (searches descriptor_string)
- segment: Filter by segment code
- category: Filter by category code
- content_type: Filter by content type code
- organization: Filter by organization code
- metadata: Comma-separated metadata codes to filter by
- date_from: ISO date
- date_to: ISO date
- page: Page number (default 1)
- limit: Results per page (default 20, max 100)

Response (200 OK):
{
  "query": "claude reasoning",
  "total": 15,
  "page": 1,
  "limit": 20,
  "results": [
    {
      "id": "550e8400...",
      "title": "Claude Opus 4.5",
      "phrase_description": "Anthropic's flagship reasoning model",
      "function_hierarchy_code": "A.LLM.T1.1",
      "logo_url": "...",
      "date_added": "2026-01-18T15:42:00Z",
      "relevance_score": 0.95
    },
    ...
  ]
}
```

### Get Similar Nodes

```
GET /api/v1/nodes/{node_id}/similar

Query Params:
- limit: Max results (default 5, max 20)
- min_similarity: Minimum similarity score (default 0.2)

Response (200 OK):
{
  "node_id": "550e8400...",
  "similar_nodes": [
    {
      "id": "661f9511...",
      "title": "Claude Sonnet 4.5",
      "similarity_score": 0.95,
      "shared_metadata_count": 12,
      "shared_codes": ["ORG:ANTHROPIC", "FNC:CODEGEN", ...]
    },
    ...
  ]
}
```

### Get Registries

```
GET /api/v1/registries/segments
GET /api/v1/registries/categories?segment=A
GET /api/v1/registries/content-types
GET /api/v1/registries/organizations
GET /api/v1/registries/metadata-codes?type=FNC
```

## 13.2 WebSocket Events

### Real-time Updates

```javascript
// Connect to WebSocket
const ws = new WebSocket('wss://api.decant.app/ws');

// Subscribe to updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channels: ['node_updates', 'hierarchy_changes']
}));

// Receive events
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'node_created':
      // New node imported
      // data.node contains the node object
      break;
      
    case 'node_updated':
      // Node Phase 2 completed or edited
      // data.node contains updated node object
      break;
      
    case 'hierarchy_restructured':
      // Codes changed due to new node
      // data.changes contains array of {node_id, old_code, new_code}
      break;
      
    case 'node_deleted':
      // Node removed
      // data.node_id contains deleted node ID
      break;
  }
};
```

---

# 14. Edge Cases & Error Handling

## 14.1 URL Edge Cases

### Duplicate URL Detection
```python
def check_duplicate(url: str) -> Optional[Node]:
    """
    Check if URL already exists in database.
    Normalizes URL before comparison.
    """
    normalized = normalize_url(url)
    
    return db.query(
        "SELECT * FROM nodes WHERE normalize_url(url) = %s",
        [normalized]
    )

def normalize_url(url: str) -> str:
    """
    Normalize URL for deduplication comparison.
    """
    parsed = urlparse(url)
    
    # Lowercase scheme and host
    scheme = parsed.scheme.lower()
    host = parsed.netloc.lower()
    
    # Remove www. prefix
    if host.startswith('www.'):
        host = host[4:]
    
    # Remove trailing slash
    path = parsed.path.rstrip('/')
    
    # Remove tracking parameters
    query_params = parse_qs(parsed.query)
    filtered_params = {
        k: v for k, v in query_params.items()
        if k not in ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'fbclid']
    }
    query = urlencode(filtered_params, doseq=True)
    
    # Remove fragment
    # (ignore #section anchors for dedup)
    
    return f"{scheme}://{host}{path}" + (f"?{query}" if query else "")
```

### Invalid URLs
```python
BLOCKED_PATTERNS = [
    r'localhost',
    r'127\.0\.0\.1',
    r'192\.168\.',
    r'10\.',
    r'file://',
]

def validate_url(url: str) -> tuple[bool, Optional[str]]:
    """
    Validate URL is importable.
    
    Returns:
        (is_valid, error_message)
    """
    # Check format
    try:
        parsed = urlparse(url)
    except Exception:
        return False, "Invalid URL format"
    
    # Check scheme
    if parsed.scheme not in ['http', 'https']:
        return False, "URL must use http or https"
    
    # Check host exists
    if not parsed.netloc:
        return False, "URL must include a domain"
    
    # Check blocked patterns
    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, url):
            return False, "Local/private URLs are not allowed"
    
    return True, None
```

### URL Fetch Failures
```python
async def fetch_with_retry(url: str, max_retries: int = 3) -> PageData:
    """
    Fetch URL with retry logic.
    """
    for attempt in range(max_retries):
        try:
            response = await http_client.get(
                url,
                timeout=30,
                headers={'User-Agent': 'DecantBot/1.0'},
                follow_redirects=True
            )
            
            if response.status_code == 200:
                return parse_page(response)
            
            if response.status_code == 403:
                raise FetchError("Access denied - site may block bots")
            
            if response.status_code == 404:
                raise FetchError("Page not found")
            
            if response.status_code >= 500:
                # Server error, retry
                await asyncio.sleep(2 ** attempt)
                continue
                
        except httpx.TimeoutException:
            if attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt)
                continue
            raise FetchError("Request timed out")
    
    raise FetchError(f"Failed after {max_retries} attempts")
```

## 14.2 Classification Edge Cases

### Unknown Segment
```python
def handle_unknown_segment(classification: dict) -> str:
    """
    Handle case where AI cannot determine segment.
    """
    if classification.get('segment') in [None, 'UNKNOWN', '']:
        # Default to Technology segment
        # Log for manual review
        log_classification_issue(
            url=classification['url'],
            issue='unknown_segment',
            ai_output=classification
        )
        return 'T'  # Technology as fallback
    
    return classification['segment']
```

### New Category Needed
```python
def get_or_create_category(segment: str, category_code: str, category_name: str) -> str:
    """
    Get existing category or create new one.
    """
    existing = db.query(
        "SELECT code FROM category_registry WHERE segment_code = %s AND code = %s",
        [segment, category_code]
    )
    
    if existing:
        return category_code
    
    # Check for code collision in same segment
    collision = db.query(
        "SELECT code FROM category_registry WHERE segment_code = %s AND code = %s",
        [segment, category_code]
    )
    
    if collision:
        # Generate alternative code
        category_code = generate_unique_category_code(segment, category_name)
    
    # Insert new category
    db.execute("""
        INSERT INTO category_registry (segment_code, code, name)
        VALUES (%s, %s, %s)
    """, [segment, category_code, category_name])
    
    return category_code
```

### Ambiguous Content Type
```python
def resolve_content_type(url: str, page_data: dict) -> str:
    """
    Determine content type with fallback logic.
    """
    # First try URL patterns
    for code, patterns in CONTENT_TYPE_PATTERNS.items():
        for pattern in patterns:
            if pattern in url:
                return code
    
    # Then try page metadata
    og_type = page_data.get('og:type')
    if og_type == 'article':
        return 'A'
    if og_type == 'video':
        return 'V'
    
    # Check for video embeds
    if has_video_embed(page_data['html']):
        return 'V'
    
    # Check for interactive elements (tool)
    if has_interactive_elements(page_data['html']):
        return 'T'
    
    # Default to Article
    return 'A'
```

## 14.3 Hierarchy Edge Cases

### Code Collision Resolution
```python
def resolve_code_collision(proposed_code: str, existing_codes: list) -> str:
    """
    Resolve collision when proposed code already exists.
    """
    if proposed_code not in existing_codes:
        return proposed_code
    
    # Try incrementing last subcategory
    parts = proposed_code.rsplit('.', 1)
    if len(parts) == 2:
        base, num = parts
        next_num = int(num) + 1
        new_code = f"{base}.{next_num}"
        return resolve_code_collision(new_code, existing_codes)
    
    # Append new subcategory
    new_code = f"{proposed_code}.1"
    return resolve_code_collision(new_code, existing_codes)
```

### Maximum Depth Limit
```python
MAX_SUBCATEGORY_DEPTH = 10

def check_depth_limit(subcategory_chain: list) -> bool:
    """
    Check if subcategory chain exceeds maximum depth.
    """
    if len(subcategory_chain) > MAX_SUBCATEGORY_DEPTH:
        log_warning(
            "Subcategory depth limit reached",
            chain=subcategory_chain
        )
        # Force uniqueness with timestamp suffix
        return True
    return False
```

### Orphan Nodes After Reorganization
```python
def cleanup_orphan_subcategories():
    """
    Remove empty subcategory branches after node deletion.
    """
    # This runs as a background job
    
    # Find subcategories with no child nodes
    orphans = db.query("""
        WITH used_paths AS (
            SELECT DISTINCT 
                regexp_replace(function_hierarchy_code, '\.\d+$', '') as parent_path
            FROM nodes
        )
        SELECT DISTINCT function_hierarchy_code 
        FROM nodes
        WHERE function_hierarchy_code NOT IN (
            SELECT parent_path FROM used_paths
        )
        AND function_hierarchy_code ~ '\.\d+\.\d+'  -- Has subcategories
    """)
    
    # Restructure if needed
    for orphan in orphans:
        restructure_branch(orphan)
```

## 14.4 Error Response Format

```json
{
  "error": {
    "code": "DUPLICATE_URL",
    "message": "This URL has already been imported",
    "details": {
      "existing_node_id": "550e8400-e29b-41d4-a716-446655440000",
      "existing_title": "Claude Opus 4.5"
    },
    "suggestions": [
      "View the existing node",
      "Update the existing node",
      "Import anyway (create duplicate)"
    ]
  }
}
```

### Error Codes
| Code | HTTP Status | Description |
|------|-------------|-------------|
| INVALID_URL | 400 | URL format is invalid |
| DUPLICATE_URL | 409 | URL already exists |
| FETCH_FAILED | 502 | Could not fetch page content |
| CLASSIFICATION_FAILED | 500 | AI classification error |
| NODE_NOT_FOUND | 404 | Requested node doesn't exist |
| RATE_LIMITED | 429 | Too many requests |
| INVALID_HIERARCHY_CODE | 400 | Malformed hierarchy code |

---

# 15. Testing Requirements

## 15.1 Unit Tests

### URL Validation Tests
```python
def test_url_validation():
    # Valid URLs
    assert validate_url("https://anthropic.com/claude")[0] == True
    assert validate_url("http://example.com/path?query=1")[0] == True
    
    # Invalid URLs
    assert validate_url("not-a-url")[0] == False
    assert validate_url("ftp://files.com")[0] == False
    assert validate_url("http://localhost:3000")[0] == False
    assert validate_url("http://192.168.1.1")[0] == False

def test_url_normalization():
    # Trailing slashes
    assert normalize_url("https://example.com/") == "https://example.com"
    
    # WWW removal
    assert normalize_url("https://www.example.com") == "https://example.com"
    
    # Tracking params
    assert normalize_url("https://example.com?utm_source=twitter") == "https://example.com"
    
    # Preserve meaningful params
    assert "page=2" in normalize_url("https://example.com?page=2")
```

### Hierarchy Code Tests
```python
def test_function_code_parsing():
    code = "A.LLM.T1.1"
    parsed = parse_function_code(code)
    
    assert parsed['segment'] == 'A'
    assert parsed['category'] == 'LLM'
    assert parsed['content_type'] == 'T'
    assert parsed['subcategory_chain'] == ['1', '1']

def test_code_generation():
    # First node in category
    code = generate_function_code(
        segment='A',
        category='LLM',
        content_type='T',
        existing_nodes=[]
    )
    assert code == 'A.LLM.T1'
    
    # Second node, different brand
    code = generate_function_code(
        segment='A',
        category='LLM',
        content_type='T',
        existing_nodes=[mock_node(code='A.LLM.T1', brand='Claude')],
        new_node_brand='GPT'
    )
    assert code == 'A.LLM.T2'

def test_subcategory_differentiation():
    nodes = [
        mock_node(brand='Claude', version='Opus 4.5'),
        mock_node(brand='Claude', version='Sonnet 4.5'),
    ]
    
    differentiator = find_differentiator(nodes)
    assert differentiator == 'version'  # Brand is same, version differs
```

### Similarity Tests
```python
def test_similarity_calculation():
    codes_a = {'ORG:ANTHROPIC', 'FNC:CODEGEN', 'TEC:API'}
    codes_b = {'ORG:ANTHROPIC', 'FNC:CODEGEN', 'TEC:PYTHON'}
    
    similarity = calculate_similarity(codes_a, codes_b)
    # Shared: 2, Union: 4, Jaccard: 0.5
    assert similarity == 0.5

def test_weighted_similarity():
    codes_a = {'ORG:ANTHROPIC': 1, 'FNC:CODEGEN': 1}
    codes_b = {'ORG:ANTHROPIC': 1, 'FNC:REASONING': 1}
    
    similarity = calculate_weighted_similarity(codes_a, codes_b)
    # ORG matches (weight 2.0), FNC doesn't (weight 1.5 each)
    # Matched: 2.0, Total: 2.0 + 1.5 + 1.5 = 5.0
    assert similarity == 2.0 / 5.0
```

## 15.2 Integration Tests

### Import Flow Test
```python
async def test_full_import_flow():
    # Setup
    url = "https://anthropic.com/claude/opus-4-5"
    
    # Phase 1: Import
    response = await client.post('/api/v1/nodes/import', json={'url': url})
    assert response.status_code == 201
    
    node = response.json()
    assert node['function_hierarchy_code'].startswith('A.LLM')
    assert node['phase_2_complete'] == False
    
    # Wait for Phase 2
    await wait_for_phase_2(node['id'], timeout=60)
    
    # Verify enrichment
    node = await client.get(f'/api/v1/nodes/{node["id"]}')
    assert node['phase_2_complete'] == True
    assert node['descriptors']['title'] is not None
    assert len(node['metadata_codes']) >= 3

async def test_hierarchy_restructuring():
    # Import first Claude model
    node1 = await import_node("https://anthropic.com/claude/opus-4-5")
    assert node1['function_hierarchy_code'] == 'A.LLM.T1'
    
    # Import second Claude model - should trigger restructure
    node2 = await import_node("https://anthropic.com/claude/sonnet-4-5")
    
    # Verify restructuring
    node1_updated = await get_node(node1['id'])
    assert node1_updated['function_hierarchy_code'] == 'A.LLM.T1.1'  # Was T1
    assert node2['function_hierarchy_code'] == 'A.LLM.T1.2'
```

### Search Test
```python
async def test_search():
    # Import test data
    await import_node("https://anthropic.com/claude/opus-4-5")
    await import_node("https://openai.com/gpt-5")
    await wait_for_all_phase_2()
    
    # Search by text
    results = await client.get('/api/v1/nodes/search?q=reasoning')
    assert len(results['results']) >= 1
    
    # Search by segment
    results = await client.get('/api/v1/nodes/search?segment=A')
    assert all(r['function_hierarchy_code'].startswith('A.') for r in results['results'])
    
    # Search by metadata
    results = await client.get('/api/v1/nodes/search?metadata=ORG:ANTHROPIC')
    assert len(results['results']) >= 1
```

## 15.3 Performance Tests

```python
async def test_import_performance():
    """Phase 1 import should complete in under 3 seconds."""
    url = "https://example.com/article"
    
    start = time.time()
    response = await client.post('/api/v1/nodes/import', json={'url': url})
    elapsed = time.time() - start
    
    assert response.status_code == 201
    assert elapsed < 3.0

async def test_search_performance():
    """Search should return results in under 500ms."""
    # Setup: Import 1000 nodes
    await bulk_import_test_data(1000)
    
    start = time.time()
    response = await client.get('/api/v1/nodes/search?q=machine+learning')
    elapsed = time.time() - start
    
    assert response.status_code == 200
    assert elapsed < 0.5

async def test_tree_load_performance():
    """Hierarchy tree should load in under 1 second."""
    # Setup: Import 1000 nodes
    await bulk_import_test_data(1000)
    
    start = time.time()
    response = await client.get('/api/v1/hierarchy/function')
    elapsed = time.time() - start
    
    assert response.status_code == 200
    assert elapsed < 1.0
```

---

# Appendix A: Quick Reference

## Code Cheat Sheet

### Segment Codes
| A | T | F | S | H | B | E | L | X | C |
|---|---|---|---|---|---|---|---|---|---|
| AI | Tech | Finance | Sports | Health | Business | Entertainment | Lifestyle | Science | Creative |

### Content Type Codes
| T | A | V | U | P | R | G | S | C | I | N | K |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Tool | Article | Video | Audio | Podcast | Research | Repo | Social | Course | Image | Newsletter | Book |

### Metadata Type Prefixes
| ORG | DOM | FNC | TEC | CON | IND | AUD | PRC | LIC | LNG | FMW | PLT |
|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| Organization | Domain | Function | Technology | Concept | Industry | Audience | Price | License | Language | Framework | Platform |

## Example Complete Node

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "https://anthropic.com/claude/opus-4-5",
  
  "function_hierarchy_code": "A.LLM.T1.1",
  "organization_hierarchy_code": "ANTH.LLM.T1.1",
  
  "segment_code": "A",
  "category_code": "LLM",
  "content_type_code": "T",
  "organization_code": "ANTH",
  
  "title": "Claude Opus 4.5",
  "source_domain": "anthropic.com",
  "company": "Anthropic",
  "phrase_description": "Anthropic's flagship reasoning model",
  "short_description": "Claude Opus 4.5 is Anthropic's most advanced AI model...",
  "logo_url": "https://assets.decant.app/logos/anthropic.png",
  "key_concepts": ["reasoning", "multimodal", "long context"],
  
  "metadata_codes": [
    "ORG:ANTHROPIC",
    "FNC:CODEGEN",
    "FNC:REASONING",
    "TEC:API",
    "CON:FRONTIER_MODEL",
    "AUD:DEVELOPER",
    "PRC:FREEMIUM"
  ],
  
  "descriptor_string": "Claude Opus 4.5|anthropic.com|Anthropic|...",
  
  "date_added": "2026-01-18T15:42:00Z",
  "phase_2_complete": true
}
```

---

# Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Category** | Second level of function hierarchy; specific topic within a segment (e.g., LLMs, Agents) |
| **Content Type** | Third level of hierarchy; format/medium of content (e.g., Article, Video, Tool) |
| **Descriptor** | Rich metadata field providing human-readable information about a node |
| **Descriptor String** | Concatenated text of all descriptors for full-text search |
| **Differentiator** | Attribute used to split nodes into subcategories |
| **Function Hierarchy** | Primary hierarchy organized by topic/purpose of content |
| **Hierarchy Code** | Unique address indicating position in hierarchy tree |
| **Metadata Code** | Tag indicating relationships/attributes for cross-cutting queries |
| **Node** | Single piece of content in the knowledge base (one imported URL) |
| **Organization** | Company/entity that created content; top level of org hierarchy |
| **Organization Hierarchy** | Alternative hierarchy organized by company/creator |
| **Phase 1** | Immediate import processing; places node in hierarchy |
| **Phase 2** | Background processing; generates rich metadata and associations |
| **Segment** | Top level of function hierarchy; broad domain (e.g., AI, Technology) |
| **Similarity Score** | Measure of relatedness between two nodes based on shared metadata |
| **Subcategory** | Dynamic level 4+ of hierarchy; created to ensure unique positioning |

---

*End of Developer Guide*

---

# PART II: IMPLEMENTATION SPECIFICATION

---

# 16. Architecture Decision: Standalone Electron

## 16.1 Critical Decision

**We are NOT building on Trilium.** Analysis showed Trilium's architecture doesn't support the dual-hierarchy toggle natively. Building standalone gives us full control over the data model.

## 16.2 Why Standalone

1. **Dual Hierarchy Support**: Full control over database schema for Function AND Organization views
2. **Clean Architecture**: Purpose-built for this use case
3. **Simpler Deployment**: Single Electron app, no server dependency
4. **Full Design Control**: Gumroad styling without fighting existing UI

## 16.3 Architecture Benefits

| Aspect | Standalone Electron | Trilium Widget (Rejected) |
|--------|---------------------|---------------------------|
| Dual hierarchy | Native support | Would require extensive hacks |
| Database control | Full SQLite control | Limited to Trilium's schema |
| UI freedom | Complete control | Constrained by Trilium UI |
| Deployment | Single .app file | Requires Trilium running |
| Updates | Independent releases | Tied to Trilium versions |

---

# 17. Tech Stack (Research-Validated)

| Component | Technology | Version | Rationale |
|-----------|------------|---------|-----------|
| **Framework** | Electron | 33.x | Cross-platform desktop, Node.js backend (downgraded from 40 for native module compatibility) |
| **Build Tool** | Electron Forge + Vite | 7.x / 5.x | Fast HMR, optimal bundling |
| **Frontend** | React 18 + TypeScript | 18.x / 5.x | Modern component model, strong typing |
| **Database** | better-sqlite3 | 9.x | Synchronous, main-process only, reliable |
| **Tree View** | React Complex Tree | 2.x | Virtualization, multi-select, drag-drop |
| **State** | React Context + useReducer | - | Simple, no external dependencies |
| **Scraping** | Metascraper + Cheerio | 5.x / 1.x | Static content extraction |
| **Dynamic Pages** | Playwright | Latest | JavaScript-rendered content (Phase 6) |
| **API Key Storage** | keytar | 7.x | System keychain (secure) |
| **AI Provider** | OpenAI API (GPT-4) | 4.x | User has API key ready |

## 17.1 Native Module Compatibility Note

**CRITICAL**: Electron 40 has V8 API changes that break better-sqlite3 compilation. 
Use Electron 33.x for stable native module support. After any Electron version change:

```bash
rm -rf node_modules package-lock.json
npm install
npm run rebuild
```

---

# 18. User Requirements Summary

| Requirement | Decision |
|-------------|----------|
| Platform | Standalone Electron desktop app (macOS primary, Windows/Linux future) |
| Database | SQLite, local only, single user |
| AI Provider | OpenAI API, fully autonomous (no confirmation dialogs) |
| Import Methods | Paste URL first, keyboard shortcut later, browser extension last |
| Layout | Three-panel (Spaces \| Tree \| Detail) |
| MVP Scope | Import + Auto-classify + View + Search + Filter |
| Content Focus | AI/Tech focused (initial taxonomy) |
| Content Storage | Descriptors only (not full page archive), works offline |
| Spaces | Both auto-generated segments AND user custom collections |
| Hierarchy Views | Function-based AND Organization-based with instant toggle |
| Node Actions | Full CRUD (view, edit, delete, merge, move) |
| Styling | Full Gumroad treatment (borders, shadows, colors) |

---

# 19. Directory Structure

```
decant-standalone/
├── package.json
├── forge.config.ts                    # Electron Forge configuration
├── vite.main.config.ts               # Vite config for main process
├── vite.preload.config.ts            # Vite config for preload
├── vite.renderer.config.ts           # Vite config for renderer
├── DECANT_MASTER_SPECIFICATION.md    # THIS FILE - complete spec
├── src/
│   ├── main/                         # Electron main process
│   │   ├── index.ts                  # Main entry, window management
│   │   ├── database/
│   │   │   ├── connection.ts         # better-sqlite3 setup
│   │   │   ├── schema.ts             # Schema creation/migration
│   │   │   ├── nodes.ts              # Node CRUD operations
│   │   │   ├── taxonomy.ts           # Hierarchy queries
│   │   │   └── search.ts             # Full-text search
│   │   ├── services/
│   │   │   ├── scraper/
│   │   │   │   ├── index.ts          # Scraper router
│   │   │   │   ├── metascraper.ts    # Static content
│   │   │   │   ├── playwright.ts     # Dynamic content (Phase 6)
│   │   │   │   └── favicon.ts        # Favicon extraction
│   │   │   ├── ai/
│   │   │   │   ├── openai.ts         # OpenAI API client
│   │   │   │   ├── classifier.ts     # Content classification
│   │   │   │   └── prompts.ts        # System prompts
│   │   │   └── import/
│   │   │       ├── pipeline.ts       # Full import flow
│   │   │       └── queue.ts          # Background processing
│   │   ├── ipc/
│   │   │   ├── handlers.ts           # IPC handler registration
│   │   │   └── channels.ts           # Channel constants
│   │   └── utils/
│   │       ├── keychain.ts           # keytar wrapper
│   │       └── paths.ts              # App data paths
│   ├── preload/
│   │   └── index.ts                  # Context bridge (api exposure)
│   ├── renderer/                     # React frontend
│   │   ├── index.html
│   │   ├── index.tsx                 # React entry
│   │   ├── App.tsx                   # Root component
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AppShell.tsx      # Three-panel layout
│   │   │   │   ├── SpacesPanel.tsx   # Left: Segments/Spaces
│   │   │   │   ├── TreePanel.tsx     # Center: Hierarchy tree
│   │   │   │   └── DetailPanel.tsx   # Right: Node details
│   │   │   ├── tree/
│   │   │   │   ├── HierarchyTree.tsx # React Complex Tree wrapper
│   │   │   │   ├── TreeNode.tsx      # Custom node renderer
│   │   │   │   └── TreeControls.tsx  # View toggle, expand/collapse
│   │   │   ├── detail/
│   │   │   │   ├── NodeDetail.tsx    # Detail view container
│   │   │   │   ├── ItemCard.tsx      # Content item display
│   │   │   │   └── MetadataEditor.tsx # Edit metadata
│   │   │   ├── import/
│   │   │   │   ├── ImportDialog.tsx  # URL input modal
│   │   │   │   └── ImportProgress.tsx # Classification progress
│   │   │   ├── search/
│   │   │   │   ├── SearchBar.tsx     # Global search
│   │   │   │   └── SearchResults.tsx # Results display
│   │   │   └── shared/
│   │   │       ├── Button.tsx        # Gumroad button
│   │   │       ├── Input.tsx         # Gumroad input
│   │   │       ├── Badge.tsx         # Content type badge
│   │   │       └── Card.tsx          # Gumroad card
│   │   ├── context/
│   │   │   ├── AppContext.tsx        # Global state
│   │   │   └── TreeContext.tsx       # Tree-specific state
│   │   ├── hooks/
│   │   │   ├── useNodes.ts           # Node data fetching
│   │   │   ├── useHierarchy.ts       # Tree data
│   │   │   ├── useSearch.ts          # Search functionality
│   │   │   └── useImport.ts          # Import flow
│   │   ├── styles/
│   │   │   ├── globals.css           # Global styles
│   │   │   ├── gumroad.css           # Gumroad design system
│   │   │   └── tree.css              # Tree-specific styles
│   │   └── types/
│   │       └── index.ts              # TypeScript interfaces
│   └── shared/                       # Shared between main/renderer
│       ├── types.ts                  # Common types
│       └── constants.ts              # Shared constants
├── resources/
│   ├── icon.icns                     # macOS icon
│   ├── icon.ico                      # Windows icon
│   └── icon.png                      # Linux icon
└── out/                              # Build output
    └── Decant-darwin-arm64/
        └── Decant.app                # Packaged macOS app
```

---

# 20. IPC Communication Pattern

## 20.1 Type Definitions

```typescript
// src/shared/types.ts

export type HierarchyView = 'function' | 'organization';

export interface Node {
  id: string;
  title: string;
  node_type: 'segment' | 'category' | 'content_type' | 'subcategory' | 'item';
  function_code: string | null;
  organization_code: string | null;
  function_parent_id: string | null;
  organization_parent_id: string | null;
  function_position: number;
  organization_position: number;
  source_url: string | null;
  favicon_path: string | null;
  thumbnail_path: string | null;
  ai_summary: string | null;
  ai_key_points: string[] | null;
  ai_confidence: number | null;
  content_type_code: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  
  // Descriptor fields (from Section 7)
  source_domain: string | null;
  company: string | null;
  phrase_description: string | null;
  short_description: string | null;
  logo_url: string | null;
  key_concepts: string[] | null;
  descriptor_string: string | null;
}

export interface CreateNodeInput {
  title: string;
  node_type: Node['node_type'];
  source_url?: string;
  function_parent_id?: string;
  organization_parent_id?: string;
}

export interface UpdateNodeInput {
  title?: string;
  ai_summary?: string;
  ai_key_points?: string[];
  phrase_description?: string;
  short_description?: string;
  key_concepts?: string[];
}

export interface TreeNode extends Node {
  children: TreeNode[];
}

export interface ImportResult {
  success: boolean;
  node?: Node;
  error?: string;
  phase1Complete: boolean;
  phase2Queued: boolean;
}

export interface SearchFilters {
  segment?: string;
  contentType?: string;
  organization?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface SearchResult {
  node: Node;
  score: number;
  matchedFields: string[];
}

export interface QueueStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}
```

## 20.2 IPC Channels

```typescript
// src/shared/types.ts (continued)

export interface IPCChannels {
  // Nodes
  'nodes:create': (data: CreateNodeInput) => Promise<Node>;
  'nodes:read': (id: string) => Promise<Node | null>;
  'nodes:update': (id: string, data: UpdateNodeInput) => Promise<Node>;
  'nodes:delete': (id: string) => Promise<void>;
  'nodes:move': (id: string, newParentId: string, view: HierarchyView) => Promise<void>;

  // Hierarchy
  'hierarchy:get-tree': (view: HierarchyView, rootId?: string) => Promise<TreeNode[]>;
  'hierarchy:get-path': (nodeId: string, view: HierarchyView) => Promise<Node[]>;
  'hierarchy:get-segments': () => Promise<Node[]>;
  'hierarchy:get-organizations': () => Promise<Node[]>;

  // Import
  'import:url': (url: string) => Promise<ImportResult>;
  'import:status': () => Promise<QueueStatus>;

  // Search
  'search:query': (query: string, filters?: SearchFilters) => Promise<SearchResult[]>;

  // Settings
  'settings:get': (key: string) => Promise<string | null>;
  'settings:set': (key: string, value: string) => Promise<void>;
  'settings:get-api-key': () => Promise<string | null>;
  'settings:set-api-key': (key: string) => Promise<void>;
}
```

## 20.3 Preload Script

```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('decantAPI', {
  nodes: {
    create: (data) => ipcRenderer.invoke('nodes:create', data),
    read: (id) => ipcRenderer.invoke('nodes:read', id),
    update: (id, data) => ipcRenderer.invoke('nodes:update', id, data),
    delete: (id) => ipcRenderer.invoke('nodes:delete', id),
    move: (id, newParentId, view) => ipcRenderer.invoke('nodes:move', id, newParentId, view),
  },
  hierarchy: {
    getTree: (view, rootId) => ipcRenderer.invoke('hierarchy:get-tree', view, rootId),
    getPath: (nodeId, view) => ipcRenderer.invoke('hierarchy:get-path', nodeId, view),
    getSegments: () => ipcRenderer.invoke('hierarchy:get-segments'),
    getOrganizations: () => ipcRenderer.invoke('hierarchy:get-organizations'),
  },
  import: {
    url: (url) => ipcRenderer.invoke('import:url', url),
    status: () => ipcRenderer.invoke('import:status'),
    onProgress: (callback) => ipcRenderer.on('import:progress', callback),
  },
  search: {
    query: (query, filters) => ipcRenderer.invoke('search:query', query, filters),
  },
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    getApiKey: () => ipcRenderer.invoke('settings:get-api-key'),
    setApiKey: (key) => ipcRenderer.invoke('settings:set-api-key', key),
  },
});

// Type declaration for renderer
declare global {
  interface Window {
    decantAPI: typeof contextBridge.exposeInMainWorld extends (name: string, api: infer T) => void ? T : never;
  }
}
```

---

# 21. Gumroad Design System

## 21.1 CSS Variables

```css
/* src/renderer/styles/gumroad.css */
:root {
  /* Primary Colors */
  --gum-pink: #FF90E8;
  --gum-yellow: #E1FF3C;
  --gum-blue: #90A8ED;
  --gum-green: #23C66B;

  /* Neutrals */
  --gum-black: #000000;
  --gum-white: #FFFFFF;
  --gum-bg: #F4F4F0;
  --gum-gray-100: #F8F8F6;
  --gum-gray-200: #E8E8E4;
  --gum-gray-300: #D0D0CC;
  --gum-gray-600: #666666;

  /* Borders & Shadows */
  --border-width: 2px;
  --border-radius: 4px;
  --shadow-default: 4px 4px 0px var(--gum-black);
  --shadow-hover: 6px 6px 0px var(--gum-black);
  --shadow-active: none;

  /* Typography */
  --font-main: 'Space Grotesk', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 700;

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;

  /* Transitions */
  --transition-fast: 0.1s ease;
  --transition-normal: 0.2s ease;
}
```

## 21.2 Core Interactive Element

```css
.gum-element {
  border: var(--border-width) solid var(--gum-black);
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-default);
  background: var(--gum-white);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.gum-element:hover {
  transform: translate(-2px, -2px);
  box-shadow: var(--shadow-hover);
}

.gum-element:active {
  transform: translate(2px, 2px);
  box-shadow: var(--shadow-active);
}
```

## 21.3 Button Variants

```css
.gum-button {
  composes: gum-element;
  padding: var(--space-sm) var(--space-md);
  font-family: var(--font-main);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
}

.gum-button--pink { background: var(--gum-pink); }
.gum-button--yellow { background: var(--gum-yellow); }
.gum-button--blue { background: var(--gum-blue); }
.gum-button--green { background: var(--gum-green); }
```

## 21.4 Input Field

```css
.gum-input {
  border: var(--border-width) solid var(--gum-black);
  border-radius: var(--border-radius);
  padding: var(--space-sm) var(--space-md);
  font-family: var(--font-main);
  background: var(--gum-white);
}

.gum-input:focus {
  outline: none;
  box-shadow: var(--shadow-default);
}
```

## 21.5 Card

```css
.gum-card {
  composes: gum-element;
  padding: var(--space-md);
}
```

## 21.6 Badge

```css
.gum-badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-xs) var(--space-sm);
  border: var(--border-width) solid var(--gum-black);
  border-radius: var(--border-radius);
  font-size: 12px;
  font-weight: var(--font-weight-bold);
}
```

## 21.7 Tree Node Styles

```css
.tree-node {
  border-left: var(--border-width) solid var(--gum-black);
  padding-left: var(--space-md);
  margin-left: var(--space-md);
}

.tree-node--selected {
  background: var(--gum-yellow);
}

.tree-node--segment { border-left-color: var(--gum-pink); }
.tree-node--category { border-left-color: var(--gum-blue); }
.tree-node--item { border-left-color: var(--gum-green); }
```

## 21.8 Segment Color Mapping

| Segment | Color | CSS Variable |
|---------|-------|--------------|
| AI (A) | Pink | `--gum-pink` |
| Technology (T) | Blue | `--gum-blue` |
| Finance (F) | Green | `--gum-green` |
| Sports (S) | Yellow | `--gum-yellow` |
| Health (H) | Pink | `--gum-pink` |
| Business (B) | Blue | `--gum-blue` |
| Entertainment (E) | Yellow | `--gum-yellow` |
| Lifestyle (L) | Green | `--gum-green` |
| Science (X) | Blue | `--gum-blue` |
| Creative (C) | Pink | `--gum-pink` |

---


# 22. Implementation Phases

## Phase 1: Project Foundation (MVP Core) ✅ COMPLETE

### 1.1 Project Setup ✅
- [x] Initialize Electron Forge with Vite template
- [x] Configure TypeScript for main, preload, renderer
- [x] Set up better-sqlite3 with proper Electron rebuilding
- [x] Create database schema and migrations
- [x] Set up keytar for API key storage

### 1.2 Basic IPC Layer ✅
- [x] Define IPC channels and types
- [x] Implement preload context bridge
- [x] Create main process IPC handlers
- [x] Test round-trip communication

### 1.3 Database Layer ✅
- [x] Implement node CRUD operations
- [x] Implement hierarchy queries (both views)
- [x] Implement search with FTS5
- [x] Add initial taxonomy data

**Verification**: App launches, database creates, can store/retrieve test nodes

## Phase 1.5: macOS App Packaging ✅ COMPLETE

- [x] Update forge.config.ts with macOS packaging settings
- [x] Configure app name, bundle ID, ad-hoc signing
- [x] Run `npm run package` to create .app bundle
- [x] Verify app launches from Finder
- [x] App can be added to Dock

**Verification**: Decant.app in `out/Decant-darwin-arm64/`, launches when clicked

## Phase 2: Scraping & AI Pipeline 🔲 NEXT

### 2.1 Content Extraction
- [ ] Implement Metascraper for static pages
- [ ] Add Cheerio-based Open Graph extraction
- [ ] Implement favicon extraction and caching
- [ ] Add URL validation and normalization

### 2.2 OpenAI Integration
- [ ] Create OpenAI API client
- [ ] Implement classification prompt (from Section 10)
- [ ] Add retry logic and error handling
- [ ] Test with sample URLs

### 2.3 Import Pipeline
- [ ] Create full import flow (extract → classify → store)
- [ ] Implement Phase 1 (immediate) processing
- [ ] Add processing queue for Phase 2
- [ ] Implement background worker

**Verification**: Paste URL → see it classified and stored → appears in tree

## Phase 3: UI Foundation 🔲

### 3.1 App Shell
- [ ] Create three-panel layout (Spaces | Tree | Detail)
- [ ] Implement panel resizing
- [ ] Add view toggle (Function/Organization)
- [ ] Implement dark mode support

### 3.2 Spaces Panel
- [ ] List segments with colors
- [ ] List custom spaces
- [ ] Add segment selection
- [ ] Implement "Add Space" button

### 3.3 Tree Panel
- [ ] Integrate React Complex Tree
- [ ] Implement dual hierarchy data loading
- [ ] Create custom node renderer with Gumroad styling
- [ ] Add expand/collapse, selection

### 3.4 Detail Panel
- [ ] Show selected node details
- [ ] Display item card with metadata
- [ ] Show hierarchy path
- [ ] Display AI-generated content (descriptor fields)

**Verification**: Full three-panel UI works, can navigate both hierarchy views

## Phase 4: Core Interactions 🔲

### 4.1 Import Dialog
- [ ] Create URL input modal
- [ ] Show classification progress
- [ ] Display result preview
- [ ] Handle errors gracefully

### 4.2 Node CRUD
- [ ] Implement edit mode for nodes
- [ ] Add delete with confirmation
- [ ] Implement drag-drop move
- [ ] Add merge functionality

### 4.3 Search
- [ ] Create global search bar
- [ ] Implement search results display
- [ ] Add filters (content type, segment, tags)
- [ ] Highlight matches in tree

**Verification**: Full CRUD works, search finds content, drag-drop moves nodes

## Phase 5: Polish & Features 🔲

### 5.1 Keyboard Shortcuts
- [ ] Global shortcut for import (Cmd+N)
- [ ] Navigation shortcuts (arrows, Enter)
- [ ] Search shortcut (Cmd+F)
- [ ] View toggle shortcut (Cmd+1, Cmd+2)

### 5.2 Settings
- [ ] Settings dialog
- [ ] API key management UI
- [ ] Theme selection
- [ ] Export/import data

### 5.3 Performance
- [ ] Add virtualization to tree (large datasets)
- [ ] Optimize search queries
- [ ] Add caching layer
- [ ] Profile and fix bottlenecks

**Verification**: App feels responsive, all features work smoothly

## Phase 6: Advanced Features (Post-MVP) 🔲

### 6.1 Playwright Integration
- [ ] Add for JavaScript-rendered pages
- [ ] Implement fallback logic

### 6.2 Browser Extension
- [ ] Create Chrome extension
- [ ] Add context menu "Save to Decant"
- [ ] Implement communication with desktop app

### 6.3 Advanced AI
- [ ] Similar content suggestions (Section 11)
- [ ] Auto-tagging improvements
- [ ] Hierarchy reorganization suggestions

---

# 23. File Creation Order

### Batch 1: Foundation
1. `package.json` - Project config with all dependencies
2. `forge.config.ts` - Electron Forge setup
3. `vite.main.config.ts`, `vite.preload.config.ts`, `vite.renderer.config.ts`
4. `src/shared/types.ts`, `src/shared/constants.ts`
5. `src/main/index.ts` - Main process entry

### Batch 2: Database
6. `src/main/database/connection.ts`
7. `src/main/database/schema.ts`
8. `src/main/database/nodes.ts`
9. `src/main/database/taxonomy.ts`
10. `src/main/database/search.ts`

### Batch 3: IPC
11. `src/main/ipc/channels.ts`
12. `src/main/ipc/handlers.ts`
13. `src/preload/index.ts`

### Batch 4: Services
14. `src/main/services/scraper/metascraper.ts`
15. `src/main/services/scraper/favicon.ts`
16. `src/main/services/ai/openai.ts`
17. `src/main/services/ai/prompts.ts`
18. `src/main/services/ai/classifier.ts`
19. `src/main/services/import/pipeline.ts`

### Batch 5: React Foundation
20. `src/renderer/index.html`
21. `src/renderer/index.tsx`
22. `src/renderer/App.tsx`
23. `src/renderer/styles/globals.css`
24. `src/renderer/styles/gumroad.css`
25. `src/renderer/context/AppContext.tsx`

### Batch 6: Layout Components
26. `src/renderer/components/layout/AppShell.tsx`
27. `src/renderer/components/layout/SpacesPanel.tsx`
28. `src/renderer/components/layout/TreePanel.tsx`
29. `src/renderer/components/layout/DetailPanel.tsx`

### Batch 7: Tree Components
30. `src/renderer/components/tree/HierarchyTree.tsx`
31. `src/renderer/components/tree/TreeNode.tsx`
32. `src/renderer/components/tree/TreeControls.tsx`

### Batch 8: Remaining Components
33. `src/renderer/components/detail/NodeDetail.tsx`
34. `src/renderer/components/import/ImportDialog.tsx`
35. `src/renderer/components/search/SearchBar.tsx`
36. `src/renderer/components/shared/Button.tsx` (and other shared)

---

# 24. Dependencies

```json
{
  "name": "decant",
  "version": "0.1.0",
  "description": "AI-powered knowledge base with dual hierarchy system",
  "main": ".vite/build/main.js",
  "devDependencies": {
    "@electron-forge/cli": "^7.0.0",
    "@electron-forge/maker-dmg": "^7.0.0",
    "@electron-forge/maker-squirrel": "^7.0.0",
    "@electron-forge/maker-zip": "^7.0.0",
    "@electron-forge/plugin-vite": "^7.0.0",
    "@electron-forge/plugin-fuses": "^7.0.0",
    "@electron/fuses": "^1.0.0",
    "@electron/rebuild": "^3.0.0",
    "@types/better-sqlite3": "^7.6.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "@types/uuid": "^9.0.0",
    "electron": "^33.0.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  },
  "dependencies": {
    "better-sqlite3": "^9.0.0",
    "cheerio": "^1.0.0",
    "keytar": "^7.9.0",
    "metascraper": "^5.0.0",
    "metascraper-author": "^5.0.0",
    "metascraper-date": "^5.0.0",
    "metascraper-description": "^5.0.0",
    "metascraper-image": "^5.0.0",
    "metascraper-logo-favicon": "^5.0.0",
    "metascraper-title": "^5.0.0",
    "openai": "^4.0.0",
    "react": "^18.0.0",
    "react-complex-tree": "^2.0.0",
    "react-dom": "^18.0.0",
    "uuid": "^9.0.0"
  }
}
```

---

# 25. Verification Checklists

## Phase 1 Complete ✅
- [x] `npm start` launches Electron window
- [x] Database file created in app data directory
- [x] Schema tables exist (check with SQLite browser)
- [x] Can store and retrieve a test node via IPC

## Phase 1.5 Complete ✅
- [x] `npm run package` completes without errors
- [x] `Decant.app` appears in `out/Decant-darwin-arm64/`
- [x] App launches when double-clicked
- [x] App can be dragged to Dock
- [x] App launches from Dock

## Phase 2 Complete
- [ ] Paste any URL → metadata extracted
- [ ] OpenAI API called → classification returned
- [ ] Node created with correct hierarchy codes (both views)
- [ ] Background queue processes Phase 2 enrichment
- [ ] Descriptor fields populated after Phase 2

## Phase 3 Complete
- [ ] Three-panel layout renders
- [ ] Segments show in Spaces panel with correct colors
- [ ] Tree shows hierarchy (both views work)
- [ ] Detail panel shows selected node with all descriptor fields
- [ ] View toggle switches between Function/Organization instantly

## Phase 4 Complete
- [ ] Import dialog accepts URL
- [ ] Can edit node title/metadata/descriptors
- [ ] Can delete nodes
- [ ] Can drag-drop to move nodes (updates hierarchy codes)
- [ ] Search finds content by title/tags/descriptor_string

## Phase 5 Complete
- [ ] Keyboard shortcuts work (Cmd+N, Cmd+F, etc.)
- [ ] Settings dialog opens
- [ ] Can change API key
- [ ] App performs well with 100+ nodes

---


---

# PART III: OPERATIONAL REFERENCE

---

# 26. Environment Variables

## 26.1 API Keys (Stored in System Keychain)

```bash
# Stored via keytar in system keychain - NOT in environment variables
OPENAI_API_KEY=sk-...  # User's OpenAI API key
```

## 26.2 Development Variables

```bash
# Optional development overrides
NODE_ENV=development|production
DEBUG=decant:*          # Enable debug logging
```

## 26.3 Build Variables

```bash
# Set by Electron Forge during build
VITE_DEV_SERVER_URL     # Development server URL
```

---

# 27. Risk Mitigation

| Risk | Likelihood | Impact | Mitigation Strategy |
|------|------------|--------|---------------------|
| better-sqlite3 native module issues | Medium | High | Use Electron 33.x, test on clean install, use electron-rebuild |
| OpenAI rate limits | Low | Medium | Implement exponential backoff, queue system, cache responses |
| Large tree performance | Medium | Medium | React Complex Tree has virtualization built-in, test with 1000+ nodes |
| Dual hierarchy complexity | High | High | Thorough testing of both views with same node data, comprehensive tests |
| macOS code signing | Low | Low | Ad-hoc signing for personal use, Developer ID for distribution |
| Electron security | Medium | High | Enable Electron fuses, use contextBridge, validate all IPC |
| Database corruption | Low | Critical | WAL mode, regular backups, schema migrations |
| AI misclassification | High | Medium | Allow manual override, provide edit UI, confidence thresholds |

---

# 28. Running the Project

## 28.1 Initial Setup

```bash
# Clone or navigate to project
cd decant-standalone

# Install dependencies
npm install

# Rebuild native modules for Electron
npm run rebuild
```

## 28.2 Development

```bash
# Start development server with hot reload
npm start

# This opens Electron with:
# - Vite dev server for renderer
# - Main process with auto-reload
# - DevTools open by default
```

## 28.3 Building

```bash
# Package app (creates .app bundle)
npm run package

# Output: out/Decant-darwin-arm64/Decant.app

# Make distributable (creates .app + .dmg)
npm run make

# Output: out/make/Decant-*.dmg
```

## 28.4 Installing

```bash
# Option 1: Copy to Applications
cp -r out/Decant-darwin-arm64/Decant.app /Applications/

# Option 2: Drag to Dock
open out/Decant-darwin-arm64/
# Then drag Decant.app to your Dock
```

## 28.5 Database Location

```
~/Library/Application Support/Decant/decant.db
```

## 28.6 Logs Location

```
~/Library/Logs/Decant/
```

---

# Appendix A: Quick Reference Cards

## A.1 Hierarchy Code Format

```
Function View:  {Segment}.{Category}.{ContentType}[.{Subcategories}].{Position}
                A.LLM.T1.1 → AI > LLM > Tool > Position 1

Organization:   {OrgCode}.{Category}.{ContentType}[.{Subcategories}].{Position}
                ANTH.LLM.T1.1 → Anthropic > LLM > Tool > Position 1
```

## A.2 Content Type Codes

| Code | Type | Code | Type |
|------|------|------|------|
| T | Tool/Website | R | Research Paper |
| A | Article | G | Repository |
| V | Video | S | Social Post |
| U | Audio | C | Course |
| P | Podcast | I | Image |
| N | Newsletter | K | Book |

## A.3 Segment Codes

| Code | Segment | Code | Segment |
|------|---------|------|---------|
| A | AI | B | Business |
| T | Technology | E | Entertainment |
| F | Finance | L | Lifestyle |
| S | Sports | X | Science |
| H | Health | C | Creative |

## A.4 Descriptor Fields Quick Reference

| Field | Max | Required | Phase |
|-------|-----|----------|-------|
| title | 500 | Yes | 2 |
| source_domain | 100 | Yes | 1 |
| url | 2000 | Yes | 1 |
| date_added | - | Yes | 1 |
| company | 200 | No | 2 |
| phrase_description | 100 | Yes | 2 |
| short_description | 500 | Yes | 2 |
| logo_url | 500 | No | 2 |
| key_concepts | 20 items | Yes | 2 |

---

# Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-18 | Robert Barbieri | Original Developer Implementation Guide |
| 2.0 | 2026-01-19 | Claude (unified) | Merged with implementation spec, added all missing sections |

---

# END OF MASTER SPECIFICATION

**Total Sections:** 28  
**Total Parts:** 3  
**File:** `DECANT_MASTER_SPECIFICATION.md`  
**Location:** `decant-standalone/DECANT_MASTER_SPECIFICATION.md`

This document contains everything needed to rebuild Decant from scratch.

