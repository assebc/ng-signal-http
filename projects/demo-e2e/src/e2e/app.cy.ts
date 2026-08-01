import { getAppRoot, getPageTitle } from '../support/app.po';

describe('Bootstrap', () => {
  beforeEach(() => cy.visit('/'));

  it('should mount the root component', () => {
    getAppRoot().should('exist');
  });

  it('should set the correct page title', () => {
    getPageTitle().should('eq', 'Ng Signal Http');
  });

  it('should render nav links', () => {
    getAppRoot().find('a').should('have.length.gte', 2);
  });
});
