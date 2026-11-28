// @ts-check
import { appRoot } from "@prisma/composer";
import { variable } from "@prisma/composer-prisma-cloud";
import { postgres } from "@prisma/composer-prisma-cloud/orm";
import webService, { fleetData } from "./service.mjs";

export default appRoot("prisma-postgres-aureolin-lever", ({ provision }) => {
  const db = provision(postgres({ name: "db", contract: fleetData, config: "./prisma.config.ts" }));
  const jwtSecret = provision(variable.secret({ name: "JWT_SECRET" })); // Signs auth tokens and share links.
  const organizationDatabaseEncryptionKey = provision(variable.secret({ name: "ORGANIZATION_DATABASE_ENCRYPTION_KEY" })); // Encrypts organization database connection strings at rest.
  provision(webService, { id: "web", deps: { db }, input: { jwtSecret, organizationDatabaseEncryptionKey } });
});
