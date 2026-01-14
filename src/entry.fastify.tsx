/*
 * WHAT IS THIS FILE?
 *
 * It's the entry point for the Fastify server when building for production.
 *
 * Learn more about Node.js server integrations here:
 * - https://qwik.dev/docs/deployments/node/
 *
 */
import { type PlatformNode } from "@builder.io/qwik-city/middleware/node";
import { Command } from "commander";
import "dotenv/config";
import Fastify from "fastify";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import FastifyQwik from "./plugins/fastify-qwik";
import { setupSystemRole, setupDefaultRole } from "./lib/auth/setup-roles";

declare global {
  type QwikCityPlatform = PlatformNode;
}

// Directories where the static assets are located
const distDir = join(fileURLToPath(import.meta.url), "..", "..", "dist");
const buildDir = join(distDir, "build");
const assetsDir = join(distDir, "assets");

async function serve(opts?: { port?: number; host?: string }) {
  const port = opts?.port ?? Number.parseInt(process.env.PORT ?? "3000", 10);
  const host = opts?.host ?? process.env.HOST ?? "0.0.0.0";

  // Setup system role and default role with permissions
  await setupSystemRole();
  await setupDefaultRole();

  // Create the fastify server
  // https://fastify.dev/docs/latest/Guides/Getting-Started/
  const fastify = Fastify({
    logger: true,
    trustProxy: true
  });

  // Enable compression
  // https://github.com/fastify/fastify-compress
  // IMPORTANT NOTE: THIS MUST BE REGISTERED BEFORE THE fastify-qwik PLUGIN
  await fastify.register(import('@fastify/compress'));

  fastify.get("/healthz", async (request, reply) => {
    return reply.status(200).send({ status: "ok" });
  });

  // Handle Qwik City using a plugin
  await fastify.register(FastifyQwik, { distDir, buildDir, assetsDir });

  // Start the fastify server
  await fastify.listen({ port, host });
}

const program = new Command();
program.name("vs-finanzverwaltung");

program
  .command("serve")
  .description("Start the Fastify server")
  .option("-p, --port <port>", "Port to listen on", (v) => Number.parseInt(v, 10))
  .option("--host <host>", "Host to bind to")
  .action(async (options: { port?: number; host?: string }) => {
    await serve({ port: options.port, host: options.host });
  });

// Preserve old behavior: running without args starts the server.
if (process.argv.length <= 2) {
  process.argv.push("serve");
}

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
