
    describe('Example Test', () => {
      it('performs UI testing', () => {
        cy.visit('/')
        cy.get('h1').should('have.text', 'Example Domain')
        cy.get('a').should('exist')
        cy.get('a').should('have.attr', 'href', 'https://www.iana.org/domains/example')
        cy.screenshot('homepage')
      })
    })
    