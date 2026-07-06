import type { FastifyError, FastifyInstance } from "fastify";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: 400 | 401 | 403 | 404 | 409,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface PostgreSqlError extends Error {
  code?: string;
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | PostgreSqlError, request, reply) => {
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send({
        code: error.code,
        message: error.message,
      });
    }

    if ("validation" in error && error.validation) {
      const issue = error.validation[0];
      const field =
        issue?.instancePath ||
        (typeof issue?.params === "object" &&
        issue.params &&
        "missingProperty" in issue.params
          ? `/${String(issue.params.missingProperty)}`
          : "");
      return reply.code(400).send({
        code: "VALIDATION_ERROR",
        message: `请求参数不符合要求${field ? `：${field}` : ""}`,
      });
    }

    if (error.code === "FST_REQ_FILE_TOO_LARGE") {
      return reply.code(413).send({
        code: "IMAGE_TOO_LARGE",
        message: "商品图片不能超过 5 MB",
      });
    }

    if (error.code === "23505") {
      return reply.code(409).send({
        code: "CONFLICT",
        message: "数据已存在，请检查唯一字段",
      });
    }

    if (error.code === "23503" || error.code === "23514") {
      return reply.code(409).send({
        code: "CONFLICT",
        message: "操作违反数据关联或业务约束",
      });
    }

    request.log.error(error);
    return reply.code(500).send({
      code: "INTERNAL_ERROR",
      message: "服务器处理请求失败",
    });
  });
}
