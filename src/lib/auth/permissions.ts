import type { Role } from "@prisma/client";
import type { AuthUser } from "./auth";

// Check if user has required role
export function hasRole(userRole: Role, requiredRoles: Role[]): boolean {
  return requiredRoles.includes(userRole);
}

// Check if user can approve up to a certain amount
export function canApprove(user: AuthUser, amount: number): boolean {
  if (user.role === "OWNER" || user.role === "FINANCE") {
    return true;
  }
  if (user.role === "PROJECT_MANAGER" && user.approvalLimit) {
    return amount <= user.approvalLimit;
  }
  return false;
}
