describe('User Detail — reactive querySignal', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/users/1', { fixture: 'user-1.json' }).as('getUser1');
    cy.intercept('GET', '**/users/2', { fixture: 'user-2.json' }).as('getUser2');
    cy.visit('/users/detail');
  });

  it('fetches and displays the first user on load', () => {
    cy.wait('@getUser1');
    cy.contains('Leanne Graham').should('be.visible');
    cy.contains('Sincere@april.biz').should('be.visible');
  });

  it('shows User #1 in the ID indicator', () => {
    cy.wait('@getUser1');
    cy.get('.user-id').should('contain.text', 'User #1');
  });

  it('refetches when the user ID changes and shows the new user', () => {
    cy.wait('@getUser1');
    cy.contains('button', 'Next').click();
    cy.wait('@getUser2');
    cy.get('.user-id').should('contain.text', 'User #2');
    cy.contains('Ervin Howell').should('be.visible');
    cy.contains('Shanna@melissa.tv').should('be.visible');
  });

  it('disables the Prev button when on user #1', () => {
    cy.wait('@getUser1');
    cy.contains('button', 'Prev').should('be.disabled');
  });

  it('shows a loading state between user transitions', () => {
    cy.intercept('GET', '**/users/2', (req) => {
      req.reply({ fixture: 'user-2.json', delay: 300 });
    }).as('getUser2Delayed');

    cy.wait('@getUser1');
    cy.contains('button', 'Next').click();
    cy.get('.status-loading').should('be.visible');
    cy.wait('@getUser2Delayed');
    cy.get('.status-loading').should('not.exist');
  });
});
