describe('Users List — querySignal', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/users', { fixture: 'users.json' }).as('getUsers');
    cy.visit('/users');
  });

  it('shows a loading indicator while the request is in flight', () => {
    cy.intercept('GET', '**/users', (req) => {
      req.reply({ fixture: 'users.json', delay: 300 });
    }).as('getUsersDelayed');

    cy.visit('/users');
    cy.get('.status-loading').should('be.visible');
  });

  it('renders a card for every user returned by the API', () => {
    cy.wait('@getUsers');
    cy.get('.user-card').should('have.length', 3);
  });

  it('displays the user name and email in each card', () => {
    cy.wait('@getUsers');
    cy.get('.user-card').first().within(() => {
      cy.get('.user-name').should('contain.text', 'Leanne Graham');
      cy.get('.user-meta').first().should('contain.text', 'Sincere@april.biz');
    });
  });

  it('shows the loaded count hint', () => {
    cy.wait('@getUsers');
    cy.get('.hint').should('contain.text', '3 users loaded');
  });

  it('shows an error message when the API fails', () => {
    cy.intercept('GET', '**/users', { statusCode: 500, body: 'Internal Server Error' }).as('getUsersFail');
    cy.visit('/users');
    cy.wait('@getUsersFail');
    cy.get('.status-error').should('be.visible');
  });
});
