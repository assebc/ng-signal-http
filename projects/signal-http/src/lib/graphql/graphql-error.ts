import { GraphQLError } from './graphql.types';

/**
 * Thrown when a GraphQL response contains an `errors` array or is missing `data`.
 * The individual GraphQL errors are available on the `errors` property.
 */
export class GraphQLRequestError extends Error {
  readonly errors: GraphQLError[];

  constructor(errors: GraphQLError[]) {
    super(errors.map(e => e.message).join('; '));
    this.name = 'GraphQLRequestError';
    this.errors = errors;
  }
}
