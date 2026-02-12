import type { Migration } from './types.js';

const migration: Migration = {
  name: '010_add_categories_table',
  up(db) {
    // Create categories reference table
    db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        segment_code CHAR(1) NOT NULL,
        category_code CHAR(3) NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (segment_code, category_code)
      );
    `);

    // Create content_types reference table
    db.exec(`
      CREATE TABLE IF NOT EXISTS content_types (
        code CHAR(1) PRIMARY KEY,
        display_name VARCHAR(100) NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed categories
    const insertCat = db.prepare(`
      INSERT OR IGNORE INTO categories (segment_code, category_code, display_name) VALUES (?, ?, ?)
    `);

    const categories: [string, string, string][] = [
      // AI & ML
      ['A', 'LLM', 'Large Language Models'], ['A', 'AGT', 'AI Agents'], ['A', 'FND', 'Foundation Models'],
      ['A', 'MLO', 'MLOps'], ['A', 'NLP', 'NLP'], ['A', 'CVS', 'Computer Vision'],
      ['A', 'GEN', 'Generative AI'], ['A', 'ETH', 'AI Ethics'], ['A', 'RES', 'AI Research'], ['A', 'OTH', 'Other AI'],
      // Technology
      ['T', 'WEB', 'Web Development'], ['T', 'MOB', 'Mobile Development'], ['T', 'DEV', 'Developer Tools'],
      ['T', 'CLD', 'Cloud & Infrastructure'], ['T', 'SEC', 'Security'], ['T', 'DAT', 'Data Engineering'],
      ['T', 'API', 'APIs & Integrations'], ['T', 'OPS', 'DevOps'], ['T', 'HRD', 'Hardware'], ['T', 'OTH', 'Other Tech'],
      // Finance
      ['F', 'INV', 'Investing'], ['F', 'CRY', 'Crypto & Blockchain'], ['F', 'FPA', 'FP&A'],
      ['F', 'BNK', 'Banking'], ['F', 'TAX', 'Tax & Accounting'], ['F', 'PFN', 'Personal Finance'],
      ['F', 'MKT', 'Markets'], ['F', 'REL', 'Real Estate'], ['F', 'ECN', 'Economics'], ['F', 'OTH', 'Other Finance'],
      // Sports
      ['S', 'NFL', 'NFL Football'], ['S', 'FAN', 'Fantasy Sports'], ['S', 'FIT', 'Fitness'],
      ['S', 'RUN', 'Running'], ['S', 'GYM', 'Gym & Training'], ['S', 'NBA', 'Basketball'],
      ['S', 'MLB', 'Baseball'], ['S', 'SOC', 'Soccer'], ['S', 'OLY', 'Olympics'], ['S', 'OTH', 'Other Sports'],
      // Health
      ['H', 'MED', 'Medical'], ['H', 'MNT', 'Mental Health'], ['H', 'NUT', 'Nutrition'],
      ['H', 'SLP', 'Sleep'], ['H', 'ACC', 'Accessibility'], ['H', 'WEL', 'Wellness'],
      ['H', 'FRT', 'Fertility'], ['H', 'AGE', 'Aging'], ['H', 'DIS', 'Disease'], ['H', 'OTH', 'Other Health'],
      // Business
      ['B', 'STR', 'Strategy'], ['B', 'MNG', 'Management'], ['B', 'PRD', 'Product'],
      ['B', 'MKT', 'Marketing'], ['B', 'SAL', 'Sales'], ['B', 'OPS', 'Operations'],
      ['B', 'HRS', 'HR & People'], ['B', 'STP', 'Startups'], ['B', 'ENT', 'Enterprise'], ['B', 'OTH', 'Other Business'],
      // Entertainment
      ['E', 'GAM', 'Gaming'], ['E', 'MUS', 'Music'], ['E', 'MOV', 'Movies & TV'],
      ['E', 'STR', 'Streaming'], ['E', 'SOC', 'Social Media'], ['E', 'POP', 'Pop Culture'],
      ['E', 'POD', 'Podcasts'], ['E', 'CEL', 'Celebrities'], ['E', 'EVT', 'Events'], ['E', 'OTH', 'Other Entertainment'],
      // Lifestyle
      ['L', 'HOM', 'Home'], ['L', 'FAS', 'Fashion'], ['L', 'FOD', 'Food & Cooking'],
      ['L', 'TRV', 'Travel'], ['L', 'REL', 'Relationships'], ['L', 'PAR', 'Parenting'],
      ['L', 'PET', 'Pets'], ['L', 'HOB', 'Hobbies'], ['L', 'GAR', 'Garden'], ['L', 'OTH', 'Other Lifestyle'],
      // Science
      ['X', 'PHY', 'Physics'], ['X', 'BIO', 'Biology'], ['X', 'CHM', 'Chemistry'],
      ['X', 'AST', 'Astronomy'], ['X', 'ENV', 'Environment'], ['X', 'MAT', 'Mathematics'],
      ['X', 'ENG', 'Engineering'], ['X', 'SOC', 'Social Sciences'], ['X', 'PSY', 'Psychology'], ['X', 'OTH', 'Other Science'],
      // Creative
      ['C', 'UXD', 'UX Design'], ['C', 'GRD', 'Graphic Design'], ['C', 'WRT', 'Writing'],
      ['C', 'PHO', 'Photography'], ['C', 'VID', 'Video Production'], ['C', 'AUD', 'Audio Production'],
      ['C', 'ART', 'Fine Art'], ['C', 'ANI', 'Animation'], ['C', 'TYP', 'Typography'], ['C', 'OTH', 'Other Creative'],
    ];

    for (const [seg, cat, name] of categories) {
      insertCat.run(seg, cat, name);
    }

    // Seed content types
    const insertType = db.prepare(`
      INSERT OR IGNORE INTO content_types (code, display_name) VALUES (?, ?)
    `);

    const types: [string, string][] = [
      ['T', 'Tools & Software'], ['A', 'Articles'], ['V', 'Videos'],
      ['P', 'Research Papers'], ['R', 'Repositories'], ['G', 'Guides & Tutorials'],
      ['S', 'Services'], ['C', 'Courses'], ['I', 'Images & Graphics'],
      ['N', 'News'], ['K', 'Knowledge Bases'], ['U', 'Other/Unknown'],
    ];

    for (const [code, name] of types) {
      insertType.run(code, name);
    }
  },
  down(db) {
    db.exec('DROP TABLE IF EXISTS categories');
    db.exec('DROP TABLE IF EXISTS content_types');
  },
};

export default migration;
