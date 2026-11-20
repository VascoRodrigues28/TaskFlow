export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`/api${path}`, { cache: "no-store", ...options });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = typeof body?.detail === "string"
      ? body.detail
      : `A API devolveu o erro ${response.status}.`;
    throw new ApiError(response.status, message);
  }
  return response;
}

export function errorMessage(error: unknown) {
  if (error instanceof TypeError) return "Não foi possível contactar a API.";
  return error instanceof Error ? error.message : "Ocorreu um erro inesperado.";
}
