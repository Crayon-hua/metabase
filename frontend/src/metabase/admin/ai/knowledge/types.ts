export type QueryKnowledgeColumn = {
  name: string;
  type: string;
  comment?: string;
  primary?: boolean;
};

export type QueryKnowledgeRelation = {
  table: string;
  column: string;
  targetTable: string;
  targetColumn: string;
  constraint?: string;
};

export type QueryKnowledgeAlias = {
  table: string;
  column?: string;
  name: string;
  synonyms: string[];
  description?: string;
};

export type QueryKnowledgeTerm = {
  name: string;
  synonyms: string[];
  description: string;
};

export type QueryKnowledgeBody = {
  aliases: QueryKnowledgeAlias[];
  terms: QueryKnowledgeTerm[];
  relations: QueryKnowledgeRelation[];
};

export type QueryKnowledgeTable = {
  name: string;
  comment?: string;
  columns: QueryKnowledgeColumn[];
  relations?: QueryKnowledgeRelation[];
};

export type QueryKnowledgeIndexStatus = {
  document_count: number;
  table_count?: number;
  ready: boolean;
  configured: boolean;
  /** embedding-not-configured | no-synced-tables | no-documents | embedding-model-mismatch */
  not_ready_reason?: string | null;
};

export type EmbeddingSettings = {
  base_url: string;
  model: string;
  api_key_configured: boolean;
  configured: boolean;
};

export type QueryKnowledgeState = {
  database_id: number;
  revision: number;
  knowledge: QueryKnowledgeBody;
  tables: QueryKnowledgeTable[];
  embedding_model: string;
  index: QueryKnowledgeIndexStatus;
  embedding: EmbeddingSettings;
  reindex?: {
    document_count?: number;
    embedding_model?: string;
    skipped?: boolean;
    reason?: string;
  };
};
