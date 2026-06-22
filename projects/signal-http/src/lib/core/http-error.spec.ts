import { HttpError } from './http-error';

describe('HttpError', () => {
  describe('instanceof', () => {
    it('is an instance of Error', () => {
      expect(new HttpError('msg', 400)).toBeInstanceOf(Error);
    });

    it('is an instance of HttpError', () => {
      expect(new HttpError('msg', 400)).toBeInstanceOf(HttpError);
    });
  });

  describe('properties', () => {
    it('sets name to HttpError', () => {
      expect(new HttpError('msg', 400).name).toBe('HttpError');
    });

    it('sets message', () => {
      expect(new HttpError('Not Found', 404).message).toBe('Not Found');
    });

    it('sets status', () => {
      expect(new HttpError('msg', 500).status).toBe(500);
    });

    it('stores response when provided', () => {
      const response = {} as Response;
      expect(new HttpError('msg', 200, response).response).toBe(response);
    });

    it('response is undefined when omitted', () => {
      expect(new HttpError('msg', 404).response).toBeUndefined();
    });
  });

  describe('isClientError', () => {
    it.each([400, 401, 403, 404, 422, 499])('is true for %i', (status) => {
      expect(new HttpError('', status).isClientError).toBe(true);
    });

    it.each([200, 301, 500, 503])('is false for %i', (status) => {
      expect(new HttpError('', status).isClientError).toBe(false);
    });
  });

  describe('isServerError', () => {
    it.each([500, 502, 503, 504])('is true for %i', (status) => {
      expect(new HttpError('', status).isServerError).toBe(true);
    });

    it.each([200, 404, 499])('is false for %i', (status) => {
      expect(new HttpError('', status).isServerError).toBe(false);
    });
  });

  describe('isTimeout', () => {
    it('is true for 408', () => {
      expect(new HttpError('', 408).isTimeout).toBe(true);
    });

    it.each([404, 500, 200])('is false for %i', (status) => {
      expect(new HttpError('', status).isTimeout).toBe(false);
    });
  });

  describe('convenience getters', () => {
    it('isNotFound is true for 404', () => {
      expect(new HttpError('', 404).isNotFound).toBe(true);
    });

    it('isNotFound is false for others', () => {
      expect(new HttpError('', 400).isNotFound).toBe(false);
    });

    it('isUnauthorized is true for 401', () => {
      expect(new HttpError('', 401).isUnauthorized).toBe(true);
    });

    it('isUnauthorized is false for others', () => {
      expect(new HttpError('', 403).isUnauthorized).toBe(false);
    });

    it('isForbidden is true for 403', () => {
      expect(new HttpError('', 403).isForbidden).toBe(true);
    });

    it('isForbidden is false for others', () => {
      expect(new HttpError('', 401).isForbidden).toBe(false);
    });
  });
});
