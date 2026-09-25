// src/types/pg.d.ts — pg 最小类型声明（不装 @types/pg，遵守 SPEC §2.1 依赖约束）
declare module "pg" {
  export interface QueryResult {
    rows: any[];
    rowCount: number | null;
  }
  export class Pool {
    constructor(config?: Record<string, unknown>);
    query(text: string, params?: unknown[]): Promise<QueryResult>;
    end(): Promise<void>;
    connect(): Promise<Client>;
  }
  export class Client {
    constructor(config?: Record<string, unknown>);
    query(text: string, params?: unknown[]): Promise<QueryResult>;
    connect(): Promise<void>;
    end(): Promise<void>;
  }
  const pg: { Pool: typeof Pool; Client: typeof Client };
  export default pg;
}
