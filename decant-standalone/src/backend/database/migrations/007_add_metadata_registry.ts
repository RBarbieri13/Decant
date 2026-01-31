// ============================================================
// Migration: 007_add_metadata_registry
// Adds metadata code registry and node-metadata junction table
// for proper structured metadata storage
// ============================================================

import type Database from 'better-sqlite3';
import type { Migration } from './types.js';

export const name = '007_add_metadata_registry';

/**
 * Metadata type codes:
 * - ORG: Organization (company/entity)
 * - DOM: Domain (field of expertise)
 * - FNC: Function (purpose/capability)
 * - TEC: Technology (programming language, framework, tool)
 * - CON: Content Type (article, video, tool, etc.)
 * - IND: Industry (sector)
 * - AUD: Audience (target users)
 * - PRC: Pricing (cost model)
 * - LIC: License (software license)
 * - LNG: Language (human language)
 * - PLT: Platform (deployment target)
 */

export function up(db: Database.Database): void {
  // Create metadata code registry table
  db.exec(`
    CREATE TABLE metadata_code_registry (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      code TEXT NOT NULL,
      display_name TEXT NOT NULL,
      description TEXT,
      usage_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(type, code)
    );
  `);

  // Create node-metadata junction table
  db.exec(`
    CREATE TABLE node_metadata (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      registry_id TEXT NOT NULL,
      confidence REAL DEFAULT 1.0,
      source TEXT DEFAULT 'ai',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
      FOREIGN KEY (registry_id) REFERENCES metadata_code_registry(id) ON DELETE CASCADE,
      UNIQUE(node_id, registry_id)
    );
  `);

  // Create indexes for metadata_code_registry
  db.exec(`
    CREATE INDEX idx_registry_type ON metadata_code_registry(type);
  `);

  db.exec(`
    CREATE INDEX idx_registry_code ON metadata_code_registry(code);
  `);

  db.exec(`
    CREATE INDEX idx_registry_type_code ON metadata_code_registry(type, code);
  `);

  // Create indexes for node_metadata
  db.exec(`
    CREATE INDEX idx_node_metadata_node ON node_metadata(node_id);
  `);

  db.exec(`
    CREATE INDEX idx_node_metadata_registry ON node_metadata(registry_id);
  `);

  // Seed common metadata codes
  const seedData = [
    // Organizations (ORG)
    { type: 'ORG', code: 'ANTHROPIC', display_name: 'Anthropic', description: 'AI safety company, creator of Claude' },
    { type: 'ORG', code: 'OPENAI', display_name: 'OpenAI', description: 'AI research company, creator of GPT and ChatGPT' },
    { type: 'ORG', code: 'GOOGLE', display_name: 'Google', description: 'Technology company, creator of Gemini' },
    { type: 'ORG', code: 'META', display_name: 'Meta', description: 'Technology company, creator of LLaMA' },
    { type: 'ORG', code: 'MICROSOFT', display_name: 'Microsoft', description: 'Technology company, Azure AI services' },

    // Technologies (TEC)
    { type: 'TEC', code: 'PYTHON', display_name: 'Python', description: 'Programming language' },
    { type: 'TEC', code: 'JAVASCRIPT', display_name: 'JavaScript', description: 'Programming language for web development' },
    { type: 'TEC', code: 'TYPESCRIPT', display_name: 'TypeScript', description: 'Typed superset of JavaScript' },
    { type: 'TEC', code: 'RUST', display_name: 'Rust', description: 'Systems programming language' },
    { type: 'TEC', code: 'GO', display_name: 'Go', description: 'Programming language by Google' },
    { type: 'TEC', code: 'JAVA', display_name: 'Java', description: 'Object-oriented programming language' },
    { type: 'TEC', code: 'CSHARP', display_name: 'C#', description: 'Programming language by Microsoft' },
    { type: 'TEC', code: 'CPP', display_name: 'C++', description: 'Systems programming language' },
    { type: 'TEC', code: 'REACT', display_name: 'React', description: 'JavaScript UI library' },
    { type: 'TEC', code: 'NODEJS', display_name: 'Node.js', description: 'JavaScript runtime' },

    // Industries (IND)
    { type: 'IND', code: 'TECHNOLOGY', display_name: 'Technology', description: 'Technology sector' },
    { type: 'IND', code: 'FINANCE', display_name: 'Finance', description: 'Financial services sector' },
    { type: 'IND', code: 'HEALTHCARE', display_name: 'Healthcare', description: 'Healthcare and medical sector' },
    { type: 'IND', code: 'EDUCATION', display_name: 'Education', description: 'Education and e-learning sector' },
    { type: 'IND', code: 'RETAIL', display_name: 'Retail', description: 'Retail and e-commerce sector' },
    { type: 'IND', code: 'MANUFACTURING', display_name: 'Manufacturing', description: 'Manufacturing sector' },
    { type: 'IND', code: 'MEDIA', display_name: 'Media', description: 'Media and entertainment sector' },

    // Pricing (PRC)
    { type: 'PRC', code: 'FREE', display_name: 'Free', description: 'Completely free to use' },
    { type: 'PRC', code: 'FREEMIUM', display_name: 'Freemium', description: 'Free tier with paid upgrades' },
    { type: 'PRC', code: 'PAID', display_name: 'Paid', description: 'Requires payment' },
    { type: 'PRC', code: 'ENTERPRISE', display_name: 'Enterprise', description: 'Enterprise pricing, contact sales' },
    { type: 'PRC', code: 'OPENSOURCE', display_name: 'Open Source', description: 'Free and open source' },

    // Domains (DOM)
    { type: 'DOM', code: 'AI_ML', display_name: 'AI/ML', description: 'Artificial Intelligence and Machine Learning' },
    { type: 'DOM', code: 'WEBDEV', display_name: 'Web Development', description: 'Web application development' },
    { type: 'DOM', code: 'DEVOPS', display_name: 'DevOps', description: 'Development operations and infrastructure' },
    { type: 'DOM', code: 'SECURITY', display_name: 'Security', description: 'Cybersecurity and information security' },
    { type: 'DOM', code: 'DATA', display_name: 'Data', description: 'Data science and analytics' },
    { type: 'DOM', code: 'MOBILE', display_name: 'Mobile', description: 'Mobile application development' },

    // Platforms (PLT)
    { type: 'PLT', code: 'WEB', display_name: 'Web', description: 'Web browser platform' },
    { type: 'PLT', code: 'DESKTOP', display_name: 'Desktop', description: 'Desktop application' },
    { type: 'PLT', code: 'MOBILE', display_name: 'Mobile', description: 'Mobile device platform' },
    { type: 'PLT', code: 'CLI', display_name: 'CLI', description: 'Command line interface' },
    { type: 'PLT', code: 'API', display_name: 'API', description: 'API/SDK integration' },
    { type: 'PLT', code: 'CLOUD', display_name: 'Cloud', description: 'Cloud-hosted service' },

    // Licenses (LIC)
    { type: 'LIC', code: 'MIT', display_name: 'MIT', description: 'MIT License' },
    { type: 'LIC', code: 'APACHE2', display_name: 'Apache 2.0', description: 'Apache License 2.0' },
    { type: 'LIC', code: 'GPL3', display_name: 'GPL 3.0', description: 'GNU General Public License v3' },
    { type: 'LIC', code: 'BSD', display_name: 'BSD', description: 'BSD License' },
    { type: 'LIC', code: 'PROPRIETARY', display_name: 'Proprietary', description: 'Proprietary/closed source' },

    // Audiences (AUD)
    { type: 'AUD', code: 'DEVELOPER', display_name: 'Developers', description: 'Software developers and engineers' },
    { type: 'AUD', code: 'BUSINESS', display_name: 'Business', description: 'Business users and professionals' },
    { type: 'AUD', code: 'RESEARCHER', display_name: 'Researchers', description: 'Academic and industry researchers' },
    { type: 'AUD', code: 'CONSUMER', display_name: 'Consumers', description: 'General consumers' },
    { type: 'AUD', code: 'ENTERPRISE', display_name: 'Enterprise', description: 'Large enterprise organizations' },
  ];

  // Generate UUIDs for seed data and insert
  const insertStmt = db.prepare(`
    INSERT INTO metadata_code_registry (id, type, code, display_name, description)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const item of seedData) {
    // Generate a deterministic ID based on type and code
    const id = `${item.type.toLowerCase()}_${item.code.toLowerCase()}`;
    insertStmt.run(id, item.type, item.code, item.display_name, item.description);
  }
}

export function down(db: Database.Database): void {
  // Drop indexes first
  db.exec(`
    DROP INDEX IF EXISTS idx_node_metadata_registry;
    DROP INDEX IF EXISTS idx_node_metadata_node;
    DROP INDEX IF EXISTS idx_registry_type_code;
    DROP INDEX IF EXISTS idx_registry_code;
    DROP INDEX IF EXISTS idx_registry_type;
  `);

  // Drop tables (junction table first due to foreign key)
  db.exec(`DROP TABLE IF EXISTS node_metadata;`);
  db.exec(`DROP TABLE IF EXISTS metadata_code_registry;`);
}

const migration: Migration = { name, up, down };
export default migration;
