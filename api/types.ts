export type CreateUploadSessionBody = {
  creatorAddress: string
}

export type ApiError = {
  code: string
  message: string
}

export type ApiResponse<T> = {
  data?: T
}

export type ProgressUpdate<T = unknown> =
  | {
    event: 'connect',
    error?: undefined,
    data?: undefined
  }
  | {
    event: 'update',
    error?: null,
    data: T
  }
  | {
    event: 'complete',
    error: null,
    data: T
  }
  | {
    event: 'error',
    error: ApiError,
    data?: undefined
  }

export type SseData = `data: ${string}\n\n`
