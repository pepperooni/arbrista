export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

export class ValidationError extends DomainError {}
export class NotFoundError extends DomainError {}
export class UnauthorizedError extends DomainError {}
/** An outside service (e.g. plant identification) cannot answer right now. */
export class ServiceUnavailableError extends DomainError {}
