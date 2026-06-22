import { RequestConfig } from '../types';

export type MutationFactory<TInput> = (input: TInput) => RequestConfig;
