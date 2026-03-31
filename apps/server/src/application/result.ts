export interface UseCaseSuccess<Success> {
  kind: "ok";
  data: Success;
}

export interface UseCaseError<ErrorCode extends string> {
  kind: "error";
  error: {
    code: ErrorCode;
  };
}

export type UseCaseResult<Success, ErrorCode extends string> =
  | UseCaseSuccess<Success>
  | UseCaseError<ErrorCode>;

export const ok = <Success>(data: Success): UseCaseSuccess<Success> => ({
  kind: "ok",
  data,
});

export const err = <ErrorCode extends string>(
  code: ErrorCode,
): UseCaseError<ErrorCode> => ({
  kind: "error",
  error: {
    code,
  },
});
