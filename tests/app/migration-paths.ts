export function appMigrationURL(name: string) { return new URL(import.meta.resolve('@inkspect/core/migrations/' + name)); }
