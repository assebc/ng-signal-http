describe('Create User — mutationSignal', () => {
  beforeEach(() => {
    cy.intercept('POST', '**/users', { fixture: 'create-user.json' }).as('createUser');
    cy.visit('/users/create');
  });

  it('renders the form with name and email fields', () => {
    cy.get('input#name').should('exist');
    cy.get('input#email').should('exist');
  });

  it('keeps the submit button disabled while fields are empty', () => {
    cy.get('button[type="submit"]').should('be.disabled');
  });

  it('enables submit once both fields are filled', () => {
    cy.get('input#name').type('Alice Smith');
    cy.get('input#email').type('alice@example.com');
    cy.get('button[type="submit"]').should('not.be.disabled');
  });

  it('shows success message with the server-assigned ID after submission', () => {
    cy.get('input#name').type('Alice Smith');
    cy.get('input#email').type('alice@example.com');
    cy.get('button[type="submit"]').click();

    cy.wait('@createUser');
    cy.get('.status-success').should('be.visible');
    cy.get('.status-success').should('contain.text', '11');
    cy.get('.status-success').should('contain.text', 'Alice Smith');
  });

  it('resets state when the Reset button is clicked', () => {
    cy.get('input#name').type('Alice Smith');
    cy.get('input#email').type('alice@example.com');
    cy.get('button[type="submit"]').click();

    cy.wait('@createUser');
    cy.get('.status-success').should('be.visible');
    cy.contains('button', 'Reset').click();
    cy.get('.status-success').should('not.exist');
  });

  it('shows an error message when the API returns an error', () => {
    cy.intercept('POST', '**/users', { statusCode: 422, body: { message: 'Unprocessable Entity' } }).as('createUserFail');

    cy.get('input#name').type('Alice Smith');
    cy.get('input#email').type('alice@example.com');
    cy.get('button[type="submit"]').click();

    cy.wait('@createUserFail');
    cy.get('.status-error').should('be.visible');
  });
});
