import { Response } from 'express';

interface ApiResponseData {
  success: boolean;
  message: string;
  data?: unknown;
  error?: unknown;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export class ApiResponse {
  static success(res: Response, data: unknown = null, message = 'Success', statusCode = 200) {
    const response: ApiResponseData = {
      success: true,
      message,
      data,
    };
    return res.status(statusCode).json(response);
  }

  static created(res: Response, data: unknown = null, message = 'Created successfully') {
    return ApiResponse.success(res, data, message, 201);
  }

  static paginated(
    res: Response,
    data: unknown,
    meta: { page: number; limit: number; total: number },
    message = 'Success'
  ) {
    const response: ApiResponseData = {
      success: true,
      message,
      data,
      meta: {
        ...meta,
        totalPages: Math.ceil(meta.total / meta.limit),
      },
    };
    return res.status(200).json(response);
  }

  static error(
    res: Response,
    message = 'Internal Server Error',
    statusCode = 500,
    error?: unknown
  ) {
    const response: ApiResponseData = {
      success: false,
      message,
      error: process.env.NODE_ENV === 'development' ? error : undefined,
    };
    return res.status(statusCode).json(response);
  }
}
