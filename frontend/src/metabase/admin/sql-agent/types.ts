export type SqlAgentSource = {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  user: string;
  tls: boolean;
};

export type SqlAgentColumn = {
  name: string;
  type: string;
  comment?: string;
  primary?: boolean;
};

export type SqlAgentRelation = {
  table: string;
  column: string;
  targetTable: string;
  targetColumn: string;
};

export type SqlAgentAlias = {
  table: string;
  column: string;
  name: string;
  synonyms: string[];
  description: string;
};

export type SqlAgentTerm = {
  name: string;
  synonyms: string[];
  description: string;
};

export type SqlAgentKnowledge = {
  aliases: SqlAgentAlias[];
  terms: SqlAgentTerm[];
  relations: SqlAgentRelation[];
};

export type SqlAgentTable = {
  name: string;
  comment?: string;
  columns: SqlAgentColumn[];
  relations?: SqlAgentRelation[];
};

export type SqlAgentCatalog = {
  revision: number;
  tables: SqlAgentTable[];
  knowledge: SqlAgentKnowledge;
};

export type SqlAgentCatalogResponse = {
  catalog: SqlAgentCatalog;
  vectorEnabled: boolean;
  vectorReady: boolean;
};
