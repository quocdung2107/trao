import type { PostgrestError } from "@supabase/supabase-js";

// Lỗi do hàm SQL chủ động raise đã có thông điệp tiếng Việt; lỗi khác hiện thông điệp chung.
export function dbErrorMessage(error: PostgrestError | null, fallback = "Đã có lỗi xảy ra. Vui lòng thử lại.") {
  if (!error) return null;
  if (["P0001", "P0002"].includes(error.code)) return error.message;
  if (error.code === "42501") return "Bạn không có quyền thực hiện thao tác này.";
  if (error.code === "23514") return "Dữ liệu chưa hợp lệ.";
  return fallback;
}
