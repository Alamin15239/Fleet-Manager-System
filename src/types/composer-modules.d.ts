// Ambient types for the Composer/Prisma 8 packages the app imports.
// The repository's tsconfig uses `moduleResolution: node`, which does not read
// the `exports` map these packages publish, so their subpaths are declared here.
declare module '@prisma/orm-postgres/runtime' {
  const postgres: any;
  export default postgres;
}
declare module '@prisma/orm-postgres/static' {
  export function contractFromJson<T = any>(json: unknown): T;
}
declare module '@prisma/orm-postgres/orm-client' {
  export function and(...predicates: any[]): any;
  export function or(...predicates: any[]): any;
  export function not(predicate: any): any;
}
declare module '@prisma/composer/nextjs' {
  const nextjs: any;
  export default nextjs;
}
declare module '@prisma/composer-prisma-cloud' {
  export const compute: any;
  export const variable: any;
}
declare module '@prisma/composer-prisma-cloud/orm' {
  export const postgres: any;
  export const dataContract: any;
}
declare module '@prisma/composer/arktype' {
  export function secretString(): any;
  export function field(inner: any): any;
}
