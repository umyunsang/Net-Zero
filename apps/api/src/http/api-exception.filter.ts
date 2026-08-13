import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";

type ErrorBody = {
  code?: string;
  message?: string | string[];
  details?: unknown;
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<FastifyReply>();
    const request = context.getRequest<FastifyRequest>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const source = exception instanceof HttpException ? exception.getResponse() : undefined;
    const body: ErrorBody = typeof source === "object" && source !== null
      ? source as ErrorBody
      : {};

    if (!(exception instanceof HttpException)) {
      this.logger.error("คำขอล้มเหลวโดยไม่คาดคิด", exception instanceof Error ? exception.stack : undefined);
    }

    void response.status(status).send({
      code: body.code ?? (status === 500 ? "INTERNAL_ERROR" : "VALIDATION_ERROR"),
      message: status === 500
        ? "ระบบขัดข้องชั่วคราว กรุณาลองใหม่"
        : Array.isArray(body.message)
          ? "ข้อมูลคำขอไม่ถูกต้อง"
          : body.message ?? "คำขอไม่สำเร็จ",
      requestId: request.id,
      ...(body.details === undefined ? {} : { details: body.details }),
    });
  }
}
