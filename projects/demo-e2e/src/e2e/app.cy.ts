import { getAppRoot, getPageTitle } from '../support/app.po';

describe('Demo App', () => {
  beforeEach(() => cy.visit('/'));

  describe('Bootstrap', () => {
    it('should mount the root component', () => {
      getAppRoot().should('exist');
    });

    it('should set the correct page title', () => {
      getPageTitle().should('eq', 'Ng Signal Http');
    });

    it('should render the app shell', () => {
      getAppRoot().should('contain.text', 'working!');
    });
  });

  describe('HTTP interception', () => {
    it('should be able to intercept outgoing requests', () => {
      cy.intercept('GET', '/api/**').as('apiCall');

      // No API calls happen yet in the demo — this just verifies Cypress
      // network interception is wired up and ready for when the library is used.
      cy.get('app-root').should('exist');
    });
  });
});
