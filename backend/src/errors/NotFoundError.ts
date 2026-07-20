import { AppError } from "./AppError";

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} not found: ${id}` : `${resource} not found`;
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}
