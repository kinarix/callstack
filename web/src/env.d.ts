/// <reference types="vite/client" />

declare module 'sql.js' {
  export interface SqlJsStatic {
    Database: new (data?: Uint8Array) => Database
  }

  export interface Database {
    run(sql: string, params?: any[]): void
    exec(sql: string): any[]
    prepare(sql: string): Statement
    export(): Uint8Array
  }

  export interface Statement {
    bind(values?: any[]): boolean
    step(): boolean
    get(): any[]
    getAsObject(): Record<string, any>
    free(): boolean
  }

  const initSqlJs: (config?: any) => Promise<SqlJsStatic>
  export default initSqlJs
}
