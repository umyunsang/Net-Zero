import "./load-env.js";
import "reflect-metadata";

import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Http2ServerRequest } from "node:http2";
import type { FastifyRequest } from "fastify";

import { AppModule } from "./app.module.js";
import { getConfig } from "./config.js";
import { ApiExceptionFilter } from "./http/api-exception.filter.js";

async function bootstrap(): Promise<void> {
  const config = getConfig();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit: config.EVIDENCE_UPLOAD_MAX_BYTES,
      genReqId: (request: IncomingMessage | Http2ServerRequest) => {
        const supplied = request.headers["x-request-id"];
        return typeof supplied === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(supplied) ? supplied : randomUUID();
      },
      logger: {
        redact: {
          paths: [
            "req.headers.authorization",
            "req.headers.x-upload-token",
            "res.headers.set-cookie",
            "password",
            "token",
            "accessToken",
          ],
          censor: "[ปกปิด]",
        },
      },
    }),
    { bodyParser: false },
  );
  const fastify = app.getHttpAdapter().getInstance();
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
    errorResponseBuilder: (_request: FastifyRequest, context: { ttl: number }) => ({
      code: "RATE_LIMITED",
      message: "ส่งคำขอถี่เกินไป กรุณารอแล้วลองใหม่",
      retryAfterSeconds: Math.ceil(context.ttl / 1_000),
    }),
  });
  fastify.addHook("onRequest", (request, reply, done) => {
    reply.header("x-request-id", request.id);
    done();
  });
  fastify.removeContentTypeParser("application/json");
  for (const contentType of ["application/json", "image/jpeg", "image/webp"]) {
    fastify.addContentTypeParser(contentType, (request, payload, done) => {
      if (request.url.startsWith("/api/evidence/") && request.url.endsWith("/content")) {
        done(null, payload);
        return;
      }
      if (contentType !== "application/json") {
        done(new Error("Unsupported media type"));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      payload.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > config.EVIDENCE_UPLOAD_MAX_BYTES) {
          payload.destroy(new Error("Request body is too large"));
          return;
        }
        chunks.push(chunk);
      });
      payload.once("error", done);
      payload.once("end", () => {
        try {
          done(null, JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch {
          done(new Error("Invalid JSON"));
        }
      });
    });
  }
  app.enableCors({
    origin: config.WEB_ORIGIN,
    credentials: false,
    allowedHeaders: ["authorization", "content-type", "idempotency-key", "x-upload-token", "x-request-id"],
  });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
}

bootstrap().catch((error: unknown) => {
  Logger.error(error, "Bootstrap");
  process.exitCode = 1;
});
