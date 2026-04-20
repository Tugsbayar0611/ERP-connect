/**
 * API Error Handler Utility
 * Provides consistent error handling with Mongolian messages
 */

export interface ApiError {
  message: string;
  status?: number;
  field?: string;
}

/**
 * Extract error message from API response
 */
export async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const errorData = await response.json();
      // Try different common error message formats
      return (
        errorData.message ||
        errorData.error ||
        errorData.errorMessage ||
        getStatusMessage(response.status)
      );
    }
  } catch {
    // If JSON parsing fails, return status message
  }
  return getStatusMessage(response.status);
}

/**
 * Get Mongolian message for HTTP status codes
 */
function getStatusMessage(status: number): string {
  const statusMessages: Record<number, string> = {
    400: "Хүсэлт буруу байна",
    401: "Нэвтрэх эрх шаардлагатай",
    403: "Энэ үйлдлийг хийх эрх байхгүй",
    404: "Олдсонгүй",
    409: "Алдаа: Өмнө нь бүртгэгдсэн байна",
    422: "Хүсэлт буруу форматтай байна",
    429: "Хэт олон хүсэлт. Түр хүлээгээд дахин оролдоно уу",
    500: "Серверийн алдаа гарлаа",
    502: "Сервертэй холбогдох боломжгүй",
    503: "Үйлчилгээ түр хугацаанд ажиллахгүй байна",
  };

  return statusMessages[status] || `Алдаа гарлаа (${status})`;
}

/**
 * Handle API error and return user-friendly message
 */
export async function handleApiError(error: unknown): Promise<string> {
  // Network error (no response)
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return "Сүлжээний алдаа. Интернэт холболтоо шалгана уу.";
  }

  // Error with response
  if (error instanceof Response) {
    return await extractErrorMessage(error);
  }

  // Error object with message
  if (error instanceof Error) {
    // Check if it's already a Mongolian message
    if (error.message.includes("алдаа") || error.message.includes("шаардлагатай")) {
      return error.message;
    }

    // Common error messages - translate if needed
    const translations: Record<string, string> = {
      "Failed to fetch": "Сүлжээний алдаа. Интернэт холболтоо шалгана уу.",
      "Invalid credentials": "Нэвтрэх нэр эсвэл  нууц үг буруу байна",
      "Login failed": "Нэвтрэхэд алдаа гарлаа",
      "Failed to fetch user": "Хэрэглэгчийн мэдээлэл авахад алдаа гарлаа",
    };

    return translations[error.message] || error.message;
  }

  // Unknown error
  return "Тодорхойгүй алдаа гарлаа";
}

/**
 * Create a standardized error from response
 */
export async function createApiError(response: Response): Promise<ApiError> {
  const message = await extractErrorMessage(response);
  return {
    message,
    status: response.status,
  };
}
