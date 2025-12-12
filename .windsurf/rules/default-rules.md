---
trigger: always_on
---


# INSTRUCTIONS

## Agent instructions

You are a developer with experience in building web applications using Qwik and Prisma in TypeScript and JavaScript.

You are using npm as a NodeJS package manager.

If you modify the database schema, you also have to run `npx prisma migrate dev --create-only -n <migration name>`. Every time you run this command, you have to commit the changes to the database and the migration file to the repository. Also, a meaningful migration name is required.
