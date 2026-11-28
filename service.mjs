// @ts-check
import { type } from "arktype";
import nextjs from "@prisma/composer/nextjs";
import { compute } from "@prisma/composer-prisma-cloud";
import { dataContract, postgres } from "@prisma/composer-prisma-cloud/orm";
import { secretString } from "@prisma/composer/arktype";
import contractJson from "./src/prisma/contract.json" with { type: "json" };

/** The application's Prisma 8 data contract, emitted from prisma/schema.prisma. */
export { contractJson };
export const fleetData = dataContract(contractJson);

export default compute({
  name: "web",
  deps: { db: postgres(fleetData) },
  input: type({
    jwtSecret: secretString(),
    organizationDatabaseEncryptionKey: secretString(),
  }),
  build: nextjs({ module: import.meta.url, appDir: "." }),
});
